import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {sampleElevation,landscapeHeight} from '../src/regional-terrain.js';
import {COURSE_SETS,heightAt} from '../src/course.js';
test('regional grids match source metadata and retain different surveyed landforms',()=>{
 const sources=JSON.parse(fs.readFileSync('public/terrain/SOURCES.json'));assert.equal(sources.length,3);
 const hashes=new Set();for(const source of sources){const data=fs.readFileSync(`public/terrain/${source.file}`);assert.equal(data.length,513*513*2);const hash=crypto.createHash('sha256').update(data).digest('hex');assert.equal(hash,source.sha256);hashes.add(hash);assert.ok(source.maxMetres-source.minMetres>400);}
 assert.equal(hashes.size,3);
});
test('regional terrain preserves every detailed mesh edge and all playable positions',()=>{
 const region={size:2,heights:new Int16Array([1000,500,1500,900]),u:.5,v:.5,span:12000,direction:1,datum:0,scale:1};
 for(const set of COURSE_SETS)for(const c of set.holes){for(const [x,z]of [[-375,100],[375,100],[0,-165],[0,c.length+165],[100,100],[-240,-90],[240,c.length+120]])assert.equal(landscapeHeight(c,region,x,z),heightAt(c,x,z));}
});
test('elevation sampling is bilinear, bounded, finite and leaves no far-boundary discontinuity',()=>{
 const region={size:2,heights:new Int16Array([0,100,200,300]),u:.5,v:.5,span:12000,direction:1,datum:0,scale:1};
 assert.equal(sampleElevation(region,.5,.5),150);assert.equal(sampleElevation(region,-1,-1),0);assert.ok(sampleElevation(region,2,2)<301);
 const c=COURSE_SETS[0].holes[0];for(const x of [414.99,415.01,1924.99,1925.01]){assert.ok(Number.isFinite(landscapeHeight(c,region,x,100)));assert.ok(Math.abs(landscapeHeight(c,region,x+.01,100)-landscapeHeight(c,region,x-.01,100))<.1);}
});
test('one failed regional asset preserves the other theme grids',async()=>{
 const {loadRegionalTerrain}=await import('../src/regional-terrain.js'),fetch=globalThis.fetch,warn=console.warn,warnings=[];
 globalThis.fetch=async url=>url.includes('highlands')?{ok:false,status:503}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(513*513*2)};console.warn=e=>warnings.push(e.message);
 try{const regions=await loadRegionalTerrain('/');assert.deepEqual(Object.keys(regions).sort(),['desert','japanese']);assert.match(warnings[0],/highlands.*503/);}finally{globalThis.fetch=fetch;console.warn=warn;}
});
test('graded horizon triangles face upward and retain an exact detailed edge',async()=>{
 const {landscapeHorizon}=await import('../src/landscape-horizon.js'),c=COURSE_SETS[0].holes[0],geometry=landscapeHorizon(c),p=geometry.attributes.position,index=geometry.index;
 assert.ok(p.count<130000);for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),d=index.getX(i+2);const cross=(p.getZ(b)-p.getZ(a))*(p.getX(d)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(d)-p.getZ(a));assert.ok(cross>0);}
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(Math.abs(x)===375||z===-165||z===c.length+165)assert.ok(Math.abs(p.getY(i)-heightAt(c,x,z))<.00003);}
 geometry.dispose();
});
test('regional images use the elevation coordinates with the image row flipped',async()=>{
 const {regionalTextureFrame}=await import('../src/regional-terrain.js');
 for(const set of COURSE_SETS.slice(0,3))for(const c of set.holes)for(const direction of [-1,1]){
  const region={u:.43,v:.57,span:14000,direction};const [u,v,sx,sz]=regionalTextureFrame(c,region);
  for(const [x,z]of [[0,c.length*.5],[-5000,-4000],[5000,4000]]){
   assert.ok(Math.abs(u+x*sx-(region.u+x/region.span))<1e-12);
   assert.ok(Math.abs(v+z*sz-(1-(region.v+direction*(z-c.length*.5)/region.span)))<1e-12);
  }
 }
});
test('regional color maps match verified geographic source bounds and checksums',()=>{
 const elevation=JSON.parse(fs.readFileSync('public/terrain/SOURCES.json')),images=JSON.parse(fs.readFileSync('public/terrain/IMAGERY.json'));
 assert.deepEqual(images.map(i=>i.theme),['highlands','desert']);
 for(const image of images){
  assert.deepEqual(image.bounds,elevation.find(e=>e.theme===image.theme).bounds);
  assert.equal(image.size,2048);assert.equal(image.notice,'Contains modified Copernicus Sentinel data 2024');
  const data=fs.readFileSync('public/terrain/'+image.file);assert.equal(data.length,image.bytes);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),image.sha256);assert.ok(data.length<2100000);
 }
});
