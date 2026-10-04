import * as THREE from 'three';
import {applyCharacterOutfit} from './character-outfits.js';
import {loadCharacterTexture,awaitCharacterTextures} from './character-textures.js';

function nativeRoughness(name){
 return loadCharacterTexture(`${import.meta.env?.BASE_URL||'/'}textures/characters/${name}-roughness.png`,{colorSpace:THREE.NoColorSpace,anisotropy:4});
}
export const awaitCharacterMaterials=awaitCharacterTextures;
function finishNativeMaterial(mat){
 const match=/^[fm]\d{3}_(head|body|opacity)$/.exec(mat.name);if(!match)return false;
 mat.metalness=0;applyCharacterOutfit(mat);
 if(match[1]==='opacity'){
  // Preserve source strand blending; its layered cards depend on the exported depth settings.
  mat.roughness=.72;
 }else{
  // Derived only from the source artist's specular intensity atlas.
  mat.roughness=1;mat.roughnessMap=nativeRoughness(mat.name);
 }
 mat.userData.nativeSurfaceFinish=true;mat.needsUpdate=true;return true;
}

let weave;
function fabricNormal(){
 if(weave)return weave;const n=128,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,over=(Math.floor(x/8)+Math.floor(y/8))%2;data[i]=128+Math.sin(x*Math.PI/4)*(over?10:29);data[i+1]=128+Math.sin(y*Math.PI/4)*(over?29:10);data[i+2]=252;data[i+3]=255;}
 weave=new THREE.DataTexture(data,n,n);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.generateMipmaps=true;weave.minFilter=THREE.LinearMipmapLinearFilter;weave.anisotropy=8;weave.needsUpdate=true;return weave;
}
export function finishCharacterMaterial(mat){
 if(finishNativeMaterial(mat))return;
 const cloth=/Woven|Silk|Indigo/.test(mat.name),metal=/Lacquered|brass/i.test(mat.name),leather=/Leather/.test(mat.name);
 if(cloth){mat.normalMap=fabricNormal();mat.normalScale=new THREE.Vector2(.22,.22);mat.roughness=.9;}
 if(metal){mat.roughness=/brass/i.test(mat.name)?.38:.37;mat.envMapIntensity=.92;}
 if(!(cloth||metal||leather))return;
 mat.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 garmentPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngarmentPosition=position;');
  s.fragmentShader=`varying vec3 garmentPosition;
  float materialHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float materialNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(materialHash(i),materialHash(i+vec3(1,0,0)),f.x),mix(materialHash(i+vec3(0,1,0)),materialHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(materialHash(i+vec3(0,0,1)),materialHash(i+vec3(1,0,1)),f.x),mix(materialHash(i+vec3(0,1,1)),materialHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float patina=materialNoise(garmentPosition*21.);float grain=materialNoise(garmentPosition*190.);
    diffuseColor.rgb*=.90+patina*.18+grain*.04;
    ${cloth?'float stitch=pow(max(0.,sin(garmentPosition.x*92.)*sin(garmentPosition.z*92.)),6.);diffuseColor.rgb*=1.+stitch*.085;':''}`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(patina-.5)*${metal?'.20':'.08'},.15,1.);`);
 };
 mat.customProgramCacheKey=()=>`garment-${cloth}-${metal}-${leather}`;
}
