import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt} from './course.js';
import {scaleBoxUV} from './architecture-uv.js';
import {architecturalSurface as surface} from './architecture-materials.js';
import {buildingFootprint,buildingBox,buildingCylinder} from './building-placement.js';
export function pagodaStairs(c,site){
 const front=site.z-11.75,run=4.35,width=8,top=site.y+1.2;
 let entry=-Infinity;
 for(let dx=-4;dx<=4;dx+=.5)for(const dz of [0,.3])entry=Math.max(entry,heightAt(c,site.x+dx,front+dz));
 const count=Math.max(5,Math.ceil((top-entry)/.19)),rise=(top-entry)/count,tread=run/count;
 return Array.from({length:count},(_,i)=>{
  const z=front+(i+.5)*tread;let bottom=Infinity;
  for(const dx of [-4,0,4])for(const dz of [-tread/2,tread/2])bottom=Math.min(bottom,heightAt(c,site.x+dx,z+dz));
  return{x:site.x,z,top:entry+(i+1)*rise,bottom:bottom-.15,width,depth:tread+.018};
 });
}
export function pagodaLocation(c,root=null){
 const searches=[{radii:[65,85,105,125],offsets:[8,-24,28,-48]},{radii:[65,75,85,95,105,115,125,135,145],offsets:[-8,-40,40,52,-64]}];
 for(const search of searches){
  let best=null,bestScore=Infinity;
  for(const radius of search.radii)for(const dz of search.offsets)for(const side of [-1,1]){
   if(Math.hypot(radius,dz)>=150)continue;
   const site=buildingFootprint(c,{x:c.greenX+side*radius,z:c.length+dz,halfWidth:13,halfDepth:12},root,12);if(!site)continue;
   const steps=pagodaStairs(c,site);if(steps.length>22)continue;
   const front=steps[0],ground=[];for(let dx=-4;dx<=4;dx+=.5)ground.push(heightAt(c,site.x+dx,front.z-front.depth/2));
   if(front.top-Math.min(...ground)>=.45)continue;
   const score=site.y-site.foundationBottom+10*(Math.max(...ground)-Math.min(...ground))+.004*radius;
   if(score<bestScore){best=site;bestScore=score;}
  }
  if(best)return best;
 }
 throw new Error(`No safe pagoda site for ${c.name}`);
}

