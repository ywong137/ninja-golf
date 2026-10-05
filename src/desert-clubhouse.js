import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {heightAt} from './course.js';
import {scaleBoxUV} from './architecture-uv.js';
import {architecturalSurface} from './architecture-materials.js';
import {buildingBox} from './building-placement.js';

export function desertClubhouseMaterials(textures={}){
 const plaster=new THREE.MeshStandardMaterial({color:'#d6b895',map:textures.adobeColor||null,normalMap:textures.adobeNormal||null,roughnessMap:textures.adobeRoughness||null,normalScale:new THREE.Vector2(.32,.32),roughness:.95});plaster.name='Clay stucco';
 const coping=plaster.clone();coping.color.set('#e2c7a7');coping.name='Rounded adobe coping';
 // Neutralize the scan's brown clay pigment before applying the warm lime finish.
 // These linear RGB values are the measured mean of the bundled color scan.
 for(const material of [plaster,coping]){
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb /= vec3(.1704,.1014,.0454);\n#endif');};
  material.customProgramCacheKey=()=> 'desert-lime-stucco-v1';
 }
 const wood=architecturalSurface('#493122',.86,0,true);wood.name='Dark porch timber';
 const bronze=new THREE.MeshStandardMaterial({color:'#504a3d',metalness:.72,roughness:.36});bronze.name='Aged bronze fittings';
 const glass=new THREE.MeshPhysicalMaterial({color:'#648087',metalness:.22,roughness:.12,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:2.8});glass.name='Recessed clubhouse glass';
 const reveal=new THREE.MeshStandardMaterial({color:'#1d2421',roughness:.9});reveal.name='Window reveals';
 const stone=new THREE.MeshStandardMaterial({color:'#aa9b83',map:textures.rock||null,normalMap:textures.normal||null,normalScale:new THREE.Vector2(.13,.13),roughness:.94});stone.name='Terrace stone';
 const lantern=new THREE.MeshStandardMaterial({color:'#dec29b',emissive:'#e6aa55',emissiveIntensity:.17,roughness:.4});lantern.name='Porch lantern panes';
 return{plaster,coping,wood,bronze,glass,reveal,stone,lantern};
}

export function desertEntranceSteps(c,site){
 const width=5.2,front=site.z-14.75,end=site.z-7.04,threshold=site.y+.045;
 let entry=-Infinity;
 for(let dx=-width/2;dx<=width/2;dx+=.4)entry=Math.max(entry,heightAt(c,site.x+dx,front));
 const rise=Math.max(.06,threshold-entry),count=Math.max(2,Math.ceil(rise/.18)),tread=(end-front)/count;
 const steps=[];
 for(let i=0;i<count;i++){
  const z=front+(i+.5)*tread;let low=Infinity;
  for(const dx of [-width/2,0,width/2])for(const dz of [-tread/2,tread/2])low=Math.min(low,heightAt(c,site.x+dx,z+dz));
  const top=entry+rise*(i+1)/count,bottom=Math.min(low-.12,top-.08);
  steps.push({x:site.x,z,width,depth:tread+.014,top,bottom});
 }
 return steps;
}

