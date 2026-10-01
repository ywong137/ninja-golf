import {Quaternion,Vector3} from 'three';

// Matching poses need no crossfade. Blending a static closed two-hand pose
// into its moving continuation can break the shared grip during the fade.
export function matchesAnimationEntry(bones,from,to,{overriddenTracks=new Set(),restPose}={}){
 if(!from?.tracks.length||!to?.tracks.length)return false;
 const names=new Set(to.tracks.map(track=>track.name));
 if(names.size!==to.tracks.length)return false;
 // The mixer restores an omitted property to its captured rest value. A toe
 // can therefore finish its pivot before an incoming clip omits that track.
 // Without the actual rest pose, retain the conservative fade.
 for(const track of from.tracks){
  if(names.has(track.name)||overriddenTracks.has(track.name))continue;
  const dot=track.name.lastIndexOf('.'),bone=bones[track.name.slice(0,dot)],property=track.name.slice(dot+1);
  if(!matchesTransform(bone,property,restPose?.get(bone)?.[property]))return false;
 }
 for(const track of to.tracks){
  // A caller can exclude properties it replaces completely after the mixer.
  if(overriddenTracks.has(track.name))continue;
  const dot=track.name.lastIndexOf('.'),bone=bones[track.name.slice(0,dot)],property=track.name.slice(dot+1);
  if(!bone||track.times[0]!==0)return false;
  const expected=property==='quaternion'&&track.getValueSize()===4?new Quaternion().fromArray(track.values)
   :(property==='position'||property==='scale')&&track.getValueSize()===3?new Vector3().fromArray(track.values):null;
  if(!matchesTransform(bone,property,expected))return false;
 }
 return true;
}

function matchesTransform(bone,property,expected){
 if(!bone||!expected)return false;
 if(property==='quaternion'&&expected.isQuaternion){
  if(!Number.isFinite(expected.lengthSq())||expected.lengthSq()<1e-10||!Number.isFinite(bone.quaternion.lengthSq())||bone.quaternion.lengthSq()<1e-10)return false;
  const angle=bone.quaternion.clone().normalize().angleTo(expected.clone().normalize());
  return Number.isFinite(angle)&&angle<=1e-5;
 }
 if((property==='position'||property==='scale')&&expected.isVector3){
  const distance=bone[property].distanceToSquared(expected);
  return Number.isFinite(distance)&&distance<=1e-12;
 }
 return false;
}
