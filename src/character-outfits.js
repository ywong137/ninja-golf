import * as THREE from 'three';
import {loadCharacterTexture,awaitCharacterTextures} from './character-textures.js';

// Exact source material identities avoid touching skin, hair, eyes, or enemies.
const MATERIALS=new Set(['m024_body','m017_body','m009_body','f003_body','f008_body','f012_body']);
export function applyCharacterOutfit(material){
 if(!MATERIALS.has(material.name))return false;
 material.map=loadCharacterTexture(`${import.meta.env?.BASE_URL||'/'}textures/outfits/${material.name}-outfit.webp`,{colorSpace:THREE.SRGBColorSpace,anisotropy:8});
 material.userData.outfitVariant=material.name;material.needsUpdate=true;return true;
}
export const awaitCharacterOutfits=awaitCharacterTextures;
