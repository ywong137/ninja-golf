import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
import {bind} from '../fixed-grip/solver.mjs';
export async function createSourceSampler(dir){
const g=await loadNativeSkin(dir+'/ronin.glb'),b={};
g.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});
const grips=JSON.parse(fs.readFileSync(dir+'/grips.json')).ronin.sword,frames=JSON.parse(fs.readFileSync('tools/ronin-candidates/heavy-cleave-frames.json'));
const P=n=>b[n].getWorldPosition(new T.Vector3()),Q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
const rest=Object.fromEntries(Object.entries(b).map(([n,o])=>[n,{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}]));
function snapshot(clip,time){
 g.mixer.stopAllAction();for(const[n,v]of Object.entries(rest)){b[n].position.fromArray(v.p);b[n].quaternion.fromArray(v.q);b[n].scale.fromArray(v.s);}
 const action=g.mixer.clipAction(g.animations.find(c=>c.name===clip)).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const bodyPose=Object.fromEntries(Object.entries(b).map(([n,o])=>[n,{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}]));
 const weapon=Q('hand_r').multiply(new T.Quaternion().fromArray(grips.r.frame)).normalize(),target=b.hand_r.localToWorld(new T.Vector3().fromArray(grips.r.center));
 const controls=[];
 for(const s of ['r','l']){
  const neutral=new T.Quaternion().fromArray(frames[s].neutralHandRotation),delta=b['hand_'+s].quaternion.clone().multiply(neutral.invert()).normalize();if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
  const angle=2*Math.acos(T.MathUtils.clamp(delta.w,-1,1)),v=new T.Vector3(delta.x,delta.y,delta.z).normalize().multiplyScalar(angle*180/Math.PI),axis=new T.Vector3().fromArray(bind['hand_'+s].p).normalize(),x=new T.Vector3(1,0,0).addScaledVector(axis,-axis.x).normalize(),z=axis.clone().cross(x);
  controls.push(v.dot(x),v.dot(z));
 }
 controls.push(0,0,0,0,0);
 return{bodyPose,weaponFrame:weapon.toArray(),target:target.toArray(),controls,feet:{r:P('foot_r').toArray(),l:P('foot_l').toArray()},feetQ:{r:Q('foot_r').toArray(),l:Q('foot_l').toArray()},toes:{r:P('ball_r').toArray(),l:P('ball_l').toArray()},pelvis:P('pelvis').toArray()};
}
return snapshot;
}
