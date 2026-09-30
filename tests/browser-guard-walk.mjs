import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),{motions,sampleMotion,combatMotionName}=await import('/src/motion.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs');await loadWarriorAssets();const reports=[],directions=[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4,-3*Math.PI/4,-Math.PI/4],players=[];
  for(let hero=0;hero<6;hero++)for(const angle of directions){
   const p=new Warrior(hero),speed=2.3*WARRIORS[hero].speed,dt=1/120,travel=new T.Vector3(Math.sin(angle),0,Math.cos(angle));let maxSupportDrift=0,minimumKneeForward=1,maxLoadedMedial=0,gripGap=0;const holds={},ranges={r:[Infinity,-Infinity],l:[Infinity,-Infinity]};
   const saved=[];for(const[bone,rest]of p.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}p.root.updateMatrixWorld(true);
   const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(p.bones['thigh_'+s],p.bones['calf_'+s],p.bones['foot_'+s])]));
   for(const[bone,position,rotation,scale]of saved){bone.position.copy(position);bone.quaternion.copy(rotation);bone.scale.copy(scale);}
   let nativeLegs=false,hipTwist=0,ankleTwist=0,kneeSidebend=0;
   for(let frame=0;frame<180;frame++){
    p.root.position.addScaledVector(travel,speed*dt);p.update(frame*dt,dt,{blocking:true,moving:true,focused:true,moveAngle:angle,moveSpeed:speed});p.root.updateMatrixWorld(true);if(frame<30)continue;
    for(const [side,offset]of [['r',.25],['l',.75]]){
     if(motions[p.current]?.nativeKneeHeading){nativeLegs=true;const m=measureLegAnatomy(calibration[side],p.bones['thigh_'+side],p.bones['calf_'+side],p.bones['foot_'+side]);hipTwist=Math.max(hipTwist,Math.abs(m.hipTwist));ankleTwist=Math.max(ankleTwist,Math.abs(m.ankleTwist));kneeSidebend=Math.max(kneeSidebend,m.kneeDeviation);}
     const ankle=p.bones['foot_'+side].getWorldPosition(new T.Vector3()),hip=p.bones['thigh_'+side].getWorldPosition(new T.Vector3()),knee=p.bones['calf_'+side].getWorldPosition(new T.Vector3()),phase=(p.guardWalkPhase+offset)%1;
     ranges[side][0]=Math.min(ranges[side][0],ankle.y);ranges[side][1]=Math.max(ranges[side][1],ankle.y);
     const forward=p.bones['ball_'+side].getWorldPosition(new T.Vector3()).sub(ankle).setY(0).normalize(),outward=new T.Vector3(0,1,0).cross(forward).multiplyScalar(side==='l'?1:-1);
     if(phase>.08&&phase<.42){holds[side]??=ankle.clone();maxSupportDrift=Math.max(maxSupportDrift,holds[side].distanceTo(ankle));maxLoadedMedial=Math.max(maxLoadedMedial,-knee.clone().sub(ankle).dot(outward)/p.root.scale.x);}else holds[side]=null;
     // A turned-out knee bends partly sideways. Check its actual shoe heading,
     // not a minimum bend along the scene's fixed Z axis.
     const axis=ankle.clone().sub(hip),bend=knee.sub(hip);bend.addScaledVector(axis,-bend.dot(axis)/axis.lengthSq());minimumKneeForward=Math.min(minimumKneeForward,bend.dot(forward));
    }
    const motion=sampleMotion(p.current,p.actions.get(p.current).time),clip=motions[p.current];if(clip.twoHanded){const direction=new T.Vector3(motion.tip[0]-motion.grip[0],motion.tip[2]-motion.grip[2],motion.grip[1]-motion.tip[1]).normalize(),expected=p.weapon.localToWorld(new T.Vector3(0,p.weapon.userData.primaryGrip,0)).addScaledVector(direction,-clip.gripSpacing*p.root.scale.x),actual=p.bones.hand_l.localToWorld(p.palmGrips.l.clone());gripGap=Math.max(gripGap,expected.distanceTo(actual));}
   }
   const movingClip=p.current;p.update(2,.02,{blocking:true,moving:true,moveAngle:angle,moveSpeed:0});const blockedClip=p.current;
   p.update(2.1,.02,{guardBreak:.4,guardHitToken:1});const broken=p.current;
   const attackName=combatMotionName(WARRIORS[hero],'light',0);p.update(2.12,.02,{guardBreak:.38,action:{token:909,kind:'light',step:0,duration:motions[attackName].duration,time:0}});const attackCancel=p.current;
   p.update(2.14,.02,{guardBreak:0});p.update(2.16,.02,{guardBreak:.4,guardHitToken:2});p.update(2.18,.02,{guardBreak:.38,dodge:true});const dodgeCancel=p.current;
   reports.push({hero:WARRIORS[hero].model,angle,maxSupportDrift,minimumKneeForward,maxLoadedMedial,nativeLegs,hipTwist,ankleTwist,kneeSidebend,gripGap,footLift:Math.min(...Object.values(ranges).map(([lo,hi])=>hi-lo)),movingClip,blockedClip,broken,attackCancel,attackName,dodgeCancel});
   if(hero===0&&directions.indexOf(angle)<4)players.push(p);else p.dispose();
  }
  const scene=new T.Scene();scene.background=new T.Color('#53616b');scene.add(new T.HemisphereLight(0xffffff,0x333943,2.4));const light=new T.DirectionalLight(0xfff1dc,3);light.position.set(2,5,4);scene.add(light);const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#434e50'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);const camera=new T.PerspectiveCamera(32,1600/900,.01,100);camera.position.set(0,2.8,8.5);camera.lookAt(0,1,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,900);document.body.append(renderer.domElement);
  players.forEach((p,i)=>{p.root.position.set((i-1.5)*1.8,0,0);p.mixer.stopAllAction();p.current='';p.oneShot=0;p.wasDodge=false;p.wasGuardBreak=false;scene.add(p.root);});window.__guardWalk={players,directions,scene,camera,renderer};return reports;
 });
 console.log(JSON.stringify(reports,null,2));
 for(const phase of [0,.2,.4,.6]){await page.evaluate(phase=>{const {players,directions,scene,camera,renderer}=window.__guardWalk;players.forEach((p,i)=>{p.guardWalkPhase=phase;p.update(phase,0,{blocking:true,moving:true,focused:true,moveAngle:directions[i],moveSpeed:2.3});p.guardWalkBlend=1;for(const action of p.guardWalkActions||[])action.stopFading();p.update(phase,.001,{blocking:true,moving:true,focused:true,moveAngle:directions[i],moveSpeed:2.3});});renderer.render(scene,camera);},phase);await page.screenshot({path:`/tmp/ninja-guard-walk-${phase}.png`});}
 for(const r of reports){assert.ok(r.maxSupportDrift<.03,JSON.stringify(r));assert.ok(r.minimumKneeForward>0,JSON.stringify(r));if(r.nativeLegs)assert.ok(r.hipTwist<50&&r.ankleTwist<22&&r.kneeSidebend<.1,JSON.stringify(r));else assert.ok(r.maxLoadedMedial<.02,JSON.stringify(r));assert.ok(r.gripGap<.02,JSON.stringify(r));assert.ok(r.footLift>.05,JSON.stringify(r));assert.ok(r.movingClip.includes('_Guard_Walk_'));assert.ok(r.blockedClip.endsWith('_Guard_Loop'));assert.ok(r.broken.endsWith('_Guard_Break'));assert.equal(r.attackCancel,r.attackName);assert.equal(r.dodgeCancel,'Roll');}
}finally{await browser.close();}
