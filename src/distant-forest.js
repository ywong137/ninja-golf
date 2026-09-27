import * as THREE from 'three';
import {COURSE_BOUNDS,random} from './course.js';
import {landscapeHeight} from './regional-terrain.js';
import {treeImpostor} from './foliage-materials.js';
import {selectForestSpecies} from './nature-species.js';
import {buildForestShadows} from './forest-shadows.js';
export const DISTANT_FOREST_LIMITS={japanese:2800,highlands:1200};

export function distantForestPlacements(c,region,sampledHeight=null){
 const limit=DISTANT_FOREST_LIMITS[c.theme];if(!limit||!region)return[];
 const height=(x,z)=>sampledHeight?.(x,z)??landscapeHeight(c,region,x,z);
 const japanese=c.theme==='japanese',r=random(c.seed+91357),records=[],occupied=new Set(),spacing=japanese?13:17;
 // Alternating belts leave broad landscape windows, rather than forming a solid wall.
 const clusters=japanese?58:30;
 for(let grove=0;grove<clusters&&records.length<limit;grove++){
  const band=grove%3,distance=360+band*520+r()*340;
  const angle=japanese?Math.PI*.58+r()*Math.PI*.84:r()*Math.PI*2;
  const cx=Math.cos(angle)*distance,cz=c.length*.5+Math.sin(angle)*(distance+c.length*.25);
  const long=110+r()*170,short=55+r()*80,rotation=r()*Math.PI,cos=Math.cos(rotation),sin=Math.sin(rotation);
  for(let i=0;i<(japanese?105:75)&&records.length<limit;i++){
   const a=r()*Math.PI*2,rad=Math.sqrt(r()),u=Math.cos(a)*rad*long,v=Math.sin(a)*rad*short;
   const x=cx+u*cos-v*sin,z=cz+u*sin+v*cos;
   // Whole crowns remain beyond the player/ball bounds, including tee and end margins.
   const clearance=65;
   if(x>COURSE_BOUNDS.minX-clearance&&x<COURSE_BOUNDS.maxX+clearance&&z>COURSE_BOUNDS.minZ-clearance&&z<c.length+COURSE_BOUNDS.endMargin+clearance)continue;
   // Preserve the open ocean horizon and keep Highland summits treeless.
   if(japanese&&x>75)continue;
   const y=height(x,z);if(y<4||!Number.isFinite(y)||!japanese&&y>260)continue;
   const gx=(height(x+8,z)-height(x-8,z))/16,gz=(height(x,z+8)-height(x,z-8))/16;
   if(Math.hypot(gx,gz)>.48)continue;
   const cellX=Math.floor(x/spacing),cellZ=Math.floor(z/spacing);let crowded=false;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(occupied.has(`${cellX+dx},${cellZ+dz}`))crowded=true;
   if(crowded)continue;occupied.add(`${cellX},${cellZ}`);
   records.push({x,z,y:y-.12,scale:(japanese?.82:.72)+r()*.56,angle:r()*Math.PI*2,grove,species:selectForestSpecies(c.theme,r())});
  }
 }
 return records;
}

// Uses a bounded set of loaded tree atlases. World cleanup owns per-course meshes/materials.
export function buildDistantForest(root,c,region,source,sampledHeight=null,materialFactory=treeImpostor){
 if(!DISTANT_FOREST_LIMITS[c.theme])return{mesh:null,records:[]};
 if(!source?.map||!source?.normalMap||!Number.isFinite(source.span)||!Number.isFinite(source.center))throw new Error('Distant forest needs the loaded forest-canopy atlas and normal atlas.');
 const records=distantForestPlacements(c,region,sampledHeight);if(!records.length)return{mesh:null,records};
 const meshes=[],shadows=[],allRecords=records;
 for(const entry of source.species||[{source}]){
 const records=entry.name?allRecords.filter(p=>p.species===entry.name):allRecords,source=entry.source;
 if(!records.length)continue;
 if(!source?.map||!source?.normalMap)throw new Error(`Missing forest atlas for ${entry.name}`);
 const geometry=new THREE.PlaneGeometry(source.span,source.span);geometry.translate(0,source.center,0);
 const material=materialFactory(source,{nearFade:false}),mesh=new THREE.InstancedMesh(geometry,material,records.length),transform=new THREE.Object3D();
 mesh.name='Distant forest belt';mesh.userData.species=entry.name||'forest-canopy';mesh.castShadow=false;mesh.receiveShadow=false;
 for(const [i,p]of records.entries()){transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.angle,0);transform.scale.setScalar(p.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);}
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
 const shadow=buildForestShadows(records,source,(x,z)=>sampledHeight?.(x,z)??landscapeHeight(c,region,x,z));
 root.add(shadow,mesh);meshes.push(mesh);shadows.push(shadow);
 }
 return{mesh:meshes[0],shadow:shadows[0],meshes,shadows,records:allRecords};
}
