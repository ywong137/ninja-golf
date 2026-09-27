import * as THREE from 'three';
import {shrubGeometry} from './theme-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,lieAt,routePoint,waterBasins,waterSurfaceAt,random,greenDistance} from './course.js';
import {queueSceneryRock} from './scenery-rocks.js';
import {findBuildingSite,buildingBox,buildingCylinder} from './building-placement.js';
import {scaleBoxUV} from './architecture-uv.js';
import {architecturalSurface} from './architecture-materials.js';
import {CYBER_FIXTURES,queueCyberFixture,flushCyberFixtures} from './cyber-fixtures.js';

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
 const stone=mat(theme==='desert'?'#b2a38b':theme==='cyberpunk'?'#273653':'#8e9187');
 if(textures.rock){stone.map=textures.rock;stone.normalMap=textures.normal;stone.normalScale=new THREE.Vector2(.2,.2);}
 const finish=theme==='desert'?architecturalSurface('#cbbb9d',.91):null;
 const dark=mat(theme==='desert'?'#665541':theme==='cyberpunk'?'#0e172c':'#5a6156');
 const leaf=mat(theme==='desert'?'#597b4b':theme==='cyberpunk'?'#5adfe1':'#6f7844',theme==='cyberpunk');
 leaf.side=THREE.DoubleSide;
 const shrubMat=new THREE.MeshStandardMaterial({color:theme==='highlands'?'#9a859d':'#76975c',vertexColors:true,side:THREE.DoubleSide,roughness:1});
 const flower=mat(theme==='highlands'?'#796078':theme==='cyberpunk'?'#dd61d8':'#9ab25d',theme==='cyberpunk');
 const glass=mat(theme==='cyberpunk'?'#385f79':'#314546');glass.metalness=.5;glass.roughness=.23;
 const wood=mat(theme==='desert'?'#584335':theme==='cyberpunk'?'#53606b':'#555e57');if(theme==='cyberpunk'){wood.name='Brushed facade metal';wood.metalness=.4;wood.roughness=.45;}
 const gold=mat(theme==='highlands'?'#a89949':theme==='cyberpunk'?'#dfbc85':'#ddc39a',theme==='cyberpunk');
 if(theme==='cyberpunk')gold.emissiveIntensity=.25;
 const box=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,7);
 const emit=(geo,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,instanced=false)=>{
  transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
  if(instanced){const key=`${geo.uuid}/${m.uuid}`;if(!instances.has(key))instances.set(key,{geo,m,matrices:[]});instances.get(key).matrices.push(transform.matrix.clone());}
  else {if(!batches.has(m))batches.set(m,[]);const part=geo.index?geo.toNonIndexed():geo.clone();if(geo===box)scaleBoxUV(part,sx,sy,sz);batches.get(m).push(part.applyMatrix4(transform.matrix));}
 };
 const register=(kind,x,z,height,radius)=>sites.push({id:`${theme}-${sites.length}`,kind,x,z,y:kind==='water'?waterSurfaceAt(c,x,z):heightAt(c,x,z),height,radius,fairway:lieAt(c,x,z)==='Fairway'});
 // Tall monuments remain outside the playable corridor. Small cover follows the fairway edges.
 for(let k=0;k<12;k++)for(const side of [-1,1]){
  const p=routePoint(c,(k+.5)/12),x=p.x+p.tangentZ*side*(p.width+6),z=p.z-p.tangentX*side*(p.width+6),y=heightAt(c,x,z);if(['Water','Bunker','Green'].includes(lieAt(c,x,z)))continue;
  const rockHeight=1.6*(theme==='desert'?.54:.8)*(1+Math.sin(k*1.73+side)*.12);
  if(theme==='highlands'||theme==='desert')queueSceneryRock(root,{x,z,y,height:rockHeight,radius:1.6,source:theme==='desert'?'desert-rock':'coastal-rock',angle:r()*Math.PI*2,burial:.08+r()*.13});
  if(theme==='cyberpunk')queueCyberFixture(root,{x,y,z,yaw:Math.atan2(p.tangentX,p.tangentZ)});
  register(theme==='cyberpunk'?'lantern':'rock',x,z,theme==='cyberpunk'?CYBER_FIXTURES.bollard.height:rockHeight,theme==='cyberpunk'?CYBER_FIXTURES.bollard.radius:.7);
 }
 const solid=(id,m,x,y,z,w,h,d)=>{emit(box,m,x,y,z,w,h,d);buildingBox(root,id,x,y,z,w,h,d);};
 const column=(id,m,x,y,z,r,h)=>{emit(cyl,m,x,y,z,r,h,r);buildingCylinder(root,id,x,y,z,r,h);};
 const entrance=(cx,base,front)=>{
  emit(box,dark,cx,base+1.55,front,2.7,3.1,.11);
  for(const side of [-1,1]){
   emit(box,glass,cx+side*.6,base+1.43,front-.07,1.10,2.74,.035);
   emit(box,wood,cx+side*1.26,base+1.55,front-.11,.10,3.1,.12);
   emit(box,gold,cx+side*.16,base+1.40,front-.16,.035,.34,.05);
  }
  emit(box,wood,cx,base+3.05,front-.11,2.6,.10,.12);
  emit(box,wood,cx,base+1.52,front-.12,.075,3,.10);
  emit(box,stone,cx,base+.045,front-.12,2.7,.09,.30);
  emit(box,wood,cx,base+2.45,front-.115,2.5,.065,.11);
 };
 const landmarkCount=theme==='cyberpunk'?5:2;
 for(let k=0;k<landmarkCount;k++){
  const p=routePoint(c,(k+.38+(k%2)*.18)/landmarkCount),site=findBuildingSite(root,c,p,theme==='cyberpunk'?23:15,theme==='cyberpunk'?20:15,k%2?1:-1,sites),{x,z,y}=site,id=`${theme}-${k}`;
  (root.userData.landmarks??=[]).push(site);
  // Foundations meet the lowest terrain sample while floors stay above the highest.
  const footing=(label,cx,cz,w,d)=>solid(`${id}-${label}`,stone,cx,(site.foundationBottom+y)/2,cz,w,y-site.foundationBottom,d);
  if(theme==='highlands'){
   for(let side=-1;side<=1;side+=2){footing(`tower-foot-${side}`,x+side*8,z,4,6);solid(`${id}-tower-${side<0?'left':'right'}`,stone,x+side*8,y+5,z,4,10,6);for(let i=0;i<3;i++)emit(box,stone,x+side*8+(i-1)*1.3,y+10.7,z,1,1.4,6);}
   solid(`${id}-lintel`,stone,x,y+7.5,z,14,3,4);
   const firstMasonryRow=-Math.ceil((y-site.foundationBottom)/.88);
   for(const side of [-1,1])for(let row=firstMasonryRow;row<11;row++)for(let col=0;col<3;col++){
    if(row>8&&((col+k+row)%4===0))continue;
    const xx=x+side*8+(col-1)*1.25+(Math.abs(row)%2)*.16,yy=y+.45+row*.88;
    emit(box,stone,xx,yy,z-3.05,1.15,.77,.22,0,0,(r()-.5)*.035);
    emit(box,stone,xx,yy,z+3.05,1.15,.77,.22);
   }
   for(const towerSide of [-1,1])for(const face of [-1,1])for(let row=firstMasonryRow;row<11;row++)for(let col=0;col<5;col++){
    if(row>8&&(row+col+k)%5===0)continue;
    emit(box,stone,x+towerSide*8+face*2.035,y+.44+row*.88,z-2.4+col*1.18,.14,.78,1.06);
   }
   footing('rear-foot',x-.7,z+11,26.5,1.1);
   const baseRows=Math.ceil((y-site.foundationBottom)/.45),blockWidth=26.5/20;
   for(const face of [-1,1])for(let row=0;row<baseRows;row++)for(let col=0;col<=20;col++){
    const left=-13.95+col*blockWidth,offset=(row%2)*blockWidth*.5,start=Math.max(-13.95,left-offset),end=Math.min(12.55,left+blockWidth-offset);
    if(end-start>.08)emit(box,stone,x+(start+end)/2,y-.225-row*.45,z+11+face*.565,end-start-.06,.39,.08);
   }
   for(const end of [-13.95,12.55])for(let row=0;row<baseRows;row++)emit(box,stone,x+end,y-.225-row*.45,z+11,.08,.39,1.04);

   for(let i=0;i<7;i++)for(let row=0;row<3;row++)solid(`${id}-rear-wall-${i}-${row}`,stone,x-12+i*3.7+(row%2)*.4,y+.25+row*.45,z+11,3.5,.4,1.1);
   for(let i=0;i<11;i++){const a=i*Math.PI/10,theta=a-Math.PI/2;emit(box,stone,x+Math.cos(a)*3.4,y+3.7+Math.sin(a)*3.3,z-2.15,1,.8,.7,0,0,theta);buildingBox(root,`${id}-arch-${i}`,x+Math.cos(a)*3.4,y+3.7+Math.sin(a)*3.3,z-2.15,Math.abs(Math.cos(theta))+.8*Math.abs(Math.sin(theta)),Math.abs(Math.sin(theta))+.8*Math.abs(Math.cos(theta)),.7);}
   for(let j=0;j<12;j++){const rx=x-10+r()*20,rz=z-7+r()*4;queueSceneryRock(root,{x:rx,z:rz,y:heightAt(c,rx,rz),height:.24+r()*.2,radius:.35+r()*.3,angle:r()*Math.PI*2,burial:.12+r()*.15});}
  }else if(theme==='desert'){
   footing('foundation',x,z,24,14);solid(`${id}-body`,finish,x,y+3,z,24,6,14);solid(`${id}-roof`,gold,x,y+6.1,z,26,.45,16);entrance(x,heightAt(c,x,z-7.1)+.06,z-7.08);
   for(const side of [-1,1])column(`${id}-porch-column-${side<0?'left':'right'}`,gold,x+side*10,(site.foundationBottom+y+5)/2,z-10,.45,y+5-site.foundationBottom);
   solid(`${id}-porch-roof`,finish,x,y+5.1,z-10,24,.4,6);
   solid(`${id}-upper-body`,finish,x+4,y+7.7,z+2,12,3,8);solid(`${id}-upper-roof`,gold,x+4,y+9.25,z+2,13,.25,9);
   for(const side of [-1,1])for(let w=0;w<6;w++){emit(box,dark,x-10+w*4,y+2.8,z+side*7.08,2.3,3.4,.18);emit(box,glass,x-10+w*4,y+2.9,z+side*7.19,1.8,2.7,.06);emit(box,gold,x-10+w*4,y+1.4,z+side*7.35,2.8,.22,.8);}
   // Side elevations use shallow plaster divisions, service doors and coping.
   for(const side of [-1,1]){
    for(const zz of [-5.7,-1.9,1.9,5.7])emit(box,finish,x+side*12.08,y+2.8,z+zz,.18,5.6,.18);
    const serviceY=heightAt(c,x+side*12.1,z)+.06;
    for(const yy of [.45,4.7,5.55]){
     const bandY=y+yy;
     // Leave clearance around the complete door frame, including its header.
     if(bandY+.06>serviceY-.05&&bandY-.06<serviceY+2.75){
      for(const end of [-1,1])emit(box,gold,x+side*12.08,bandY,z+end*4,.20,.12,6.2);
     }else emit(box,gold,x+side*12.08,bandY,z,.20,.12,14.2);
    }
    emit(box,dark,x+side*12.12,serviceY+1.28,z,.12,2.56,1.35);
    for(const zz of [-.73,.73])emit(box,wood,x+side*12.19,serviceY+1.32,z+zz,.10,2.64,.10);
    emit(box,wood,x+side*12.19,serviceY+2.65,z,.10,.10,1.56);
    emit(box,gold,x+side*12.25,serviceY+1.20,z+.40,.05,.10,.17);
    for(const zz of [-4,4]){
     emit(box,dark,x+side*12.12,y+3.8,z+zz,.10,1.0,1.5);
     emit(box,glass,x+side*12.18,y+3.8,z+zz,.04,.82,1.30);
     emit(box,gold,x+side*12.23,y+3.24,z+zz,.30,.12,1.7);
    }
   }
   for(let j=0;j<15;j++)emit(box,wood,x-11+j*1.6,y+5.4,z-9.6,.16,.25,7);
   for(const side of [-1,1]){
    const px=x+side*12,pz=z-12.5;let low=Infinity,high=-Infinity;
    for(const dx of [-1.5,0,1.5])for(const dz of [-1,0,1]){const ground=heightAt(c,px+dx,pz+dz);low=Math.min(low,ground);high=Math.max(high,ground);}
    const bottom=low-.15,top=high+.8;
    solid(`${id}-planter-${side}`,stone,px,(bottom+top)/2,pz,3,top-bottom,2);
    emit(shrub,shrubMat,px,top,pz,1.3,.75,.8,0,0,0,true);
   }


  }else{
   const variant=(k+c.seed)%5,total=[38,64,47,76,54][variant],width=[16,13,18,12,17][variant],depth=[15,17,13,15,16][variant];
   footing('foundation',x,z,22,19);solid(`${id}-podium`,stone,x,y+2.4,z,22,4.8,19);
   // Continuous four-sided facade grids follow each setback, including upper floors.
   const facade=(cx,cz,base,w,d,h,index)=>{
    solid(`${id}-tower-${index}`,dark,cx,base+h/2,cz,w,h,d);
    const floors=Math.max(1,Math.floor(h/3.3)),colsX=Math.max(2,Math.floor(w/2.6)),colsZ=Math.max(2,Math.floor(d/2.6));
    for(let floor=0;floor<floors;floor++){
     const yy=base+(floor+.5)*h/floors;
     for(const side of [-1,1]){
      for(let col=0;col<colsX;col++)emit(box,((floor*7+col*3+k+index)%9===0)?gold:glass,cx-w/2+(col+.5)*w/colsX,yy,cz+side*(d/2+.025),w/colsX*.67,1.85,.07);
      for(let col=0;col<colsZ;col++)emit(box,((floor*3+col*7+k+index)%11===0)?leaf:glass,cx+side*(w/2+.025),yy,cz-d/2+(col+.5)*d/colsZ,.07,1.85,d/colsZ*.67);
     }
     emit(box,stone,cx,yy-1.24,cz,w+.15,.22,d+.15);
    }
    for(const side of [-1,1]){
     for(let col=0;col<=colsX;col++)emit(box,wood,cx-w/2+col*w/colsX,base+h/2,cz+side*(d/2+.07),.075,h,.085);
     for(let col=0;col<=colsZ;col++)emit(box,wood,cx+side*(w/2+.07),base+h/2,cz-d/2+col*d/colsZ,.085,h,.075);
    }
    for(const side of [-1,1]){emit(box,stone,cx+side*(w/2-.13),base+h/2,cz,.26,h,d+.12);emit(box,stone,cx,base+h/2,cz+side*(d/2-.13),w,.26+h,.26);}
    const roofY=base+h,trim=k%2?leaf:flower;
    // Dark roof membranes replace the former full-area emissive caps.
    emit(box,stone,cx,roofY+.025,cz,w,.05,d);
    for(const side of [-1,1]){
     emit(box,trim,cx+side*(w/2-.10),roofY+.06,cz,.075,.08,d-.2);
     emit(box,trim,cx,roofY+.06,cz+side*(d/2-.10),w-.2,.08,.075);
    }
    // Shallow service hatches stay within the previous roof-cap envelope.
    if(index>=2){
     const hx=cx-w*.20,hz=cz+d*.18,hw=Math.min(2.4,w*.28),hd=Math.min(3.2,d*.32);
     emit(box,dark,hx,roofY+.085,hz,hw,.07,hd);
     for(let fin=0;fin<7;fin++)emit(box,wood,hx,roofY+.125,hz-hd*.4+fin*hd*.8/6,hw*.85,.018,.035);
     emit(box,dark,cx+w*.21,roofY+.075,cz-d*.23,1.1,.05,1.6);
     emit(box,stone,cx+w*.21,roofY+.106,cz-d*.23,.92,.012,1.4);
    }
   };
   const lower=total*.53,upper=total*.29,crown=total-lower-upper;
   facade(x,z,y+4.8,width,depth,lower,0);
   facade(x+(k%2?1.6:-1.6),z+1.2,y+4.8+lower,width*.79,depth*.81,upper,1);
   facade(x+(k%2?2.3:-2.3),z+1.7,y+4.8+lower+upper,width*.54,depth*.6,crown,2);
   const companionX=x+(k%2?-16:16),companionZ=z+5,companionH=9+(k%3)*4;
   footing('companion-foot',companionX,companionZ,10,13);facade(companionX,companionZ,y,10,13,companionH,3);
   // Ground-level shop glazing and slender canopies tie each cluster together.
   for(const side of [-1,1])for(let col=0;col<7;col++){
    if(side===-1&&col===3)continue;
    const xx=x-9+col*3,face=z+side*9.54;
    emit(box,dark,xx,y+2,face,2.55,3.15,.12);
    emit(box,glass,xx,y+2,face+side*.075,2.27,2.85,.045);
    for(const edge of [-1,1])emit(box,wood,xx+edge*1.20,y+2,face+side*.12,.08,3.12,.10);
    for(const yy of [.47,1.35,3.53])emit(box,wood,xx,y+yy,face+side*.12,2.46,.075,.10);
   }
   entrance(x,y,z-9.55);
   solid(`${id}-canopy`,dark,x,y+4.2,z-11,22,.28,3);
   emit(box,k%2?flower:leaf,x,y+4.4,z-12.5,22,.12,.1);
   column(`${id}-antenna`,wood,x+(k%2?2.3:-2.3),y+total+8,z+1.7,.08,6.4);
   for(let j=0;j<3;j++){
    const px=x-3+j*2.5,py=y+total*.53+5.3;
    solid(`${id}-roof-plant-${j}`,stone,px,py,z-4,1.6,1,2);
    for(let vent=0;vent<6;vent++)emit(box,dark,px,py-.34+vent*.13,z-5.006,1.25,.045,.014);
    emit(cyl,dark,px,py+.505,z-4,.53,.012,.53);
    for(let fin=0;fin<5;fin++)emit(box,wood,px-.4+fin*.2,py+.516,z-4,.035,.012,.85);
   }

  }
 }
 for(const b of c.bunkers)register('sand',b[0],b[1],0);
 for(const pond of waterBasins(c))for(let i=0;i<8;i++){const a=i*Math.PI/4,x=pond[0]+Math.cos(a)*pond[2]*.87,z=pond[1]+Math.sin(a)*pond[3]*.87;if(lieAt(c,x,z)==='Water')register('water',x,z,0);}
 for(const {geo,m,matrices} of instances.values()){const mesh=new THREE.InstancedMesh(geo.clone(),m,matrices.length);matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.architectureTheme=theme;mesh.name=`${theme} architecture`;root.add(mesh);}
 for(const [m,geos] of batches){const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.architectureTheme=theme;mesh.name=`${theme} architecture`;root.add(mesh);}
 if(theme==='highlands')dark.dispose();
 for(const geo of [box,cyl,shrub])geo.dispose();
 if(theme==='cyberpunk')flushCyberFixtures(root);

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
   const rockCover=c.theme==='highlands'||c.theme==='desert',coverHeight=rockCover?(c.theme==='desert'?.7:.9):c.theme==='cyberpunk'?CYBER_FIXTURES.cover.height:1.95;
   if(rockCover){
    queueSceneryRock(root,{x,z,y,height:coverHeight,radius:1.15,source:c.theme==='desert'?'desert-rock':'coastal-rock',angle:c.seed*.37+count*2.39,burial:.10+count*.04});
   }else if(c.theme==='cyberpunk'){
    queueCyberFixture(root,{x,y,z,kind:'cover',yaw:Math.atan2(p.tangentX,p.tangentZ)});
   }else{
    add(box,0,x,y+.14,z,1.35,.28,1.25);add(box,0,x,y+.8,z,.55,1.15,.55);
    add(box,1,x,y+1.52,z,1.1,.45,.76);add(box,0,x,y+1.85,z,1.45,.2,1.1);
   }
   sites.push({id:`fairway-cover-${count}`,kind:c.theme==='highlands'||c.theme==='desert'?'rock':'lantern',x,z,y,height:coverHeight,radius:rockCover?1.15:c.theme==='cyberpunk'?CYBER_FIXTURES.cover.radius:.7,fairway:true});count++;break;
  }
 }
 for(let i=0;i<2;i++)if(chunks[i].length){const mesh=new THREE.Mesh(mergeGeometries(chunks[i]),i?accent:stone);chunks[i].forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 for(let i=0;i<2;i++)if(!chunks[i].length)(i?accent:stone).dispose();
 box.dispose();if(c.theme==='cyberpunk')flushCyberFixtures(root);return count;
}
