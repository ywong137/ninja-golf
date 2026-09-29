import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async({onlyHero,onlyTheme})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{COURSE_SETS,heightAt,ellipse}=await import('/src/course.js'),{courseSurfaceHeight}=await import('/src/terrain.js'),{combatMotionName,motions}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();
  const spots=[[29.3656,176.9803],[2.3435,208.6719],[13.6653,219.8109],[-47.1833,207.1993]],reports=[],stages=[];
  const contacts=(p,ground)=>['r','l'].map(side=>{const state=p.footPlacement.feet[side],foot=p.bones['foot_'+side],q=foot.getWorldQuaternion(new T.Quaternion()),a=foot.getWorldPosition(new T.Vector3());return Math.min(...state.contacts.map(v=>{const point=v.clone().applyQuaternion(q).add(a);return point.y-ground(point.x,point.z)}));});
  for(let hero=0;hero<6;hero++)for(let theme=0;theme<4;theme++){
   if(onlyHero!==null&&hero!==onlyHero||onlyTheme!==null&&theme!==onlyTheme)continue;
   const c=COURSE_SETS[theme].holes[0],[x,z]=spots[theme],ground=(x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse),p=new Warrior(hero);p.root.position.set(x,heightAt(c,x,z),z);
   let maximumSupportError=0,maximumPenetration=0,minimumKnee=1,maximumCorrectionStep=0,gripError=0,recoveryError=0;let previous=[],previousStance=[],previousAnkles=[],previousPelvis=null,worstSupport=null,worstSupportStep=null,worstPelvisStep=null;let maximumSupportStep=0,maximumAnkleStep=0,maximumPelvisStep=0;
   for(const mode of ['idle','guard','run','attack']){
    p.root.position.set(x,heightAt(c,x,z),z);previous=[];previousStance=[];previousAnkles=[];previousPelvis=null;
    for(let f=0;f<120;f++){
     const dt=1/60,speed=mode==='run'?5.6*WARRIORS[hero].speed:0;
     if(speed){p.root.position.z+=speed*dt;p.root.position.y=heightAt(c,p.root.position.x,p.root.position.z);}
     const name=combatMotionName(WARRIORS[hero],'heavy',0),action=mode==='attack'?{kind:'heavy',step:0,token:1000+Math.floor(f/60),time:(f%60)/60*motions[name].duration,duration:motions[name].duration}:null;
     p.update(f*dt,dt,{groundHeight:ground,blocking:mode==='guard',moving:mode==='run',moveSpeed:speed,action});p.root.updateMatrixWorld(true);
     const gaps=contacts(p,ground),report=p.footPlacement.report;if(!report)continue;
     if(f>30){if(previousPelvis!==null&&Math.abs(report.pelvisOffset-previousPelvis)>maximumPelvisStep){maximumPelvisStep=Math.abs(report.pelvisOffset-previousPelvis);worstPelvisStep={mode,f,previous:previousPelvis,current:report.pelvisOffset,wanted:report.pelvisWanted};}previousPelvis=report.pelvisOffset;}
     if(f>30)for(const [i,foot]of report.feet.entries()){
      const ankle=p.bones['foot_'+foot.side].getWorldPosition(new T.Vector3());if(mode==='run'&&foot.stance&&previousStance[i]){// Toe-off raises the ankle while the sole stays in contact. Measure planar
      // sliding separately from the bounded vertical pivot.
      maximumAnkleStep=Math.max(maximumAnkleStep,ankle.distanceTo(previousAnkles[i]));const step=Math.hypot(ankle.x-previousAnkles[i].x,ankle.z-previousAnkles[i].z);if(step>maximumSupportStep){maximumSupportStep=step;worstSupportStep={f,side:foot.side,ankle:ankle.toArray(),previous:previousAnkles[i].toArray(),pelvisOffset:report.pelvisOffset,foot:{...foot}};}}previousAnkles[i]=ankle;previousStance[i]=foot.stance;
      if(foot.stance){const supportError=gaps[i]-(report.preserveAuthored?foot.sourceSoleGap:0);if(Math.abs(supportError)>maximumSupportError){maximumSupportError=Math.abs(supportError);worstSupport={mode,f,side:foot.side,gap:gaps[i],supportError,foot};}maximumPenetration=Math.max(maximumPenetration,-gaps[i]);}
      if(previous[i]!==undefined)maximumCorrectionStep=Math.max(maximumCorrectionStep,Math.abs(foot.offset-previous[i]));previous[i]=foot.offset;
      const side=foot.side,hip=p.bones['thigh_'+side].getWorldPosition(new T.Vector3()),knee=p.bones['calf_'+side].getWorldPosition(new T.Vector3()).sub(hip),axis=p.bones['foot_'+side].getWorldPosition(new T.Vector3()).sub(hip);knee.addScaledVector(axis,-knee.dot(axis)/axis.lengthSq());minimumKnee=Math.min(minimumKnee,knee.length());
      if(foot.lift>.2&&foot.terrainDelta<0)recoveryError=Math.max(recoveryError,Math.abs(foot.offset));
     }
    }
   }
   p.wasDodge=false;p.update(4,1/60,{dodge:true,groundHeight:ground});if(p.footPlacement.report!==null)throw new Error('Roll must release terrain IK');
   p.update(4.1,1/60,{emerging:{progress:.5},groundHeight:ground});if(p.footPlacement.report!==null)throw new Error('Jump must release terrain IK');
   // Golf fixes only the legs. Compare the exact club path before and after terrain correction.
   let golfSupportError=0;
   for(const [name,t]of [['Golf_Address',0],['Golf_Swing',1.4],['Golf_Swing',1.9],['Golf_Putt',22/30]]){
    p.root.position.set(x,heightAt(c,x,z),z);p.footPlacement.restore();p.mixer.stopAllAction();p.current='';p.play(name,0,true);const a=p.actions.get(name);a.time=t;
    for(let f=0;f<90;f++){p.footPlacement.restore();a.time=t;p.mixer.update(0);p.syncHeldObjects(undefined,true);const before=p.club.getWorldPosition(new T.Vector3());p.footPlacement.apply(1/60,ground,{golf:true});p.syncHeldObjects(undefined,true);p.root.updateMatrixWorld(true);gripError=Math.max(gripError,before.distanceTo(p.club.getWorldPosition(new T.Vector3())));}
    const gaps=contacts(p,ground);for(const [i,foot]of p.footPlacement.report.feet.entries())if(foot.stance)golfSupportError=Math.max(golfSupportError,Math.abs(gaps[i]));
   }
   reports.push({hero,theme,maximumSupportError,maximumPenetration,minimumKnee,maximumCorrectionStep,gripError,recoveryError,golfSupportError,maximumAnkleStep,maximumSupportStep,maximumPelvisStep,worstSupport,worstSupportStep,worstPelvisStep});
   if(theme===(onlyTheme??1)){p.root.position.set(x,heightAt(c,x,z),z);stages[hero]={p,c,x,z,ground};}else p.dispose();
  }
  const scene=new T.Scene();scene.background=new T.Color('#73848b');scene.add(new T.HemisphereLight(0xffffff,0x3c453c,2));const light=new T.DirectionalLight(0xffeedc,3);light.position.set(3,5,2);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-3;light.shadow.camera.right=3;light.shadow.camera.top=3;light.shadow.camera.bottom=-3;light.shadow.camera.near=.1;light.shadow.camera.far=20;light.shadow.bias=-.0001;scene.add(light,light.target);const camera=new T.PerspectiveCamera(38,1.5,.01,100),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,1000);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const group=new T.Group();scene.add(group);window.__footStages={stages,scene,camera,renderer,group,light,T};return reports;
 },{onlyHero:process.env.FOOT_HERO!==undefined?Number(process.env.FOOT_HERO):null,onlyTheme:process.env.FOOT_THEME!==undefined?Number(process.env.FOOT_THEME):null});
 console.log(JSON.stringify(reports,null,2));
 if(!process.env.SKIP_FOOT_CAPTURES)for(const hero of (process.env.FOOT_HERO===undefined?[0,1,2,3,4,5]:[Number(process.env.FOOT_HERO)]))for(const mode of ['guard','run','golf','attack'])for(const frame of [0,1,2]){
  await page.evaluate(({hero,mode,frame})=>{const {stages,scene,camera,renderer,group,light,T}=window.__footStages,{p,x,z,ground}=stages[hero];group.clear();group.add(p.root);p.root.position.set(x,ground(x,z),z);p.root.rotation.y=.4;p.oneShot=0;p.mixer.stopAllAction();p.current='';p.running=false;p.guardWalking=false;p.wasSwing=false;
   for(let i=0;i<(mode==='golf'?84+frame*27:mode==='attack'?10+frame*10:50+frame*8);i++)p.update(i/60,1/60,{groundHeight:ground,blocking:mode==='guard',moving:mode==='run',moveSpeed:mode==='run'?5.6:0,golf:mode==='golf',swing:mode==='golf'?1:0,action:mode==='attack'?{kind:'heavy',step:0,token:10000+frame,time:i/60,duration:.76}:null});
   const positions=[],indices=[];for(let row=0;row<=50;row++)for(let col=0;col<=50;col++){const xx=x-3+col*.12,zz=z-3+row*.12;positions.push(xx,ground(xx,zz),zz);}for(let row=0;row<50;row++)for(let col=0;col<50;col++){const a=row*51+col;indices.push(a,a+51,a+1,a+1,a+51,a+52);}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#9a9474',roughness:.95}));mesh.receiveShadow=true;group.add(mesh);light.position.set(x+3,ground(x,z)+5,z+2);light.target.position.set(x,ground(x,z),z);camera.position.set(x+3,ground(x,z)+2.5,z+4);camera.lookAt(x,ground(x,z)+.9,z);renderer.render(scene,camera);}, {hero,mode,frame});await page.screenshot({path:`/tmp/ninja-foot-${hero}-${mode}-${frame}.png`});
 }
 for(const r of reports){assert.ok(r.gripError<1e-6,JSON.stringify(r));assert.ok(r.minimumKnee>.025,JSON.stringify(r));assert.ok(r.maximumPenetration<.005,JSON.stringify(r));assert.ok(r.maximumSupportError<.012,JSON.stringify(r));assert.ok(r.maximumSupportStep<.02,JSON.stringify(r));assert.ok(r.maximumAnkleStep<.04,JSON.stringify(r));assert.ok(r.maximumPelvisStep<.036,JSON.stringify(r));assert.ok(r.recoveryError<1e-5,JSON.stringify(r));assert.ok(r.golfSupportError<.02,JSON.stringify(r));}
}finally{await browser.close();}
