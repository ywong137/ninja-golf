import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegHinge} from '../src/leg-hinge.js';
import {STRAFE_PROFILE as profile,STRAFE_VERSION} from '../tools/strafe-profile.mjs';
const degrees=180/Math.PI;
const gaits=JSON.parse(fs.readFileSync(new URL('../src/locomotion-data.json',import.meta.url)));
for(const model of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${model}: lateral running preserves human leg frames and continuous support`,async t=>{
 const file=new URL('../public/models/'+model+'.glb',import.meta.url),g=await loadNativeSkin(file);
 const raw=fs.readFileSync(file),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
 const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const rest=Object.fromEntries(['r','l'].map(s=>[s,{
  hinge:calibrateLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]),
  parent:rotation(bones['thigh_'+s].parent.name),thigh:rotation('thigh_'+s),footInCalf:rotation('calf_'+s).invert().multiply(rotation('foot_'+s)),
  upper:point('calf_'+s).sub(point('thigh_'+s)).normalize(),
  thighLength:point('thigh_'+s).distanceTo(point('calf_'+s)),calfLength:point('calf_'+s).distanceTo(point('foot_'+s)),
 }]));
 for(const [name,direction]of [['Run_Right',1],['Run_Left',-1]]){
  assert.equal(doc.animations.find(a=>a.name===name).extras.nativeStrafeVersion,STRAFE_VERSION);
  for(const key of ['duration','support','amplitude','width','lift'])assert.equal(gaits[name][key],profile[key],`${name} playback metadata ${key}`);
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
  const worst={hinge:0,hipTwist:0,ankleTwist:0,kneeSpeed:0,footSpeed:0,lengthError:0,supportDrift:0,seam:0},range={flexion:[180,0],loadedFlexion:0,hipAbduction:0,ankleSeparation:Infinity};
  const previous={},held={},first={},ys=[];
  const frames=336,dt=profile.duration/frames;
  for(let i=0;i<=frames;i++){
   const time=i*dt;a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);ys.push(point('pelvis').y);
   range.ankleSeparation=Math.min(range.ankleSeparation,point('foot_l').distanceTo(point('foot_r')));
   for(const s of ['r','l']){
    const hip=point('thigh_'+s),knee=point('calf_'+s),foot=point('foot_'+s),r=rest[s],q=rotation('thigh_'+s);
    const u=knee.clone().sub(hip).normalize(),v=foot.clone().sub(knee).normalize(),h=r.hinge.hingeInThigh.clone().applyQuaternion(q);
    worst.hinge=Math.max(worst.hinge,Math.asin(Math.min(1,Math.abs(h.dot(v))))*degrees);
    const flex=Math.atan2(h.dot(u.clone().cross(v)),u.dot(v))*degrees;
    range.flexion[0]=Math.min(range.flexion[0],flex);range.flexion[1]=Math.max(range.flexion[1],flex);
    const parent=rotation(bones['thigh_'+s].parent.name),inBody=u.clone().applyQuaternion(parent.clone().invert()).applyQuaternion(r.parent);
    range.hipAbduction=Math.max(range.hipAbduction,Math.abs(Math.asin(inBody.x))*degrees);
    const reference=parent.clone().multiply(r.parent.clone().invert()).multiply(r.thigh);
    const nativeU=r.upper.clone().applyQuaternion(r.thigh.clone().invert()).applyQuaternion(reference);
    const minimum=new T.Quaternion().setFromUnitVectors(nativeU,u).multiply(reference),delta=q.clone().multiply(minimum.invert());
    const angle=2*Math.atan2(delta.x*u.x+delta.y*u.y+delta.z*u.z,delta.w);
    worst.hipTwist=Math.max(worst.hipTwist,Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))*degrees);
    const expectedFoot=rotation('calf_'+s).multiply(r.footInCalf),ankleDelta=rotation('foot_'+s).multiply(expectedFoot.invert());
    const ankleAngle=2*Math.atan2(ankleDelta.x*v.x+ankleDelta.y*v.y+ankleDelta.z*v.z,ankleDelta.w);
    worst.ankleTwist=Math.max(worst.ankleTwist,Math.abs(Math.atan2(Math.sin(ankleAngle),Math.cos(ankleAngle)))*degrees);
    worst.lengthError=Math.max(worst.lengthError,Math.abs(hip.distanceTo(knee)-r.thighLength),Math.abs(knee.distanceTo(foot)-r.calfLength));
    if(previous[s]){worst.kneeSpeed=Math.max(worst.kneeSpeed,knee.distanceTo(previous[s].knee)/dt);worst.footSpeed=Math.max(worst.footSpeed,foot.distanceTo(previous[s].foot)/dt);}
    previous[s]={knee,foot};first[s]??={knee:knee.clone(),foot:foot.clone()};
    if(i===frames)worst.seam=Math.max(worst.seam,knee.distanceTo(first[s].knee),foot.distanceTo(first[s].foot));
    const phase=(time/profile.duration+(s==='l'?.5:0))%1;
    if(phase<profile.support)range.loadedFlexion=Math.max(range.loadedFlexion,flex);
    if(phase>.08&&phase<profile.support-.08){
     const world=foot.clone().add(new T.Vector3(direction*2*profile.amplitude/(profile.support*profile.duration)*time,0,0));
     held[s]??=world.clone();worst.supportDrift=Math.max(worst.supportDrift,world.distanceTo(held[s]));
    }else held[s]=null;
   }
  }
  let maxDropAcceleration=0;
  for(let i=8;i<ys.length-8;i++)maxDropAcceleration=Math.max(maxDropAcceleration,-(ys[i+8]-2*ys[i]+ys[i-8])/(8*dt)**2);
  t.diagnostic(JSON.stringify({model,name,...worst,...range,maxDropAcceleration}));
  assert.ok(worst.hinge<.01,'Knee bends sideways through its native skin frame');
  assert.ok(worst.hipTwist<15,'Knee correction transfers excessive twist to the hip');
  assert.ok(worst.ankleTwist<10,'Knee correction twists the ankle');
  assert.ok(range.hipAbduction<30,'Sideways stride spreads the thighs too far');
  assert.ok(range.flexion[0]>10&&range.flexion[1]<135,'Knee locks, reverses, or folds too tightly');
  assert.ok(range.loadedFlexion<80,'Loaded leg crouches too deeply');
  assert.ok(range.ankleSeparation>.25,'Recovery feet converge');
  // Imported nonuniform scales leave less than 0.1mm numerical residual.
  assert.ok(worst.lengthError<.0001,'Native leg lengths change');
  assert.ok(worst.kneeSpeed<5&&worst.footSpeed<4,'Foot lift or knee plane jumps');
  assert.ok(worst.supportDrift<.001,'Planted foot slides at the reference playback speed');
  assert.ok(worst.seam<.001,'Loop does not close');
  assert.ok(maxDropAcceleration<4,'Pelvis drops abruptly');
 }
});