// Original Pueblo-inspired resort buildings. All geometry is static and batched by material.
export function buildDesertClubhouse(root,c,site,index,{emit,materials:m}){
 const {x,z,y}=site,id=`desert-${index}`,unit=new THREE.BoxGeometry(1,1,1);
 const box=(mat,cx,cy,cz,w,h,d,rx=0,ry=0,rz=0)=>{const g=scaleBoxUV(unit.clone(),w,h,d,2);emit(g,mat,cx,cy,cz,w,h,d,rx,ry,rz);g.dispose();};
 const rounded=(mat,cx,cy,cz,w,h,d,radius=.10)=>{const g=scaleBoxUV(new RoundedBoxGeometry(w,h,d,2,radius),w,h,d,2);emit(g,mat,cx,cy,cz);g.dispose();};
 const solid=(label,mat,cx,cy,cz,w,h,d,radius=0)=>{(radius?rounded:box)(mat,cx,cy,cz,w,h,d,radius);return buildingBox(root,`${id}-${label}`,cx,cy,cz,w,h,d);};
 const log=(cx,cy,cz,r,length,axis='y')=>{const g=new THREE.CylinderGeometry(r*.93,r,length,12);emit(g,m.wood,cx,cy,cz,1,1,1,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);g.dispose();};
 const foundationHeight=y-site.foundationBottom;
 solid('foundation',m.plaster,x,(site.foundationBottom+y)/2,z,24,foundationHeight,14);
 solid('body',m.plaster,x,y+2.4,z,24,4.8,14,.18);
 // Rounded parapets contain the roof, instead of projecting an oversized flat slab.
 solid('roof',m.coping,x,y+4.79,z,24,.24,14,.11);
 const parapet=(label,cx,cz,w,d,base)=>{
  for(const side of [-1,1]){
   solid(`${label}-front-${side}`,m.plaster,cx,base+.34,cz+side*(d/2-.23),w,.68,.46,.15);
   solid(`${label}-side-${side}`,m.plaster,cx+side*(w/2-.23),base+.34,cz,.46,.68,d-.75,.15);
  }
 };
 parapet('parapet',x,z,24,14,y+4.8);
 const ux=x+(index%2?-5:4),uw=index%2?9.6:12,ud=index%2?7:8,uh=index%2?2.6:2.85;
 solid('upper-body',m.plaster,ux,y+4.8+uh/2,z+2,uw,uh,ud,.17);
 solid('upper-roof',m.coping,ux,y+4.8+uh,z+2,uw,.23,ud,.10);
 parapet('upper-parapet',ux,z+2,uw,ud,y+4.8+uh);
 // A small chimney and roof drains break the repeated block silhouette.
 solid('chimney',m.plaster,x+(index%2?7:-8),y+5.7,z+4.8,1.65,1.8,1.65,.13);
 rounded(m.coping,x+(index%2?7:-8),y+6.63,z+4.8,1.86,.23,1.86,.10);
 for(const side of [-1,1]){box(m.reveal,x+side*12.03,y+4.59,z+4,.08,.15,.3);box(m.wood,x+side*12.3,y+4.5,z+4,.65,.08,.36);}
 // Raised porch wings meet the entrance stair. The central stair remains open to the door.
 for(const side of [-1,1]){
  solid(`terrace-${side}`,m.plaster,x+side*7.35,(site.foundationBottom+y)/2,z-9.8,9.5,foundationHeight,5.6,.08);
  rounded(m.stone,x+side*7.35,y+.025,z-9.8,9.5,.11,5.6,.025);
 }
 const steps=desertEntranceSteps(c,site);
 for(const [i,s]of steps.entries()){
  const record=solid(`entrance-step-${i}`,m.stone,s.x,(s.bottom+s.top)/2,s.z,s.width,s.top-s.bottom,s.depth);
  if(i===0)record.navigationFootprint={x,z:(steps[0].z-steps[0].depth/2+steps.at(-1).z+steps.at(-1).depth/2)/2,halfWidth:s.width/2,halfDepth:(steps.at(-1).z+steps.at(-1).depth/2-steps[0].z+steps[0].depth/2)/2,yaw:0};else record.navigationSkip=true;
 }
 // Grounded timber posts, stone shoes, corbels, and exposed round roof beams.
 for(const offset of [-10.4,-3.5,3.5,10.4]){
  const px=x+offset,pz=z-11.8;
  rounded(m.stone,px,y+.18,pz,.72,.35,.72,.055);
  box(m.wood,px,y+1.95,pz,.35,3.7,.35);
  buildingBox(root,`${id}-porch-post-${offset}`,px,y+1.95,pz,.42,3.9,.42);
  for(const side of [-1,1])box(m.wood,px+side*.32,y+3.45,pz,.72,.17,.26,0,0,side*Math.PI/4);
  rounded(m.wood,px,y+3.77,pz,1.35,.23,.44,.06);
 }
 solid('porch-beam',m.wood,x,y+3.92,z-11.8,23.7,.34,.38);
 solid('porch-roof',m.plaster,x,y+4.3,z-9.8,24.6,.34,6.2,.10);
 for(let i=0;i<18;i++)log(x-11.4+i*1.34,y+4.1,z-9.8,.14,6.85,'z');
 for(let i=0;i<20;i++)box(m.wood,x,y+4.145,z-12.7+i*.3,24,.045,.19);
 // Recessed glazing and timber frames give a readable human scale to each elevation.
 const window=(cx,base,cz,width,height,side=0)=>{
  const yaw=side*Math.PI/2;
  const local=(mat,dx,dy,dz,w,h,d)=>box(mat,cx+dx*Math.cos(yaw)+dz*Math.sin(yaw),base+dy,cz-dx*Math.sin(yaw)+dz*Math.cos(yaw),w,h,d,0,yaw);
  local(m.reveal,0,height/2,.015,width+.25,height+.25,.07);
  local(m.glass,0,height/2,-.035,width,height,.055);
  for(const s of [-1,1])local(m.wood,s*(width/2+.06),height/2,-.125,.14,height+.38,.24);
  for(const h of [-.10,height+.1])local(m.wood,0,h,-.13,width+.36,.14,.25);
  local(m.wood,0,height/2,-.13,.07,height,.15);
  local(m.wood,0,height*.66,-.13,width,.065,.15);
  local(m.coping,0,-.21,-.13,width+.58,.16,.54);
 };
 for(const front of [-1,1]){
  for(const xx of [-8.4,-4.5,4.5,8.4])window(x+xx,y+1.15,z+front*7.025,2.45,2.03,front<0?0:2);
 }
 for(const side of [-1,1])for(const zz of [-4.1,3.9])window(x+side*12.025,y+1.3,z+zz,2.2,1.9,side<0?1:-1);
 for(const xx of [-uw*.28,uw*.28])window(ux+xx,y+5.38,z+2-ud/2-.025,uw*.28,1.42);
 // The door threshold is the building floor, with the staircase directly below it.
 box(m.reveal,x,y+1.51,z-7.045,3.15,3.04,.09);
 for(const side of [-1,1]){
  rounded(m.wood,x+side*.74,y+1.46,z-7.16,1.40,2.90,.13,.025);
  box(m.glass,x+side*.74,y+1.86,z-7.235,1.06,1.68,.025);
  for(let i=0;i<4;i++)box(m.wood,x+side*(.19+i*.34),y+.49,z-7.24,.028,.70,.03);
  box(m.bronze,x+side*.16,y+1.32,z-7.29,.055,.39,.07);
  rounded(m.plaster,x+side*1.69,y+1.53,z-7.17,.25,3.22,.36,.08);
 }
 rounded(m.coping,x,y+3.15,z-7.16,3.64,.27,.42,.085);
 // Framed wall lanterns, not floating point lights.
 for(const side of [-1,1]){
  const lx=x+side*2.55,lz=z-7.25;
  box(m.bronze,lx,y+2.8,lz,.14,.72,.14);box(m.bronze,lx,y+3.07,lz-.2,.08,.08,.4);
  box(m.lantern,lx,y+2.7,lz-.36,.27,.40,.23);
  for(const xx of [-.17,.17])for(const zz of [-.15,.15])box(m.bronze,lx+xx,y+2.7,lz-.36+zz,.036,.48,.036);
  for(const yy of [2.45,2.95])rounded(m.bronze,lx,y+yy,lz-.36,.42,.08,.38,.03);
 }
 // Low outer parapets keep the raised terrace plausible without blocking the entrance.
 for(const side of [-1,1]){
  solid(`terrace-rail-${side}`,m.plaster,x+side*11.9,y+.52,z-9.8,.45,1.04,5.6,.13);
  rounded(m.coping,x+side*11.9,y+1.07,z-9.8,.55,.16,5.7,.07);
  // Built-in seats use the same porch materials and remain inside the terrace collision.
  rounded(m.plaster,x+side*9.1,y+.32,z-8,3.25,.64,1.0,.13);
  box(m.wood,x+side*9.1,y+.67,z-8,3.28,.09,1.02);
 }
 unit.dispose();
 return{steps,variant:index%2?'practice-lodge':'clubhouse'};
}
