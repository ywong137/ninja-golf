import {LoaderUtils} from 'three';

function isGLB(bytes){return bytes[0]===0x67&&bytes[1]===0x6c&&bytes[2]===0x54&&bytes[3]===0x46;}

// Some static hosts decode Content-Encoding before fetch exposes the body.
// Inspect the bytes so either server policy works without double decompression.
export async function decodeModelBytes(buffer){
 const bytes=new Uint8Array(buffer);
 if(isGLB(bytes))return buffer;
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)throw new Error('Expected a gzip-compressed GLB or an already decoded GLB.');
 const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=await new Response(stream).arrayBuffer();
 if(!isGLB(new Uint8Array(decoded)))throw new Error('The compressed model does not contain a GLB.');
 return decoded;
}

export async function loadModel(loader,url,{compressed=false}={}){
 if(!compressed||typeof globalThis.DecompressionStream!=='function')return loader.loadAsync(url);
 const suffixAt=url.search(/[?#]/),file=suffixAt<0?url:url.slice(0,suffixAt);
 if(!file.endsWith('.glb'))throw new Error(`Compressed model URL must end in .glb: ${url}`);
 const compressedURL=file+'.gz'+(suffixAt<0?'':url.slice(suffixAt));
 const response=await fetch(compressedURL,{headers:loader.requestHeader,credentials:loader.withCredentials?'include':'same-origin'});
 if(!response.ok)throw new Error(`Model download failed (${response.status}): ${compressedURL}`);
 let decoded;
 try{decoded=await decodeModelBytes(await response.arrayBuffer());}
 catch(cause){throw new Error(`Model decompression failed: ${compressedURL}`,{cause});}
 return loader.parseAsync(decoded,LoaderUtils.extractUrlBase(url));
}
