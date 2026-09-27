import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WARRIORS} from '../src/warriors.js';

const data=readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+data+';');
const {motions,sampleMotion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.ProgressEvent??=class{};

test('Native attack wrists follow blade directions between solved animation keys',async()=>{
 for(const hero of WARRIORS){
  const raw=readFileSync(new URL(`../public/models/${hero.model}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
  const binary=raw.subarray(28+size);doc.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
  for(const key of ['meshes','skins','materials','textures','images'])delete doc[key];
  for(const node of doc.nodes){delete node.mesh;delete node.skin;}
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),''),mixer=new THREE.AnimationMixer(gltf.scene);
  const point=name=>gltf.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  const clips=gltf.animations.filter(c=>c.name.startsWith(hero.motionPrefix)&&/^(Cut_|Heavy_|Musou_)/.test(c.name.slice(hero.motionPrefix.length)));
  assert.equal(clips.length,9,hero.model);
  for(const clip of clips){
   mixer.stopAllAction();const action=mixer.clipAction(clip).play();
   // Check the exported keys and the intervals between native solved samples.
   const rate=motions[clip.name].nativeSampleRate||60;
   for(let frame=0;frame<Math.floor(clip.duration*rate);frame++)for(const fraction of [0,.5]){
    const time=(frame+fraction)/rate;action.time=time;mixer.update(0);gltf.scene.updateMatrixWorld(true);
    const pose=sampleMotion(clip.name,time);
    for(const side of hero.dualWield?['r','l']:['r']){
     const grip=side==='r'?pose.grip:pose.offGrip,tip=side==='r'?pose.tip:pose.offTip;
     const expected=new THREE.Vector3(tip[0]-grip[0],tip[2]-grip[2],grip[1]-tip[1]).normalize();
     const actual=point('PalmShaft_'+side).sub(point('PalmGrip_'+side)).normalize();
     const degrees=actual.angleTo(expected)*180/Math.PI;
     assert.ok(degrees<15,`${hero.model}/${clip.name}/${side} at ${time}: ${degrees}° wrist error`);
    }
   }
  }
 }
});
