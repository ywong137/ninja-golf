#!/usr/bin/env node
// Export actual skinning derivatives for a shared geometric photo fit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';

const {values}=parseArgs({options:{model:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/export-vice-president-fit-surface.mjs --model MODEL.glb --output SURFACE.json\nExports the native 1713-vertex head at Selection 0.1s, with exact linear skinning derivatives. No asset changes.');
 process.exit(0);
}
if(!values.model||!values.output)throw Error('Supply --model and --output. See --help.');
if(path.resolve(values.model)===path.resolve(values.output))throw Error('The output must differ from the model.');
const raw=fs.readFileSync(values.model),g=await loadNativeSkin(values.model);
const clip=g.animations.find(c=>c.name==='Naginata_Selection_Idle');
if(!clip)throw Error('The model must contain Naginata_Selection_Idle.');
g.mixer.clipAction(clip).play();g.mixer.update(.1);g.scene.updateMatrixWorld(true);
const mesh=g.scene.getObjectByName('Mesh_1');
if(!mesh?.isSkinnedMesh||mesh.geometry.attributes.position.count!==1713)throw Error('Expected the original 1713-vertex head topology.');
mesh.skeleton.update();
const p=mesh.geometry.attributes.position,index=mesh.geometry.index,bind=[],posed=[],posedJacobian=[];
const point=i=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
for(let i=0;i<p.count;i++){
 const original=new T.Vector3().fromBufferAttribute(p,i),before=point(i),columns=[];
 bind.push(...original.toArray());posed.push(before.toArray());
 for(let axis=0;axis<3;axis++){
  const old=p.getComponent(i,axis);
  try{
   p.setComponent(i,axis,old+.001);
   columns.push(point(i).sub(before).divideScalar(p.getComponent(i,axis)-old).toArray());
  }finally{p.setComponent(i,axis,old);}
 }
 posedJacobian.push([0,1,2].map(r=>[0,1,2].map(c=>columns[c][r])));
 if(point(i).distanceTo(before)>1e-10)throw Error(`Vertex ${i} did not restore after the derivative calculation.`);
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={schemaVersion:1,model:path.resolve(values.model),modelSha256:hash(raw),clip:clip.name,time:.1,
 meshes:[{name:mesh.name,source:{meshIndex:0,primitiveIndex:1},vertexCount:p.count,bind,posed,posedJacobian,
  triangles:Array.from({length:index.count/3},(_,i)=>[0,1,2].map(k=>index.getX(3*i+k))),
  indexSha256:hash(Buffer.from(index.array.buffer,index.array.byteOffset,index.array.byteLength))}]};
fs.mkdirSync(path.dirname(path.resolve(values.output)),{recursive:true});
fs.writeFileSync(values.output,JSON.stringify(result)+'\n');
console.log(JSON.stringify({output:values.output,vertices:p.count,clip:clip.name,time:.1,sourceSha256:result.modelSha256}));
