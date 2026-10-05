import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original models: separate mature silhouettes and a young column, in metres.
export const SAGUARO_NAMES=['saguaro-twin','saguaro-crown','saguaro-young'];
export const SAGUARO_DETAIL={nearStart:30,nearEnd:34,farStart:760,farEnd:800};
const forms={
 'saguaro-twin':{height:6.8,radius:.34,lean:.13,arms:[{y:2.8,yaw:.5,reach:1.15,top:5.8,radius:.245},{y:3.8,yaw:3.45,reach:1.0,top:6.0,radius:.23}]},
 'saguaro-crown':{height:5.7,radius:.40,lean:-.12,arms:[{y:2.3,yaw:.2,reach:1.3,top:4.7,radius:.25},{y:2.8,yaw:2.75,reach:1.05,top:5.2,radius:.26},{y:3.5,yaw:4.55,reach:.82,top:5.8,radius:.23}]},
 'saguaro-young':{height:3.4,radius:.235,lean:.055,arms:[]},
};
export const saguaroHeight=name=>Math.max(forms[name].height,...forms[name].arms.map(arm=>arm.top));
export const saguaroRadius=name=>forms[name].radius;
const v=new THREE.Vector3();
function stemGeometry(points,radius,lod,seed){
 const curve=new THREE.CatmullRomCurve3(points),length=curve.getLength(),bodyRings=lod?Math.max(9,Math.ceil(length*3)):Math.max(20,Math.ceil(length*7)),capRings=lod?3:8,rings=bodyRings+capRings,sides=lod?14:56;
 const frames=curve.computeFrenetFrames(rings,false),positions=[],colors=[],uv=[],indices=[],base=new THREE.Color(),olive=new THREE.Color('#5f7950'),wax=new THREE.Color('#8a9467'),cork=new THREE.Color('#877255');
 for(let i=0;i<=rings;i++){
  const distance=i<=bodyRings?(length-radius)*i/bodyRings:length-radius+radius*Math.sin((i-bodyRings)/capRings*Math.PI/2);
  const t=distance/length,p=curve.getPointAt(t),fromTop=(1-t)*length;
  // A hemispherical crown closes at the actual end, without a separate ball.
  const cap=Math.sqrt(Math.max(.00001,1-Math.max(0,1-fromTop/radius)**2));
  const taper=1-.17*t+.025*Math.sin(t*9+seed);
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,rib=lod?1:.94+.06*Math.cos(a*14),r=radius*taper*cap*rib;
   v.copy(p).addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);
   positions.push(v.x,v.y,v.z);uv.push(j/sides,length*t);
   const variation=.30+.17*Math.sin(a*3+seed)+.11*Math.sin(p.y*1.8+a*2)+.08*Math.sin(p.y*8+a*4);
   base.copy(olive).lerp(wax,variation).lerp(cork,Math.max(0,1-p.y/.65)*.75);colors.push(base.r,base.g,base.b);
   if(i<rings&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 // Average seam normals so the lit side has no vertical seam.
 const n=g.attributes.normal;for(let i=0;i<=rings;i++){const a=i*(sides+1),b=a+sides;v.fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
 return g;
}
export function saguaroGeometry(name,lod=0){
 const f=forms[name];if(!f)throw new Error(`Unknown saguaro form: ${name}`);
 const pieces=[stemGeometry([new THREE.Vector3(0,-.10,0),new THREE.Vector3(f.lean*.25,f.height*.33,0),new THREE.Vector3(f.lean,f.height*.72,.035),new THREE.Vector3(f.lean*.85,f.height,0)],f.radius,lod,1)];
 for(const [i,a] of f.arms.entries()){
  const p=(x,y)=>new THREE.Vector3(Math.cos(a.yaw)*x,y,Math.sin(a.yaw)*x);
  // The arm leaves the trunk horizontally, rounds upward, then grows vertically.
  const points=[p(.05,a.y),p(a.reach*.55,a.y+.02),p(a.reach*.9,a.y+.33),p(a.reach,a.y+.85),p(a.reach*.97,a.top)];
  pieces.push(stemGeometry(points,a.radius,lod,i+4));
 }
 const g=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function applySaguaroSkin(material){
 material.vertexColors=true;material.color.set(0xffffff);material.roughness=.86;material.metalness=0;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 cactusUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncactusUv=uv;');
  shader.fragmentShader='varying vec2 cactusUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 q=vec2(cactusUv.x*14.,cactusUv.y*8.);
   vec2 footprint=max(fwidth(q),vec2(.001));
   float resolved=1.-smoothstep(.3,1.1,max(footprint.x,footprint.y));
   float rib=.5+.5*cos(q.x*6.2831853);
   diffuseColor.rgb*=mix(1.,.87+.17*rib,resolved);
   vec2 cell=abs(fract(q+vec2(.5,0.))-.5);
   // Small areole markings appear only while the image can resolve them.
   float areole=(1.-smoothstep(.06,.12+footprint.x,cell.x))*(1.-smoothstep(.065,.13+footprint.y,cell.y));
   float fiber=sin(cactusUv.y*510.+sin(cactusUv.x*93.)*5.)*.012;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.32,.19),areole*.65*resolved);
   diffuseColor.rgb*=1.+fiber*resolved;
  `);
 };
 material.customProgramCacheKey=()=> 'saguaro-skin-v1';return material;
}
export function createSaguaro(name){
 return{parts:[0,1].map(lod=>({lod,geometry:saguaroGeometry(name,lod),material:applySaguaroSkin(new THREE.MeshStandardMaterial())})),saguaro:true};
}
