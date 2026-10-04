import {TextureLoader} from 'three';

const entries=new Map(),readiness=new WeakMap();
export function loadCharacterTexture(url,{colorSpace,anisotropy}){
 if(entries.has(url))return entries.get(url).texture;
 const entry={texture:null,promise:null};
 entry.promise=new Promise((resolve,reject)=>{
  entry.texture=new TextureLoader().load(url,resolve,undefined,()=>{
   entries.delete(url);reject(new Error(`Character texture could not load: ${url}. Try again.`));
  });
 });
 entry.texture.colorSpace=colorSpace;entry.texture.flipY=false;entry.texture.anisotropy=anisotropy;
 entries.set(url,entry);readiness.set(entry.texture,entry.promise);
 // The model loader awaits this promise after assigning every material.
 entry.promise.catch(()=>{});return entry.texture;
}
export async function awaitCharacterTextures(materials){
 const promises=materials
  ?materials.flatMap(material=>Object.values(material).filter(value=>value?.isTexture).map(texture=>readiness.get(texture)))
  :[...entries.values()].map(entry=>entry.promise);
 await Promise.all(promises);
}
