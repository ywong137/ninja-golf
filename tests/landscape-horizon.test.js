import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {landscapeHorizon,HORIZON_TRIANGLE_LIMIT} from '../src/landscape-horizon.js';
import {loadRegionalTerrain,landscapeHeight} from '../src/regional-terrain.js';
import {createTerrainSurfaceSampler} from '../src/terrain-surface.js';
import {COURSE_SETS,heightAt,random} from '../src/course.js';
async function localRegions(){const saved=globalThis.fetch;globalThis.fetch=async url=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(new URL(`../public/${url}`,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});try{return await loadRegionalTerrain('');}finally{globalThis.fetch=saved;}}
test('Real DEM refinement reduces surface error within the triangle budget',async()=>{
 const regions=await localRegions();
 for(const set of COURSE_SETS.slice(0,3)){
  const c=set.holes[0],region=regions[c.theme],coarse=landscapeHorizon(c,region,{refine:false}),fine=landscapeHorizon(c,region),a=createTerrainSurfaceSampler(coarse),b=createTerrainSurfaceSampler(fine),r=random(82451);let oldError=0,newError=0,count=0;
  for(let i=0;i<10000;i++){const x=(r()-.5)*11000,z=(r()-.5)*11000+c.length*.5,ya=a(x,z),yb=b(x,z);if(ya===null||yb===null)continue;const target=landscapeHeight(c,region,x,z);oldError+=(ya-target)**2;newError+=(yb-target)**2;count++;}
  assert.ok(count>9900);assert.ok(newError<oldError*.36,`${c.theme}: RMS error must decrease by at least40%`);
  assert.ok(fine.index.count/3<=HORIZON_TRIANGLE_LIMIT);coarse.dispose();fine.dispose();
 }
});
test('Horizon faces share corner normals without cracks and preserve course edge shading',async()=>{
 const regions=await localRegions(),c=COURSE_SETS[2].holes[0],geometry=landscapeHorizon(c,regions.desert),expected=geometry.clone();expected.computeVertexNormals();
 const p=geometry.attributes.position,n=geometry.attributes.normal,en=expected.attributes.normal,positions=new Set(),edges=new Map();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),key=`${x},${z}`;assert.ok(!positions.has(key),`duplicate vertex at${key}`);positions.add(key);
  const boundary=(Math.abs(x)===375&&z>=-165&&z<=c.length+165)||(x>=-375&&x<=375&&(z===-165||z===c.length+165));
  if(boundary){assert.ok(Math.abs(p.getY(i)-heightAt(c,x,z))<.00003);const nx=heightAt(c,x-.15,z)-heightAt(c,x+.15,z),nz=heightAt(c,x,z-.15)-heightAt(c,x,z+.15),length=Math.hypot(nx,.3,nz);assert.ok(Math.abs(n.getY(i)-.3/length)<1e-5);}
  else assert.ok(Math.abs(n.getX(i)-en.getX(i))+Math.abs(n.getY(i)-en.getY(i))+Math.abs(n.getZ(i)-en.getZ(i))<1e-6);
  assert.ok(n.getY(i)>0);assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
 }
 const index=geometry.index;
 for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);}
 for(const [key,count]of edges){assert.ok(count<=2);if(count===1){const [a,b]=key.split(':').map(Number),x=p.getX(a),z=p.getZ(a);assert.ok((x===p.getX(b)&&[375,-375,6475,-6475].includes(x))||(z===p.getZ(b)&&[-165,c.length+165,-6265,c.length+6265].includes(z)),`open interior edge${key}`);}}
 geometry.dispose();expected.dispose();
});
