import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SAGUARO_NAMES,saguaroGeometry} from '../src/saguaro.js';
import {natureAssetsForTheme,natureModelFilesForTheme} from '../src/nature-assets.js';

test('Cactus distance meshes preserve silhouette, outward normals, and a bounded geometry cost',()=>{
 const forms=[];
 for(const name of SAGUARO_NAMES){
  const levels=[0,1].map(lod=>saguaroGeometry(name,lod));
  for(const [lod,g]of levels.entries()){
   assert.ok(g.index.count/3<(lod?1800:16500));
   for(const attribute of Object.values(g.attributes))assert.ok(attribute.array.every(Number.isFinite));
   const p=g.attributes.position,n=g.attributes.normal;
   let outside=0,samples=0;for(let i=0;i<p.count;i++)if(p.getY(i)<.4){outside+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);samples++;}
   assert.ok(samples>20&&outside/samples>.12,`${name}: inward-facing trunk`);
   assert.ok(g.boundingBox.min.y<0&&g.boundingBox.min.y>-.15,'Base must extend into the ground');
  }
  assert.ok(levels[0].boundingBox.min.distanceTo(levels[1].boundingBox.min)<.03);
  assert.ok(levels[0].boundingBox.max.distanceTo(levels[1].boundingBox.max)<.03);
  forms.push(levels[0].boundingBox.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(1)).join('/'));
  levels.forEach(g=>g.dispose());
 }
 assert.equal(new Set(forms).size,3,'Mature and young forms need different silhouettes');
});

test('Desert loads its scrub and generates cacti without requesting nonexistent model files',()=>{
 const all=natureAssetsForTheme('desert'),files=natureModelFilesForTheme('desert');
 assert.ok(SAGUARO_NAMES.every(name=>all.includes(name)&&!files.includes(name)));
 assert.ok(files.includes('desert-rock')&&files.includes('woody-scrub')&&files.includes('desert-scrub'));
 assert.ok(!all.includes('dry-tree'));
 for(const theme of ['japanese','highlands','cyberpunk'])assert.ok(!natureAssetsForTheme(theme).some(name=>SAGUARO_NAMES.includes(name)));
});
