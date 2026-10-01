import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../../../tests/native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../../../tools/native-arm-anatomy.mjs';
import {installLimbSkinning} from '../../../src/forearm-twist.js';
import {closeSharedHilt} from '../../../tools/shared-hilt-closure.mjs';
const g=await loadNativeSkin('public/models/ronin.glb'),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});
const V=a=>new T.Vector3().fromArray(a),Q=a=>new T.Quaternion().fromArray(a).normalize(),D=Math.PI/180;
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
const grips=JSON.parse(fs.readFileSync('tools/ronin-candidates/ronin-grip-patch.json')).sword,frames=JSON.parse(fs.readFileSync('tools/ronin-candidates/heavy-cleave-frames.json'));
grips.r.frame=Q(grips.r.frame).multiply(new T.Quaternion().setFromAxisAngle(Y,-40*D)).toArray();
grips.l.frame=Q(grips.l.frame).multiply(new T.Quaternion().setFromAxisAngle(Y,139.07181728221101*D)).toArray();
const snapshot=()=>Object.fromEntries(Object.entries(b).map(([n,o])=>[n,{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}]));
function restore(s){for(const[n,v]of Object.entries(s)){b[n].position.fromArray(v.p);b[n].quaternion.fromArray(v.q);b[n].scale.fromArray(v.s);}g.scene.updateMatrixWorld(true);}
function setWorld(n,r){b[n].quaternion.copy(q(b[n].parent.name).invert().multiply(r)).normalize();b[n].updateWorldMatrix(false,true);}
const bind=snapshot(),cal={},lengths={},wristAxes={},neutral={};
for(const s of ['r','l']){cal[s]=calibrateArmAnatomy(captureArmPose(b,s));lengths[s]=p('upperarm_'+s).distanceTo(p('lowerarm_'+s));neutral[s]=Q(frames[s].neutralHandRotation);const axis=b['hand_'+s].position.clone().normalize(),x=X.clone().addScaledVector(axis,-X.dot(axis)).normalize();wristAxes[s]={x,z:axis.clone().cross(x)};}
const deformation=installLimbSkinning(g.scene);
const surfaces=skinGroups(g),source=await loadNativeSkin('public/models/ronin.glb'),sb={};source.scene.traverse(o=>{if(o.isBone)sb[o.name]=o});
const sourceAction=source.mixer.clipAction(source.animations.find(a=>a.name==='Ronin_Heavy_Cleave')).setLoop(T.LoopOnce,1).play();sourceAction.clampWhenFinished=true;
function frame(axis,normal){const x=axis.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x)).normalize(),y=z.clone().cross(x);return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
function wrist(s,x,z){const a=Math.hypot(x,z),axis=wristAxes[s].x.clone().multiplyScalar(x).addScaledVector(wristAxes[s].z,z);return a<1e-8?neutral[s].clone():new T.Quaternion().setFromAxisAngle(axis.normalize(),a*D).multiply(neutral[s]);}
let context;
function pose(v){
 const {weapon,shaft,target,chest}=context,hands={};
 for(const [i,side]of [[5,'r'],[6,'l']])setWorld('clavicle_'+side,new T.Quaternion().setFromAxisAngle(Z,v[i+2]*D*(side==='r'?-1:1)).multiply(new T.Quaternion().setFromAxisAngle(Y,v[i]*D*(side==='r'?1:-1))).multiply(context.clavicles[side]));
 const shoulders=Object.fromEntries(['r','l'].map(s=>[s,p('upperarm_'+s)]));
 for(const s of ['r','l']){
  const hand=weapon.clone().multiply(Q(grips[s].frame).invert());
  const i=s==='r'?0:2,w=wrist(s,v[i],v[i+1]),lower=hand.clone().multiply(w.clone().invert());
  const wristOffset=V(grips[s].center).applyQuaternion(hand).negate().addScaledVector(shaft,s==='r'?0:-.12),elbowOffset=wristOffset.clone().sub(V(bind['hand_'+s].p).applyQuaternion(lower));
  hands[s]={hand,lower,w,wristOffset,elbowOffset};
 }
 const closure=closeSharedHilt({shoulders,upperArmLengths:lengths,elbowOffsets:Object.fromEntries(['r','l'].map(s=>[s,hands[s].elbowOffset])),target,orbitRadians:v[4]*D});
 if(!closure.feasible)return{feasible:false,gap:closure.gap};
 for(const s of ['r','l']){const h=hands[s],wrist=closure.position.clone().add(h.wristOffset),elbow=closure.position.clone().add(h.elbowOffset),upper=elbow.clone().sub(shoulders[s]),fore=wrist.clone().sub(elbow),hinge=upper.clone().normalize().cross(fore.clone().normalize());
  h.upper=frame(upper,hinge).multiply(frame(cal[s].upperAxisLocal,cal[s].hingeAxisLocal).invert());h.elbow=elbow;h.wrist=wrist;
  h.measure=measureArmAnatomy(cal[s],{shoulder:shoulders[s],elbow,wrist,upperArmQuaternion:h.upper,forearmQuaternion:h.lower,chestQuaternion:chest});
 }
 return{feasible:true,hilt:closure.position,hands};
}

