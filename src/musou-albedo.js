import {SRGBColorSpace} from 'three';
import {loadCharacterTexture} from './character-textures.js';

export function loadMusouAlbedo(identity){
 if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(identity))return null;
 return loadCharacterTexture(`${import.meta.env?.BASE_URL||'/'}textures/musou/${identity}-snarl.webp?v=20261005-identity`,{colorSpace:SRGBColorSpace,anisotropy:8});
}

// A private material lets each actor own its expression. The shared texture
// loads with the character, before portrait shader preparation can begin.
export function installMusouAlbedo(model,texture){
 if(!texture)return null;
 const weight={value:0},materials=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^[fm]\d{3}_head$/.test(mesh.material?.name))return;
  const original=mesh.material,material=original.clone();
  const previous=original.onBeforeCompile,key=original.customProgramCacheKey.call(original);
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);
   shader.uniforms.musouAlbedo={value:texture};shader.uniforms.musouAlbedoWeight=weight;
   shader.fragmentShader='uniform sampler2D musouAlbedo;\nuniform float musouAlbedoWeight;\n'+shader.fragmentShader;
   // Keep the native alpha, roughness and normals. Both color samplers use
   // sRGB decoding and the original GLTF UV coordinates.
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
     diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*texture2D(musouAlbedo,vMapUv).rgb,musouAlbedoWeight);
    #endif`);
  };
  material.customProgramCacheKey=()=>key+':musou-albedo-v1';
  mesh.material=material;materials.push(material);
 });
 if(!materials.length)throw Error('The musou expression texture needs the character’s native head material.');
 return {materials,weight,set(value){weight.value=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;}};
}
