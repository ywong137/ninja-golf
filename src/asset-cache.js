// Share in-flight work and successful results. A failed request can be retried.
export function createAssetCache(load){
 const entries=new Map();
 return {
  load(key){
   if(entries.has(key))return entries.get(key).promise;
   const entry={ready:false,value:undefined,promise:null};
   entry.promise=Promise.resolve().then(()=>load(key)).then(value=>{
    entry.value=value;entry.ready=true;return value;
   },error=>{entries.delete(key);throw error;});
   entries.set(key,entry);return entry.promise;
  },
  has:key=>entries.get(key)?.ready===true,
  get(key){if(!entries.get(key)?.ready)throw new Error(`Asset is not ready: ${key}. Load it before use.`);return entries.get(key).value;},
 };
}