export {grips,bind,b,g,surfaces,deformation};
export function sampleBodyAt(sourceTime){
 if(!Number.isFinite(sourceTime)||sourceTime<0||sourceTime>sourceAction.getClip().duration+1e-6)throw Error('sourceTime must lie within the source cleave.');
 sourceAction.time=sourceTime;source.mixer.update(0);source.scene.updateMatrixWorld(true);
 return Object.fromEntries(Object.entries(sb).map(([n,o])=>[n,{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}]));
}
export function sampleAt({sourceTime,pitch,target,controls,skin=false}){
 const bodyPose=sampleBodyAt(sourceTime);
 const angle=pitch*D,shaft=new T.Vector3(0,Math.sin(angle),Math.cos(angle)),edge=new T.Vector3(0,-Math.cos(angle),Math.sin(angle));
 const weapon=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(edge,shaft,edge.clone().cross(shaft)));
 return samplePose({bodyPose,weaponFrame:weapon.toArray(),target,controls,skin});
}
// Other attacks supply their body motion and blade orientation explicitly.
// The shared closure and both complete palm frames remain identical.
export function samplePose({bodyPose,weaponFrame,target,controls,skin=false,capture=true}){
 if(!Array.isArray(weaponFrame)||weaponFrame.length!==4||!weaponFrame.every(Number.isFinite)||Math.hypot(...weaponFrame)<1e-10)throw Error('weaponFrame must contain a finite, nonzero quaternion.');
 if(!Array.isArray(controls)||controls.length!==9||!controls.every(Number.isFinite))throw Error('Supply all nine finite arm controls.');
 if(!Array.isArray(target)||target.length!==3||!target.every(Number.isFinite))throw Error('target must contain three finite coordinates.');
 restore(bodyPose);const weapon=Q(weaponFrame),shaft=Y.clone().applyQuaternion(weapon);
 context={clavicles:Object.fromEntries(['r','l'].map(s=>[s,q('clavicle_'+s)])),weapon,shaft,target:V(target),chest:q('spine_03')};
 const result=pose(controls);if(!result.feasible)return result;
 for(const s of ['r','l']){setWorld('upperarm_'+s,result.hands[s].upper);setWorld('lowerarm_'+s,result.hands[s].lower);b['hand_'+s].quaternion.copy(result.hands[s].w);for(const[n,r]of Object.entries(grips[s].rotations))b[n].quaternion.fromArray(r);}g.scene.updateMatrixWorld(true);deformation.update();
 const actual=Object.fromEntries(['r','l'].map(s=>[s,measureArmAnatomy(cal[s],captureArmPose(b,s))]));
 const surface=skin?Object.fromEntries(['r','l'].map(s=>[s,measureArmSkin(g,surfaces,s)])):undefined;
 return{feasible:true,weapon:weapon.toArray(),hilt:result.hilt.toArray(),actual,skin:surface,violations:Object.fromEntries(['r','l'].map(s=>[s,armAuthoringViolations(actual[s],{maxHingeDeviationDegrees:.1})])),...(capture?{pose:snapshot()}:{})};
}
