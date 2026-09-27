import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,fairwayDistance,mapOutlines,lieAt} from '../src/course.js';
import {segments,MAX_FAIRWAY_SEGMENTS,sculptFairways} from '../src/course-layout.js';
const distanceToLine=(x,z,s)=>{const dx=s[2]-s[0],dz=s[3]-s[1],t=Math.max(0,Math.min(1,((x-s[0])*dx+(z-s[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-s[0]-dx*t,z-s[1]-dz*t);};
function insidePolygon(x,z,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
test('All 36 centerlines genuinely curve while preserving authored landing anchors and path separation',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const old=segments(c.layout.fairways),curved=c.layout.curvedPaths;
  assert.equal(curved.length,c.layout.fairways.length);assert.ok(c.layout.segments.length<=MAX_FAIRWAY_SEGMENTS);
  let excursion=0;
  for(const path of curved)for(const p of path){excursion=Math.max(excursion,Math.min(...old.map(s=>distanceToLine(p[0],p[1],s))));assert.ok(fairwayDistance(c,p[0],p[1])<0);assert.ok(p[2]>=6);}
  assert.ok(excursion>1.2,`${c.name} still has a straight centerline`);
  for(const path of c.layout.fairways)for(const [x,z,w]of path)assert.ok(fairwayDistance(c,x,z)<-w*.60,`${c.name}: landing anchor lost`);
  const copy=JSON.parse(JSON.stringify(c));assert.deepEqual(sculptFairways(copy),c.layout.segments,'Curves must not drift across rebuilds');
 }
});
test('Rendered map unions agree with physical curved lies across every hole',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const polygons=mapOutlines(c);let covered=0,rough=0;
  for(let z=9;z<c.length+25;z+=13)for(let x=-135;x<130;x+=11){const d=fairwayDistance(c,x,z);if(Math.abs(d)<.3)continue;const mapInside=polygons.some(p=>insidePolygon(x,z,p));assert.equal(mapInside,d<0,`${c.name}: map boundary ${x},${z}`);if(d<0){covered++;assert.ok(['Fairway','Tee','Green','Bunker','Water'].includes(lieAt(c,x,z)));}else rough++;}
  assert.ok(covered>10&&rough>10);
 }
});
test('Detached island pads have asymmetric shapes instead of repeated circles',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes))for(const [index,path]of c.layout.fairways.entries())if(path.length===1){const [x,z,w]=path[0],p=c.layout.curvedPaths[index];assert.ok(p.length>=5);assert.ok(Math.hypot(p[0][0]-x,p[0][1]-z)>.25*w);assert.notEqual(p[0][2],p.at(-1)[2]);}
});
test('The broad Highland elbow keeps its turn radius outside the inner fairway bank',()=>{
 const p=COURSE_SETS[1].holes[2].layout.curvedPaths[0];let checked=0;
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1];if(b[1]<190||b[1]>260)continue;
  const dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-b[0],ez=c[1]-b[1];
  const radius=Math.hypot(dx,dz)*Math.hypot(ex,ez)*Math.hypot(c[0]-a[0],c[1]-a[1])/(2*Math.abs(dx*ez-dz*ex));
  assert.ok(radius>b[2],`Inner bank folds at sample ${i}: radius ${radius}, width ${b[2]}`);checked++;
 }
 assert.ok(checked>=8);
});
