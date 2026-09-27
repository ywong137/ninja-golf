import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,heightAt} from '../src/course.js';
import {buildThemeScenery} from '../src/course-themes.js';
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

test('Theme stone faces preserve meter-scale texture density without changing shared textures',()=>{
 const texture=new THREE.Texture();
 for(const set of COURSE_SETS.slice(1)){
  const root=new THREE.Group();buildThemeScenery(root,set.holes[0],[],{rock:texture,normal:texture});let checked=0;
  root.traverse(mesh=>{if(mesh.material?.map!==texture)return;const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
   for(let i=0;i<p.count;i+=3){if(i+2>=p.count)break;const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1).sub(a),c=new THREE.Vector3().fromBufferAttribute(p,i+2).sub(a),area=b.cross(c).length();
    const du=uv.getX(i+1)-uv.getX(i),dv=uv.getY(i+1)-uv.getY(i),eu=uv.getX(i+2)-uv.getX(i),ev=uv.getY(i+2)-uv.getY(i),uvArea=Math.abs(du*ev-dv*eu);if(area<.0001||uvArea<.0001)continue;
    assert.ok(Math.abs(area/uvArea-1.25**2)<.03,`${set.theme}: stretched stone face`);checked++;
   }
  });assert.ok(checked>25);assert.deepEqual(texture.repeat.toArray(),[1,1]);dispose(root);
 }
 texture.dispose();
});

test('Desert and city paired doors meet their agreed entry levels within existing building fronts',()=>{
 for(const theme of [2,3]){
  const c=COURSE_SETS[theme].holes[0],root=new THREE.Group();buildThemeScenery(root,c,[]);
  for(const site of root.userData.landmarks){
   const front=site.z-(theme===2?7.08:9.55),threshold=theme===2?heightAt(c,site.x,site.z-7.1)+.06:site.y;let lowest=Infinity;
   root.traverse(mesh=>{if(mesh.material?.color.getHexString()!==(theme===2?'314546':'385f79'))return;const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-site.x)<1.18&&Math.abs(p.getZ(i)-front)<.12)lowest=Math.min(lowest,p.getY(i));
   });assert.ok(Math.abs(lowest-threshold-.06)<.005,`${c.name}: doorway floats above its approach`);
  }dispose(root);
 }
});

test('Facade detail remains batched and within the agreed cyber geometry increase',()=>{
 for(const [index,set]of COURSE_SETS.slice(1).entries()){
  const root=new THREE.Group();buildThemeScenery(root,set.holes[0],[]);assert.ok(root.children.every(o=>o.userData.architectureTheme===set.theme));const facade=root.children.filter(o=>!o.userData.cyberFixtureBatch),fixtures=root.children.filter(o=>o.userData.cyberFixtureBatch);assert.ok(facade.length<=[3,7,8][index]);assert.ok(fixtures.length<=(set.theme==='cyberpunk'?3:0));
  const triangles=facade.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0);
  if(set.theme==='cyberpunk'){assert.ok(triangles<=30224+20000);const fixtureTriangles=fixtures.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);assert.ok(fixtureTriangles<=root.userData.cyberFixtures.length*600);}dispose(root);
 }
});

test('Highland foundation courses cover front, rear, inner, and outer wall faces below the raised floor',()=>{
 for(const c of COURSE_SETS[1].holes){const root=new THREE.Group();buildThemeScenery(root,c,[]);const mesh=root.children.find(m=>m.userData.architectureTheme==='highlands'),p=mesh.geometry.attributes.position;
  for(const foot of root.userData.buildingObstacles.filter(o=>o.id.includes('tower-foot')||o.id.endsWith('rear-foot'))){
   for(const [axis,side]of [['x',-1],['x',1],['z',-1],['z',1]]){let dressed=false;
    for(let i=0;i<p.count&&!dressed;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y>=foot.maxY-.12||y<foot.minY-.7)continue;
     const projection=axis==='x'?(x-foot.x)*side-foot.halfWidth:(z-foot.z)*side-foot.halfDepth,other=axis==='x'?Math.abs(z-foot.z)-foot.halfDepth:Math.abs(x-foot.x)-foot.halfWidth;
     if(projection>.025&&projection<.2&&other<.1)dressed=true;
    }
    assert.ok(dressed,`${c.name}: bare ${axis}/${side} foundation face ${foot.id}`);
   }
  }dispose(root);
 }
});
