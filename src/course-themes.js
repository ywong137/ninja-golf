import * as THREE from 'three';
import {shrubGeometry} from './theme-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,lieAt,routePoint,fairwayDistance,waterBasins,random,greenDistance} from './course.js';
import {queueSceneryRock} from './scenery-rocks.js';

export const THEME_LIGHTS={
 japanese:{sky:'#a9c3ce',fog:'#b4c3bd',sun:'#ffedd0',ground:'#777a49',intensity:3,ambient:.8},
 highlands:{sky:'#a1adb9',fog:'#a6b2bd',sun:'#e6edff',ground:'#766e59',intensity:2.1,ambient:1.1},
 desert:{sky:'#9ecbdc',fog:'#e0b996',sun:'#ffdb9b',ground:'#b68a66',intensity:3.4,ambient:.9},
 cyberpunk:{sky:'#121b39',fog:'#172342',sun:'#c8d7eb',ground:'#394239',intensity:2.4,ambient:.85},
};
const transform=new THREE.Object3D();
// Each plant component is a single instanced draw. Static architecture is merged by material.
export function buildThemeScenery(root,c,sites,textures={}){
 const r=random(c.seed+912),theme=c.theme,batches=new Map(),instances=new Map();
 const mat=(color,glow=false)=>new THREE.MeshStandardMaterial({color,roughness:glow?.38:.92,emissive:glow?color:'#000000',emissiveIntensity:glow?.65:0});
 const shrub=shrubGeometry();
 const stone=mat(theme==='desert'?'#b7784c':theme==='cyberpunk'?'#273653':'#8e9187');
 if(textures.rock){stone.map=textures.rock;stone.normalMap=textures.normal;stone.normalScale=new THREE.Vector2(.5,.5);}
 const dark=mat(theme==='desert'?'#9c6648':theme==='cyberpunk'?'#0e172c':'#5a6156');
 const leaf=mat(theme==='desert'?'#597b4b':theme==='cyberpunk'?'#5adfe1':'#6f7844',theme==='cyberpunk');
 leaf.side=THREE.DoubleSide;
 const shrubMat=new THREE.MeshStandardMaterial({color:theme==='highlands'?'#9a859d':'#76975c',vertexColors:true,side:THREE.DoubleSide,roughness:1});
 const flower=mat(theme==='highlands'?'#796078':theme==='cyberpunk'?'#dd61d8':'#9ab25d',theme==='cyberpunk');
 const glass=mat(theme==='cyberpunk'?'#385f79':'#314546');glass.metalness=.5;glass.roughness=.23;
 const wood=mat(theme==='desert'?'#584335':'#555e57');
 const gold=mat(theme==='highlands'?'#a89949':theme==='cyberpunk'?'#f2ab61':'#ddc39a',theme==='cyberpunk');
 const box=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),cyl=new THREE.CylinderGeometry(1,1,1,7);
 const emit=(geo,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,instanced=false)=>{
  transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
  if(instanced){const key=`${geo.uuid}/${m.uuid}`;if(!instances.has(key))instances.set(key,{geo,m,matrices:[]});instances.get(key).matrices.push(transform.matrix.clone());}
  else {if(!batches.has(m))batches.set(m,[]);batches.get(m).push((geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(transform.matrix));}
 };
 const register=(kind,x,z,height,radius)=>sites.push({id:`${theme}-${sites.length}`,kind,x,z,y:heightAt(c,x,z),height,radius,fairway:lieAt(c,x,z)==='Fairway'});
 // Tall monuments remain outside the playable corridor. Small cover follows the fairway edges.
 for(let k=0;k<12;k++)for(const side of [-1,1]){
  const p=routePoint(c,(k+.5)/12),x=p.x+p.tangentZ*side*(p.width+6),z=p.z-p.tangentX*side*(p.width+6),y=heightAt(c,x,z);if(['Water','Bunker','Green'].includes(lieAt(c,x,z)))continue;
  const rockHeight=1.6*(theme==='desert'?.54:.8)*(1+Math.sin(k*1.73+side)*.12);
  if(theme==='highlands'||theme==='desert')queueSceneryRock(root,{x,z,y,height:rockHeight,radius:1.6,source:theme==='desert'?'desert-rock':'coastal-rock',angle:r()*Math.PI*2,burial:.08+r()*.13});
  if(theme==='cyberpunk'){emit(box,dark,x,y+1.25,z,1.3,2.5,1.3);emit(box,k%2?leaf:flower,x,y+2.55,z,1.65,.16,1.65);emit(ball,leaf,x,y+3.3,z,.55,.55,.55);}
  register(theme==='cyberpunk'?'lantern':'rock',x,z,theme==='cyberpunk'?3.5:rockHeight,.7);
 }
 const landmarkCount=theme==='cyberpunk'?5:2;
 for(let k=0;k<landmarkCount;k++){
  const p=routePoint(c,(k+.5)/landmarkCount),z=p.z;let x=p.x-75;while(fairwayDistance(c,x,z)<28)x-=12;const y=heightAt(c,x,z);
  (root.userData.landmarks??=[]).push({x,z,halfWidth:theme==='desert'?13:theme==='highlands'?15:10,halfDepth:14});
  if(theme==='highlands'){
   for(let side=-1;side<=1;side+=2){emit(box,stone,x+side*8,y+5,z,4,10,6);for(let i=0;i<3;i++)emit(box,stone,x+side*8+(i-1)*1.3,y+10.7,z,1,1.4,6);}
   emit(box,stone,x,y+7.5,z,14,3,4);
   for(const side of [-1,1])for(let row=0;row<11;row++)for(let col=0;col<3;col++){
    if(row>8&&((col+k+row)%4===0))continue;
    const xx=x+side*8+(col-1)*1.25+(row%2)*.16,yy=y+.45+row*.88;
    emit(box,(row+col)%4===0?dark:stone,xx,yy,z-3.05,1.15,.77,.22,0,0,(r()-.5)*.035);
    emit(box,(row+col)%4===0?dark:stone,xx,yy,z+3.05,1.15,.77,.22);
   }
   for(let i=0;i<7;i++)for(let row=0;row<3;row++)emit(box,(i+row)%3?stone:dark,x-12+i*3.7+(row%2)*.4,y+.25+row*.45,z+11,3.5,.4,1.1);
   for(let i=0;i<11;i++){const a=i*Math.PI/10;emit(box,stone,x+Math.cos(a)*3.4,y+3.7+Math.sin(a)*3.3,z-2.15,1,.8,.7,0,0,a-Math.PI/2);}
   for(let j=0;j<12;j++){const rx=x-10+r()*20,rz=z-7+r()*4;queueSceneryRock(root,{x:rx,z:rz,y:heightAt(c,rx,rz),height:.24+r()*.2,radius:.35+r()*.3,angle:r()*Math.PI*2,burial:.12+r()*.15});}
  }else if(theme==='desert'){
   emit(box,stone,x,y+3,z,24,6,14);emit(box,gold,x,y+6.1,z,26,.45,16);emit(box,dark,x,y+2.3,z-7.1,9,3.5,.1);
   for(const side of [-1,1])emit(cyl,gold,x+side*10,y+2.5,z-10,.45,5,.45);
   emit(box,stone,x,y+5.1,z-10,24,.4,6);
   emit(box,stone,x+4,y+7.7,z+2,12,3,8);emit(box,gold,x+4,y+9.25,z+2,13,.25,9);
   for(const side of [-1,1])for(let w=0;w<6;w++){emit(box,dark,x-10+w*4,y+2.8,z+side*7.08,2.3,3.4,.18);emit(box,glass,x-10+w*4,y+2.9,z+side*7.19,1.8,2.7,.06);emit(box,gold,x-10+w*4,y+1.4,z+side*7.35,2.8,.22,.8);}
   for(let j=0;j<15;j++)emit(box,wood,x-11+j*1.6,y+5.4,z-9.6,.16,.25,7);
   for(const side of [-1,1]){emit(box,stone,x+side*10,y+.45,z-13,3,.9,2);emit(shrub,shrubMat,x+side*10,y+.9,z-13,1.3,.75,.8,0,0,0,true);}


  }else{
   emit(box,dark,x,y+22+k*3,z,15,44+k*6,17);
   for(let j=0;j<9;j++){
    emit(box,j%2?flower:leaf,x,y+4+j*5,z-8.6,15,.10,.15);
    for(let col=0;col<5;col++){const lit=(j*7+col*3+k)%5===0;emit(box,lit?gold:glass,x-5.8+col*2.8,y+6+j*4.7,z-8.58,1.6,2.5,.09);emit(box,lit?leaf:glass,x+7.58,y+6+j*4.7,z-6+col*2.8,.09,2.5,1.6);}
   }
   emit(box,stone,x+2,y+46+k*6,z+2,8,4,8);emit(cyl,leaf,x,y+52+k*6,z,.09,14,.09);
   emit(box,dark,x,y+2,z-10,20,4,6);emit(box,flower,x,y+4.1,z-13,20,.15,.15);
   // Vertical sign bars form a simple circuit mark on a projecting billboard.
   emit(box,stone,x-8.2,y+23,z-5,.7,13,5);
   for(let row=0;row<4;row++){emit(box,gold,x-8.62,y+19+row*2.4,z-5,.06,.16,3.2);emit(box,flower,x-8.65,y+19.8+row*2.4,z-4.2,.06,1.6,.16);}

   const ring=new THREE.TorusGeometry(10,.3,5,32);emit(ring,k%2?flower:leaf,x,y+38,z,1,1,1,.3,k);ring.dispose();
  }
 }
 for(const b of c.bunkers)register('sand',b[0],b[1],0);
 for(const pond of waterBasins(c))for(let i=0;i<8;i++){const a=i*Math.PI/4,x=pond[0]+Math.cos(a)*pond[2]*.87,z=pond[1]+Math.sin(a)*pond[3]*.87;if(lieAt(c,x,z)==='Water')register('water',x,z,0);}
 for(const {geo,m,matrices} of instances.values()){const mesh=new THREE.InstancedMesh(geo.clone(),m,matrices.length);matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(const [m,geos] of batches){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(const geo of [box,ball,cyl,shrub])geo.dispose();

}

// Edge-inset cover keeps the centre of every landing corridor clear.
export function buildFairwayCover(root,c,sites,textures={}){
 const stone=new THREE.MeshStandardMaterial({color:c.theme==='desert'?'#a58363':'#818c83',roughness:.95,map:textures.color,normalMap:textures.normal});
 const accent=new THREE.MeshStandardMaterial({color:c.theme==='cyberpunk'?'#63d9df':c.theme==='japanese'?'#9c483e':'#544b43',emissive:c.theme==='cyberpunk'?'#40c2ce':'#000000',emissiveIntensity:.65,roughness:.6});
 const chunks=[[],[]],box=new THREE.BoxGeometry(1,1,1);let count=0;
 const add=(geometry,material,x,y,z,sx,sy,sz)=>{transform.position.set(x,y,z);transform.rotation.set(0,.27,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();chunks[material].push((geometry.index?geometry.toNonIndexed():geometry.clone()).applyMatrix4(transform.matrix));};
 for(const fraction of [.25,.48,.72,.34,.61,.82]){
  if(count>=3)break;const p=routePoint(c,fraction);
  if(sites.some(s=>s.fairway&&Math.hypot(s.x-p.x,s.z-p.z)<10))continue;
  for(const side of [count%2?-1:1,count%2?1:-1]){
   const x=p.x+p.tangentZ*side*(p.width-3.2),z=p.z-p.tangentX*side*(p.width-3.2),y=heightAt(c,x,z);
   if(lieAt(c,x,z)!=='Fairway'||y<3.8||greenDistance(c,x,z)<28||Math.hypot(x,z)<22)continue;
   const rockCover=c.theme==='highlands'||c.theme==='desert',coverHeight=rockCover?(c.theme==='desert'?.7:.9):1.95;
   if(rockCover){
    queueSceneryRock(root,{x,z,y,height:coverHeight,radius:1.15,source:c.theme==='desert'?'desert-rock':'coastal-rock',angle:c.seed*.37+count*2.39,burial:.10+count*.04});
   }else{
    add(box,0,x,y+.14,z,1.35,.28,1.25);add(box,0,x,y+.8,z,.55,1.15,.55);
    add(box,1,x,y+1.52,z,1.1,.45,.76);add(box,0,x,y+1.85,z,1.45,.2,1.1);
   }
   sites.push({id:`fairway-cover-${count}`,kind:c.theme==='highlands'||c.theme==='desert'?'rock':'lantern',x,z,y,height:coverHeight,radius:rockCover?1.15:.7,fairway:true});count++;break;
  }
 }
 for(let i=0;i<2;i++)if(chunks[i].length){const mesh=new THREE.Mesh(mergeGeometries(chunks[i]),i?accent:stone);chunks[i].forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(let i=0;i<2;i++)if(!chunks[i].length)(i?accent:stone).dispose();
 box.dispose();return count;
}
