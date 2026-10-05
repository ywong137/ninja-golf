import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseGlb} from '../tools/bake-native-golf.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');


test('Ethan coat preserves the existing head, skeleton and all native animation bytes',()=>{
 const {doc,bin}=parseGlb(fs.readFileSync(new URL('../public/models/monk.glb',import.meta.url)));
 const saved=JSON.parse(fs.readFileSync(new URL('../docs/reviews/ethan-wardrobe-preservation.json',import.meta.url)));
 assert.equal(hash(bin.subarray(0,saved.preservedBinaryBytes)),saved.originalBinarySha256);
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/ethan-before-wardrobe.json',import.meta.url)));
 for(const name of ['animations','nodes','skins'])assert.deepEqual(name==='animations'?doc.animations.slice(0,baseline.animations.length):doc[name],baseline[name],name);
 const indices=primitive=>{const ac=doc.accessors[primitive.indices],v=doc.bufferViews[ac.bufferView],size=ac.componentType===5123?2:4,read=size===2?'readUInt16LE':'readUInt32LE';return Array.from({length:ac.count},(_,i)=>bin[read](v.byteOffset+(ac.byteOffset||0)+i*size));};
 const triangles=rows=>Array.from({length:rows.length/3},(_,i)=>rows.slice(i*3,i*3+3).join(',')).sort();
 assert.deepEqual(triangles([...indices(doc.meshes[0].primitives[0]),...indices(doc.meshes[0].primitives[3])]),triangles(indices(baseline.meshes[0].primitives[0])),'The cloth/hand split must preserve every original triangle.');
 assert.equal(doc.extras.wardrobeDefault.id,1);assert.equal(doc.extras.wardrobeDefault.name,'Hostile Takeover');
 assert.equal(doc.animations.length,44);assert.deepEqual(doc.animations.slice(40).map(a=>a.name),['Ethan_GDH_Combo5_Review','Ethan_GDH_Advancing_Thrust','Ethan_GDH_Return_Cuts','Ethan_GDH_Leaping_Finish']);assert.ok(saved.addedTriangles<10000);assert.ok(doc.meshes[0].primitives.length<=8,'Merge small trim pieces into shared draw groups.');
 const skin=doc.skins[0],newPrimitives=doc.meshes[0].primitives.filter(p=>doc.accessors[p.attributes.POSITION].bufferView>=doc.bufferViews.findIndex(v=>v.byteOffset>=saved.preservedBinaryBytes));
 assert.equal(newPrimitives.length,4);
 for(const p of newPrimitives){
  const wa=doc.accessors[p.attributes.WEIGHTS_0],ja=doc.accessors[p.attributes.JOINTS_0],wv=doc.bufferViews[wa.bufferView],jv=doc.bufferViews[ja.bufferView];
  for(let i=0;i<wa.count;i++){
   let sum=0;for(let k=0;k<4;k++){const weight=bin.readFloatLE(wv.byteOffset+(wa.byteOffset||0)+i*16+k*4),joint=bin.readUInt16LE(jv.byteOffset+(ja.byteOffset||0)+i*8+k*2);assert.ok(weight>=0&&joint<skin.joints.length);sum+=weight;}
   assert.ok(Math.abs(sum-1)<.001,'Normalize every garment vertex.');
  }
 }
});
