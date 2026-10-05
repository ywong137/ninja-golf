import {AnimationMixer,LoopOnce,Vector3,InterpolateLinear,InterpolateDiscrete,PropertyBinding} from 'three';

/** Split horizontal travel in a native +Y-up model's world frame.
 * Load the model without an outer gameplay transform before calling this.
 * Preserve vertical motion and every other track. Restore the supplied pose.
 * Optional world x/z anchor translates the complete performance by a constant
 * offset. Add the returned offset back when comparing with the original clip.
 */
export function extractPlanarRoot(scene,clip,{boneName='pelvis',tolerance=1e-7,anchor=null}={}){
 if(anchor&&(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.z)))throw Error('Root anchor needs finite world x and z coordinates.');
 if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Supply an animation with a positive duration.');
 if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Parent transform tolerance must be positive and finite.');
 const bone=scene.getObjectByName(boneName);if(!bone?.parent)throw Error('Missing pelvis with a parent');
 const track=clip.tracks.find(t=>t.name===boneName+'.position');
 if(!track||track.getValueSize()!==3||track.getInterpolation()!==InterpolateLinear)throw Error('Root extraction requires a linear pelvis position track');
 if(Math.abs(track.times[0])>1e-7||Math.abs(track.times.at(-1)-clip.duration)>1e-6)throw Error('The pelvis track must cover the complete clip, starting at zero.');
 if(track.times.length<2||Array.from(track.times).some((t,i)=>!Number.isFinite(t)||(i>0&&t<=track.times[i-1]))||Array.from(track.values).some(v=>!Number.isFinite(v)))throw Error('Pelvis keys must have increasing finite times and finite positions.');
 const ancestors=new Set();for(let parent=bone.parent;parent;parent=parent.parent){ancestors.add(parent.name);ancestors.add(parent.uuid);}
 for(const channel of clip.tracks){
  const binding=PropertyBinding.parseTrackName(channel.name);
  if(!ancestors.has(binding.nodeName)||!['position','quaternion','scale','rotation','matrix'].includes(binding.propertyName))continue;
  const width=channel.getValueSize(),linear=[InterpolateLinear,InterpolateDiscrete].includes(channel.getInterpolation());
  // Checking only pelvis sample times can miss a parent that moves and returns
  // between those samples. Reject that animation before modifying the scene.
  if(!linear||Array.from(channel.values).some((v,i)=>!Number.isFinite(v)||Math.abs(v-channel.values[i%width])>tolerance))
   throw Error('Pelvis parent moves during the clip. Bake that parent transform first.');
 }
 const saved=[];scene.traverse(o=>saved.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const mixer=new AnimationMixer(scene),action=mixer.clipAction(clip);action.setLoop(LoopOnce);action.clampWhenFinished=true;action.play();
 try{
  mixer.setTime(track.times[0]);scene.updateMatrixWorld(true);
  const parent=bone.parent.matrixWorld.clone(),inverse=parent.clone().invert(),origin=new Vector3().fromArray(track.values).applyMatrix4(parent),worldOrigin=new Vector3().applyMatrix4(parent),localOrigin=worldOrigin.clone().applyMatrix4(inverse);
  const offset={x:anchor?origin.x-anchor.x:0,z:anchor?origin.z-anchor.z:0};
  const result=clip.clone(),output=result.tracks.find(t=>t.name===track.name),rows=[];
  for(let i=0;i<track.times.length;i++){
   mixer.setTime(track.times[i]);scene.updateMatrixWorld(true);
   if(bone.parent.matrixWorld.elements.some((v,j)=>Math.abs(v-parent.elements[j])>tolerance))throw Error('Pelvis parent moves during the clip. Bake that parent transform first.');
   const original=new Vector3().fromArray(track.values,i*3),world=original.clone().applyMatrix4(parent),delta=new Vector3(world.x-origin.x,0,world.z-origin.z);
   rows.push({time:track.times[i],x:delta.x,z:delta.z});
   const localDelta=worldOrigin.clone().add(delta).add(new Vector3(offset.x,0,offset.z)).applyMatrix4(inverse).sub(localOrigin);
   original.sub(localDelta).toArray(output.values,i*3);
  }
  return{clip:result,path:{duration:clip.duration,rows},offset};
 }finally{
  mixer.stopAllAction();mixer.uncacheRoot(scene);
  for(const [o,p,q,s]of saved){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s)}scene.updateMatrixWorld(true);
 }
}
