const names=['r','l'].flatMap(side=>['clavicle','upperarm','lowerarm','hand'].map(part=>part+'_'+side));
const properties=['position','quaternion','scale'];

// A shared chest transform can blend without opening a two-hand grip. The
// arms must follow the authored motion together, rather than blend separately.
export class ArmMotionContinuation {
 constructor(bones,restPose){
  this.bones=bones;this.restPose=restPose;this.cache=new WeakMap();this.saved=[];this.active=null;
  this.valid=names.every(name=>bones[name]&&restPose.has(bones[name]))
   &&!!bones.clavicle_r.parent&&bones.clavicle_r.parent===bones.clavicle_l.parent&&['r','l'].every(side=>
   bones['upperarm_'+side].parent===bones['clavicle_'+side]
   &&bones['lowerarm_'+side].parent===bones['upperarm_'+side]&&bones['hand_'+side].parent===bones['lowerarm_'+side]);
 }
 samplers(clip){
  if(this.cache.has(clip))return this.cache.get(clip);
  const tracks=new Map();let valid=this.valid;
  for(const track of clip.tracks){
   const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1);
   if(!names.includes(name))continue;
   if(!properties.includes(property)||tracks.has(track.name)||track.times[0]!==0
    ||track.getValueSize()!==(property==='quaternion'?4:3)||!Array.from(track.values).every(Number.isFinite))valid=false;
   if(property==='quaternion')for(let i=0;i<track.values.length;i+=4)
    if(Math.hypot(...track.values.subarray(i,i+4))<1e-5)valid=false;
   tracks.set(track.name,track);
  }
  const rows=valid&&tracks.size?names.flatMap(name=>properties.map(property=>{
   const bone=this.bones[name],track=tracks.get(name+'.'+property);
   return{bone,property,sample:track?.createInterpolant(),value:bone[property].clone(),rest:this.restPose.get(bone)[property].clone(),saved:bone[property].clone()};
  })):null;
  this.cache.set(clip,rows);return rows;
 }
 begin(action,start,duration){
  this.clear();
  if(!action||!Number.isFinite(start)||!(duration>0)||!Number.isFinite(duration))return false;
  const rows=this.samplers(action.getClip());if(!rows)return false;
  for(const row of rows){
   const {bone,property,value,sample,rest}=row;
   if(sample)value.fromArray(sample.evaluate(0));else value.copy(rest);
   if(property==='quaternion'){
    if(value.lengthSq()<1e-10||!Number.isFinite(bone.quaternion.lengthSq())||bone.quaternion.lengthSq()<1e-10)return false;
    const angle=bone.quaternion.clone().normalize().angleTo(value.normalize());
    if(!Number.isFinite(angle)||angle>1e-5)return false;
   }else if(!Number.isFinite(bone[property].distanceToSquared(value))||bone[property].distanceToSquared(value)>1e-12)return false;
  }
  this.active={kind:'continuation',action,end:start+duration,rows};return true;
 }
 restore(){for(const row of this.saved)row.bone[row.property].copy(row.saved);this.saved.length=0;}
 clear(){this.restore();this.active=null;}
 release(start,duration){
  this.restore();if(!this.active)return;
  if(!(duration>0)||!Number.isFinite(duration)||!Number.isFinite(start)){this.clear();return;}
  // A dodge can interrupt the first few frames. Fade from the displayed arms,
  // not the older mixer pose underneath them, so the interruption cannot snap.
  const rows=this.active.rows.map(row=>({bone:row.bone,property:row.property,from:row.value.clone(),value:row.value.clone(),saved:row.saved.clone()}));
  this.active={kind:'release',start,end:start+duration,rows};
 }
 apply(time){
  this.restore();const active=this.active;if(!active)return;
  const {action,end,rows}=active;
  if(time>=end||action&&(!action.enabled||!action.isScheduled())){this.active=null;return;}
  for(const row of rows){
   row.saved.copy(row.bone[row.property]);this.saved.push(row);
   if(active.kind==='release'){
    const weight=Math.max(0,(time-active.start)/(end-active.start));
    row.value.copy(row.from)[row.property==='quaternion'?'slerp':'lerp'](row.saved,weight);
   }else if(row.sample)row.value.fromArray(row.sample.evaluate(action.time));else row.value.copy(row.rest);
   if(row.property==='quaternion')row.value.normalize();
   row.bone[row.property].copy(row.value);
  }
 }
}
