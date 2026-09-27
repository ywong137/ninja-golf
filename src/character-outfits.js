import * as THREE from 'three';

// Exact source material identities avoid touching skin, hair, eyes, or enemies.
const MATERIALS=new Set(['m024_body','m017_body','m009_body','f003_body','f008_body','f012_body']);
const textures=new Map();
export function applyCharacterOutfit(material){
 if(!MATERIALS.has(material.name))return false;
 let entry=textures.get(material.name);
 if(!entry){
  entry={texture:null,promise:null};
  const url=`${import.meta.env?.BASE_URL||'/'}textures/outfits/${material.name}-outfit.webp`;
  entry.promise=new Promise((resolve,reject)=>{entry.texture=new THREE.TextureLoader().load(url,resolve,undefined,()=>reject(new Error(`Missing garment texture: ${url}`)));});
  entry.texture.colorSpace=THREE.SRGBColorSpace;entry.texture.flipY=false;entry.texture.anisotropy=8;
  textures.set(material.name,entry);
 }
 material.map=entry.texture;material.userData.outfitVariant=material.name;material.needsUpdate=true;return true;
}
export async function awaitCharacterOutfits(){await Promise.all([...textures.values()].map(entry=>entry.promise));}
