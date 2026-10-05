import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,lieAt,fairwayDistance,routePoint,heightAt} from '../src/course.js';
import {buildArchitecture,pagodaLocation,pagodaStairs} from '../src/architecture.js';
import {buildThemeScenery} from '../src/course-themes.js';
import {createCoursePath} from '../src/course-path.js';
import {desertEntranceSteps} from '../src/desert-clubhouse.js';
const cleanup=root=>root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
const build=(root,c)=>{const sites=[];if(c.theme==='japanese')buildArchitecture(root,c,{color:null,normal:null});else buildThemeScenery(root,c,sites);return sites;};
const inside=(ob,x,y,z)=>y>=ob.minY&&y<=ob.maxY&&(ob.kind==='box'?Math.abs(x-ob.x)<ob.halfWidth&&Math.abs(z-ob.z)<ob.halfDepth:Math.hypot(x-ob.x,z-ob.z)<ob.radius);

test('All36 building compounds avoid water, fairways, greens, bounds and actual walking paths',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const root=new THREE.Group(),path=createCoursePath(c,{});root.userData.pathContains=path.userData.contains;const sites=build(root,c);
  const obstacles=root.userData.buildingObstacles;assert.ok(obstacles.length>0&&obstacles.length<200);assert.equal(new Set(obstacles.map(o=>o.id)).size,obstacles.length);
  for(const site of root.userData.landmarks){
   assert.ok(sites.every(s=>['sand','water'].includes(s.kind)||Math.abs(s.x-site.x)>=site.halfWidth+3||Math.abs(s.z-site.z)>=site.halfDepth+3),'Building hides an existing ambush site');
   for(let x=site.x-site.halfWidth;x<=site.x+site.halfWidth;x+=1.5)for(let z=site.z-site.halfDepth;z<=site.z+site.halfDepth;z+=1.5){
    assert.ok(!['Water','Out of bounds','Green','Tee','Bunker'].includes(lieAt(c,x,z)),`${c.name}: unsafe building at ${x},${z}`);assert.ok(fairwayDistance(c,x,z)>5);assert.equal(path.userData.contains(x,z,2),false);
   }
  }
  for(const o of obstacles){assert.ok([o.x,o.z,o.minY,o.maxY,o.radius??o.halfWidth,o.radius??o.halfDepth].every(Number.isFinite));assert.ok(o.maxY>o.minY);}
  const snapshot=JSON.stringify(obstacles);cleanup(root);root.clear();root.userData={pathContains:path.userData.contains};build(root,c);assert.equal(JSON.stringify(root.userData.buildingObstacles),snapshot,'Course reconstruction must not drift or accumulate records');
  cleanup(root);path.geometry.dispose();path.material.dispose();
 }
});

test('Gate, Highland arch and resort porch preserve overhead clearance',()=>{
 for(const theme of [0,1,2]){
  const c=COURSE_SETS[theme].holes[0],root=new THREE.Group();build(root,c);const obstacles=root.userData.buildingObstacles;
  if(theme===0){const y=heightAt(c,-13,-8);assert.equal(obstacles.some(o=>inside(o,-13,y+1,-8)),false);assert.ok(obstacles.some(o=>inside(o,-13,y+6.35,-8)));assert.ok(obstacles.some(o=>o.id==='jp-pagoda-foundation'));}
  else for(const [k,site]of root.userData.landmarks.entries()){
   const z=site.z-(theme===2?10:0);assert.equal(obstacles.some(o=>inside(o,site.x,site.y+1,z)),false);
   assert.ok(obstacles.some(o=>inside(o,site.x,site.y+(theme===2?4.3:7.5),z)),`${c.name}: missing overhead collision`);
  }
  cleanup(root);
 }
});

test('Cyber districts span both sides and use four facade bodies per tower cluster',()=>{
 for(const c of COURSE_SETS[3].holes){const root=new THREE.Group();build(root,c);const sites=root.userData.landmarks,signs=sites.map((s,k)=>Math.sign(s.x-routePoint(c,(k+.38+(k%2)*.18)/5).x));assert.ok(signs.includes(-1)&&signs.includes(1));
  const bodies=root.userData.buildingObstacles.filter(o=>/tower-\d$/.test(o.id));assert.equal(bodies.length,20);assert.ok(new Set(bodies.map(o=>(o.maxY-o.minY).toFixed(2))).size>8);assert.ok(root.children.length<=10,'Facade detail must merge into a finite material palette');cleanup(root);
 }
});


