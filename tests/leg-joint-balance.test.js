import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FootPlacement} from '../src/foot-placement.js';
import {calibrateLegAnatomy} from '../src/leg-anatomy.js';
import {captureLegPole,solveLegWithPole} from '../src/leg-pole.js';
import {balanceLegJoints,LegJointBalance} from '../src/leg-joint-balance.js';
import {alignLegHinge} from '../src/leg-hinge.js';

const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const violation=a=>Math.max(0,Math.abs(a.hipTwist)-27.5)**2+Math.max(0,Math.abs(a.ankleTwist)-17.5)**2;

async function fixture(model,clipName='Run_Forward'){
 const g=await loadNativeSkin(new URL(`../public/models/${model}.glb`,import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 g.scene.position.set(2,.4,-3);g.scene.rotation.y=.67;g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const placement=new FootPlacement(g.scene,bones);
 const calibrations=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const clip=g.animations.find(c=>c.name===clipName),action=g.mixer.clipAction(clip).play();
 const pose=phase=>{action.time=phase*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);};
 const leg=side=>({thigh:bones['thigh_'+side],calf:bones['calf_'+side],foot:bones['foot_'+side],calibration:calibrations[side],contacts:placement.feet[side].contacts});
 return{g,pose,leg,bones,calibrations,placement};
}

for(const model of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${model}: twist correction retains supporting shoes and a forward knee hinge`,async()=>{
 const f=await fixture(model);let changed=0;
 for(const phase of [.1,.25,.4,.7]){
  f.pose(phase);
  for(const side of ['r','l']){
   const leg=f.leg(side),{thigh,calf,foot,calibration}=leg;
   const saved=[thigh,calf,foot].map(b=>b.quaternion.clone());
   for(const turn of [-24,24]){
    [thigh,calf,foot].forEach((b,i)=>b.quaternion.copy(saved[i]));thigh.updateWorldMatrix(true,true);
    const target=point(foot),shoe=rotation(foot),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
    pole.bend.applyAxisAngle(pole.axis,turn*Math.PI/180);
    solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,pole);
    const beforePosition=point(foot),beforeRotation=rotation(foot);
    const result=balanceLegJoints({...leg,supported:true,groundHeight:()=>-5});
    const detail=JSON.stringify({model,phase,side,turn,result});
    assert.ok(point(foot).distanceTo(beforePosition)<5e-5,detail);
    assert.ok(rotation(foot).angleTo(beforeRotation)<.0003,detail);
    assert.ok(result.after.kneeDeviation<.03&&result.after.kneeFlexion>=0&&result.after.kneeFlexion<150,detail);
    assert.ok(violation(result.after)<=violation(result.before)+.01,detail);
    assert.ok(result.shoeDegrees===0,'A supporting shoe cannot relax its orientation.');
    changed+=Math.abs(result.planeDegrees)>1e-3?1:0;
   }
  }
 }
 assert.ok(changed>0,'The test must include poses that actually require correction.');
});

test('airborne ankle relaxation respects terrain clearance and cannot move the ankle target',async()=>{
 const f=await fixture('ronin');let corrections=0;
 for(const side of ['r','l'])for(const phase of [.1,.25,.4,.7]){
  f.pose(phase);const leg=f.leg(side),{thigh,calf,foot,calibration,contacts}=leg;
  const target=point(foot),shoe=rotation(foot),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
  pole.bend.applyAxisAngle(pole.axis,24*Math.PI/180);
  solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,pole);
  const saved=[thigh,calf,foot].map(b=>b.quaternion.clone());
  for(const clearance of [0,.024,.06,.3]){
   [thigh,calf,foot].forEach((b,i)=>b.quaternion.copy(saved[i]));thigh.updateWorldMatrix(true,true);
   const beforePosition=point(foot),beforeRotation=rotation(foot),slope=.12;
   const low=Math.min(...contacts.map(v=>{const p=v.clone().applyQuaternion(beforeRotation).add(beforePosition);return p.y-slope*p.z;}));
   const groundHeight=(x,z)=>slope*z+low-clearance;
   const result=balanceLegJoints({...leg,supported:false,groundHeight});
   const detail=JSON.stringify({side,phase,clearance,result});
   assert.ok(point(foot).distanceTo(beforePosition)<5e-5,detail);
   assert.ok(result.minimumGap>=Math.min(.005,clearance)-1e-5,detail);
   assert.ok(Math.abs(result.shoeDegrees)<=6+1e-8,detail);
   if(clearance<.025)assert.ok(result.shoeDegrees===0,'A shoe near the surface cannot rotate as an airborne shoe.');
   corrections+=Math.abs(result.shoeDegrees)>1e-3?1:0;
  }
 }
 assert.ok(corrections>0,'The test must exercise the free-shoe correction.');
});

test('an acceptable leg pose remains unchanged',async()=>{
 const f=await fixture('ronin');f.pose(.1);const leg=f.leg('r');
 const saved=[leg.thigh,leg.calf,leg.foot].map(b=>b.quaternion.clone());
 const result=balanceLegJoints({...leg,supported:true,groundHeight:()=>-5});
 assert.equal(result.evaluations,0);assert.equal(result.planeDegrees,0);assert.equal(result.shoeDegrees,0);
 [leg.thigh,leg.calf,leg.foot].forEach((b,i)=>assert.ok(b.quaternion.angleTo(saved[i])<1e-7));
});

test('the knee approaches the loaded pose before the shoe lands',async()=>{
 const f=await fixture('ronin');f.pose(.7);const leg=f.leg('r'),{thigh,calf,foot,calibration,contacts}=leg;
 const target=point(foot),shoe=rotation(foot),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
 pole.bend.applyAxisAngle(pole.axis,16*Math.PI/180);
 solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,pole);
 const saved=[thigh,calf,foot].map(b=>b.quaternion.clone()),rootY=f.g.scene.position.y,state={};
 const floor=Math.min(...contacts.map(v=>v.clone().applyQuaternion(rotation(foot)).add(point(foot)).y))-.15;
 let previous=null,maximumStep=0,last;
 // The source leg keeps the same bend while its ankle descends at 0.5 m/s.
 // Contact becomes true only at touchdown. A binary limit change would turn
 // the knee abruptly despite the smooth incoming trajectory.
 for(let i=0;i<=54;i++){
  [thigh,calf,foot].forEach((b,j)=>b.quaternion.copy(saved[j]));
  const clearance=Math.max(0,.15-i/144*.5);
  f.g.scene.position.y=rootY-.15+clearance;f.g.scene.updateMatrixWorld(true);
  last=balanceLegJoints({...leg,supported:clearance===0,groundHeight:()=>floor,state});
  const current=captureLegPole(thigh,calf,foot,calibration.hinge);
  if(previous)maximumStep=Math.max(maximumStep,current.bend.angleTo(previous.bend)*180/Math.PI);
  previous=current;
 }
 assert.ok(maximumStep<.6,`Knee plane changed ${maximumStep} degrees in one 144 Hz frame.`);
 assert.ok(Math.abs(last.after.hipTwist)<27.6,'The landed pose must satisfy the supporting hip bound.');
 assert.ok(last.targetError<5e-5&&last.shoeError<.015,'The final supporting shoe must stay fixed.');
});

test('a small airborne ankle correction does not delay an otherwise acceptable knee',async()=>{
 const f=await fixture('ronin');f.pose(.1);const leg=f.leg('r'),{thigh,calf,foot,calibration}=leg;
 alignLegHinge(thigh,calf,foot,calibration.hinge);
 // Construct the intended ankle-only error directly. A particular running
 // knee pose can change when source motion improves; it is not the contract.
 const axis=point(foot).sub(point(calf)).normalize();
 const neutral=rotation(calf).multiply(calibration.footInCalf);
 const shoe=new Quaternion().setFromAxisAngle(axis,20*Math.PI/180).multiply(neutral);
 foot.quaternion.copy(rotation(foot.parent).invert().multiply(shoe)).normalize();foot.updateWorldMatrix(false,true);
 const previous=captureLegPole(thigh,calf,foot,calibration.hinge);
 previous.bend.applyAxisAngle(previous.axis,10*Math.PI/180);
 const result=balanceLegJoints({...leg,supported:false,groundHeight:()=>-5,state:{pole:previous}});
 assert.ok(Math.abs(result.before.ankleTwist)>17.5,'This pose must require an ankle correction.');
 assert.ok(Math.abs(result.shoeDegrees)>0,'The shoe correction must run.');
 assert.equal(result.evaluations,0,'Free ankle motion already resolves the excess; a knee search adds unnecessary lag.');
 assert.equal(result.planeDegrees,0);
 assert.ok(Math.abs(result.after.ankleTwist)<17.501);
});

test('a fading landing contact cannot switch ankle freedom in one frame',async()=>{
 const f=await fixture('ronin');f.pose(.1);const leg=f.leg('r'),{thigh,calf,foot,calibration}=leg;
 alignLegHinge(thigh,calf,foot,calibration.hinge);
 const axis=point(foot).sub(point(calf)).normalize(),neutral=rotation(calf).multiply(calibration.footInCalf);
 const shoe=new Quaternion().setFromAxisAngle(axis,20*Math.PI/180).multiply(neutral);
 foot.quaternion.copy(rotation(foot.parent).invert().multiply(shoe));foot.updateWorldMatrix(false,true);
 const saved=Object.values(f.bones).map(b=>[b,b.quaternion.clone()]);
 const balance=new LegJointBalance(f.bones,f.calibrations,f.placement.feet),owner={};
 const samples=[];
 for(const weight of [.049999,.050001]){
  for(const [b,q]of saved)b.quaternion.copy(q);f.g.scene.updateMatrixWorld(true);
  balance.apply(owner,{r:weight,l:weight},()=>-5);
  samples.push({shoe:rotation(foot),knee:captureLegPole(thigh,calf,foot,calibration.hinge).bend});
 }
 assert.ok(samples[0].shoe.angleTo(samples[1].shoe)<.001,'Landing pressure caused an abrupt ankle correction');
 assert.ok(samples[0].knee.angleTo(samples[1].knee)<.001,'Landing pressure caused an abrupt knee turn');
 assert.throws(()=>balanceLegJoints({...leg,supported:false,supportWeight:NaN,groundHeight:()=>-5}),/support weight/);
});

test('a smooth leg trajectory retains smooth knee correction as sampling increases',async()=>{
 const f=await fixture('ronin');f.pose(.7);
 const leg=f.leg('r'),{thigh,calf,foot,calibration}=leg;
 const saved=[thigh,calf,foot].map(b=>b.quaternion.clone()),target=point(foot),shoe=rotation(foot);
 const source=captureLegPole(thigh,calf,foot,calibration.hinge),rootYaw=f.g.scene.rotation.y,peaks=[];
 for(const samples of [240,960]){
  let previous=null,peak=0,changed=0;
  for(let i=0;i<=samples;i++){
   [thigh,calf,foot].forEach((b,j)=>b.quaternion.copy(saved[j]));
   // A small body turn keeps the corrected output moving while the shoe holds.
   f.g.scene.rotation.y=rootYaw+.04*Math.sin(2*Math.PI*i/samples);f.g.scene.updateMatrixWorld(true);
   const degrees=-32+10*Math.sin(2*Math.PI*i/samples);
   solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,
    {axis:source.axis,bend:source.bend.clone().applyAxisAngle(source.axis,degrees*Math.PI/180)});
   const result=balanceLegJoints({...leg,supported:true,groundHeight:()=>-5});
   changed+=Math.abs(result.planeDegrees)>.001?1:0;
   const bend=captureLegPole(thigh,calf,foot,calibration.hinge).bend;
   if(previous)peak=Math.max(peak,bend.angleTo(previous)*samples);
   previous=bend;
  }
  assert.ok(changed>samples/2,'The trajectory must exercise knee correction.');peaks.push(peak);
 }
 assert.ok(peaks[1]<peaks[0]*1.15,`Knee correction gains speed at finer sampling: ${peaks}`);
});

test('a held shoe can resolve ankle twist beyond the first local search bracket',async()=>{
 // Retain the original regression posture; the new forward capture has a
 // different knee angle and cannot reproduce this injected-twist fixture.
 const f=await fixture('ronin','Run_Directional_Forward');f.pose(.1);
 const leg=f.leg('r'),{thigh,calf,foot,calibration}=leg;
 alignLegHinge(thigh,calf,foot,calibration.hinge);
 const axis=point(foot).sub(point(calf)).normalize(),neutral=rotation(calf).multiply(calibration.footInCalf);
 const shoe=new Quaternion().setFromAxisAngle(axis,46*Math.PI/180).multiply(neutral);
 foot.quaternion.copy(rotation(foot.parent).invert().multiply(shoe));foot.updateWorldMatrix(false,true);
 const target=point(foot),result=balanceLegJoints({...leg,supported:true,groundHeight:()=>-5});
 assert.ok(Math.abs(result.planeDegrees)>24,'This case must exceed the original search bracket.');
 assert.ok(Math.abs(result.after.ankleTwist)<20,JSON.stringify(result));
 assert.ok(Math.abs(result.after.hipTwist)<35,JSON.stringify(result));
 assert.ok(result.after.kneeDeviation<.01&&result.after.kneeFlexion>=0,JSON.stringify(result));
 assert.ok(point(foot).distanceTo(target)<5e-5&&rotation(foot).angleTo(shoe)<.0003,'The supporting shoe must remain fixed.');
});
