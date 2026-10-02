import {MathUtils,Vector3} from 'three';

const ARMS=['clavicle_r','upperarm_r','lowerarm_r','hand_r','clavicle_l','upperarm_l','lowerarm_l','hand_l'];
const CORE=['pelvis','spine_01','spine_02','spine_03'];
const NAMES=[...CORE,...ARMS];

// Rejoin the authored ready body during the recorded landing. World foot
// targets remain owned by the contact solver; this layer never moves a shoe.
export class RecordedStopPose{
 constructor(bones,ready,rest){
  this.bones=bones;this.landings=new WeakMap();this.saved=[];this.last=null;this.exitAge=0;
  const tracks=new Map(ready.tracks.map(t=>[t.name,t]));this.ready={};
  for(const name of NAMES){
   const bone=bones[name],pose=rest.get(bone);if(!bone||!pose)throw Error('Recorded stop recovery needs the native rest pose for '+name);
   const q=pose.quaternion.clone(),track=tracks.get(name+'.quaternion');if(track)q.fromArray(track.createInterpolant().evaluate(0)).normalize();
   this.ready[name]=q.normalize();
  }
  const track=tracks.get('pelvis.position');
  this.readyHeight=track?new Vector3().fromArray(track.createInterpolant().evaluate(0)).y:rest.get(bones.pelvis).position.y;
 }
 restore(){for(const [bone,p,q]of this.saved){bone.position.copy(p);bone.quaternion.copy(q);}this.saved=[];}
 save(name){const b=this.bones[name];this.saved.push([b,b.position.clone(),b.quaternion.clone()]);return b;}
 apply(profile,time,data){
  const contacts=Object.values(profile.contacts),landed=Math.max(...contacts.map(rows=>rows.at(-1)[0]));
  const takeoff=Math.max(...contacts.flatMap(rows=>rows.slice(0,-1).map(row=>row[1])));
  const arms=MathUtils.smootherstep(time,takeoff,Math.min(profile.exitTime,landed+.18));
  const body=MathUtils.smootherstep(time,landed,profile.exitTime);
  for(const name of NAMES){
   const bone=this.save(name),weight=ARMS.includes(name)?arms:body;
   if(weight===1)bone.quaternion.copy(this.ready[name]);else if(weight>0)bone.quaternion.normalize().slerp(this.ready[name],weight);
  }
  if(time>=landed){
   let entry=this.landings.get(profile);
   if(!entry){
    if(!data?.rows||!(data.count>0))throw Error('Recorded stop recovery requires sampled source body motion.');
    const sample=t=>{const at=MathUtils.clamp(t/profile.duration,0,1)*data.count,i=Math.min(data.count-1,Math.floor(at));return MathUtils.lerp(data.rows[i].pelvis.y,data.rows[i+1].pelvis.y,at-i);};
    const h=.001;entry={height:sample(landed),velocity:(sample(landed+h)-sample(landed-h))/(2*h)};this.landings.set(profile,entry);
   }
   const span=profile.exitTime-landed,u=MathUtils.clamp((time-landed)/span,0,1);
   // Leave the absorption pose with its recorded vertical velocity, then
   // settle directly at ready height. Do not rise into the source idle pose.
   this.bones.pelvis.position.y=(2*u**3-3*u*u+1)*entry.height+(u**3-2*u*u+u)*span*entry.velocity+(-2*u**3+3*u*u)*this.readyHeight;
  }
  this.last=Object.fromEntries(NAMES.map(name=>[name,{p:this.bones[name].position.clone(),q:this.bones[name].quaternion.clone()}]));
  this.exitAge=0;this.report={arms,body,landed,takeoff};
 }
 applyExit(dt){
  if(!this.last)return;
  this.exitAge+=dt;const weight=MathUtils.smootherstep(this.exitAge,0,.18);
  if(weight===1){this.last=null;this.report=null;return;}
  for(const name of NAMES){
   const bone=this.save(name),outgoing=this.last[name],target=bone.quaternion.clone();
   bone.quaternion.copy(outgoing.q).normalize().slerp(target.normalize(),weight);
   if(name==='pelvis')bone.position.y=MathUtils.lerp(outgoing.p.y,bone.position.y,weight);
  }
 }
 reset(){this.restore();this.last=null;this.exitAge=0;this.report=null;}
}
