import fs from 'node:fs';
import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

/** Keep unit conversion outside the hierarchy controlled by animation tracks. */
export function createMotionUnitRoot(imported,unitScale=.01){
 if(!imported?.isObject3D||!Number.isFinite(unitScale)||unitScale<=0)throw Error('Supply an imported scene and a positive unit scale.');
 const scene=new T.Group();scene.scale.setScalar(unitScale);scene.add(imported);
 scene.animations=imported.animations;scene.updateMatrixWorld(true);return scene;
}

/** Load a local reference, preserving its source clock and bind transforms. */
export function loadMixamoMotion(file){
 const manager=new T.LoadingManager();
 // Motion fitting needs no textures or external image requests.
 manager.addHandler(/.*/,{load:()=>new T.Texture(),setPath(){return this;}});
 const raw=fs.readFileSync(file),imported=new FBXLoader(manager).parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 const scene=createMotionUnitRoot(imported);
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
 scene.updateMatrixWorld(true);
 return {scene,animations:scene.animations,mixer:new T.AnimationMixer(scene)};
}
