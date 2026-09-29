import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {measureTriangleHeadClearance as measureSurfaceClearance} from '../tools/blade-head-surface.mjs';
test('Ace recovery keeps the two leg surfaces apart',async t=>{
// The shared triangle checker accepts arbitrary skinned surface regions.
// Exclude the connected upper-thigh seam, where both legs join the pelvis.
const g=await loadNativeSkin(new URL('../public/models/kaede.glb',import.meta.url));g.scene.updateMatrixWorld(true);const surfaces={r:[],l:[]},p=n=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const {skinIndex,skinWeight,position}=mesh.geometry.attributes,index=mesh.geometry.index;const weights=side=>Array.from({length:position.count},(_,i)=>{let sum=0;for(let k=0;k<4;k++)if(new RegExp('^(thigh|calf|foot|ball)_'+side+'$').test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))sum+=skinWeight.getComponent(i,k);return sum});for(const s of ['r','l']){const w=weights(s),hip=p('thigh_'+s),axis=p('calf_'+s).sub(hip),tris=[];for(let i=0;i<(index?index.count:position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.some(v=>w[v]<.65))continue;const center=ids.reduce((a,v)=>a.add(mesh.getVertexPosition(v,new T.Vector3()).applyMatrix4(mesh.matrixWorld)),new T.Vector3()).multiplyScalar(1/3);if(center.clone().sub(hip).dot(axis)/axis.lengthSq()<.2)continue;tris.push(ids);}if(tris.length)surfaces[s].push({mesh,triangles:tris});}});
const clip=g.animations.find(c=>c.name==='Fan_Heavy_Rising'),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();const result={samples:0,triangles:Object.fromEntries(['r','l'].map(s=>[s,surfaces[s].reduce((n,m)=>n+m.triangles.length,0)])),minimum:.10,crossings:0,closest:null};
for(let i=0;i<=Math.ceil(clip.duration*480);i++){const time=Math.min(i/480,clip.duration);a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);const query={leftLeg:[]};for(const {mesh,triangles}of surfaces.l){mesh.skeleton.update();const cache=new Map();for(const ids of triangles)query.leftLeg.push(ids.map(i=>{if(!cache.has(i))cache.set(i,mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));return cache.get(i)}));}const m=measureSurfaceClearance(surfaces.r,query,{distanceCap:.10});result.samples++;result.crossings+=m.crossings;if(m.minimumClearance<result.minimum){result.minimum=m.minimumClearance;result.closest={time,...m.closest}};}
t.diagnostic(JSON.stringify(result));
assert.ok(result.triangles.r>500&&result.triangles.l>500,'Missing central thigh, calf, or shoe surfaces');
assert.equal(result.crossings,0,'The leg surfaces intersect');
assert.ok(result.minimum>.003,'The recovery step must clear the other leg');
});
