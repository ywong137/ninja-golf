import {Quaternion,Vector3} from 'three';

// Matching poses need no crossfade. Blending a static closed two-hand pose
// into its moving continuation can break the shared grip during the fade.
export function matchesAnimationEntry(bones,from,to,{overriddenTracks=new Set()}={}){
 if(!from?.tracks.length||!to?.tracks.length)return false;
 const names=new Set(to.tracks.map(track=>track.name));
 // An outgoing property omitted by the next clip would return to its bind pose.
 if(names.size!==to.tracks.length||from.tracks.some(track=>!names.has(track.name)&&!overriddenTracks.has(track.name)))return false;
 for(const track of to.tracks){
  // A caller can exclude properties it replaces completely after the mixer.
  if(overriddenTracks.has(track.name))continue;
  const dot=track.name.lastIndexOf('.'),bone=bones[track.name.slice(0,dot)],property=track.name.slice(dot+1);
  if(!bone||track.times[0]!==0)return false;
  if(property==='quaternion'&&track.getValueSize()===4){
   const expected=new Quaternion().fromArray(track.values);
   if(!Number.isFinite(expected.lengthSq())||expected.lengthSq()<1e-10)return false;
   const angle=bone.quaternion.clone().normalize().angleTo(expected.normalize());
   if(!Number.isFinite(angle)||angle>1e-5)return false;
  }else if((property==='position'||property==='scale')&&track.getValueSize()===3){
   const distance=bone[property].distanceToSquared(new Vector3().fromArray(track.values));
   if(!Number.isFinite(distance)||distance>1e-12)return false;
  }else return false;
 }
 return true;
}
