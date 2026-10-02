import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FootPlacement} from '../src/foot-placement.js';
import {headingKnee} from '../src/knee-alignment.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';

const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();

for(const model of [...WARRIORS,...ENEMY_APPEARANCES])test(`${model.model}: a released trailing foot cannot pull the pelvis down or move the supporting foot`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+model.model+'.glb',import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>bones[n+'_'+side]))]));
 const placement=new FootPlacement(g.scene,bones),action=g.mixer.clipAction(g.animations.find(c=>['Idle_Loop','Sword_Idle'].includes(c.name))).play();
 for(const freeSide of ['r','l'])for(const hz of [40,120]){
  placement.restore();placement.reset();action.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const targets=Object.fromEntries(['r','l'].map(side=>[side,{p:point(bones['foot_'+side]),q:rotation(bones['foot_'+side])}]));
  const support=freeSide==='r'?'l':'r',ground=()=>0,weights={[support]:1,[freeSide]:0};
  const options={preserveAuthored:true,preserveHinge:true,enforceClearance:true,worldFootTargets:targets,kneeSolver:headingKnee,contactWeights:weights};
  placement.apply(1/hz,ground,options);const baseline=point(bones.pelvis),planted=point(bones['foot_'+support]);
  placement.restore();placement.reset();g.mixer.update(0);g.scene.updateMatrixWorld(true);
  targets[freeSide].p.z-=.6;targets[freeSide].p.y+=.04;
  placement.apply(1/hz,ground,options);
  assert.ok(point(bones.pelvis).distanceTo(baseline)<1e-6,'The airborne target lowered the body');
  assert.ok(point(bones['foot_'+support]).distanceTo(planted)<1e-6,'The free leg changed the supporting contact');
  const report=placement.report.feet.find(f=>f.side===freeSide);
  assert.ok(report.freeTargetCorrection>.01,'The fixture did not exceed free-leg reach');
  assert.ok(report.reachError<1e-6,'The corrected free target remained unreachable');
  assert.ok(point(bones['foot_'+freeSide]).y>=targets[freeSide].p.y,'The reach correction lowered the airborne shoe');
  for(const side of ['r','l']){
   const anatomy=measureLegAnatomy(calibration[side],...['thigh','calf','foot'].map(n=>bones[n+'_'+side]));
   assert.ok(anatomy.kneeFlexion>=0&&anatomy.kneeDeviation<.1,'The correction reversed or twisted the native knee hinge');
  }
  placement.restore();placement.reset();g.mixer.update(0);g.scene.updateMatrixWorld(true);
  placement.pelvisOffset=-.20;
  // Stopping has left the running cycle, but recovery must retain its bound.
  const recoveryTargets=Object.fromEntries(['r','l'].map(side=>[side,{p:point(bones['foot_'+side]),q:rotation(bones['foot_'+side])}]));
  placement.apply(1/hz,ground,{...options,enforceClearance:false,worldFootTargets:recoveryTargets});
  assert.ok(placement.pelvisOffset+.20<=1.5/hz+1e-7,'Stopping released the pelvis into an unbounded upward correction.');
 }
});

test('world foot targets keep exact slope contacts while terrain adjusts the pelvis once',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const placement=new FootPlacement(g.scene,bones),action=g.mixer.clipAction(g.animations.find(c=>c.name==='Idle_Loop')).play();
 for(const slope of [-.12,.12]){
  placement.restore();placement.reset();action.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const ground=(x,z)=>slope*z,targets={};
  for(const side of ['r','l']){
   const p=point(bones['foot_'+side]),q=rotation(bones['foot_'+side]);
   const gap=Math.min(...placement.feet[side].contacts.map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
   p.y-=gap;targets[side]={p,q};
  }
  for(let frame=0;frame<12;frame++){
   placement.restore();g.mixer.update(0);g.scene.updateMatrixWorld(true);const before=point(bones.pelvis);
   placement.apply(1/40,ground,{preserveAuthored:true,preserveHinge:true,worldFootTargets:targets,kneeSolver:headingKnee,contactWeights:{r:1,l:1},stance:{r:true,l:true}});
   for(const side of ['r','l']){
    assert.ok(point(bones['foot_'+side]).distanceTo(targets[side].p)<1e-5,'Terrain reapplied height to an already grounded target');
    assert.ok(rotation(bones['foot_'+side]).angleTo(targets[side].q)<1e-4,'Terrain reapplied tilt to an already oriented shoe');
   }
   assert.ok(Math.abs(point(bones.pelvis).y-before.y-placement.pelvisOffset)<1e-6,'Pelvis reserve must apply exactly once');
  }
 }
});

