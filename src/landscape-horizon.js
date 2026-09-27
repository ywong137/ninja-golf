import * as THREE from 'three';
import {landscapeHeight} from './regional-terrain.js';
// Concentric rectangles retain the detailed mesh edge, then reduce sampling in
// both dimensions. Unequal edge counts join with triangles, without T-junctions.
export function landscapeHorizon(c,region){
 const vertices=[],normals=[],uvs=[],indices=[],extent=c.length+330;
 const vertex=(x,z)=>{const y=landscapeHeight(c,region,x,z),nx=landscapeHeight(c,region,x-.2,z)-landscapeHeight(c,region,x+.2,z),nz=landscapeHeight(c,region,x,z-.2)-landscapeHeight(c,region,x,z+.2),n=Math.hypot(nx,.4,nz),id=vertices.length/3;vertices.push(x,y,z);normals.push(nx/n,.4/n,nz/n);uvs.push((x+375)/750,(z+165)/extent);return id;};
 const triangle=(a,b,d)=>{const cross=(vertices[b*3+2]-vertices[a*3+2])*(vertices[d*3]-vertices[a*3])-(vertices[b*3]-vertices[a*3])*(vertices[d*3+2]-vertices[a*3+2]);indices.push(a,...(cross>=0?[b,d]:[d,b]));};
 const ring=offset=>{
  const corners=[[-375-offset,-165-offset],[-375-offset,c.length+165+offset],[375+offset,c.length+165+offset],[375+offset,-165-offset]],spacing=offset===0?3:Math.min(55,6+offset*.04);
  return corners.map(([x,z],side)=>{const [xx,zz]=corners[(side+1)%4],n=Math.round(Math.hypot(xx-x,zz-z)/spacing);return Array.from({length:n+1},(_,i)=>vertex(x+(xx-x)*i/n,z+(zz-z)*i/n));});
 };
 let previous=ring(0);
 for(let offset=25;offset<=6100;offset+=offset<600?25:50){
  const next=ring(offset);
  for(let side=0;side<4;side++){
   const a=previous[side],b=next[side];let i=0,j=0;
   while(i<a.length-1||j<b.length-1){if(i<a.length-1&&(j===b.length-1||(i+1)/(a.length-1)<=(j+1)/(b.length-1))){triangle(a[i],b[j],a[i+1]);i++;}else{triangle(a[i],b[j],b[j+1]);j++;}}
  }previous=next;
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeBoundingSphere();return geo;
}
