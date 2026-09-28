import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node tools/adjust-sora-fringe.mjs --input MODEL.glb --output /tmp/sora-fringe.glb [--lift-mm 4] [--head-texture PATCH.png]\nLift only the central lower edge of Sora’s frontal hair cards. Preserve all other original binary payloads; optionally append a forehead texture.');process.exit(0);}
const options={};for(let i=0;i<args.length;i+=2){if(!['--input','--output','--lift-mm','--head-texture'].includes(args[i])||!args[i+1])throw Error('Expected --input, --output, --lift-mm, or --head-texture. Use --help.');options[args[i].slice(2)]=args[i+1];}
if(!options.input||!options.output)throw Error('--input and --output are required.');
if(path.resolve(options.input)===path.resolve(options.output))throw Error('Write a separate candidate; never overwrite the input.');
const lift=Number(options['lift-mm']??4)/1000;if(!(lift>0&&lift<=.004))throw Error('Use a lift above 0 and at most 4 mm.');
const source=fs.readFileSync(options.input),out=Buffer.from(source),jsonLength=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+jsonLength)),bin=28+jsonLength;
const primitive=doc.meshes.flatMap(m=>m.primitives).find(p=>doc.materials[p.material]?.name==='f012_opacity');if(!primitive)throw Error('Expected Sora material f012_opacity.');
const accessor=doc.accessors[primitive.attributes.POSITION],view=doc.bufferViews[accessor.bufferView],base=bin+(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||12;
if(accessor.componentType!==5126||accessor.type!=='VEC3')throw Error('Expected float32 position vertices.');
const uvAccessor=doc.accessors[primitive.attributes.TEXCOORD_0],uvView=doc.bufferViews[uvAccessor.bufferView],uvBase=bin+(uvView.byteOffset||0)+(uvAccessor.byteOffset||0),uvStride=uvView.byteStride||8;
const hash=crypto.createHash('sha256').update(source.subarray(base,base+view.byteLength)).digest('hex');
const expected='072a1b11e81e029968e451ed5f734ed625ecb9b39e7076c7eef72c878513b588';if(hash!==expected)throw Error(`Unrecognized opacity geometry ${hash}. Use the unchanged source mesh; this also prevents applying the patch twice.`);
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const changes=[],allowed=new Set();
for(let i=0;i<accessor.count;i++){
 const offset=base+i*stride,x=source.readFloatLE(offset),y=source.readFloatLE(offset+4),z=source.readFloatLE(offset+8),u=source.readFloatLE(uvBase+i*uvStride),v=source.readFloatLE(uvBase+i*uvStride+4);
 // This UV island is the front fringe only. Eyelashes, side locks and ponytail
 // occupy separate UV islands, even where their world-space bounds overlap.
 if(u<.1||u>.39||v<.53||v>.66||z<.058||y<1.62||y>1.645)continue;
 const dy=lift*(1-smooth(.012,.026,Math.abs(x)))*(1-smooth(1.624,1.644,y));if(dy<1e-8)continue;
 out.writeFloatLE(y+dy,offset+4);for(let j=0;j<4;j++)allowed.add(offset+4+j);changes.push({vertex:i,x,y,z,lift:out.readFloatLE(offset+4)-y});
}
if(changes.length!==10)throw Error(`Expected 10 seam-paired fringe vertices; selected ${changes.length}.`);
let changedBytes=0;for(let i=0;i<source.length;i++)if(source[i]!==out[i]){if(!allowed.has(i))throw Error(`Unexpected changed byte ${i}`);changedBytes++;}
let result=out;
if(options['head-texture']){
 const png=fs.readFileSync(options['head-texture']);
 if(png.subarray(1,4).toString()!=='PNG'||png.readUInt32BE(16)!==2048||png.readUInt32BE(20)!==2048)throw Error('Expected a 2048×2048 PNG forehead patch.');
 const oldBin=out.subarray(bin),offset=oldBin.length,newBin=Buffer.alloc(offset+Math.ceil(png.length/4)*4);oldBin.copy(newBin);png.copy(newBin,offset);
 const imageIndex=doc.textures[doc.materials.find(m=>m.name==='f012_head').pbrMetallicRoughness.baseColorTexture.index].source;
 doc.images[imageIndex]={...doc.images[imageIndex],bufferView:doc.bufferViews.length,mimeType:'image/png'};
 doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length});doc.buffers[0].byteLength=newBin.length;
 const json=Buffer.from(JSON.stringify(doc)),jsonPadded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(jsonPadded);
 result=Buffer.alloc(28+jsonPadded.length+newBin.length);out.copy(result,0,0,12);result.writeUInt32LE(result.length,8);result.writeUInt32LE(jsonPadded.length,12);result.writeUInt32LE(0x4e4f534a,16);jsonPadded.copy(result,20);result.writeUInt32LE(newBin.length,20+jsonPadded.length);result.writeUInt32LE(0x004e4942,24+jsonPadded.length);newBin.copy(result,28+jsonPadded.length);
}
fs.writeFileSync(options.output,result);
const report={input:options.input,output:options.output,positionHash:hash,changedBytes,changedVertices:changes.length,maxLift:Math.max(...changes.map(c=>c.lift)),changes,headTexture:options['head-texture']??null,unchanged:options['head-texture']?'All original binary payloads except selected hair POSITION.y values. UVs, normals, skin weights, indices and animation bytes remain exact. JSON changes the head image reference and appends the PNG buffer view; the original embedded texture bytes remain unused.':'Every byte except selected hair POSITION.y values, including JSON, UVs, normals, skin weights, indices, textures and animations.'};
fs.writeFileSync(options.output+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
