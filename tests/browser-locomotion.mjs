import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async({onlyHero})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js');const {runSupportPoint}=await import('/tools/run-contact-measurement.mjs');await loadWarriorAssets();const reports=[],players=[];
  const cases=[{angle:0,sprint:false,focused:false},{angle:0,sprint:true,focused:false},...[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4,-3*Math.PI/4,-Math.PI/4].map(angle=>({angle,sprint:false,focused:true}))];
  for(let hero=0;hero<6;hero++){if(onlyHero!==null&&hero!==onlyHero)continue;for(const c of cases){
   const p=new Warrior(hero),speed=(c.sprint?8:c.focused?5.3:5.6)*WARRIORS[hero].speed,dt=1/180,travel=new T.Vector3(Math.sin(c.angle),0,Math.cos(c.angle));let maxSupportDrift=0,minimumKnee=1,maxFootPitch=0,minimumToeHipAlignment=1;const holds={},ranges={r:[Infinity,-Infinity],l:[Infinity,-Infinity]},core={hips:[Infinity,-Infinity],relativeChest:[Infinity,-Infinity]};
   for(let frame=0;frame<360;frame++){
    p.root.position.addScaledVector(travel,speed*dt);p.update(frame*dt,dt,{moving:true,sprinting:c.sprint,focused:c.focused,moveAngle:c.angle,moveSpeed:speed,groundHeight:()=>0});p.root.updateMatrixWorld(true);if(frame<60)continue;
    const hipLine=p.bones.thigh_l.getWorldPosition(new T.Vector3()).sub(p.bones.thigh_r.getWorldPosition(new T.Vector3())),shoulderLine=p.bones.upperarm_l.getWorldPosition(new T.Vector3()).sub(p.bones.upperarm_r.getWorldPosition(new T.Vector3()));
    const hipYaw=Math.atan2(hipLine.z,hipLine.x),shoulderYaw=Math.atan2(shoulderLine.z,shoulderLine.x),relativeChest=Math.atan2(Math.sin(shoulderYaw-hipYaw),Math.cos(shoulderYaw-hipYaw));
    for(const [name,value]of [['hips',hipYaw],['relativeChest',relativeChest]]){core[name][0]=Math.min(core[name][0],value);core[name][1]=Math.max(core[name][1],value);}
    for(const [side,offset]of [['r',0],['l',.5]]){
     const ankle=p.bones['foot_'+side].getWorldPosition(new T.Vector3()),hip=p.bones['thigh_'+side].getWorldPosition(new T.Vector3()),knee=p.bones['calf_'+side].getWorldPosition(new T.Vector3()),toe=p.bones['ball_'+side].getWorldPosition(new T.Vector3()),phase=(p.runPhase+offset)%1;
     ranges[side][0]=Math.min(ranges[side][0],ankle.y);ranges[side][1]=Math.max(ranges[side][1],ankle.y);
     const contact=runSupportPoint(p,side);if(contact.loaded){if(holds[side]?.id!==contact.id)holds[side]={id:contact.id,p:contact.point.clone()};maxSupportDrift=Math.max(maxSupportDrift,holds[side].p.distanceTo(contact.point));maxFootPitch=Math.max(maxFootPitch,Math.abs(toe.y-ankle.y));minimumToeHipAlignment=Math.min(minimumToeHipAlignment,toe.clone().sub(ankle).setY(0).normalize().dot(hipLine.clone().setY(0).normalize().cross(new T.Vector3(0,1,0))));}else holds[side]=null;
     // A raised shoe can point downward past vertical; its horizontal toe
     // projection no longer describes knee anatomy. Check this relation only
     // during support; browser-run-recovery measures native hinges throughout.
     if(contact.loaded){const axis=ankle.clone().sub(hip),bend=knee.sub(hip);bend.addScaledVector(axis,-bend.dot(axis)/axis.lengthSq());minimumKnee=Math.min(minimumKnee,bend.dot(toe.clone().sub(ankle).setY(0).normalize()));}
    }
   }
   const movingClip=p.current;p.update(2,.02,{moving:true,moveSpeed:0});const blockedClip=p.current;
   p.update(2.1,.02,{blocking:true,moving:true,moveAngle:0,moveSpeed:2.3});const guardClip=p.current;
   p.update(2.2,.02,{moving:true,moveSpeed:speed});const resumeClip=p.current;
   reports.push({hero:WARRIORS[hero].model,...c,speed,maxSupportDrift,minimumKnee,maxFootPitch,minimumToeHipAlignment,hipYawRange:core.hips[1]-core.hips[0],relativeChestYawRange:core.relativeChest[1]-core.relativeChest[0],footLift:Math.min(...Object.values(ranges).map(([lo,hi])=>hi-lo)),movingClip,blockedClip,guardClip,resumeClip});
   if(hero===(onlyHero??0)&&cases.indexOf(c)<6)players.push({p,c});else p.dispose();
  }}
  const scene=new T.Scene();scene.background=new T.Color('#53616b');scene.add(new T.HemisphereLight(0xffffff,0x333943,2.4));const light=new T.DirectionalLight(0xfff1dc,3);light.position.set(2,5,4);scene.add(light);const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#434e50'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);const camera=new T.PerspectiveCamera(32,1600/900,.01,100);camera.position.set(0,3.1,11.5);camera.lookAt(0,1,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,900);document.body.append(renderer.domElement);
  players.forEach(({p},i)=>{p.root.position.set((i-2.5)*1.5,0,0);p.root.rotation.y=.48;p.mixer.stopAllAction();p.current='';p.oneShot=0;p.running=false;p.guardWalking=false;scene.add(p.root);});window.__locomotion={players,scene,camera,renderer};return reports;
 },{onlyHero:process.env.MOTION_HERO?Number(process.env.MOTION_HERO):null});
 console.log(JSON.stringify(reports,null,2));
 for(let frame=0;frame<12;frame++){await page.evaluate(phase=>{const {players,scene,camera,renderer}=window.__locomotion;players.forEach(({p,c})=>{p.runPhase=phase;p.update(phase,0,{moving:true,sprinting:c.sprint,focused:c.focused,moveAngle:c.angle,moveSpeed:5.6});p.runBlend=1;for(const action of p.runActions)action.stopFading();p.update(phase,0,{moving:true,sprinting:c.sprint,focused:c.focused,moveAngle:c.angle,moveSpeed:5.6});});renderer.render(scene,camera);},frame/12);await page.screenshot({path:`/tmp/ninja-run-${frame}.png`});}
 for(const r of reports){if(!r.sprint&&Math.abs(r.angle)<.001)assert.ok(r.hipYawRange>5*Math.PI/180,JSON.stringify(r));assert.ok(r.maxSupportDrift<.035,JSON.stringify(r));assert.ok(r.minimumKnee>.02,JSON.stringify(r));assert.ok(r.footLift>.08,JSON.stringify(r));assert.ok(r.minimumToeHipAlignment>.65,JSON.stringify(r));assert.ok(r.movingClip.startsWith('Run_')||r.movingClip==='Sprint_Forward');assert.ok(!r.blockedClip.startsWith('Run_'));assert.ok(r.guardClip.includes('_Guard_Walk_'));assert.equal(r.resumeClip,'Run_Forward');}
}finally{await browser.close();}
