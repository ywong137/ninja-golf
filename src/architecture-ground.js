import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,lieAt,fairwayDistance,ellipse} from './course.js';
import {courseSurfaceHeight} from './terrain.js';
import {SceneryCollision} from './scenery-collision.js';
import {buildingBox} from './building-placement.js';
import {scaleBoxUV} from './architecture-uv.js';

// Static approaches use the existing path texture and draw. Only raised steps add a batch.
export function buildArchitectureGround(root,course,path,sites=[]){
 const obstacles=root.userData.buildingObstacles||[],patches=[],stepGeometry=[],railGeometry=[],cells=new Map();let collision;
 const record={courts:[],connections:[],steps:[],samples:[]};
 const surface=(x,z)=>courseSurfaceHeight(course,x,z,heightAt,ellipse);
 const safe=(x,z,radius=.2,checkBuildings=true)=>{
  for(const [dx,dz]of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]])if(['Water','Out of bounds','Green','Tee','Bunker'].includes(lieAt(course,x+dx,z+dz))||fairwayDistance(course,x+dx,z+dz)<.8)return false;
  if(sites.some(s=>!['water','sand'].includes(s.kind)&&Math.hypot(s.x-x,s.z-z)<(s.radius||.7)+radius+.25))return false;
  return !checkBuildings||!collision.blocked({x,y:heightAt(course,x,z),z},radius,2,true);
 };
 const occupy=(x,z)=>{const key=`${Math.floor(x/5)},${Math.floor(z/5)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([x,z]);};
 const makePatch=(rows,paved,underBuildings=false)=>{
  const positions=[],uv=[],coverage=[],paving=[],indices=[];
  for(const row of rows)for(const p of row){positions.push(p.x,surface(p.x,p.z)+.035,p.z);uv.push(p.x/2.5,p.z/2.5);coverage.push(p.edge??1);paving.push(paved?1:0);}
  const width=rows[0].length;
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<width-1;j++){
   const points=[rows[i][j],rows[i][j+1],rows[i+1][j],rows[i+1][j+1]];
   if(points.some(p=>!safe(p.x,p.z,.2,!underBuildings)))continue;
   const a=i*width+j,b=a+width;indices.push(a,b,a+1,a+1,b,b+1);
   const x=points.reduce((n,p)=>n+p.x,0)/4,z=points.reduce((n,p)=>n+p.z,0)/4;occupy(x,z);record.samples.push({x,z});
  }
  if(!indices.length)return 0;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('pathCoverage',new THREE.Float32BufferAttribute(coverage,1));g.setAttribute('courtPaving',new THREE.Float32BufferAttribute(paving,1));g.setIndex(indices);g.computeVertexNormals();
  // Strip orientation can differ from rectangular patches. Keep all top normals upward.
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2],p=g.attributes.position;if((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))>0){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}}
  g.setIndex(indices);g.computeVertexNormals();patches.push(g);return indices.length/3;
 };
 const rectangle=(x,z,w,d,paved)=>{
  const nx=Math.ceil(w/.65),nz=Math.ceil(d/.65),rows=[];
  for(let iz=0;iz<=nz;iz++){const row=[];for(let ix=0;ix<=nx;ix++){const edge=ix===0||ix===nx||iz===0||iz===nz;row.push({x:x-w/2+w*ix/nx,z:z-d/2+d*iz/nz,edge:edge?.25:1});}rows.push(row);}
  return makePatch(rows,paved,true);
 };
 const connection=(a,b)=>{
  const length=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(length/.6),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,rows=[];
  for(let i=0;i<=n;i++){
   const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;
   if(!safe(x,z,1.35))return null;
   rows.push([-1.25,-1,0,1,1.25].map((side,j)=>({x:x-dz*side,z:z+dx*side,edge:j===0||j===4?0:1})));
  }
  return rows;
 };
 if(course.theme==='cyberpunk')for(const [index,site]of (root.userData.landmarks||[]).entries()){
   const id=`${course.theme}-approach-${index}`;
   const front=site.z-18.5,end=site.z-9.49,width=4.2,run=end-front,threshold=site.y;let entry=-Infinity;
   for(let dx=-width/2;dx<=width/2;dx+=.35)entry=Math.max(entry,heightAt(course,site.x+dx,front));
   const rise=threshold-entry;if(rise<=.12)continue;
   const count=Math.ceil(rise/.19),tread=run/count;
   if(tread<.25)throw new Error(`Entrance slope needs a longer stair: ${course.name}/${id}`);
   for(let i=0;i<count;i++){
    const z=front+(i+.5)*tread,top=entry+rise*(i+1)/count;let low=Infinity;
    for(const dx of [-width/2,0,width/2])for(const dz of [-tread/2,tread/2])low=Math.min(low,heightAt(course,site.x+dx,z+dz));
    const bottom=Math.min(low-.1,top-.04),h=top-bottom,g=new THREE.BoxGeometry(width,h,tread+.012);scaleBoxUV(g,width,h,tread+.012,2.5);g.translate(site.x,(top+bottom)/2,z);stepGeometry.push(g);
    const solid=buildingBox(root,`${id}-step-${i}`,site.x,(top+bottom)/2,z,width,h,tread+.012);
    if(i===0)solid.navigationFootprint={x:site.x,z:(front+end)/2,halfWidth:width/2,halfDepth:run/2+.006,yaw:0};else solid.navigationSkip=true;
    record.steps.push({...solid,top,bottom});
   }
   const rail=(a,b)=>{const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(.032,.032,delta.length(),8).toNonIndexed();g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);railGeometry.push(g);};
   for(const side of [-1,1]){
    const x=site.x+side*(width/2-.14),a=new THREE.Vector3(x,entry+rise/count+1.02,front+tread/2),b=new THREE.Vector3(x,threshold+1.02,end-tread/2);rail(a,b);
    for(const t of [0,1/3,2/3,1]){const point=a.clone().lerp(b,t),step=Math.min(count-1,Math.floor((point.z-front)/tread)),bottom=entry+rise*(step+1)/count;rail(new THREE.Vector3(x,bottom,point.z),point);}
   }
  }
 collision=new SceneryCollision([],obstacles);
 for(const [index,site]of (root.userData.landmarks||[]).entries()){
  const theme=course.theme,id=`${theme}-approach-${index}`,offset=theme==='cyberpunk'?-15:theme==='desert'?-12:theme==='japanese'?-14.4:-5;
  const w=theme==='cyberpunk'?19:theme==='desert'?17:9,d=theme==='cyberpunk'?8.5:theme==='desert'?9:theme==='japanese'?6:7;
  const center={x:site.x,z:site.z+offset},triangles=rectangle(center.x,center.z,w,d,theme!=='highlands');
  if(!triangles)continue;
  const start={x:site.x,z:center.z-d/2+.15};record.courts.push({id,...center,width:w,depth:d,triangles,entry:{x:site.x,z:theme==='cyberpunk'?site.z-9.55:theme==='desert'?site.z-7.1:theme==='japanese'?site.z-11.8:site.z-3}});
  const starts=theme==='cyberpunk'?[-4,4].map(dx=>({x:start.x+dx,z:start.z})):[start];
  const candidates=(path.userData.samplePoints||[]).flatMap(([x,z])=>starts.map(a=>({x,z,start:a,distance:Math.hypot(x-a.x,z-a.z)}))).filter(p=>p.distance>2&&p.distance<65).sort((a,b)=>a.distance-b.distance);
  for(let i=0;i<candidates.length;i+=4){const target=candidates[i],rows=connection(target.start,target);if(rows){makePatch(rows,false);record.connections.push({id,start:{...target.start},end:{x:target.x,z:target.z},width:2.5,length:target.distance});break;}}

 }
 if(patches.length){const old=path.geometry;path.geometry=mergeGeometries([old,...patches]);old.dispose();patches.forEach(g=>g.dispose());}
 if(stepGeometry.length){const material=new THREE.MeshStandardMaterial({map:path.material.map,normalMap:path.material.normalMap,normalScale:new THREE.Vector2(.18,.18),roughnessMap:path.material.roughnessMap,roughness:.92,color:'#b4bbc3'}),mesh=new THREE.Mesh(mergeGeometries(stepGeometry),material);material.name='Weathered entry stone';material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),.92);');};material.customProgramCacheKey=()=> 'entry-stone-v1';stepGeometry.forEach(g=>g.dispose());mesh.name='Building entrance steps';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 if(railGeometry.length){const frame=root.children.find(m=>m.isMesh&&!m.isInstancedMesh&&m.material?.name==='Brushed facade metal');if(!frame)throw new Error('City entry rails need the shared facade metal batch');const old=frame.geometry;frame.geometry=mergeGeometries([old,...railGeometry]);old.dispose();railGeometry.forEach(g=>g.dispose());}
 const baseContains=root.userData.pathContains;
 record.contains=(x,z,margin=0)=>{const radius=.6+margin,reach=Math.ceil(radius/5),cx=Math.floor(x/5),cz=Math.floor(z/5);for(let iz=cz-reach;iz<=cz+reach;iz++)for(let ix=cx-reach;ix<=cx+reach;ix++)for(const p of cells.get(`${ix},${iz}`)||[])if((x-p[0])**2+(z-p[1])**2<radius*radius)return true;return false;};
 root.userData.pathContains=(x,z,margin=0)=>baseContains?.(x,z,margin)||record.contains(x,z,margin);root.userData.architectureGround=record;return record;
}
