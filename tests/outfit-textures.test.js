import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {applyCharacterOutfit,awaitCharacterOutfits} from '../src/character-outfits.js';

test('outfits affect only the six hero body materials and share loaded textures',async()=>{
 const load=THREE.TextureLoader.prototype.load,urls=[];
 THREE.TextureLoader.prototype.load=function(url,done){urls.push(url);const t=new THREE.Texture();queueMicrotask(()=>done(t));return t;};
 try{
  for(const name of ['m024_body','m017_body','m009_body','f003_body','f008_body','f012_body']){
   const normal=new THREE.Texture(),m=new THREE.MeshStandardMaterial({name,normalMap:normal});
   assert.equal(applyCharacterOutfit(m),true);const second=m.clone();applyCharacterOutfit(second);
   assert.equal(m.map,second.map);assert.equal(m.normalMap,normal);assert.equal(m.map.flipY,false);assert.equal(m.map.colorSpace,THREE.SRGBColorSpace);
  }
  for(const name of ['f003_head','f012_opacity','m004_body']){
   const map=new THREE.Texture(),m=new THREE.MeshStandardMaterial({name,map});assert.equal(applyCharacterOutfit(m),false);assert.equal(m.map,map);
  }
  await awaitCharacterOutfits();assert.equal(urls.length,6);
 }finally{THREE.TextureLoader.prototype.load=load;}
});
test('six licensed garment variants match the generated manifest',()=>{
 const folder=new URL('../public/textures/outfits/',import.meta.url),m=JSON.parse(fs.readFileSync(new URL('SOURCES.json',folder)));
 assert.equal(m.files.length,6);assert.equal(m.license,'MIT');
 for(const item of m.files){assert.equal(item.unchangedOutsideMaskBeforeCompression,true);assert.ok(item.coverage>.08&&item.coverage<.5);const bytes=fs.readFileSync(new URL(item.file,folder));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);}
});
