import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalSunVisibility} from '../src/regional-lighting.js';
import {regionalVisibilityAt} from '../src/regional-terrain.js';
import {COURSE_SETS} from '../src/course.js';

test('A flat landscape remains sunlit, including every grid boundary',()=>{
 for(const direction of [-1,1]){
  const region={size:33,heights:new Int16Array(33*33).fill(100),span:320,scale:.7,datum:20,direction};
  assert.ok(regionalSunVisibility(region).heights.every(v=>v===255));
 }
});

test('Terrain shadows match independent sun rays for both map orientations and all diagonal azimuths',()=>{
 const n=25,heights=new Int16Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)heights[z*n+x]=Math.round(20+19*Math.sin(x*.7)+15*Math.cos(z*.9));
 let checked=0,lit=0,shadowed=0;
 for(const direction of [-1,1])for(const sx of [-1,1])for(const sz of [-1,1]){
  const region={size:n,heights,span:240,scale:.8,datum:0,direction},sun=[sx,.6,sz],mask=regionalSunVisibility(region,sun).heights;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const origin=heights[z*n+x]*region.scale;let clearance=-Infinity;
   for(let step=1;;step++){
    const tx=x+sx*step,tz=z+sz*direction*step;if(tx<0||tx>=n||tz<0||tz>=n)break;
    const distance=Math.hypot(tx-x,tz-z)*10,ray=origin+distance*sun[1]/Math.hypot(sun[0],sun[2]);
    clearance=Math.max(clearance,heights[tz*n+tx]*region.scale-ray);
   }
   if(clearance>1.51){assert.equal(mask[z*n+x],0);shadowed++;checked++;}
   if(clearance<-.51){assert.equal(mask[z*n+x],255);lit++;checked++;}
  }
 }
 assert.ok(checked>4500);assert.ok(lit>1000);assert.ok(shadowed>1000);
});

test('The course and immediate surroundings never inherit distant mountain shadows',()=>{
 const c=COURSE_SETS[2].holes[0],region={size:2,sunVisibility:{size:2,heights:new Uint8Array(4)},span:14000,u:.5,v:.5,direction:-1};
 for(const x of [0,300,900,1275])assert.equal(regionalVisibilityAt(c,region,x,c.length/2),1);
 assert.ok(regionalVisibilityAt(c,region,1800,c.length/2)>0);
 assert.ok(regionalVisibilityAt(c,region,1800,c.length/2)<1);
 assert.equal(regionalVisibilityAt(c,region,2600,c.length/2),0);
 assert.equal(regionalVisibilityAt(c,null,2600,c.length/2),1);
});

test('Unsupported light directions fail with an actionable error',()=>{
 const region={size:2,heights:new Int16Array(4),span:10,scale:1,datum:0,direction:1};
 for(const sun of [[0,1,1],[1,0,1],[1,1,.2]])assert.throws(()=>regionalSunVisibility(region,sun),/elevated diagonal sun/);
});
