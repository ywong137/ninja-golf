import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoopOnce,Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {WARRIORS} from '../src/warriors.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {attackFootContacts} from '../src/foot-placement.js';
import {createWeapon} from '../src/weapons.js';
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const grips=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
for(const [model,kind] of [...['ronin','monk'].flatMap(model=>['light','heavy'].map(kind=>[model,kind])),['kaede','heavy']])test(model+' '+kind+' source cut retains whole-body movement, native hinges, and two fitted fists',async t=>{
 const hero=WARRIORS.find(h=>h.model===model),name=model==='monk'?(kind==='light'?'Ethan_Naginata_Driving_Cut':'Ethan_Naginata_Power_Cut'):hero.motionOverrides[(hero.motionPrefix||'')+(kind==='light'?'Cut_Diagonal':'Heavy_Cleave')],record=motions[name];
 assert.ok(record.nativeSourceMotion&&record.nativeAttachment&&record.fixedGripFrame&&record.pairedGrip);
 // The wider polearm grip has separately reviewed rotation bounds.
 // Hinge tolerance covers quaternion interpolation, not a reverse elbow.
 const polearmLight=model==='monk'&&kind==='light';
 const limits={hinge:polearmLight?.15:.1,humeral:model==='kaede'?86:polearmLight?80:kind==='light'?75:70,wrist:polearmLight?42:40,step:kind==='light'?.25:.4};
 const attack=withMotionTiming(attackDefinition(kind,0,hero.combatStyle),record);
 assert.equal(attack.hits.length,kind==='light'?1:2);assert.equal(attack.damage*attack.hits.length,attackDefinition(kind,0,hero.combatStyle).damage);
 const rig=await loadNativeSkin(new URL('../public/models/'+model+'.glb',import.meta.url)),b={};rig.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});rig.scene.updateMatrixWorld(true);
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(b,s))]));
 const wrists=Object.fromEntries(['r','l'].map(s=>[s,b['hand_'+s].quaternion.clone().normalize()]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const q=n=>b[n].getWorldQuaternion(new Quaternion()),p=n=>b[n].getWorldPosition(new Vector3());
 const play=name=>{rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===name);assert.ok(clip);const a=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();a.clampWhenFinished=true;return time=>{a.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};};
 play(hero.readyClip)(0);const pose=motions[hero.readyClip].poses[0],up=new Vector3(0,1,0),shaft=new Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
 const mount=q('hand_r').invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,pose.roll??0))).multiply(new Quaternion().setFromAxisAngle(up,record.weaponGripRoll));
 const sample=play(name),profile=grips[model].sword;
 const core=createWeapon(hero.weaponKind).getObjectByName('Wrapped hand grip');
 core.geometry.computeBoundingBox();
 const gripMin=core.geometry.boundingBox.min.y+core.position.y,gripMax=core.geometry.boundingBox.max.y+core.position.y;
 let firstFoot,firstChest,maxStep=0,maxTurn=0,minHip=Infinity,maxHip=-Infinity,maxGap=0,maxWrist=0;
 for(let i=0;i<=240;i++){
  sample(i/240*record.duration);const palms=['r','l'].map(s=>b['hand_'+s].localToWorld(new Vector3().fromArray(profile[s].center))),axis=up.clone().applyQuaternion(q('hand_r').multiply(mount));
  maxGap=Math.max(maxGap,palms[0].clone().addScaledVector(axis,-record.gripSpacing).distanceTo(palms[1]));
  const foot=p('foot_l'),chest=q('spine_03');firstFoot??=foot.clone();firstChest??=chest.clone();maxStep=Math.max(maxStep,foot.distanceTo(firstFoot));maxTurn=Math.max(maxTurn,chest.angleTo(firstChest));minHip=Math.min(minHip,p('pelvis').y);maxHip=Math.max(maxHip,p('pelvis').y);
  for(const s of ['r','l']){
   const arm=measureArmAnatomy(arms[s],captureArmPose(b,s)),leg=measureLegAnatomy(legs[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<limits.hinge,JSON.stringify(arm));
   assert.ok(Math.abs(arm.humeralRollDegrees)<limits.humeral&&Math.abs(arm.forearmTwistDegrees)<70.1,JSON.stringify(arm));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<130&&leg.kneeDeviation<.1,JSON.stringify(leg));
   assert.ok(Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   maxWrist=Math.max(maxWrist,wrists[s].angleTo(b['hand_'+s].quaternion.clone().normalize())*180/Math.PI);
   for(const [finger,rotation]of Object.entries(profile[s].rotations)){
    assert.ok(b[finger].quaternion.angleTo(new Quaternion().fromArray(rotation))<.001,'A fitted finger opens.');
    if(!finger.startsWith('thumb')){
     // Include a 1 cm pad around each finger joint, not only the palm centre.
     const station=p(finger).sub(palms[0]).dot(axis)+record.primaryGrip;
     assert.ok(station-.01>gripMin&&station+.01<gripMax,'Finger extends beyond the actual handle: '+JSON.stringify({finger,station,gripMin,gripMax}));
    }
   }
  }
 }
 assert.ok(maxGap<.001,'The two fists separate from the shaft: '+maxGap);assert.ok(maxWrist<limits.wrist,'The fitted wrist exceeds its reviewed range: '+maxWrist);
 assert.ok(maxStep>limits.step&&maxTurn>.8&&maxHip-minHip>.05,JSON.stringify({maxStep,maxTurn,hip:maxHip-minHip}));
 const bladePoint=time=>{sample(time);return b.hand_r.localToWorld(new Vector3().fromArray(profile.r.center)).addScaledVector(up.clone().applyQuaternion(q('hand_r').multiply(mount)),model==='monk'?1.4:.8);};
 for(const impact of record.impacts){
  const velocity=bladePoint(impact+1/480).sub(bladePoint(impact-1/480)).normalize();sample(impact);
  const edge=new Vector3(1,0,0).applyQuaternion(q('hand_r').multiply(mount));assert.ok((hero.weaponKind==='jian'?Math.abs(velocity.dot(edge)):velocity.dot(edge))>.6,'The blade hits flat or with its blunt edge: '+velocity.dot(edge));
  const contacts=attackFootContacts(record,impact,{footR:[0,0,1],footL:[0,0,1]});assert.ok(contacts.stance.r||contacts.stance.l,'Both feet lose support at contact.');
 }
 t.diagnostic(JSON.stringify({maxGap,maxWrist,maxStep,maxTurn,hipTravel:maxHip-minHip}));
});
