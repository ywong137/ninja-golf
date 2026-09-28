import * as THREE from 'three';

const palette=(id,name,color)=>Object.freeze({id,name,color});
export const ENEMY_APPEARANCES=Object.freeze([
 {id:'hoodie',model:'enemy-hoodie',name:'Hooded runner',palettes:[palette('ochre','Ochre','#9a7748'),palette('forest','Forest green','#3d6253'),palette('slate','Slate blue','#466477'),palette('plum','Muted plum','#704858')]},
 {id:'tshirt',model:'enemy-tshirt',name:'Club regular',palettes:[palette('white','White','#d3d0c5'),palette('red','Red','#a33439'),palette('gray','Gray','#777c80'),palette('navy','Navy','#263d58')]},
 {id:'cloth-ninja',model:'enemy-cloth-ninja',name:'Cloth shinobi',palettes:[palette('black','Black','#25262a'),palette('darkgray','Dark gray','#41454a'),palette('darkblue','Dark blue','#24384e'),palette('burgundy','Burgundy','#542d38')]},
].map(f=>Object.freeze({...f,palettes:Object.freeze(f.palettes)})));

// A fixed twelve-slot wardrobe cycle is independent of enemy combat roles.
export function enemyAppearanceForSlot(slot){
 if(!Number.isInteger(slot)||slot<0)throw Error('Enemy appearance slot must be a nonnegative integer.');
 return {family:slot%3,palette:Math.floor(slot/3)%4};
}
export function resolveEnemyAppearance({family=0,palette=0}={}){
 const index=typeof family==='string'?ENEMY_APPEARANCES.findIndex(f=>f.id===family):family;
 const definition=ENEMY_APPEARANCES[index];if(!definition)throw Error(`Unknown enemy appearance family: ${family}`);
 if(!Number.isInteger(palette)||!definition.palettes[palette])throw Error(`Invalid palette ${palette} for ${definition.id}`);
 return {family:index,palette,definition};
}

/** Apply to an instance with already-cloned materials. No per-instance textures. */
export function applyEnemyAppearance(model,appearance){
 const {family,palette,definition}=resolveEnemyAppearance(appearance),tint=new THREE.Color(definition.palettes[palette].color);let affected=0;
 model.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
  const body=(/^(m023|m017)_body$/.test(material.name)||material.name==='Enemy T-shirt'),woven=material.userData.enemyGarment;
  if(!body&&!woven)return;affected++;material.userData.enemyPalette=definition.palettes[palette].id;material.roughness=1;material.metalness=0;
  if(woven&&!material.map){material.color.copy(tint);continue;}
  const previous=material.onBeforeCompile;material.onBeforeCompile=shader=>{
   previous?.(shader);shader.uniforms.enemyClothColor={value:tint};shader.fragmentShader='uniform vec3 enemyClothColor;\n'+shader.fragmentShader;
   const region=family===1?'((vMapUv.x>.33&&vMapUv.x<.68&&vMapUv.y<.86)||((vMapUv.x<.31||vMapUv.x>.72)&&vMapUv.y>.445&&vMapUv.y<.575))':family===0?'(vMapUv.y<.825&&((vMapUv.x>.285&&vMapUv.x<.715)||vMapUv.y>.42))':'!(vMapUv.y>.825&&(vMapUv.x<.258||vMapUv.x>.742))';
   const reference=family===1?.008:family===0?.19:.052;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\n#ifdef USE_MAP\nif(${region}){float shade=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/${reference},.14,2.2);diffuseColor.rgb=enemyClothColor*shade;}\n#endif`);
  };
  material.customProgramCacheKey=()=>`enemy-cloth-${definition.id}-v1`;material.needsUpdate=true;
 }});
 model.userData.enemyAppearance={family,palette,id:definition.id};return {affectedMaterials:affected,ownedResources:[]};
}
