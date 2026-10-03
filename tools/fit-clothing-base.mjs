import fs from 'node:fs';
import {Matrix4,Matrix3,Vector3,Triangle} from 'three';
import {parseGlb} from './bake-native-golf.mjs';
const usage='Usage: node tools/fit-clothing-base.mjs TARGET.glb DONOR.glb OUTPUT.glb [--fit-arms]';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log(usage+'\nFit licensed clothing to the target rig. --fit-arms preserves the native arm envelope and skin weights.');process.exit(0);}
for(const arg of args)if(arg.startsWith('--')&&arg!=='--fit-arms')throw Error('Unknown option '+arg+'\n'+usage);
const positional=args.filter(arg=>!arg.startsWith('--'));if(positional.length!==3)throw Error(usage);
const [targetPath,donorPath,out]=positional;
const target=parseGlb(fs.readFileSync(targetPath)),donor=parseGlb(fs.readFileSync(donorPath)),d=target.doc,s=donor.doc,chunks=[target.bin];let length=target.bin.length;
const clone=x=>JSON.parse(JSON.stringify(x));
function blob(bytes){const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}const i=d.bufferViews.length;d.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;return i;}
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]};
function rows(doc,bin,i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],[read,size]=types[a.componentType],n=widths[a.type],start=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>bin[read](start+j*(v.byteStride||size*n)+k*size)));}
function array(values,type,component=5126){const flat=values.flat(),b=Buffer.alloc(flat.length*(component===5123?2:4));flat.forEach((v,i)=>component===5123?b.writeUInt16LE(v,i*2):b.writeFloatLE(v,i*4));const a={bufferView:blob(b),componentType:component,type,count:values.length};if(type==='VEC3'){a.min=[0,1,2].map(k=>Math.min(...values.map(v=>v[k])));a.max=[0,1,2].map(k=>Math.max(...values.map(v=>v[k])));}d.accessors.push(a);return d.accessors.length-1;}
const copied=new Map();function copyAccessor(i){if(!copied.has(i)){const a=clone(s.accessors[i]),v=s.bufferViews[a.bufferView],b=donor.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);a.bufferView=blob(b);if(v.byteStride)d.bufferViews[a.bufferView].byteStride=v.byteStride;d.accessors.push(a);copied.set(i,d.accessors.length-1);}return copied.get(i);}
function copyImage(i){const image=clone(s.images[i]),v=s.bufferViews[image.bufferView];image.bufferView=blob(donor.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));d.images.push(image);return d.images.length-1;}
function texture(i){const t=clone(s.textures[i]);t.source=copyImage(t.source);if(t.sampler!==undefined){d.samplers??=[];d.samplers.push(clone(s.samplers[t.sampler]));t.sampler=d.samplers.length-1;}d.textures.push(t);return d.textures.length-1;}
const source=s.meshes[0].primitives[0],material=clone(s.materials[source.material]);material.name=d.materials[d.meshes[0].primitives[0].material].name;
function textures(x){for(const [k,v]of Object.entries(x))if(v&&typeof v==='object'){if(k.endsWith('Texture')&&v.index!==undefined)v.index=texture(v.index);else textures(v);}}textures(material);d.materials.push(material);
const ts=d.skins[0],ss=s.skins[0],targetNames=new Map(ts.joints.map((j,i)=>[d.nodes[j].name,i])),mapping=ss.joints.map(j=>targetNames.get(s.nodes[j].name));
const ti=rows(d,target.bin,ts.inverseBindMatrices).map(v=>new Matrix4().fromArray(v).invert()),si=rows(s,donor.bin,ss.inverseBindMatrices).map(v=>new Matrix4().fromArray(v));
const transforms=mapping.map((j,i)=>j===undefined?null:ti[j].clone().multiply(si[i])),normals=transforms.map(m=>m&&new Matrix3().getNormalMatrix(m));
const pos=rows(s,donor.bin,source.attributes.POSITION),normal=rows(s,donor.bin,source.attributes.NORMAL),joints=rows(s,donor.bin,source.attributes.JOINTS_0),weights=rows(s,donor.bin,source.attributes.WEIGHTS_0),resultP=[],resultN=[];
for(let i=0;i<pos.length;i++){const p=new Vector3(),n=new Vector3();for(let k=0;k<4;k++){const w=weights[i][k];if(w<=0)continue;const j=joints[i][k];if(!transforms[j])throw Error('Unmapped body bone '+s.nodes[ss.joints[j]].name);p.addScaledVector(new Vector3(...pos[i]).applyMatrix4(transforms[j]),w);n.addScaledVector(new Vector3(...normal[i]).applyMatrix3(normals[j]),w);}resultP.push(p.toArray());resultN.push(n.normalize().toArray());}
// Short sleeves use the native arm envelope and native skin weights. This keeps
// the cloth from inheriting the donor's wider underarm and spine weighting.
if(process.argv.includes('--fit-arms')){
 const native=d.meshes[0].primitives[0],np=rows(d,target.bin,native.attributes.POSITION).map(v=>new Vector3(...v)),nn=rows(d,target.bin,native.attributes.NORMAL).map(v=>new Vector3(...v)),nj=rows(d,target.bin,native.attributes.JOINTS_0),nw=rows(d,target.bin,native.attributes.WEIGHTS_0),ni=rows(d,target.bin,native.indices).flat();
 const names=ts.joints.map(j=>d.nodes[j].name),arm=(js,ws)=>js.reduce((n,j,k)=>n+(/^(upperarm|lowerarm)_[rl]$/.test(names[j])?ws[k]:0),0),triangles=[];
 for(let i=0;i<ni.length;i+=3){const ids=ni.slice(i,i+3);if(ids.every(k=>arm(nj[k],nw[k])>.25))triangles.push({ids,triangle:new Triangle(...ids.map(k=>np[k]))});}
 for(let i=0;i<resultP.length;i++){
  const js=joints[i].map(j=>mapping[j]??0);if(arm(js,weights[i])<.3)continue;
  const p=new Vector3(...resultP[i]);let best=null,distance=.05;
  for(const entry of triangles){const point=entry.triangle.closestPointToPoint(p,new Vector3()),gap=point.distanceTo(p);if(gap<distance){distance=gap;best={...entry,point};}}
  if(!best)continue;
  const bary=best.triangle.getBarycoord(best.point,new Vector3()).toArray(),n=new Vector3(),combined=new Map();
  best.ids.forEach((id,k)=>{n.addScaledVector(nn[id],bary[k]);nj[id].forEach((j,c)=>combined.set(j,(combined.get(j)||0)+nw[id][c]*bary[k]));});
  resultP[i]=best.point.addScaledVector(n.normalize(),.001).toArray();resultN[i]=n.toArray();
  const top=[...combined].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),total=top.reduce((n,[,w])=>n+w,0);
  for(let k=0;k<4;k++){const j=top[k]?.[0]??0;joints[i][k]=mapping.indexOf(j);weights[i][k]=(top[k]?.[1]??0)/total;}
 }
}
const primitive=clone(source);primitive.attributes=Object.fromEntries(Object.entries(source.attributes).filter(([key])=>key!=='TANGENT').map(([key,i])=>[key,copyAccessor(i)]));primitive.indices=copyAccessor(source.indices);primitive.material=d.materials.length-1;
primitive.attributes.POSITION=array(resultP,'VEC3');primitive.attributes.WEIGHTS_0=array(weights,'VEC4');primitive.attributes.NORMAL=array(resultN,'VEC3');primitive.attributes.JOINTS_0=array(joints.map(row=>row.map(j=>mapping[j]??0)),'VEC4',5123);
d.meshes[0].primitives[0]=primitive;d.extras??={};d.extras.clothingTemplate={source:'Licensed f008 body, fitted through existing bone bind frames',originalHeadPreserved:true,originalSkeletonPreserved:true};d.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(d));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(out,Buffer.concat([header,json,bh,bin]));console.log(JSON.stringify({out,vertices:pos.length,originalHeadPreserved:true}));