test('Pagoda stairs meet local ground and rise continuously inside every safe footprint',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const root=new THREE.Group(),path=createCoursePath(c,{});root.userData.pathContains=path.userData.contains;
  const site=pagodaLocation(c,root),steps=pagodaStairs(c,site);assert.ok(steps.length>=5&&steps.length<=22);
  for(const [i,s]of steps.entries()){
   assert.ok(s.z-s.depth/2>=site.z-12);assert.ok(s.z+s.depth/2<=site.z-7.3);assert.ok(s.depth>=.19);
   if(i)assert.ok(s.top>steps[i-1].top&&s.top-steps[i-1].top<=.191);
   for(let dx=-4;dx<=4;dx+=.5){const ground=heightAt(c,s.x+dx,s.z);assert.ok(s.bottom<ground,`${c.name}: floating stair base`);assert.ok(s.top>ground,`${c.name}: buried tread`);}
  }
  const first=steps[0];for(let dx=-4;dx<=4;dx+=.5){const ground=heightAt(c,first.x+dx,first.z-first.depth/2);assert.ok(first.top-ground<.45,`${c.name}: first stair rises above the approach`);}
  assert.ok(Math.abs(steps.at(-1).top-(site.y+1.2))<1e-8,'Top tread must meet the foundation deck');
  path.geometry.dispose();path.material.dispose();
 }
});

test('Desert entry stairs meet their terrace without floating, buried treads or redundant route corners',()=>{
 for(const c of COURSE_SETS[2].holes){
  const root=new THREE.Group(),path=createCoursePath(c,{});root.userData.pathContains=path.userData.contains;build(root,c);
  for(const [index,site]of root.userData.landmarks.entries()){
   const steps=desertEntranceSteps(c,site),obs=root.userData.buildingObstacles.filter(o=>o.id.startsWith(`desert-${index}-entrance-step-`));
   assert.equal(steps.length,obs.length);assert.ok(steps.length>=2);assert.equal(obs.filter(o=>!o.navigationSkip).length,1);
   assert.ok(Math.abs(steps.at(-1).top-site.y-.045)<1e-8);
   for(const [i,s]of steps.entries()){
    assert.ok(s.depth>=.25,`${c.name}: narrow tread`);
    if(i)assert.ok(s.top>steps[i-1].top&&s.top-steps[i-1].top<=.18001);
    for(let dx=-s.width/2;dx<=s.width/2;dx+=.25){
     const ground=heightAt(c,s.x+dx,s.z);assert.ok(s.bottom<ground,`${c.name}: floating stair`);assert.ok(s.top>ground,`${c.name}: buried tread`);
    }
   }
  }
  assert.equal(root.children.filter(o=>o.userData.architectureTheme==='desert').length,8,'Both buildings share eight material batches');
  cleanup(root);path.geometry.dispose();path.material.dispose();
 }
});

test('Cyber rooftop lighting occupies narrow trims rather than luminous slabs',()=>{
 const root=new THREE.Group();build(root,COURSE_SETS[3].holes[0]);const roofs=root.userData.buildingObstacles.filter(o=>/tower-[23]$/.test(o.id));
 for(const roof of roofs){let luminousArea=0,darkArea=0;
  root.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
   for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),vs=ids.map(k=>new THREE.Vector3().fromBufferAttribute(p,k)),center=vs[0].clone().add(vs[1]).add(vs[2]).multiplyScalar(1/3);
    if(Math.abs(center.x-roof.x)>roof.halfWidth+.2||Math.abs(center.z-roof.z)>roof.halfDepth+.2||center.y<roof.maxY-.001||center.y>roof.maxY+.17)continue;
    const cross=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0]));if(cross.y<=0||cross.y/cross.length()<.99)continue;
    if(mesh.material.emissiveIntensity>0&&mesh.material.emissive.getHex()!==0)luminousArea+=cross.y/2;else darkArea+=cross.y/2;
   }
  });
  assert.ok(darkArea>roof.halfWidth*roof.halfDepth*3.8);assert.ok(luminousArea/(roof.halfWidth*roof.halfDepth*4)<.075,'Roof became a glowing plate');
 }
 cleanup(root);
});