function roof(width,depth,rise){
 const v=[],uv=[],ids=[],N=28;
 for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){const a=x/N*2-1,b=z/N*2-1,q=Math.max(Math.abs(a),Math.abs(b));const h=rise*Math.pow(1-q,.86)+.32*Math.pow(q,9)+.18*Math.pow(Math.abs(a*b),3);v.push(a*width/2,h,b*depth/2);uv.push(x/N*width,z/N*depth);}
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const a=z*(N+1)+x;ids.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return g;
}
export function buildArchitecture(root,c,stoneTextures){
 const batches=new Map(),wood=surface('#4a2c1d',.82,0,true),red=surface('#8e3523',.57),plaster=surface('#d8c9a4'),stone=new THREE.MeshStandardMaterial({map:stoneTextures.color,normalMap:stoneTextures.normal,color:'#b4b5a5',roughness:.97,normalScale:new THREE.Vector2(.2,.2)}),gold=surface('#ba934b',.37,.75),tile=surface('#344441',.86,0);
 tile.side=THREE.DoubleSide;tile.onBeforeCompile=s=>{s.vertexShader='varying vec2 tileUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ntileUv=uv;');s.fragmentShader='varying vec2 tileUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat fluting=.78+.22*smoothstep(.05,.30,abs(sin(tileUv.x*11.)));float rows=.92+.08*smoothstep(.02,.09,fract(tileUv.y*2.8));diffuseColor.rgb*=fluting*rows;');};tile.customProgramCacheKey=()=> 'ceramic-roof';
 const object=new THREE.Object3D();const emit=(geo,mat,x,y,z,sx=1,sy=1,sz=1,rz=0)=>{object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.rotation.set(0,0,rz);object.updateMatrix();const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(object.matrix);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);geo.dispose();};
 const box=(m,x,y,z,sx,sy,sz,rz=0)=>emit(scaleBoxUV(new THREE.BoxGeometry(1,1,1),sx,sy,sz),m,x,y,z,sx,sy,sz,rz);
 const cyl=(m,x,y,z,r,h)=>emit(new THREE.CylinderGeometry(r,r*1.04,h,12),m,x,y,z);
 const solid=(id,m,x,y,z,w,h,d)=>{box(m,x,y,z,w,h,d);buildingBox(root,id,x,y,z,w,h,d);};
 // Gate feet sit on stone sockets. The upper beam curves upward at both ends.
 const tx=-13,tz=-8,ty=heightAt(c,tx,tz);
 for(const side of [-1,1]){buildingCylinder(root,`jp-gate-post-${side<0?'left':'right'}`,tx+side*4,ty+4.25,tz,.3328,8.2);buildingCylinder(root,`jp-gate-socket-${side}`,tx+side*4,ty+.35,tz,.5616,.7);buildingCylinder(root,`jp-gate-collar-${side}`,tx+side*4,ty+1.05,tz,.364,.6);cyl(stone,tx+side*4,ty+.35,tz,.54,.7);cyl(red,tx+side*4,ty+4.25,tz,.32,8.2);cyl(wood,tx+side*4,ty+1.05,tz,.35,.6);}
 solid('jp-gate-beam-lower',red,tx,ty+6.35,tz,10.4,.38,.6);box(gold,tx,ty+7.27,tz-.19,.74,1.16,.12);
 for(let i=0;i<24;i++){const a=(i+.5)/24*12.8-6.4,h=.38*Math.pow(Math.abs(a)/6.4,4),slope=.38*4*Math.pow(Math.abs(a)/6.4,3)/6.4*Math.sign(a);box(red,tx+a,ty+8.1+h,tz,.57,.38,.75,Math.atan(slope));buildingBox(root,`jp-gate-beam-upper-${i}`,tx+a,ty+8.25+h,tz,.6,.65,1.08);box(tile,tx+a,ty+8.4+h,tz,.57,.22,1.08,Math.atan(slope));}
 // Layered hip roofs, open galleries, lattice panels, steps, and exposed rafters.
 const site=pagodaLocation(c,root),{x:px,z:pz,y:py}=site;
 (root.userData.landmarks??=[]).push({x:px,z:pz,halfWidth:13,halfDepth:12});
 solid('jp-pagoda-foundation',stone,px,(site.foundationBottom+py+1.2)/2,pz,20,py+1.2-site.foundationBottom,15);
 for(const [i,step]of pagodaStairs(c,site).entries())solid(`jp-pagoda-step-${i}`,stone,step.x,(step.bottom+step.top)/2,step.z,step.width,step.top-step.bottom,step.depth);
 for(let level=0;level<3;level++){
  const y=py+1.2+level*5.1,w=16-level*3,d=w*.72;
  solid(`jp-pagoda-floor-${level}`,wood,px,y+.18,pz,w+1.4,.36,d+1.5);solid(`jp-pagoda-body-${level}`,plaster,px,y+2.05,pz,w-.9,3.5,d-.9);
  for(const side of [-1,1]){
   for(let x=-w/2+.4;x<w/2;x+=2.2){box(wood,px+x,y+2,pz+side*(d/2-.2),.2,3.9,.23);box(wood,px+x,y+1.5,pz+side*(d/2+.65),.10,.92,.10);}
   for(const h of [.95,1.7])box(wood,px,y+h,pz+side*(d/2+.65),w+1,.1,.1);
   for(let x=-w/2+.8;x<w/2;x+=.37)box(wood,px+x,y+2.4,pz+side*(d/2+.02),.043,1.2,.07);
   for(const h of [1.82,2.4,3.02])box(wood,px,y+h,pz+side*(d/2+.02),w-.8,.065,.09);
  }
  for(const side of [-1,1])for(const back of [-1,1])box(red,px+side*(w/2-.15),y+2,pz+back*(d/2-.15),.32,4.1,.32);
  box(red,px,y+3.85,pz,w+1,.25,d+1);
  for(let x=-w/2-.6;x<w/2+1;x+=.55)box(wood,px+x,y+3.85,pz,.14,.18,d+2.9);
  emit(roof(w+4.2,d+4.2,2.5),tile,px,y+4,pz);
  // Small overhead cells follow the sloped roof instead of sealing its gallery.
  const rw=w+4.2,rd=d+4.2,N=6,roofHeight=(a,b)=>{const q=Math.max(Math.abs(a),Math.abs(b));return 2.5*Math.pow(1-q,.86)+.32*Math.pow(q,9)+.18*Math.pow(Math.abs(a*b),3);};
  for(let ix=0;ix<N;ix++)for(let iz=0;iz<N;iz++){
   const ax=ix/N*2-1,bx=(ix+1)/N*2-1,az=iz/N*2-1,bz=(iz+1)/N*2-1,hs=[roofHeight(ax,az),roofHeight(ax,bz),roofHeight(bx,az),roofHeight(bx,bz),roofHeight((ax+bx)/2,(az+bz)/2)],low=Math.min(...hs)-.06,high=Math.max(...hs)+.06;
   buildingBox(root,`jp-pagoda-roof-${level}-${ix}-${iz}`,px+(ax+bx)*rw/4,y+4+(low+high)/2,pz+(az+bz)*rd/4,rw/N,high-low,rd/N);
  }

  box(tile,px,y+6.47,pz,2.2,.23,.34);
 }
 cyl(gold,px,py+19.2,pz,.12,2.8);
 for(let i=0;i<6;i++)emit(new THREE.TorusGeometry(.42-i*.04,.038,6,20).rotateX(Math.PI/2),gold,px,py+18.2+i*.30,pz);
 // Merge every static architectural material into one draw call.
 for(const [mat,geometries]of batches){const geo=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;root.add(m);}
}
