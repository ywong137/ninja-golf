import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {WARRIORS} from '../src/warriors.js';
import {attackFootContacts} from '../src/foot-placement.js';
import {createWeapon} from '../src/weapons.js';
import {headSurfaceMetadata,measureTriangleHeadClearance} from '../tools/blade-head-surface.mjs';

const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const hero=WARRIORS.find(h=>h.model==='ayame'),name=hero.motionOverrides.Ring_Cut_Diagonal,record=motions[name];
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).ayame.sword.r;
async function load(){
 const rig=await loadNativeSkin(new URL('../public/models/ayame.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 return {rig,bones};
}
function play(rig,name){
 rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===name);assert.ok(clip);
 const action=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 return time=>{action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
}

test('the Hustler opening cut has one supported damage contact and a complete recovery',()=>{
 assert.equal(name,'Hustler_Diagonal_Cut');assert.ok(record.nativeSourceMotion&&record.nativeAttachment);
 const attack=withMotionTiming(attackDefinition('light',0,hero.combatStyle),record);
 assert.equal(attack.hits.length,1);assert.ok(attack.hits[0]>.18&&attack.hits[0]<.3);
 assert.equal(attack.duration,record.combatDuration);
 assert.ok(record.duration-record.impacts[0]>.8,'Keep the authored recovery.');
 const contact=attackFootContacts(record,record.impacts[0],{footR:[0,0,1],footL:[0,0,1]});
 assert.ok(contact.stance.l,'The lunge must have a supporting foot at contact.');
});

test('the source sabre cut moves the complete body without flipped joints or a twisted sword wrist',async t=>{
 const {rig,bones}=await load();
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const wrist=calibrateWristAnatomy(captureWristPose(bones,'r')),sample=play(rig,name);
 const point=n=>bones[n].getWorldPosition(new Vector3());let initialFoot,initialChest,step=0,turn=0,minHip=Infinity,maxHip=-Infinity,maxWrist=0,maxJointStep=0,previous;
 for(let i=0;i<=Math.ceil(record.duration*240);i++){
  sample(Math.min(i/240,record.duration));
  const foot=point('foot_l'),chest=bones.spine_03.getWorldQuaternion(new Quaternion()).normalize();initialFoot??=foot.clone();initialChest??=chest.clone();
  step=Math.max(step,foot.distanceTo(initialFoot));turn=Math.max(turn,chest.angleTo(initialChest));minHip=Math.min(minHip,point('pelvis').y);maxHip=Math.max(maxHip,point('pelvis').y);
  const current={};
  for(const side of ['r','l']){
   const arm=measureArmAnatomy(arms[side],captureArmPose(bones,side)),leg=measureLegAnatomy(legs[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1,JSON.stringify(arm));
   assert.ok(Math.abs(arm.forearmTwistDegrees)<40,JSON.stringify(arm));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<130&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+side;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
  }
  previous=current;maxWrist=Math.max(maxWrist,measureWristAnatomy(wrist,captureWristPose(bones,'r')).totalDegrees);
  for(const [finger,q]of Object.entries(grip.rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new Quaternion().fromArray(q).normalize())<.001,'The fingers lost their fitted grip.');
 }
 assert.ok(step>.3&&turn>.7&&maxHip-minHip>.1,'The attack lost its source step, turn, or body drop.');
 assert.ok(maxWrist<30,'The sword wrist exceeds its reviewed range.');assert.ok(maxJointStep<10,'The arm snaps between 240 Hz samples.');
 t.diagnostic(JSON.stringify({step,turnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,maxWrist,maxJointStep}));
});

test('the curved sabre leads with its cutting edge through the contact window',async t=>{
 const {rig,bones}=await load(),rotation=n=>bones[n].getWorldQuaternion(new Quaternion()).normalize(),up=new Vector3(0,1,0);
 play(rig,hero.readyClip)(0);const p=motions[hero.readyClip].poses[0],shaft=new Vector3(p.tip[0]-p.grip[0],p.tip[2]-p.grip[2],p.grip[1]-p.tip[1]).normalize();
 const frame=rotation('hand_r').invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,p.roll??0)));
 const weapon=createWeapon(hero.weaponKind),sample=play(rig,name);
 const bladePoint=time=>{sample(time);weapon.quaternion.copy(rotation('hand_r')).multiply(frame);weapon.position.copy(bones.hand_r.localToWorld(new Vector3().fromArray(grip.center))).addScaledVector(up.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);return weapon.localToWorld(new Vector3(0,.7,0));};
 let minimum=1;for(const time of [.24,.25,record.impacts[0],.267,.28]){
  const velocity=bladePoint(time+1/480).sub(bladePoint(time-1/480)).normalize();bladePoint(time);
  const edge=velocity.dot(new Vector3(1,0,0).applyQuaternion(weapon.quaternion));minimum=Math.min(minimum,edge);
  assert.ok(edge>.75,'The blunt edge or flat face leads the strike: '+edge);
 }
 t.diagnostic(JSON.stringify({minimumLeadingEdge:minimum}));
});

test('the attacking arm clears the face during the cross-body preparation',async t=>{
 const {rig}=await load(),surfaces=headSurfaceMetadata(rig).filter(s=>s.mesh.name!=='Mesh_2'),arms=[];
 // Mesh_2 is the separate hair shell. Test the face/head skin beneath it.
 rig.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight,position}=mesh.geometry.attributes,index=mesh.geometry.index;
  const weight=Array.from({length:position.count},(_,i)=>{let sum=0;for(let k=0;k<4;k++)if(/^(upperarm|lowerarm|hand)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))sum+=skinWeight.getComponent(i,k);return sum;});
  const triangles=[];for(let i=0;i<(index?index.count:position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.every(v=>weight[v]>.65))triangles.push(ids);}if(triangles.length)arms.push({mesh,triangles});
 });
 assert.ok(surfaces.length&&arms.length);const sample=play(rig,name);let minimum=.03;
 for(let i=0;i<=Math.ceil(record.duration*120);i++){
  const time=Math.min(i/120,record.duration);sample(time);const query={arm:[]};
  for(const {mesh,triangles}of arms){mesh.skeleton.update();const cache=new Map();for(const ids of triangles)query.arm.push(ids.map(id=>{if(!cache.has(id))cache.set(id,mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));return cache.get(id);}));}
  const hit=measureTriangleHeadClearance(surfaces,query);minimum=Math.min(minimum,hit.minimumClearance);assert.equal(hit.crossings,0,'The forearm intersects the head at '+time);
 }
 assert.ok(minimum>.001);t.diagnostic(JSON.stringify({minimumArmHeadClearance:minimum}));
});
