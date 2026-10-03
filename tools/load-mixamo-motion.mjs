import fs from 'node:fs';
import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

/** Load a local reference, preserving its source clock and bind transforms. */
export function loadMixamoMotion(file){
 const manager=new T.LoadingManager();
 // Motion fitting needs no textures or external image requests.
 manager.addHandler(/.*/,{load:()=>new T.Texture(),setPath(){return this;}});
 const raw=fs.readFileSync(file),scene=new FBXLoader(manager).parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 const map={Hips:'pelvis',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',Neck:'neck_01',Head:'Head'};
 for(const [side,label]of [['r','Right'],['l','Left']]){
  for(const [source,target]of [['Shoulder','clavicle'],['Arm','upperarm'],['ForeArm','lowerarm'],['Hand','hand'],['UpLeg','thigh'],['Leg','calf'],['Foot','foot'],['ToeBase','ball']])map[label+source]=target+'_'+side;
  for(const finger of ['Thumb','Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++)map[label+'Hand'+finger+i]=finger.toLowerCase()+'_0'+i+'_'+side;
 }
 const names={},bones=[];scene.traverse(b=>{if(b.isBone)bones.push(b);});
 // FBX creates zero-length skin leaves with duplicate joint names. Keep them
 // out of the animation and retarget lookup; the actual joint comes first.
 for(const b of bones){const name=b.name;if(names[name]){b.name=name+'_skin_leaf';continue;}names[name]=b;}
 for(const [name,b]of Object.entries(names))b.name=map[name.replace(/^mixamorig:?/,'')]??name;
 for(const clip of scene.animations)for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot);if(names[name])track.name=names[name].name+track.name.slice(dot);}
 scene.scale.setScalar(.01);scene.updateMatrixWorld(true);
 return {scene,animations:scene.animations,mixer:new T.AnimationMixer(scene)};
}
