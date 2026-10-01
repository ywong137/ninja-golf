import * as T from 'three';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
import {solveLeg} from '../../../src/foot-placement.js';
import {headingKnee} from '../../../src/knee-alignment.js';
import {alignLegHinge} from '../../../src/leg-hinge.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../../../src/leg-anatomy.js';
export async function createBodyPlanner(file){
const g=await loadNativeSkin(file),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});g.scene.updateMatrixWorld(true);
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const Q=a=>new T.Quaternion().fromArray(a),V=a=>new T.Vector3().fromArray(a);
function plantPose(bodyPose,feet,feetQ){
 for(const[n,v]of Object.entries(bodyPose)){b[n].position.fromArray(v.p);b[n].quaternion.fromArray(v.q);b[n].scale.fromArray(v.s);}g.scene.updateMatrixWorld(true);
 const legs={};let error=0;
 for(const s of ['r','l']){
  error=Math.max(error,solveLeg(b['thigh_'+s],b['calf_'+s],b['foot_'+s],V(feet[s]),Q(feetQ[s]),{kneeSolver:headingKnee}));
  alignLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s],cal[s].hinge);legs[s]=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
 }
 return{bodyPose:Object.fromEntries(Object.entries(b).map(([n,o])=>[n,{p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}])),legs,error};
}
function connectedReturn(source,first,time){
 const fade=1-T.MathUtils.smoothstep(time,.54,.85),bodyPose=structuredClone(source.bodyPose),offset=new T.Vector3(-.025,0,.16).multiplyScalar(fade);
 bodyPose.pelvis.p=V(bodyPose.pelvis.p).add(offset).toArray();
 const feet={},feetQ={};for(const s of ['r','l']){feet[s]=V(source.feet[s]).lerp(V(first.feet[s]),fade).toArray();feetQ[s]=Q(source.feetQ[s]).slerp(Q(first.feetQ[s]),fade).toArray();}
 feet.r[1]+=.09*Math.sin(Math.PI*(1-fade))**2;
 feet.l[1]+=.002*Math.sin(Math.PI*(1-fade))**2;
 const pivot=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),5*Math.PI/180*T.MathUtils.smoothstep(time,.4,.5)*fade),toe=V(first.toes.l);
 feet.l=V(feet.l).sub(toe).applyQuaternion(pivot).add(toe).toArray();feetQ.l=pivot.multiply(Q(feetQ.l)).toArray();
 for(const s of ['r','l'])bodyPose['ball_'+s].q=Q(bodyPose['ball_'+s].q).slerp(Q(first.bodyPose['ball_'+s].q),fade).toArray();
 const body=plantPose(bodyPose,feet,feetQ);
 return{...source,...body,target:V(source.target).add(offset).toArray(),feet,feetQ};
}
function interpolateBody(first,last,w){
 const bodyPose={};for(const[n,a]of Object.entries(first.bodyPose)){const b=last.bodyPose[n];bodyPose[n]={p:V(a.p).lerp(V(b.p),w).toArray(),q:Q(a.q).slerp(Q(b.q),w).toArray(),s:V(a.s).lerp(V(b.s),w).toArray()};}
 return plantPose(bodyPose,first.feet,first.feetQ);
}
return{connectedReturn,interpolateBody};
}
