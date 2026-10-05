// Static hosts cannot be configured to add Content-Encoding for binary files.
// Accept either gzip bytes or bytes the host has already decompressed.
export async function decodeEnvironmentBytes(buffer){
 const bytes=new Uint8Array(buffer);
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)return buffer;
 return new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
export async function loadEnvironmentBytes(url,{compressed=false}={}){
 const useGzip=compressed&&typeof DecompressionStream==='function';
 const response=await fetch(useGzip?url+'.gz':url);
 if(!response.ok)throw Error(`Environment ${url}: HTTP ${response.status}`);
 const buffer=await response.arrayBuffer();return useGzip?decodeEnvironmentBytes(buffer):buffer;
}
export async function loadEnvironmentTexture(loader,url,{compressed=false}={}){
 if(!compressed||typeof DecompressionStream!=='function')return loader.loadAsync(url);
 const buffer=await loadEnvironmentBytes(url,{compressed:true}),local=URL.createObjectURL(new Blob([buffer]));
 // Let Three.js retain its complete HDR decoding and texture configuration.
 try{return await loader.loadAsync(local);}finally{URL.revokeObjectURL(local);}
}
