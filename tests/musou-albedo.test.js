import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture,ShaderLib} from 'three';
import {installMusouAlbedo,loadMusouAlbedo} from '../src/musou-albedo.js';
import {FacialPose} from '../src/facial-pose.js';
import {loadFace} from '../tools/audit-facial-pose.mjs';

test('musou color belongs to each actor and preserves neutral material properties',()=>{
 const original=new MeshStandardMaterial({name:'f012_head',map:new Texture(),normalMap:new Texture(),roughness:.78});
 const create=()=>{const group=new Group(),mesh=new Mesh(new BoxGeometry(),original);group.add(mesh);return {group,mesh};};
 const a=create(),b=create(),texture=new Texture(),first=installMusouAlbedo(a.group,texture),second=installMusouAlbedo(b.group,texture);
 assert.notEqual(a.mesh.material,b.mesh.material);assert.notEqual(a.mesh.material,original);
 assert.equal(a.mesh.material.map,original.map);assert.equal(a.mesh.material.normalMap,original.normalMap);assert.equal(a.mesh.material.roughness,.78);
 first.set(.8);assert.equal(first.weight.value,.8);assert.equal(second.weight.value,0);
 first.set(Infinity);assert.equal(first.weight.value,0);first.set(2);assert.equal(first.weight.value,1);
 assert.equal(installMusouAlbedo(a.group,null),null);assert.equal(loadMusouAlbedo('unknown'),null);
});

test('musou texture blends in the actual surface shader and preserves prior extensions',()=>{
 const group=new Group(),material=new MeshStandardMaterial({name:'f012_head',map:new Texture()});
 material.onBeforeCompile=shader=>{shader.uniforms.existing={value:1};};material.customProgramCacheKey=()=> 'source-material';group.add(new Mesh(new BoxGeometry(),material));
 const texture=new Texture(),expression=installMusouAlbedo(group,texture),shader={uniforms:{},fragmentShader:ShaderLib.standard.fragmentShader,vertexShader:ShaderLib.standard.vertexShader};
 const installed=group.children[0].material;installed.onBeforeCompile(shader);
 assert.equal(shader.uniforms.existing.value,1);assert.equal(shader.uniforms.musouAlbedo.value,texture);assert.equal(shader.uniforms.musouAlbedoWeight,expression.weight);
 assert.ok(shader.fragmentShader.includes('texture2D(musouAlbedo,vMapUv)'));assert.ok(shader.fragmentShader.includes('#include <normal_fragment_maps>'));
 assert.equal(installed.customProgramCacheKey(),'source-material:musou-albedo-v1');
});

test('native facial lifecycle resets the angry texture on disabled and restored poses',async()=>{
 const {bones,scene}=await loadFace('sora'),albedo={value:0,set(v){this.value=v;}},pose=new FacialPose(bones,{identity:'sora',model:scene,albedo});
 for(let i=0;i<30;i++)pose.apply(1/60,{musou:1});assert.ok(albedo.value>.99);assert.equal(albedo.value,pose.anger);
 pose.apply(1/60,{enabled:false});assert.equal(albedo.value,0);
 pose.apply(1/60,{musou:1});assert.ok(albedo.value>.99);pose.restore();assert.equal(albedo.value,0);
 // Recorded running uses the same facial owner, so it must fade out too.
 for(let i=0;i<60;i++)pose.apply(1/60,{exertion:.4});assert.ok(albedo.value<.0001);
});

for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero} angry color asset matches its source record`,()=>{
 const folder=new URL('../public/textures/musou/',import.meta.url),record=JSON.parse(fs.readFileSync(new URL(`${hero}-snarl.source.json`,folder))),bytes=fs.readFileSync(new URL(record.file,folder));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<250000);
});
