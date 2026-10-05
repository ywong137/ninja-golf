import * as THREE from 'three';
import {leafShadowCutoff} from './foliage-materials.js';
import {bunkerDistance} from './bunkers.js';
import {waterAt} from './course-layout.js';
import templates from './rough-grass-templates.json' with {type:'json'};
import {lieAt,greenDistance,fairwayDistance,random} from './course.js';

export const ROUGH_GRASS={step:.4,radius:30,fadeStart:17,fadeEnd:24,capacity:22500,streamRadius:28.25,blades:16};
const palettes={japanese:'#ffffff',highlands:'#d2c496',desert:'#cbb88c',cyberpunk:'#91b8b2'};

// The CC0 source templates preserve curved leaf shapes and photographic UVs.
export function roughGrassGeometry(theme){
 const r=random(39257),positions=[],normals=[],uv=[],colors=[],tint=new THREE.Color(palettes[theme]||palettes.japanese);
 for(let blade=0;blade<ROUGH_GRASS.blades;blade++){
  const source=templates[blade%templates.length],angle=r()*Math.PI*2,co=Math.cos(angle),si=Math.sin(angle),scale=1.7+r()*.5;
  const cx=(blade%4+r())/4*.42-.21,cz=(Math.floor(blade/4)+r())/4*.42-.21;
  for(let i=0;i<source.position.length;i+=3){
   const x=source.position[i]*scale,y=source.position[i+1]*scale,z=source.position[i+2]*scale;
   positions.push(co*x-si*z+cx,y,si*x+co*z+cz);
   const nx=source.normal[i],ny=source.normal[i+1],nz=source.normal[i+2];normals.push(co*nx-si*nz,ny,si*nx+co*nz);
   const shade=.68+.32*Math.min(1,y/.07);colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
  }
  uv.push(...source.uv);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geo;
}

export function roughGrassMaterial(time,focus,textures){
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,map:textures.color,alphaMap:textures.alpha,alphaTest:.18,alphaToCoverage:true,side:THREE.DoubleSide,roughness:1});
 mat.color.setRGB(1.5,1.65,1.3);
 mat.onBeforeCompile=s=>{
  s.uniforms.grassTime=time;s.uniforms.grassFocus=focus;
  s.vertexShader='uniform float grassTime;uniform vec3 grassFocus;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 origin=instanceMatrix[3].xyz;
   float fade=1.-smoothstep(${ROUGH_GRASS.fadeStart}.,${ROUGH_GRASS.fadeEnd}.,distance(origin.xz,grassFocus.xz));
   transformed.y*=fade;
   float wind=sin(grassTime*1.6+origin.x*.55+origin.z*.27)*.16+sin(grassTime*.8+origin.z*.14)*.12;
   transformed.x+=wind*position.y*position.y*4.*fade;
  `);
  // Blend toward the ground normal to approximate the diffuse response of many thin leaves.
  // Root shading supplies local occlusion without another shadow-map draw.
  s.fragmentShader=s.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
   // The original RGB photograph has black outside its alpha mask.
   // Undo that coverage average before lighting minified blade edges.
   diffuseColor.rgb/=max(.18,texture2D(alphaMap,vAlphaMapUv).g);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(mix(normal,normalize(mat3(viewMatrix)*vec3(0.,1.,0.)),.65));
  `);
 };
 mat.customProgramCacheKey=()=> 'rough-grass-photographic-v3';leafShadowCutoff(mat,.18);return mat;
}

// This only decorates Rough. Golf lies, ball resistance, and course boundaries are unchanged.
export function roughGrassGrowth(course,x,z){
 if(lieAt(course,x,z)!=='Rough')return 0;
 const edge=fairwayDistance(course,x,z);
 if(edge<.6||greenDistance(course,x,z)<19.2||(Math.abs(x)<5.6&&Math.abs(z)<7.6))return 0;
 if(course.bunkers.some(b=>bunkerDistance(x,z,b)<.8))return 0;
 if([[.6,.6],[.6,-.6],[-.6,.6],[-.6,-.6]].some(([dx,dz])=>waterAt(course,x+dx,z+dz)))return 0;
 const firstCut=THREE.MathUtils.smoothstep(edge,.6,3.2);
 const patch=.78+.22*Math.sin(x*.39+Math.sin(z*.21))*Math.sin(z*.28-x*.11);
 if(course.theme==='desert')return edge<8?(.20+.65*firstCut)*patch*(1.-THREE.MathUtils.smoothstep(edge,4,8)):0;
 if(course.theme==='cyberpunk')return (.32+.40*firstCut)*patch;
 return (.42+.78*firstCut)*patch*(course.theme==='highlands'?1.25:1.15);
}

export function grassCellSample(ix,iz){
 const hash=Math.sin(ix*127.1+iz*311.7)*43758.5453,a=hash-Math.floor(hash);
 const other=Math.sin(ix*269.5+iz*183.3)*43758.5453,b=other-Math.floor(other);
 return {x:(ix+.18+a*.64)*ROUGH_GRASS.step,z:(iz+.18+b*.64)*ROUGH_GRASS.step,angle:a*Math.PI*2,scale:.82+b*.34};
}

const grassUp=new THREE.Vector3(0,1,0),grassNormal=new THREE.Vector3(),grassYaw=new THREE.Quaternion();
export function placeGrassPatch(object,sample,growth,ground){
 const {x,z,angle,scale}=sample,y=ground(x,z);
 grassNormal.set((y-ground(x+.25,z))/.25,1,(y-ground(x,z+.25))/.25).normalize();
 object.position.set(x,y-.004,z);
 object.quaternion.setFromUnitVectors(grassUp,grassNormal).multiply(grassYaw.setFromAxisAngle(grassUp,angle));
 object.scale.set(scale,growth*scale,scale);object.updateMatrix();return y;
}
