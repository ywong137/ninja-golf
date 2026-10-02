import {Quaternion,Vector3} from 'three';
import {createSourceLegRetarget} from './source-leg-retarget.mjs';
const point=b=>b.getWorldPosition(new Vector3()),rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const CHILD={pelvis:'spine_01',spine_01:'spine_02',spine_02:'spine_03',spine_03:'neck_01',neck_01:'Head'};
for(const side of ['r','l']){
 for(const [a,b] of [['thigh','calf'],['calf','foot'],['foot','ball'],['clavicle','upperarm'],['upperarm','lowerarm'],['lowerarm','hand'],['hand','middle_01']])CHILD[a+'_'+side]=b+'_'+side;
 for(const finger of ['thumb','index','middle','ring','pinky'])for(let n=1;n<3;n++)CHILD[`${finger}_0${n}_${side}`]=`${finger}_0${n+1}_${side}`;
}
function capture(root){
 root.updateMatrixWorld(true,true);const bones={},ordered=[];root.traverse(b=>{if(b.isBone){bones[b.name]=b;ordered.push(b);}});
 return {root,bones,ordered,rest:Object.fromEntries(ordered.map(b=>[b.name,{p:point(b),q:rotation(b),localP:b.position.clone(),localQ:b.quaternion.clone(),scale:b.scale.clone()}]))};
}
/** Reconstruct a complete gait from one source clock. No target animation plays.
 * This avoids mixing source legs with an upper body from a truncated export.
 */
export function createSourceGaitRetarget(sourceRoot,targetRoot,{footRotation='segment-frame'}={}){
 if(!['segment-frame','bind-delta'].includes(footRotation))throw Error('Choose segment-frame or bind-delta foot rotation.');
 const source=capture(sourceRoot),target=capture(targetRoot),legs=createSourceLegRetarget(sourceRoot,targetRoot,{includeFeet:footRotation==='segment-frame'}),corrections={};
 if(!source.bones.pelvis||!target.bones.pelvis)throw Error('Gait retarget requires a pelvis bone on both rigs.');
 const sourceHeight=source.rest.pelvis.p.y-sourceRoot.getWorldPosition(new Vector3()).y,targetHeight=target.rest.pelvis.p.y-targetRoot.getWorldPosition(new Vector3()).y;
 if(sourceHeight<=0||targetHeight<=0)throw Error('Gait retarget requires upright bind poses above the model origin.');
 for(const b of target.ordered){
  const name=b.name,s=source.bones[name];if(!s)continue;
  const sr=source.rest[name],tr=target.rest[name],child=CHILD[name];let sd,td;
  // Captured ankle/forefoot markers have different rest slopes from the shoe
  // skeleton. Preserve the calibrated sole orientation, not that marker slope.
  if(footRotation==='bind-delta'&&/^(foot|ball)_[rl]$/.test(name)){corrections[name]=sr.q.clone().invert().multiply(tr.q);continue;}
  if(child&&source.rest[child]&&target.rest[child]){sd=source.rest[child].p.clone().sub(sr.p);td=target.rest[child].p.clone().sub(tr.p);}
  else if(name==='Head'||!b.parent?.isBone||!s.parent?.isBone){sd=new Vector3(0,1,0);td=sd.clone();}
  else{sd=sr.p.clone().sub(source.rest[s.parent.name].p);td=tr.p.clone().sub(target.rest[b.parent.name].p);}
  if(sd.lengthSq()<1e-12||td.lengthSq()<1e-12)throw Error('Gait retarget has no rest direction for '+name);
  corrections[name]=sr.q.clone().invert().multiply(new Quaternion().setFromUnitVectors(td.normalize(),sd.normalize())).multiply(tr.q);
 }
 return {names:Object.keys(corrections),bones:target.bones,translationScale:targetHeight/sourceHeight,apply(){
  sourceRoot.updateMatrixWorld(true,true);
  for(const b of target.ordered){const rest=target.rest[b.name];b.position.copy(rest.localP);b.quaternion.copy(rest.localQ);b.scale.copy(rest.scale);}
  targetRoot.updateMatrixWorld(true,true);
  const wanted=point(source.bones.pelvis).sub(source.rest.pelvis.p).multiplyScalar(targetHeight/sourceHeight).add(target.rest.pelvis.p),pelvis=target.bones.pelvis;
  pelvis.position.copy(pelvis.parent.worldToLocal(wanted));pelvis.updateWorldMatrix(false,true);
  for(const b of target.ordered)if(corrections[b.name]){
   const q=rotation(source.bones[b.name]).multiply(corrections[b.name]);
   b.quaternion.copy(rotation(b.parent).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);
  }
  legs.apply();
  // The calibrated thigh/calf frames change the shoe's parent rotation.
  // Reapply the intended world shoe/toe orientations after those frames.
  if(footRotation==='bind-delta')for(const side of ['r','l'])for(const part of ['foot','ball']){
   const name=part+'_'+side,b=target.bones[name],q=rotation(source.bones[name]).multiply(corrections[name]);
   b.quaternion.copy(rotation(b.parent).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);
  }
 }};
}

export function validateSourceGaitTiming(clip){
 if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Source gait requires a positive clip duration.');
 for(const track of clip.tracks){
  if(Math.abs(track.times[0])>1e-7||Math.abs(track.times.at(-1)-clip.duration)>1e-6)throw Error(`Source gait ${clip.name} must start at zero and include its complete endpoint: ${track.name}`);
  const width=track.getValueSize(),start=Array.from(track.values.slice(0,width)),end=Array.from(track.values.slice(-width));
  const error=track.ValueTypeName==='quaternion'?new Quaternion().fromArray(start).normalize().angleTo(new Quaternion().fromArray(end).normalize()):Math.max(...start.map((v,i)=>Math.abs(v-end[i])));
  // The licensed source has a sub-degree left-arm endpoint residual. Keep
  // that source motion; require the pelvis and both leg cycles to close.
  if(/^(pelvis|spine_0[123]|thigh_[rl]|calf_[rl]|foot_[rl]|ball_[rl])\./.test(track.name)&&error>1e-5)throw Error(`Source gait ${clip.name} has an open body/leg loop: ${track.name} differs by ${error}. Use the original animation file.`);
 }
}

export function sourceGaitBakeTimes(sourceClip,targetDuration,rate=120){
 if(!Number.isFinite(targetDuration)||targetDuration<=0||!Number.isFinite(rate)||rate<=0)throw Error('Gait bake requires positive duration and sample rate.');
 validateSourceGaitTiming(sourceClip);
 const count=Math.ceil(targetDuration*rate);
 // Preserve source interpolation boundaries as well as dense verification keys.
 // Float32 deduplication avoids two keys that collapse to the same GLB time.
 return [...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*targetDuration)),...sourceClip.tracks.flatMap(t=>Array.from(t.times,time=>Math.fround(time/sourceClip.duration*targetDuration)))])].sort((a,b)=>a-b);
}
