import * as THREE from 'three';
// Static surface variation adds finish detail without changing shared textures.
export function architecturalSurface(color,roughness=.85,metalness=0,grain=false){
 const material=new THREE.MeshStandardMaterial({color,roughness,metalness});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 architecturePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\narchitecturePosition=position;');
  shader.fragmentShader=`varying vec3 architecturePosition;
float architectureHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float architectureNoise(vec3 p){
 vec3 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(architectureHash(cell),architectureHash(cell+vec3(1,0,0)),f.x),mix(architectureHash(cell+vec3(0,1,0)),architectureHash(cell+vec3(1,1,0)),f.x),f.y),mix(mix(architectureHash(cell+vec3(0,0,1)),architectureHash(cell+vec3(1,0,1)),f.x),mix(architectureHash(cell+vec3(0,1,1)),architectureHash(cell+vec3(1,1,1)),f.x),f.y),f.z);
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 ap=architecturePosition;
 float finish=architectureNoise(ap*${grain?'vec3(24.,.18,3.)':'1.7'});
 float fineFinish=architectureNoise(ap*${grain?'vec3(60.,.6,5.)':'22.'});
 diffuseColor.rgb*= ${grain?'.94+(finish-.5)*.10+(fineFinish-.5)*.025':'.985+(finish-.5)*.026+(fineFinish-.5)*.009'};`);
 };
 material.customProgramCacheKey=()=>`architectural-finish-${grain?'wood':'smooth'}-v2`;
 return material;
}
