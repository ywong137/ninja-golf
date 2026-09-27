import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from './course.js';

// Each palm frond is a curved rachis with paired, tapered leaflets.
export function palmFrond(){
 const vertices=[],indices=[];const point=(t,side=0)=>new THREE.Vector3(side,Math.sin(t*Math.PI)*.52-t*t*.82,t*4.6);
 for(let j=0;j<14;j++){
  const t=.05+j*.066,stem=point(t),next=point(t+.045),width=Math.sin(t*Math.PI)*.94;
  for(const side of [-1,1]){
   const end=point(t+.10,side*width),back=point(t+.17,side*width*.77);end.y-=.17;back.y-=.21;
   const base=vertices.length/3;for(const p of [stem,next,end,back])vertices.push(p.x,p.y,p.z);
   indices.push(base,base+2,base+1,base+1,base+2,base+3);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function cactusStem(){
 const g=new THREE.CapsuleGeometry(.36,3.3,6,32),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),f=.93+.07*Math.cos(a*16);p.setXYZ(i,x*f,p.getY(i)+2,z*f);}
 g.computeVertexNormals();return g;
}
export function cactusArm(){
 const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.55,0),new THREE.Vector3(.48,1.55,0),new THREE.Vector3(.86,1.8,0),new THREE.Vector3(.92,2.2,0),new THREE.Vector3(.92,2.9,0)]);
 const tube=new THREE.TubeGeometry(path,15,.23,12,false),cap=new THREE.SphereGeometry(.23,12,6);cap.translate(.92,2.9,0);
 const g=mergeGeometries([tube,cap]);tube.dispose();cap.dispose();return g;
}
export function shrubGeometry(seed=18){
 const r=random(seed),v=[],col=[],colors=[new THREE.Color('#6f7852'),new THREE.Color('#8c9666'),new THREE.Color('#adb28a')];
 for(let i=0;i<130;i++){
  const a=r()*Math.PI*2,rad=Math.sqrt(r())*.9,y=(1-rad*.58)*(.25+r()*.65),x=Math.cos(a)*rad,z=Math.sin(a)*rad,w=.05+r()*.07,h=.09+r()*.12,c=colors[i%3];
  for(const p of [[x-w,y,z],[x+w,y+.015,z],[x,y+h,z+.025],[x,y-.02,z-w],[x,y+.01,z+w],[x+.02,y+h,z]]){v.push(...p);col.push(c.r,c.g,c.b);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}
export function ridgeTrunk(){
 const g=new THREE.CylinderGeometry(.17,.3,8,9,24),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i),f=1+.075*Math.cos(y*19);p.setXYZ(i,p.getX(i)*f+.035*y*y,p.getY(i)+4,p.getZ(i)*f);}
 g.computeVertexNormals();return g;
}
