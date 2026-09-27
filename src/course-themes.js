import * as THREE from 'three';
import {palmFrond,cactusStem,cactusArm,shrubGeometry,ridgeTrunk} from './theme-geometry.js';
import {Vegetation} from './vegetation.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,lieAt,center,random,greenDistance} from './course.js';

export const THEME_LIGHTS={
 japanese:{sky:'#a9c3ce',fog:'#b4c3bd',sun:'#ffedd0',ground:'#777a49',intensity:3,ambient:.8},
 highlands:{sky:'#a1adb9',fog:'#a6b2bd',sun:'#e6edff',ground:'#766e59',intensity:2.1,ambient:1.1},
 desert:{sky:'#9ecbdc',fog:'#e0b996',sun:'#ffdb9b',ground:'#b68a66',intensity:3.4,ambient:.9},
 cyberpunk:{sky:'#121b39',fog:'#172342',sun:'#95b9ff',ground:'#503c79',intensity:1.8,ambient:1.8},
};
const transform=new THREE.Object3D();
// Each plant component is a single instanced draw. Static architecture is merged by material.
export function buildThemeScenery(root,c,sites,textures={}){
 const r=random(c.seed+912),theme=c.theme,batches=new Map(),instances=new Map();
 const mat=(color,glow=false)=>new THREE.MeshStandardMaterial({color,roughness:glow?.38:.92,emissive:glow?color:'#000000',emissiveIntensity:glow?.65:0});
 const crystal=new THREE.OctahedronGeometry(1,0),orbit=new THREE.TorusGeometry(1,.045,5,20).rotateX(Math.PI/2);
 const shrub=shrubGeometry(),frond=palmFrond(),cactus=cactusStem(),arm=cactusArm(),trunk=ridgeTrunk();
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
 const mesa=new THREE.CylinderGeometry(.72,1,1,16,5);const mp=mesa.attributes.position;for(let i=0;i<mp.count;i++){const x=mp.getX(i),y=mp.getY(i),z=mp.getZ(i),a=Math.atan2(z,x),f=1+.13*Math.sin(a*5)+.08*Math.cos(a*9)+.06*Math.sin(y*45);mp.setXYZ(i,x*f,y+(y>0?.018*Math.sin(a*7):0),z*f);}mesa.computeVertexNormals();
 const box=new THREE.BoxGeometry(1,1,1),ball=new THREE.IcosahedronGeometry(1,1),cyl=new THREE.CylinderGeometry(1,1,1,7),cone=new THREE.ConeGeometry(1,1,6);
 const emit=(geo,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,instanced=false)=>{
  transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
  if(instanced){const key=`${geo.uuid}/${m.uuid}`;if(!instances.has(key))instances.set(key,{geo,m,matrices:[]});instances.get(key).matrices.push(transform.matrix.clone());}
  else {if(!batches.has(m))batches.set(m,[]);batches.get(m).push((geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(transform.matrix));}
 };
 const register=(kind,x,z,height)=>sites.push({id:`${theme}-${sites.length}`,kind,x,z,y:heightAt(c,x,z),height,fairway:lieAt(c,x,z)==='Fairway'});
 for(let i=0;i<480;i++){
  const z=-60+r()*(c.length+150),x=-190+r()*310,d=Math.abs(x-center(c,z));
  if(d<c.width+10||greenDistance(c,x,z)<30||lieAt(c,x,z)==='Water'||heightAt(c,x,z)<3.6)continue;
  const y=heightAt(c,x,z),s=.8+r()*1.4;
  if(theme==='highlands'){
   const gorse=i%3===0;emit(shrub,shrubMat,x,y,z,1.5*s,(gorse?1.4:.7)*s,1.3*s,0,r()*6,0,true);
   for(let j=0;j<(gorse?10:16);j++){const a=j*2.4,rr=.2+r()*.65;emit(ball,gorse?gold:flower,x+Math.cos(a)*rr*s,y+(gorse?.8:.43)*s+rr*.2,z+Math.sin(a)*rr*s,.065*s,.075*s,.07*s,0,0,0,true);}
  } else if(theme==='desert'){
   if(i%5===0){
    emit(trunk,dark,x,y,z,s,s,s,0,r()*6,0,true);
    for(let j=0;j<9;j++){const a=j*Math.PI*2/9;emit(frond,leaf,x+.56*s,y+7.8*s,z,s,s,s,-.2+(j%3)*.16,a,0,true);}register('tree',x,z,8*s);
   }else if(i%3){emit(cactus,leaf,x,y,z,s,s,s,0,0,0,true);for(const side of [-1,1])emit(arm,leaf,x,y,z,s,s*(side===1?.85:1.1),s,0,side===1?0:Math.PI,0,true);register('tree',x,z,4*s);
   }else {emit(shrub,shrubMat,x,y,z,s,.55*s,s,0,r()*6,0,true);for(let j=0;j<7;j++)emit(frond,leaf,x,y+.3*s,z,.22*s,.22*s,.22*s,-.9,j*Math.PI*2/7,0,true);}
  }else{
   emit(cyl,dark,x,y+3*s,z,.2*s,6*s,.2*s,0,0,0,true);
   for(let j=0;j<5;j++){const a=j*2.4,rr=j===0?0:1.6,xx=x+Math.cos(a)*rr*s,zz=z+Math.sin(a)*rr*s,yy=y+(4.6+j%3*.45)*s;emit(crystal,j%2?flower:leaf,xx,yy,zz,1.75*s,.75*s,1.45*s,0,a,0,true);emit(cyl,dark,(x+xx)*.5,y+3.7*s,(z+zz)*.5,.07*s,2.3*s,.07*s,Math.cos(a)*.7,0,Math.sin(a)*.7,true);}
   emit(orbit,leaf,x,y+2.3*s,z,.75*s,.75*s,.75*s,0,0,0,true);
   register('tree',x,z,7*s);
  }
 }
 // Tall monuments remain outside the playable corridor. Small cover follows the fairway edges.
 for(let z=25,k=0;z<c.length;z+=39,k++)for(const side of [-1,1]){
  const x=center(c,z)+side*(c.width+6),y=heightAt(c,x,z);if(['Water','Bunker','Green'].includes(lieAt(c,x,z)))continue;
  if(theme==='highlands'){emit(box,stone,x,y+1.1,z,1.6,2.2,1.1,0,.2*k);emit(ball,dark,x+1.3,y+.4,z+.5,1,.65,.9);}
  if(theme==='desert'){emit(ball,stone,x,y+1,z,1.6,1.8,1.2,0,.7*k);emit(box,gold,x,y+2.2,z,1.6,.2,1.3);}
  if(theme==='cyberpunk'){emit(box,dark,x,y+1.25,z,1.3,2.5,1.3);emit(box,k%2?leaf:flower,x,y+2.55,z,1.65,.16,1.65);emit(ball,leaf,x,y+3.3,z,.55,.55,.55);}
  register('lantern',x,z,theme==='cyberpunk'?3.5:2.4);
 }
 for(let k=0;k<5;k++){
  const z=10+k*c.length/4,x=Math.min(-85-(k%2)*24,center(c,z)-c.width-40),y=heightAt(c,x,z);
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
   for(let j=0;j<12;j++)emit(ball,stone,x-10+r()*20,y+.25,z-7+r()*4,.3+r()*.5,.3,.4,0,r()*6,0);
  }else if(theme==='desert'){
   emit(box,stone,x,y+3,z,24,6,14);emit(box,gold,x,y+6.1,z,26,.45,16);emit(box,dark,x,y+2.3,z-7.1,9,3.5,.1);
   for(const side of [-1,1])emit(cyl,gold,x+side*10,y+2.5,z-10,.45,5,.45);
   emit(box,stone,x,y+5.1,z-10,24,.4,6);
   emit(box,stone,x+4,y+7.7,z+2,12,3,8);emit(box,gold,x+4,y+9.25,z+2,13,.25,9);
   for(const side of [-1,1])for(let w=0;w<6;w++){emit(box,dark,x-10+w*4,y+2.8,z+side*7.08,2.3,3.4,.18);emit(box,glass,x-10+w*4,y+2.9,z+side*7.19,1.8,2.7,.06);emit(box,gold,x-10+w*4,y+1.4,z+side*7.35,2.8,.22,.8);}
   for(let j=0;j<15;j++)emit(box,wood,x-11+j*1.6,y+5.4,z-9.6,.16,.25,7);
   for(const side of [-1,1]){emit(box,stone,x+side*10,y+.45,z-13,3,.9,2);emit(shrub,shrubMat,x+side*10,y+.9,z-13,1.3,.75,.8,0,0,0,true);}

   // Flat sandstone mesas make a different horizon from the pine-covered coast.
   emit(mesa,stone,-180-k*19,y+16+k*4,z+100,43,38+k*8,34,0,k*.7);emit(mesa,dark,-170-k*19,y+3,z+100,48,9,40,0,k*.7);
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
 if(theme==='cyberpunk'){
  emit(ball,gold,-75,95,c.length*.6,12,12,12);
  // Oversized floating koi and hoops make this course deliberately impossible scenery.
  for(let k=0;k<4;k++){const z=45+k*c.length/4,x=65+12*Math.sin(k);emit(ball,k%2?leaf:flower,x,40+k*4,z,9,3,3);emit(cone,gold,x-9,41+k*4,z,2.4,5,.5,0,0,Math.PI/2+.4);emit(cone,gold,x-9,39+k*4,z,2.4,5,.5,0,0,Math.PI/2-.4);emit(ball,dark,x+6.9,40.8+k*4,z-2,.42,.42,.42);}
 }
 for(const b of c.bunkers)register('sand',b[0],b[1],0);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;register('water',c.pond[0]+Math.cos(a)*c.pond[2]*.87,c.pond[1]+Math.sin(a)*c.pond[3]*.87,0);}
 for(const {geo,m,matrices} of instances.values()){const mesh=new THREE.InstancedMesh(geo.clone(),m,matrices.length);matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(const [m,geos] of batches){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(const geo of [box,ball,cyl,cone,mesa,shrub,frond,cactus,arm,trunk,crystal,orbit])geo.dispose();
 return theme==='highlands'?new Vegetation(root,{...c,vegetationCount:100,conifersOnly:true},sites):{update(){}};
}

// Edge-inset cover keeps the centre of every landing corridor clear.
export function buildFairwayCover(root,c,sites){
 const stone=new THREE.MeshStandardMaterial({color:c.theme==='desert'?'#a58363':'#818c83',roughness:.95});
 const accent=new THREE.MeshStandardMaterial({color:c.theme==='cyberpunk'?'#63d9df':c.theme==='japanese'?'#9c483e':'#544b43',emissive:c.theme==='cyberpunk'?'#40c2ce':'#000000',emissiveIntensity:.65,roughness:.6});
 const chunks=[[],[]],box=new THREE.BoxGeometry(1,1,1),rock=new THREE.DodecahedronGeometry(1,0);let count=0;
 const add=(geometry,material,x,y,z,sx,sy,sz)=>{transform.position.set(x,y,z);transform.rotation.set(0,.27,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();chunks[material].push((geometry.index?geometry.toNonIndexed():geometry.clone()).applyMatrix4(transform.matrix));};
 for(const fraction of [.25,.48,.72,.34,.61,.82]){
  if(count>=3)break;const z=c.length*fraction;
  if(sites.some(s=>s.fairway&&Math.abs(s.z-z)<10))continue;
  for(const side of [count%2?-1:1,count%2?1:-1]){
   const w=c.width*(.84+.18*Math.sin(z*.031)),x=center(c,z)+side*(w-3.2),y=heightAt(c,x,z);
   if(lieAt(c,x,z)!=='Fairway'||y<3.8||greenDistance(c,x,z)<28||Math.hypot(x,z)<22)continue;
   if(c.theme==='highlands'||c.theme==='desert'){
    for(let j=0;j<4;j++)add(rock,0,x,y+.27+j*.39,z,.77-j*.13,.35,.64-j*.10);
    add(box,1,x,y+1.63,z,.63,.12,.50);
   }else{
    add(box,0,x,y+.14,z,1.35,.28,1.25);add(box,0,x,y+.8,z,.55,1.15,.55);
    add(box,1,x,y+1.52,z,1.1,.45,.76);add(box,0,x,y+1.85,z,1.45,.2,1.1);
   }
   sites.push({id:`fairway-cover-${count}`,kind:c.theme==='highlands'||c.theme==='desert'?'rock':'lantern',x,z,y,height:1.95,fairway:true});count++;break;
  }
 }
 for(let i=0;i<2;i++)if(chunks[i].length){const mesh=new THREE.Mesh(mergeGeometries(chunks[i]),i?accent:stone);chunks[i].forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 box.dispose();rock.dispose();return count;
}
