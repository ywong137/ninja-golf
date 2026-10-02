import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,LoopOnce} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {recoveryWeight,solveRecoveryLeg} from '../src/leg-recovery.js';
import {captureLegPole,transportLegPole,blendLegPole,solveLegWithPole} from '../src/leg-pole.js';

const p=b=>b.getWorldPosition(new Vector3());
const q=b=>b.getWorldQuaternion(new Quaternion()).normalize();

test('Knee plane remains defined across a straight-leg limit and an opposite target axis',()=>{
 const pole={axis:new Vector3(0,-1,0),bend:new Vector3(0,0,1)};
 for(const axis of [new Vector3(.000001,-1,0),new Vector3(0,1,0),new Vector3(1,0,0)]){
  const bend=transportLegPole(pole,axis);
  assert.ok(Math.abs(bend.length()-1)<1e-10);
  assert.ok(Math.abs(bend.dot(axis.clone().normalize()))<1e-10);
  const back=transportLegPole({axis:axis.clone().normalize(),bend},pole.axis);
  assert.ok(back.distanceTo(pole.bend)<1e-8);
 }
 const opposite={axis:pole.axis,bend:pole.bend.clone().negate()};
 let previous=pole.bend;const continuity={};
 for(let i=1;i<=240;i++){
  const bend=blendLegPole(pole,opposite,pole.axis,i/240,continuity);
  assert.ok(previous.angleTo(bend)<Math.PI/200,'Plane must rotate continuously, without linear-vector collapse.');
  previous=bend;
 }
 assert.ok(previous.distanceTo(opposite.bend)<1e-10);
});

test('An animated target crossing the opposite knee plane retains its turn direction',()=>{
 const from={axis:new Vector3(0,-1,0),bend:new Vector3(0,0,1)},continuity={};
 let previous=null;
 for(const degrees of [170,179,179.99,180.01,181,190]){
  const to={axis:from.axis,bend:from.bend.clone().applyAxisAngle(from.axis,degrees*Math.PI/180)};
  const bend=blendLegPole(from,to,from.axis,.5,continuity);
  if(previous)assert.ok(previous.angleTo(bend)<.09,'Crossing 180 degrees must not reverse the half-blended knee.');
  previous=bend;
 }
 assert.ok(Math.abs(continuity.angle-190*Math.PI/180)<1e-10);
});

for(const model of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${model}: a small recovery-foot adjustment preserves the actual knee plane`,async()=>{
 const g=await loadNativeSkin(new URL(`../public/models/${model}.glb`,import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 g.scene.position.set(2,.7,-3);g.scene.rotation.set(.02,.67,-.03);g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const clip=g.animations.find(c=>c.name==='Run_Forward'),a=g.mixer.clipAction(clip).setLoop(LoopOnce);a.play();
 for(const phase of [.082,.29,.414,.748,.79,.90])for(const side of ['r','l']){
  a.time=phase*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side];
  solveRecoveryLeg(thigh,calf,foot,p(foot),q(foot),cal[side],recoveryWeight(phase+(side==='l'?.5:0)));
  const before=measureLegAnatomy(cal[side],thigh,calf,foot),pole=captureLegPole(thigh,calf,foot,cal[side].hinge);
  const upper=q(thigh),lower=q(calf),shoe=q(foot),ankle=p(foot),knee=p(calf);
  solveLegWithPole(thigh,calf,foot,ankle,shoe,cal[side].hinge,pole);
  assert.ok(p(calf).distanceTo(knee)<5e-5,'The existing bent-knee position must survive a zero-displacement solve.');
  // Use the same world-frame decomposition tolerance for all three segments.
  assert.ok(q(thigh).angleTo(upper)<.0002&&q(calf).angleTo(lower)<.0002,JSON.stringify({model,side,phase,upperError:q(thigh).angleTo(upper),lowerError:q(calf).angleTo(lower)}));
  const target=ankle.clone().add(new Vector3(.001,.002,.003));
  const error=solveLegWithPole(thigh,calf,foot,target,shoe,cal[side].hinge,pole);
  const after=measureLegAnatomy(cal[side],thigh,calf,foot);
  assert.ok(error<1e-4&&p(foot).distanceTo(target)<1e-4,'Rigid leg must reach the nearby target.');
  assert.ok(q(thigh).angleTo(upper)<.06&&q(calf).angleTo(lower)<.06,JSON.stringify({model,side,phase,before,after}));
  assert.ok(after.kneeDeviation<.01&&after.kneeFlexion>0&&after.kneeFlexion<150);
  assert.ok(Math.abs(after.hipTwist-before.hipTwist)<3&&Math.abs(after.ankleTwist-before.ankleTwist)<3,JSON.stringify({model,side,phase,before,after}));
  // Imported nonuniform bone scales cause about 0.008 degrees of world-frame
  // decomposition error on the female rigs. This limit is 0.012 degrees.
  assert.ok(q(foot).angleTo(shoe)<.0002,JSON.stringify({model,side,phase,shoeErrorDegrees:q(foot).angleTo(shoe)*180/Math.PI}));
 }
});
