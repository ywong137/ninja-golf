import * as THREE from 'three';
import {COURSE_BOUNDS,random,smooth} from './course.js';
import {treeImpostor} from './foliage-materials.js';
import {buildForestShadows} from './forest-shadows.js';

export const SHRUB_DETAIL=Object.freeze({
 'woody-scrub':{nearStart:24,nearEnd:28,farStart:160,farEnd:180},
 'desert-scrub':{nearStart:38,nearEnd:42,farStart:260,farEnd:300},
});
export const UNDERSTORY_LIMITS=Object.freeze({highlands:9000,desert:14000});

// Independent seeds preserve the existing course layout, cover and collisions.
// Elliptical patches follow gentle slopes and leave broad windows between them.
export function landscapeUnderstoryPlacements(c,height){
 const limit=UNDERSTORY_LIMITS[c.theme];if(!limit||!height)return [];
 const desert=c.theme==='desert',r=random(c.seed+918251),records=[],cells=new Map(),spacing=desert?2.8:2.5;
 for(let patch=0;patch<(desert?155:115)&&records.length<limit;patch++){
  const angle=r()*Math.PI*2,distance=330+Math.pow(r(),1.3)*1100;
  const cx=Math.cos(angle)*distance,cz=c.length*.5+Math.sin(angle)*(distance+c.length*.25);
  const major=45+r()*90,minor=20+r()*45,yaw=r()*Math.PI,co=Math.cos(yaw),si=Math.sin(yaw);
  for(let i=0;i<120&&records.length<limit;i++){
   const a=r()*Math.PI*2,rad=Math.sqrt(r()),u=Math.cos(a)*rad*major,v=Math.sin(a)*rad*minor;
   const x=cx+u*co-v*si,z=cz+u*si+v*co;
   if(x>COURSE_BOUNDS.minX-65&&x<COURSE_BOUNDS.maxX+65&&z>COURSE_BOUNDS.minZ-65&&z<c.length+COURSE_BOUNDS.endMargin+65)continue;
   const y=height(x,z);if(!Number.isFinite(y)||y<4)continue;
   const dx=(height(x+3,z)-height(x-3,z))/6,dz=(height(x,z+3)-height(x,z-3))/6,slope=Math.hypot(dx,dz);
   if(!Number.isFinite(slope)||slope>.48||r()<smooth(desert?330:160,desert?540:300,y))continue;
   const cellX=Math.floor(x/spacing),cellZ=Math.floor(z/spacing);let crowded=false;
   for(let gx=-1;gx<=1;gx++)for(let gz=-1;gz<=1;gz++)for(const p of cells.get(`${cellX+gx},${cellZ+gz}`)||[])if(Math.hypot(p.x-x,p.z-z)<spacing)crowded=true;
   if(crowded)continue;
   const record={x,z,y:y-.045,scale:(desert?.85:.65)+r()*(desert?.90:.65),angle:r()*Math.PI*2,patch,species:desert&&r()<.78?'desert-scrub':'woody-scrub'};
   const key=`${cellX},${cellZ}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(record);records.push(record);
  }
 }
 return records;
}

export function buildLandscapeUnderstory(root,c,sources,height){
 const records=landscapeUnderstoryPlacements(c,height),meshes=[],shadows=[];
 for(const [name,source]of Object.entries(sources)){
  const group=records.filter(r=>r.species===name);if(!group.length)continue;
  if(!source?.map||!source?.normalMap||!source?.shadowMap)throw new Error(`Missing ${name} shrub atlas; load the course scenery first.`);
  const geometry=new THREE.PlaneGeometry(source.span,source.span);geometry.translate(0,source.center,0);
  const material=treeImpostor(source,{nearFade:false});if(c.theme==='desert'&&name==='woody-scrub')material.color.set('#e3d7ae');
  const mesh=new THREE.InstancedMesh(geometry,material,group.length),transform=new THREE.Object3D();mesh.name='Distant shrub patches';mesh.userData.species=name;
  for(const [i,p]of group.entries()){transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.angle,0);transform.scale.setScalar(p.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  const shadow=buildForestShadows(group,source,height,{grid:1});shadow.name='Distant shrub ground silhouettes';root.add(shadow,mesh);meshes.push(mesh);shadows.push(shadow);
 }
 return {records,meshes,shadows};
}
