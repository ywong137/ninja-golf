import * as THREE from 'three';
const palette=(id,name,color)=>Object.freeze({id,name,color});
export const ENEMY_APPEARANCES=Object.freeze([
 Object.freeze({id:'cloth-ninja',model:'enemy-cloth-ninja',name:'Shinobi',palettes:Object.freeze([
  palette('black','Ink black','#171c23'),palette('charcoal','Charcoal','#30373e'),
  palette('navy','Midnight navy','#17283f'),palette('indigo','Smoky indigo','#28374b'),
 ])}),
]);
export const NINJA_TRIM=Object.freeze({
 japanese:['#a19370','#9a7771','#708e86','#a7a39b'],
 highlands:['#8d9774','#8e8093','#9e9781','#6f9393'],
 desert:['#b08867','#8e9e95','#a78d77','#a28b8f'],
 cyberpunk:['#66aaa9','#9e7ba6','#858daf','#b1a085'],
});
export function enemyAppearanceForSlot(slot,theme='japanese'){
 if(!Number.isInteger(slot)||slot<0)throw Error('Enemy appearance slot must be a nonnegative integer.');
 return {family:0,palette:slot%4,trim:Math.floor(slot/4)%4,theme};
}
export function resolveEnemyAppearance({family=0,palette=0,trim=0,theme='japanese'}={}){
 const index=typeof family==='string'?ENEMY_APPEARANCES.findIndex(f=>f.id===family):family;
 const definition=ENEMY_APPEARANCES[index];if(!definition)throw Error(`Unknown enemy appearance family: ${family}`);
 if(!Number.isInteger(palette)||!definition.palettes[palette])throw Error(`Invalid palette ${palette} for ${definition.id}`);
 if(!Number.isInteger(trim)||trim<0||trim>3)throw Error('Ninja trim must be 0–3.');
 return {family:index,palette,trim,theme:NINJA_TRIM[theme]?theme:'japanese',definition};
}
/** Fixed dark cloth palettes and narrow course-colored trim; roles remain independent. */
export function applyEnemyAppearance(model,appearance){
 const {family,palette,trim,theme,definition}=resolveEnemyAppearance(appearance);
 const tint=new THREE.Color(definition.palettes[palette].color),edge=new THREE.Color(NINJA_TRIM[theme][trim]);let affected=0;
 model.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
  if(!material.userData.enemyGarment&&!/^m023_body$/.test(material.name))return;
  affected++;material.userData.enemyPalette=definition.palettes[palette].id;material.roughness=1;material.metalness=0;
  const sash=/waist sash/i.test(material.name);
  if(!material.map){material.color.copy(sash?edge.clone().multiplyScalar(.65):tint);continue;}
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   previous?.(shader);shader.uniforms.enemyClothColor={value:tint};shader.uniforms.enemyTrimColor={value:edge};
   shader.fragmentShader='uniform vec3 enemyClothColor;uniform vec3 enemyTrimColor;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
    if(!(vMapUv.y>.825&&(vMapUv.x<.258||vMapUv.x>.742))){
     float shade=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.052,.18,1.8);
     diffuseColor.rgb=enemyClothColor*shade;
     float seam=(1.-smoothstep(.003,.006,abs(vMapUv.x-.5)))*step(.34,vMapUv.y)*step(vMapUv.y,.71);
     diffuseColor.rgb=mix(diffuseColor.rgb,enemyTrimColor*.55,seam);
    }
    #endif`);
  };
  material.customProgramCacheKey=()=>`ninja-course-trim-v2-${sash}`;material.needsUpdate=true;
 }});
 model.userData.enemyAppearance={family,palette,trim,theme,id:definition.id};return {affectedMaterials:affected,ownedResources:[]};
}
