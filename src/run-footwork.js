import * as THREE from 'three';
import {headingKnee} from './knee-alignment.js';
import {solveLeg} from './foot-placement.js';
import {calibrateLegHinge,alignLegHinge} from './leg-hinge.js';

const caches=new WeakMap();
const point=bone=>bone.getWorldPosition(new THREE.Vector3());
const rotation=bone=>bone.getWorldQuaternion(new THREE.Quaternion()).normalize();

// Quaternion blending alone shortens a planted leg when the hips turn between
// forward and lateral runs. Blend the authored ankle paths, then solve the legs.
// Cache native paths once per model; no extra skeleton runs during gameplay.
function sampleClips(template,clips){
 if(caches.has(template))return caches.get(template);
 const proxy=template.clone(true),meshes=[];proxy.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const mesh of meshes)mesh.removeFromParent();
 const mixer=new THREE.AnimationMixer(proxy),data={};
 for(const clip of clips.filter(c=>/^Run_|^Sprint_Forward$/.test(c.name))){
  const count=Math.ceil(clip.duration*240),rows=[];mixer.stopAllAction();
  const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce);action.clampWhenFinished=true;action.play();
  for(let i=0;i<=count;i++){
   action.time=i/count*clip.duration;mixer.update(0);proxy.updateMatrixWorld(true);
   rows.push(Object.fromEntries(['r','l'].map(side=>{const foot=proxy.getObjectByName('foot_'+side);return[side,{p:point(foot),q:rotation(foot)}];})));
  }
  data[clip.name]={rows,count};
 }
 mixer.stopAllAction();mixer.uncacheRoot(proxy);caches.set(template,data);return data;
}
export class RunFootwork{
 constructor(root,model,bones,template,clips){
  this.root=root;this.model=model;this.bones=bones;this.saved=[];this.data=sampleClips(template,clips);
  this.hinges=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegHinge(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side])]));
 }
 restore(){for(const [bone,q]of this.saved)bone.quaternion.copy(q);this.saved=[];}
 captureEntry(){
  this.root.updateMatrixWorld(true);
  this.entry=Object.fromEntries(['r','l'].map(side=>[side,{p:point(this.bones['foot_'+side]),q:rotation(this.bones['foot_'+side])}]));
 }
 resetEntry(){this.entry=null;}
 apply(actions,phase,blend){
  this.report=null;if(!actions?.length||blend<=0)return;
  const active=actions.map(action=>({name:action.getClip().name,weight:action.getEffectiveWeight()})).filter(a=>a.weight>1e-6);
  if(!active.length)return;
  const total=active.reduce((sum,a)=>sum+a.weight,0);this.root.updateMatrixWorld(true);
  const modelQ=rotation(this.model),reports=[];
  for(const side of ['r','l']){
   const target=new THREE.Vector3(),q=new THREE.Quaternion();let accumulated=0;
   for(const a of active){
    const {rows,count}=this.data[a.name],at=((phase%1)+1)%1*count,i=Math.min(count-1,Math.floor(at)),t=at-i;
    target.addScaledVector(rows[i][side].p.clone().lerp(rows[i+1][side].p,t),a.weight/total);
    const orientation=rows[i][side].q.clone().slerp(rows[i+1][side].q,t);
    if(!accumulated)q.copy(orientation);else q.slerp(orientation,a.weight/(accumulated+a.weight));accumulated+=a.weight;
   }
   target.applyMatrix4(this.model.matrixWorld);q.premultiply(modelQ);
   const thigh=this.bones['thigh_'+side],calf=this.bones['calf_'+side],foot=this.bones['foot_'+side];
   target.lerp(this.entry?.[side].p??point(foot),1-blend);q.slerp(this.entry?.[side].q??rotation(foot),1-blend);
   for(const bone of [thigh,calf,foot])this.saved.push([bone,bone.quaternion.clone()]);
   const error=solveLeg(thigh,calf,foot,target,q,{maxReach:.999,kneeSolver:headingKnee});alignLegHinge(thigh,calf,foot,this.hinges[side]);reports.push({side,error});
  }
  this.report=reports;
  if(blend>=1)this.entry=null;
 }
}
