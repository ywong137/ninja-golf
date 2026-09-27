import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();const {ATTACKS}=await import('/src/combat.js');const reports=[];
  const owned=['REye','LEye','MJaw','RInnerEyebrow','LInnerEyebrow'];
  const delta=(a,b)=>{let angle=0,distance=0;for(const name of owned){const x=a.bones['Bip01_'+name],y=b.bones['Bip01_'+name];angle=Math.max(angle,2*Math.min(Math.hypot(x.quaternion.x-y.quaternion.x,x.quaternion.y-y.quaternion.y,x.quaternion.z-y.quaternion.z,x.quaternion.w-y.quaternion.w),Math.hypot(x.quaternion.x+y.quaternion.x,x.quaternion.y+y.quaternion.y,x.quaternion.z+y.quaternion.z,x.quaternion.w+y.quaternion.w)));distance=Math.max(distance,x.position.distanceTo(y.position));}return {angle,distance};};
  for(let hero=0;hero<6;hero++){
   const p=new Warrior(hero),control=new Warrior(hero);if(!p.facialPose)throw Error(`Hero ${hero} has no facial overlay`);control.facialPose=null;
   let gazeError=0,restError=0,maxAngle=0;const target=new T.Vector3();
   for(let frame=0;frame<180;frame++){
    control.update(frame/60,1/60,{selection:true});control.root.updateMatrixWorld(true);const eye=control.bones.Bip01_REye,q=eye.getWorldQuaternion(new T.Quaternion()),origin=eye.getWorldPosition(new T.Vector3());
    const direction=new T.Vector3(Math.cos(.02)*Math.cos(.04),-Math.sin(.02),Math.cos(.02)*Math.sin(.04)).applyQuaternion(q);target.copy(origin).addScaledVector(direction,2);
    p.update(frame/60,1/60,{selection:true,gazeTarget:target});p.root.updateMatrixWorld(true);
    const actual=new T.Vector3(1,0,0).applyQuaternion(p.bones.Bip01_REye.getWorldQuaternion(new T.Quaternion()));if(frame>120){gazeError=Math.max(gazeError,actual.angleTo(direction));restError=Math.max(restError,new T.Vector3(1,0,0).applyQuaternion(q).angleTo(direction));}maxAngle=Math.max(maxAngle,delta(p,control).angle);
   }
   const disabled=[];
   for(const [name,flags]of [['golf',{golf:true}],['dodge',{dodge:true}],['emerging',{emerging:{progress:.2}}],['death',{}]]){
    if(name==='death'){p.dead=control.dead=1;}p.update(4,1/60,{...flags,gazeTarget:target});control.update(4,1/60,flags);disabled.push({name,...delta(p,control),applied:p.facialPose.applied});
   }
   p.dispose();control.dispose();
   const active=new Warrior(hero),base=new Warrior(hero);base.facialPose=null;let effortJaw=0,musouJaw=0,browDistance=0,attackBrowDistance=0;
   for(let frame=0;frame<120;frame++)for(const actor of [active,base])actor.update(frame/60,1/60,{moving:true,moveSpeed:5.6});
   effortJaw=active.bones.Bip01_MJaw.quaternion.angleTo(base.bones.Bip01_MJaw.quaternion);
   for(let frame=0;frame<120;frame++)for(const actor of [active,base])actor.update(3+frame/60,1/60,{cinematic:true});
   musouJaw=active.bones.Bip01_MJaw.quaternion.angleTo(base.bones.Bip01_MJaw.quaternion);browDistance=active.bones.Bip01_RInnerEyebrow.position.distanceTo(base.bones.Bip01_RInnerEyebrow.position);
   for(let frame=0;frame<120;frame++)for(const actor of [active,base])actor.update(6+frame/60,1/60,{action:{kind:'musou',step:0,token:777,time:frame/60,duration:ATTACKS.musou.duration}});attackBrowDistance=active.bones.Bip01_RInnerEyebrow.position.distanceTo(base.bones.Bip01_RInnerEyebrow.position);
   reports.push({hero,gazeError,restError,maxAngle,disabled,effortJaw,musouJaw,browDistance,attackBrowDistance});active.dispose();base.dispose();
  }
  const enemyOverlays=[];for(let type=0;type<4;type++){const enemy=new Warrior(type,true);enemyOverlays.push(Boolean(enemy.facialPose));enemy.dispose();}return {reports,enemyOverlays};
 });
 for(const r of reports.reports){assert.ok(r.gazeError<.003,JSON.stringify(r));assert.ok(r.gazeError<r.restError*.1);assert.ok(r.maxAngle<.08,'Overlay accumulated beyond the gaze limits');for(const state of r.disabled){assert.ok(state.angle<1e-6&&state.distance<1e-10,JSON.stringify({hero:r.hero,...state}));assert.equal(state.applied,false);}assert.ok(r.effortJaw>.001&&r.effortJaw<=Math.PI/180+.00001,JSON.stringify(r));assert.ok(r.musouJaw<=Math.PI/180+.00001);assert.ok(r.browDistance>.0001&&r.browDistance<=.000301,JSON.stringify(r));assert.ok(r.attackBrowDistance>.0001&&r.attackBrowDistance<=.000301,JSON.stringify(r));}
 assert.deepEqual(reports.enemyOverlays,[false,false,false,false]);assert.deepEqual(errors,[]);console.log(JSON.stringify(reports,null,2));console.log('Actual actor facial integration passed for all six heroes and four enemy classes.');
}finally{await browser.close();}
