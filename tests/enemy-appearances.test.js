import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as T from 'three';
import{ENEMY_APPEARANCES,enemyAppearanceForSlot,resolveEnemyAppearance}from'../src/enemy-appearances.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';
import{ENEMY_TYPES}from'../src/combat.js';import{loadNativeSkin}from'./native-skin-helper.mjs';
const directory=process.env.ENEMY_APPEARANCE_DIR||new URL('../public/models/',import.meta.url).pathname;
const read=file=>{const raw=fs.readFileSync(file),n=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+n)),bin:raw.subarray(28+n)}};
test('all roles use traditional ninja cloth with four dark palettes and course trim',()=>{
 assert.equal(ENEMY_TYPES.length,4);assert.equal(ENEMY_APPEARANCES.length,1);
 const seen=new Set();for(let slot=0;slot<16;slot++){const a=resolveEnemyAppearance(enemyAppearanceForSlot(slot,'desert'));seen.add(a.palette+':'+a.trim);assert.equal(a.definition.id,'cloth-ninja');assert.equal(a.theme,'desert');}
 assert.equal(seen.size,16);assert.deepEqual(ENEMY_APPEARANCES[0].palettes.map(p=>p.id),['black','charcoal','navy','indigo']);
 assert.throws(()=>enemyAppearanceForSlot(-1));assert.throws(()=>resolveEnemyAppearance({family:1}));assert.throws(()=>resolveEnemyAppearance({trim:4}));
});
for(const family of ENEMY_APPEARANCES)test(`${family.id}: every role attack and native knee frames during running and jumps`,async()=>{
 const file=path.join(directory,family.model+'.glb'),asset=read(file),g=await loadNativeSkin(file),point=name=>g.scene.getObjectByName(name).getWorldPosition(new T.Vector3());
 for(const role of ENEMY_TYPES)assert.ok(g.animations.some(a=>a.name===role.clip),`${family.id} missing ${role.clip}`);
 g.scene.updateMatrixWorld(true);const calibration=Object.fromEntries(["r","l"].map(s=>[s,calibrateLegAnatomy(...["thigh_","calf_","foot_"].map(n=>g.scene.getObjectByName(n+s)))]));let lengths={};for(const s of['r','l'])lengths[s]=[point('thigh_'+s).distanceTo(point('calf_'+s)),point('calf_'+s).distanceTo(point('foot_'+s))];
 for(const name of ['Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land']){
  const clip=g.animations.find(c=>c.name===name);g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;let previous={},minBend=1,maxSpeed=0,maxLength=0,hip=0,ankle=0,hinge=0;
  assert.equal(asset.doc.animations.find(a=>a.name===name).extras?.enemyKneePlaneVersion,2,`${family.id} ${name}: missing corrected frames`);
  for(let i=0;i<=Math.ceil(clip.duration*240);i++){const time=Math.min(i/240,clip.duration);action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);for(const s of['r','l']){const m=measureLegAnatomy(calibration[s],...["thigh_","calf_","foot_"].map(n=>g.scene.getObjectByName(n+s)));hip=Math.max(hip,Math.abs(m.hipTwist));ankle=Math.max(ankle,Math.abs(m.ankleTwist));hinge=Math.max(hinge,m.kneeDeviation);const h=point('thigh_'+s),k=point('calf_'+s),a=point('foot_'+s),axis=a.clone().sub(h);const bend=k.clone().sub(h).addScaledVector(axis,-k.clone().sub(h).dot(axis)/axis.lengthSq());minBend=Math.min(minBend,bend.z);maxLength=Math.max(maxLength,Math.abs(h.distanceTo(k)-lengths[s][0]),Math.abs(k.distanceTo(a)-lengths[s][1]));if(previous[s])maxSpeed=Math.max(maxSpeed,k.distanceTo(previous[s])*240);previous[s]=k;}}
  assert.ok(hip<45&&ankle<15&&hinge<.05,JSON.stringify({family:family.id,name,hip,ankle,hinge}));
  assert.ok(minBend>-.001,`${family.id} ${name}: backward knee ${minBend}`);assert.ok(maxSpeed<12,`${family.id} ${name}: knee discontinuity ${maxSpeed} m/s`);assert.ok(maxLength<.00002,`${family.id} ${name}: stretched leg ${maxLength}`);
 }
 if(family.id==='cloth-ninja'){
  for(const name of ['Enemy face wrap','Enemy waist sash','Enemy shin wraps']){const material=asset.doc.materials.findIndex(m=>m.name==='Woven '+name),p=asset.doc.meshes.flatMap(m=>m.primitives).find(p=>p.material===material);assert.ok(p,`Missing weighted ${name}`);const a=asset.doc.accessors[p.attributes.WEIGHTS_0],v=asset.doc.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){let sum=0;for(let j=0;j<4;j++)sum+=asset.bin.readFloatLE(v.byteOffset+(a.byteOffset||0)+i*16+j*4);assert.ok(Math.abs(sum-1)<.00001,`${name}: invalid weights`);}}
 }
});
test('wardrobe preserves the licensed body, face, skin weights and UVs',()=>{
 const view=(asset,id)=>{const a=asset.doc.accessors[id],v=asset.doc.bufferViews[a.bufferView];return asset.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
 for(const [family,source]of[['hoodie','ninja'],['tshirt','shinobi'],['cloth-ninja','ninja']]){
  const a=read(new URL('../public/models/'+source+'.glb',import.meta.url)),b=read(path.join(directory,'enemy-'+family+'.glb'));
  // Enemy bodies retain the pre-costume source topology.
  const saved=JSON.parse(fs.readFileSync(new URL('../docs/reviews/selected-wardrobe-preservation.json',import.meta.url)));
  if(a.doc.extras?.wardrobeDefault)a.doc.meshes[0].primitives=saved[source].originalMeshPrimitives;
  for(let mesh=0;mesh<a.doc.meshes.length;mesh++)for(let p=0;p<a.doc.meshes[mesh].primitives.length;p++){
   const original=a.doc.meshes[mesh].primitives[p],actual=b.doc.meshes[mesh].primitives[p];
   for(const key of Object.keys(original.attributes))assert.ok(view(a,original.attributes[key]).equals(view(b,actual.attributes[key])),`${family} changed original ${key}`);
   assert.ok(view(a,original.indices).equals(view(b,actual.indices)),`${family} changed source triangles`);
  }
 }
});
