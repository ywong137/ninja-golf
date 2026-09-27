import * as THREE from 'three';
import {heightAt} from './course.js';
// A coarse outer landscape meets the detailed golf surface at the same sampled edge.
export function landscapeHorizon(c){
 const vertices=[],normals=[],uvs=[],indices=[],extent=c.length+330,nz=Math.round(extent/3),dz=extent/nz;
 const edgeZ=Array.from({length:nz+1},(_,i)=>-165+i*dz),edgeX=Array.from({length:251},(_,i)=>-375+i*3);
 const outerZ=[-4500,-3000,-1800,-900,-450,-165],farZ=[c.length+165,c.length+450,c.length+900,c.length+1800,c.length+3000,c.length+4500];
 const longZ=[...outerZ.slice(0,-1),...edgeZ,...farZ.slice(1)];
 const patch=(xs,zs)=>{const base=vertices.length/3;
  for(const z of zs)for(const x of xs){const y=heightAt(c,x,z),nx=heightAt(c,x-.2,z)-heightAt(c,x+.2,z),nz=heightAt(c,x,z-.2)-heightAt(c,x,z+.2),n=Math.hypot(nx,.4,nz);vertices.push(x,y,z);normals.push(nx/n,.4/n,nz/n);uvs.push((x+375)/750,(z+165)/extent);}
  for(let iz=0;iz<zs.length-1;iz++)for(let ix=0;ix<xs.length-1;ix++){const a=base+iz*xs.length+ix;indices.push(a,a+xs.length,a+1,a+1,a+xs.length,a+xs.length+1);}
 };
 patch([-4500,-3000,-1800,-900,-600,-375],longZ);patch([375,600,900,1800,3000,4500],longZ);patch(edgeX,outerZ);patch(edgeX,farZ);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);return geo;
}