test('terrain pelvis planning is repeatable and matches the final reserve',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const placement=new FootPlacement(g.scene,bones),action=g.mixer.clipAction(g.animations.find(c=>c.name==='Idle_Loop')).play();
 for(const rate of [40,144])for(const slope of [-.12,0,.12]){
  placement.restore();placement.reset();action.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  // Include recovery from an earlier terrain offset when the ground is flat.
  placement.pelvisOffset=-.0924;
  const ground=(x,z)=>slope*z,targets={};
  for(const side of ['r','l']){
   const p=point(bones['foot_'+side]),q=rotation(bones['foot_'+side]);
   p.y-=Math.min(...placement.feet[side].contacts.map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
   targets[side]={p,q};
  }
  const before=point(bones.pelvis),oldOffset=placement.pelvisOffset,dt=1/rate;
  const plan=placement.planTerrainPelvis(dt,ground,{enforceClearance:true});
  assert.deepEqual(placement.planTerrainPelvis(dt,ground,{enforceClearance:true}),plan,'Preview advanced the smoothing state.');
  assert.equal(placement.pelvisOffset,oldOffset,'Preview changed the saved offset.');
  assert.ok(point(bones.pelvis).equals(before),'Preview moved the skeleton.');
  assert.ok(Math.abs(plan.reserve+Math.abs(slope)*.77)<1e-10,'The reserve did not follow the ground slope.');
  placement.apply(dt,ground,{preserveAuthored:true,enforceClearance:true,worldFootTargets:targets,pelvisPlan:plan,contactWeights:{r:1,l:1},stance:{r:true,l:true}});
  assert.ok(Math.abs(placement.pelvisOffset-plan.offset)<1e-7,'Final placement disagreed with its terrain plan.');
  assert.ok(Math.abs(point(bones.pelvis).y-before.y-plan.offset)<1e-6,'The body did not receive exactly one correction.');
 }
});

for(const model of [...WARRIORS,...ENEMY_APPEARANCES])test(`${model.model}: terrain lowering carries an airborne source leg without compressing it`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+model.model+'.glb',import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const placement=new FootPlacement(g.scene,bones);
 const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>bones[n+'_'+side]))]));
 const clip=g.animations.find(c=>c.name==='Sprint_Loop'),action=g.mixer.clipAction(clip).play();
 const restore=pose=>{placement.restore();placement.reset();for(const [b,p,q]of pose){b.position.copy(p);b.quaternion.copy(q);}g.scene.updateMatrixWorld(true);};
 for(const freeSide of ['r','l']){
  const support=freeSide==='r'?'l':'r',foot=bones['foot_'+freeSide];let best=-Infinity,pose;
  for(let i=0;i<60;i++){
   action.time=clip.duration*i/60;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   const ankle=point(foot),q=rotation(foot),height=Math.min(...placement.feet[freeSide].contacts.map(v=>v.clone().applyQuaternion(q).add(ankle).y));
   if(height>best){best=height;pose=Object.values(bones).map(b=>[b,b.position.clone(),b.quaternion.clone()]);}
  }
  assert.ok(best>.20,'The fixture needs a freely recovering foot');
  for(const slope of [-.1,.1]){
   restore(pose);
   // Match the runtime order: native recovery aligns the hinge before terrain.
   for(const side of ['r','l'])alignLegHinge(...['thigh','calf','foot'].map(n=>bones[n+'_'+side]),calibration[side].hinge);
   const ground=(x,z)=>slope*z,weights={[support]:1,[freeSide]:0};
   const options={preserveAuthored:true,preserveHinge:true,enforceClearance:true,kneeSolver:headingKnee,
    contactWeights:weights,stance:{[support]:true,[freeSide]:false},pelvisPlan:{previousOffset:-.07,reserve:-.07}};
   const hip=point(bones['thigh_'+freeSide]),ankle=point(foot),shoe=rotation(foot);
   const before=measureLegAnatomy(calibration[freeSide],...['thigh','calf','foot'].map(n=>bones[n+'_'+freeSide]));
   placement.apply(1/60,ground,options);
   const after=measureLegAnatomy(calibration[freeSide],...['thigh','calf','foot'].map(n=>bones[n+'_'+freeSide]));
   const report=placement.report.feet.find(f=>f.side===freeSide);
   assert.ok(placement.pelvisOffset<-.03,'The fixture did not lower the body');
   assert.ok(Math.abs(report.freePelvisShift-placement.pelvisOffset)<1e-6,'The free foot did not follow the body');
   assert.ok(point(foot).sub(point(bones['thigh_'+freeSide])).distanceTo(ankle.sub(hip))<1e-5,'Terrain compressed the recovering leg');
   assert.ok(Math.abs(after.kneeFlexion-before.kneeFlexion)<.01,'Terrain changed the free knee bend');
   assert.ok(rotation(foot).angleTo(shoe)<1e-4,`Terrain rotated an airborne shoe by ${rotation(foot).angleTo(shoe)} radians`);
   const planted=point(bones['foot_'+support]);
   assert.equal(placement.report.feet.find(f=>f.side===support).freePelvisShift,0,'The support moved with the pelvis');
   for(const side of ['r','l']){
    const p=point(bones['foot_'+side]),q=rotation(bones['foot_'+side]);
    const gap=Math.min(...placement.feet[side].contacts.map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
    assert.ok(gap>-.00001,'The carried shoe penetrated the ground');
   }
   // An explicit airborne trajectory belongs to its planner. It must stay in
   // world space while the other foot keeps exactly the same support.
   restore(pose);
   for(const side of ['r','l'])alignLegHinge(...['thigh','calf','foot'].map(n=>bones[n+'_'+side]),calibration[side].hinge);
   const targets=Object.fromEntries(['r','l'].map(side=>[side,{p:point(bones['foot_'+side]),q:rotation(bones['foot_'+side])}]));
   targets[support].p.copy(planted);
   placement.apply(1/60,ground,{...options,worldFootTargets:targets});
   assert.equal(placement.report.feet.find(f=>f.side===freeSide).freePelvisShift,0,'Terrain overrode an explicit airborne trajectory');
   assert.ok(point(foot).distanceTo(targets[freeSide].p)<1e-5,'The explicit free target moved with the body');
   assert.ok(point(bones['foot_'+support]).distanceTo(planted)<1e-5,'The airborne correction changed support');
  }
  placement.restore();placement.reset();
 }
});
