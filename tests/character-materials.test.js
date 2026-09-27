import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {finishCharacterMaterial,awaitCharacterMaterials} from '../src/character-materials.js';

test('native surface maps preserve source color, normals, and GLTF UV orientation',async()=>{
 const load=THREE.TextureLoader.prototype.load,urls=[];
 THREE.TextureLoader.prototype.load=function(url,onLoad){urls.push(url);const texture=new THREE.Texture();queueMicrotask(()=>onLoad(texture));return texture;};
 try{
  const color=new THREE.Texture(),normal=new THREE.Texture();
  const material=new THREE.MeshStandardMaterial({name:'f003_head',map:color,normalMap:normal});
  finishCharacterMaterial(material);const second=material.clone();finishCharacterMaterial(second);
  await awaitCharacterMaterials();
  assert.equal(material.map,color);assert.equal(material.normalMap,normal);
  assert.equal(material.roughnessMap,second.roughnessMap);assert.equal(urls.length,1);
  assert.equal(material.roughnessMap.colorSpace,THREE.NoColorSpace);assert.equal(material.roughnessMap.flipY,false);
  assert.equal(material.metalness,0);
 }finally{THREE.TextureLoader.prototype.load=load;}
});

test('hair preserves the source transparency and depth contract',()=>{
 const map=new THREE.Texture(),material=new THREE.MeshStandardMaterial({name:'f012_opacity',map,transparent:true});
 finishCharacterMaterial(material);
 assert.equal(material.map,map);assert.equal(material.transparent,true);assert.equal(material.depthWrite,true);
 assert.equal(material.alphaTest,0);assert.equal(material.metalness,0);
});

test('surface map manifest covers every human with licensed, verifiable source maps',()=>{
 const folder=new URL('../public/textures/characters/',import.meta.url);
 const manifest=JSON.parse(fs.readFileSync(new URL('SOURCES.json',folder)));
 assert.equal(manifest.license,'MIT');assert.equal(manifest.files.length,20);
 for(const entry of manifest.files){
  assert.match(entry.source,/Microsoft-Rocketbox.*_specular\.tga$/);
  assert.match(entry.sourceBlob,/^[0-9a-f]{40}$/);
  const bytes=fs.readFileSync(new URL(entry.file,folder));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert.ok(entry.size.every(size=>size===512||size===1024));
 }
});
