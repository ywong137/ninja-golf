import {createAssetCache} from './asset-cache.js';

export function createMotionDataLoader(records,owners,loadBundle){
 const cache=createAssetCache(async group=>{
  const poses=await loadBundle(group),names=Object.keys(owners).filter(name=>owners[name]===group);
  // Validate the complete group before publishing any data. Failed downloads
  // remain retryable and cannot expose a partially prepared character.
  for(const name of names)if(!Array.isArray(poses[name])||poses[name].length<2)
   throw Error(`Motion data is incomplete: ${name}. Try the download again.`);
  for(const name of names)records[name].poses=poses[name];
 });
 return names=>Promise.all([...new Set(names.filter(name=>name in records).map(name=>{
  if(!owners[name])throw Error(`Motion data has no asset: ${name}`);
  return owners[name];
 }))].map(group=>cache.load(group)));
}
