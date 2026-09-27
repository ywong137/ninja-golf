import * as THREE from 'three';
import {heightAt} from './course.js';
import {landscapeHeight} from './regional-terrain.js';
export const HORIZON_TRIANGLE_LIMIT=198000;
// Rectangular rings retain the detailed course edge. Shared corner and refinement
// vertices keep the surface watertight and give adjacent faces identical normals.
export function landscapeHorizon(c,region,{refine=true}={}){
 const vertices=[],uvs=[],indices=[],extent=c.length+330,inner=new Set();
 const vertex=(x,z)=>{const id=vertices.length/3;vertices.push(x,landscapeHeight(c,region,x,z),z);uvs.push((x+375)/750,(z+165)/extent);return id;};
 const triangle=(a,b,d)=>{const cross=(vertices[b*3+2]-vertices[a*3+2])*(vertices[d*3]-vertices[a*3])-(vertices[b*3]-vertices[a*3])*(vertices[d*3+2]-vertices[a*3+2]);indices.push(a,...(cross>=0?[b,d]:[d,b]));};
 const ring=offset=>{
  const corners=[[-375-offset,-165-offset],[-375-offset,c.length+165+offset],[375+offset,c.length+165+offset],[375+offset,-165-offset]],spacing=offset===0?3:Math.min(55,6+offset*.04);
  const cornerIds=corners.map(([x,z])=>vertex(x,z));
  return corners.map(([x,z],side)=>{const next=(side+1)%4,[xx,zz]=corners[next],n=Math.round(Math.hypot(xx-x,zz-z)/spacing);
   return Array.from({length:n+1},(_,i)=>i===0?cornerIds[side]:i===n?cornerIds[next]:vertex(x+(xx-x)*i/n,z+(zz-z)*i/n));});
 };
 let previous=ring(0);for(const side of previous)for(const id of side)inner.add(id);
 for(let offset=25;offset<=6100;offset+=offset<600?25:50){
  const next=ring(offset);
  for(let side=0;side<4;side++){
   const a=previous[side],b=next[side];let i=0,j=0;
   while(i<a.length-1||j<b.length-1){if(i<a.length-1&&(j===b.length-1||(i+1)/(a.length-1)<=(j+1)/(b.length-1))){triangle(a[i],b[j],a[i+1]);i++;}else{triangle(a[i],b[j],b[j+1]);j++;}}
  }previous=next;
 }
 const baseTriangles=indices.length/3;
 if(region&&refine){
  const edges=new Map(),key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  for(let i=0;i<indices.length;i+=3){
   const ids=indices.slice(i,i+3),x=ids.reduce((sum,id)=>sum+vertices[id*3],0)/3,z=ids.reduce((sum,id)=>sum+vertices[id*3+2],0)/3;
   const centerError=Math.abs(landscapeHeight(c,region,x,z)-ids.reduce((sum,id)=>sum+vertices[id*3+1],0)/3);
   for(let j=0;j<3;j++){
    const a=ids[j],b=ids[(j+1)%3];if(inner.has(a)&&inner.has(b))continue;
    const id=key(a,b);let edge=edges.get(id);
    if(!edge){const x=(vertices[a*3]+vertices[b*3])/2,z=(vertices[a*3+2]+vertices[b*3+2])/2,y=landscapeHeight(c,region,x,z);
     edge={a,b,x,z,y,error:Math.abs(y-(vertices[a*3+1]+vertices[b*3+1])/2),faces:0,mid:null};edges.set(id,edge);}
    edge.error=Math.max(edge.error,centerError*.65);edge.faces++;
   }
  }
  // Splitting a shared edge adds exactly one triangle per adjacent face.
  let added=0;for(const edge of [...edges.values()].filter(e=>e.error>.8).sort((a,b)=>b.error-a.error)){
   if(baseTriangles+added+edge.faces>HORIZON_TRIANGLE_LIMIT)continue;
   edge.mid=vertices.length/3;vertices.push(edge.x,edge.y,edge.z);uvs.push((edge.x+375)/750,(edge.z+165)/extent);added+=edge.faces;
  }
  const original=indices.splice(0);
  for(let i=0;i<original.length;i+=3){
   const [a,b,d]=original.slice(i,i+3),ab=edges.get(key(a,b))?.mid??null,bd=edges.get(key(b,d))?.mid??null,da=edges.get(key(d,a))?.mid??null;
   const mask=(ab!==null?1:0)|(bd!==null?2:0)|(da!==null?4:0);
   if(mask===0)triangle(a,b,d);
   else if(mask===1){triangle(a,ab,d);triangle(ab,b,d);}
   else if(mask===2){triangle(a,b,bd);triangle(a,bd,d);}
   else if(mask===4){triangle(a,b,da);triangle(da,b,d);}
   else if(mask===3){triangle(b,bd,ab);triangle(a,ab,d);triangle(ab,bd,d);}
   else if(mask===5){triangle(a,ab,da);triangle(ab,b,d);triangle(ab,d,da);}
   else if(mask===6){triangle(d,da,bd);triangle(a,b,bd);triangle(a,bd,da);}
   else{triangle(a,ab,da);triangle(ab,b,bd);triangle(da,bd,d);triangle(ab,bd,da);}
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
 // The inner ring meets the existing course surface, whose normals use this derivative.
 const normal=geo.getAttribute('normal');
 for(const id of inner){const x=vertices[id*3],z=vertices[id*3+2],nx=heightAt(c,x-.15,z)-heightAt(c,x+.15,z),nz=heightAt(c,x,z-.15)-heightAt(c,x,z+.15),length=Math.hypot(nx,.3,nz);normal.setXYZ(id,nx/length,.3/length,nz/length);}
 geo.computeBoundingSphere();geo.userData.horizon={baseTriangles,triangles:indices.length/3,innerVertices:inner.size};return geo;
}
