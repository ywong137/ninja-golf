import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forestSpecies,selectForestSpecies} from '../src/nature-species.js';
function glb(name){const raw=fs.readFileSync(new URL(`../public/models/nature/${name}.glb`,import.meta.url));return {raw,doc:JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString())};}
test('Distinct conifer anatomy retains bounded near and middle geometry with textured foliage',()=>{
 const signatures=[];
 for(const name of ['pine-open','pine-young','fir-layered']){
  const {raw,doc}=glb(name),counts=[0,0];let alpha=false,nearFoliage=0;
  for(const node of doc.nodes){if(node.mesh===undefined)continue;const lod=node.name.startsWith('LOD1')?1:0;
   for(const primitive of doc.meshes[node.mesh].primitives){counts[lod]+=doc.accessors[primitive.indices].count/3;const mat=doc.materials[primitive.material];if(mat.alphaMode==='BLEND'||mat.alphaMode==='MASK'){assert.ok(mat.pbrMetallicRoughness.baseColorTexture);assert.ok(primitive.attributes.TEXCOORD_0!==undefined,`${name}: native needle UV attribute was lost`);alpha=true;if(lod===0)nearFoliage+=doc.accessors[primitive.indices].count/3;}}
  }
  assert.ok(alpha,`${name}: missing photographed needle cards`);assert.equal(nearFoliage,{'pine-open':345915,'pine-young':209250,'fir-layered':33753}[name],`${name}: native near foliage was reduced`);assert.ok(counts[0]<400000);assert.ok(counts[1]>40000&&counts[1]<140000);assert.ok(raw.length<22e6);signatures.push(counts.join('/'));
 }
 assert.equal(new Set(signatures).size,3,'Separate authored tree forms must not reuse one mesh');
 const scrub=glb('woody-scrub');assert.ok(scrub.raw.length<2e6);assert.ok(scrub.doc.materials.some(m=>/leaves/.test(m.name)));
});
test('Japanese and Highland groves select different three-species mixes without canopy reuse in Highlands',()=>{
 for(const theme of ['japanese','highlands']){
  const entries=forestSpecies(theme),counts=Object.fromEntries(entries.map(e=>[e.name,0]));
  assert.equal(entries.length,3);assert.ok(Math.abs(entries.reduce((sum,e)=>sum+e.weight,0)-1)<1e-8);
  for(let i=0;i<1000;i++)counts[selectForestSpecies(theme,(i+.5)/1000)]++;
  for(const entry of entries)assert.equal(counts[entry.name],entry.weight*1000);
 }
 assert.equal(forestSpecies('highlands').some(e=>e.name==='forest-canopy'),false);
 assert.deepEqual(forestSpecies('desert'),[{name:'dry-tree',weight:1}]);
});

test('Native conifer branches contain no large triangular sheets from collapsed junctions',()=>{
 for(const name of ['pine-open','pine-young','fir-layered']){
  const {raw,doc}=glb(name),start=28+raw.readUInt32LE(12);
  const read=id=>{const a=doc.accessors[id],view=doc.bufferViews[a.bufferView],components=a.type==='VEC3'?3:1,bytes=a.componentType===5123?2:4,result=[];
   for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=start+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*bytes)+j*bytes;result.push(a.componentType===5126?raw.readFloatLE(at):bytes===2?raw.readUInt16LE(at):raw.readUInt32LE(at));}return result;
  };
  let checked=0;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
   if(!doc.materials[primitive.material].name.includes('_bark'))continue;
   const positions=read(primitive.attributes.POSITION),indices=read(primitive.indices);
   for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,u=positions.slice(b,b+3).map((v,k)=>v-positions[a+k]),v=positions.slice(c,c+3).map((v,k)=>v-positions[a+k]);
    const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
    assert.ok(area<.03,`${name}: branch face covers ${area} square metres`);checked++;
   }
  }
  assert.ok(checked>10000);
 }
});
