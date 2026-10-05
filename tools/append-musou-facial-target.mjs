import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
const options={};
if(process.argv.includes('--help')){console.log('Usage: node tools/append-musou-facial-target.mjs --identity HERO --input MODEL.glb --source FACS.json --output CANDIDATE.glb');process.exit(0);}
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!['--identity','--input','--source','--output'].includes(key)||!process.argv[i+1])throw Error('Invalid arguments. Use --help.');options[key.slice(2)]=process.argv[i+1];}
const hero=options.identity;
if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(hero)||!options.input||!options.source||!options.output)throw Error('Expected identity, input, source and output. Use --help.');
if(path.resolve(options.input)===path.resolve(options.output))throw Error('Use a separate output candidate.');
const source=JSON.parse(fs.readFileSync(options.source));
const input=fs.readFileSync(options.input),jsonLength=input.readUInt32LE(12),doc=JSON.parse(input.subarray(20,20+jsonLength)),originalBin=input.subarray(28+jsonLength);
const chunks=[originalBin],report={hero,inputSHA256:crypto.createHash('sha256').update(input).digest('hex'),weights:{AU_04_BrowLowerer:.78,AU_07_LidTightener:hero==='monk'?.65:.80,AU_09_NoseWrinkler:.68,AU_10_UpperLipRaiser:.82,AU_16_LowerLipDepressor:.5,AU_26_JawDrop:hero==='monk'?.20:.14},primitives:[]};let offset=originalBin.length;
const component={5121:1,5123:2,5125:4,5126:4},arity={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function read(ai){const a=doc.accessors[ai],v=doc.bufferViews[a.bufferView],n=arity[a.type],size=component[a.componentType],at=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*size;const data=[];for(let i=0;i<a.count;i++)for(let j=0;j<n;j++){const p=at+i*stride+j*size;data.push(a.componentType===5126?originalBin.readFloatLE(p):a.componentType===5125?originalBin.readUInt32LE(p):a.componentType===5123?originalBin.readUInt16LE(p):originalBin[p]);}return data;}
function append(array){const bytes=Buffer.from(new Float32Array(array).buffer),view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];array.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});const index=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:5126,count:array.length/3,type:'VEC3',min,max});return index;}
function normals(positions,index){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setIndex(index);g.computeVertexNormals();return g.attributes.normal.array;}
function preserveTriangleOrientation(pos,delta,index){
 const original=delta.slice(),changed=new Set();
 const groups=new Map(),weld=[];for(let i=0;i<pos.length/3;i++){const key=pos.slice(i*3,i*3+3).map(v=>Math.round(v*1e6)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);weld[i]=groups.get(key);}
 const p=i=>new Vector3(...pos.slice(i*3,i*3+3)),d=i=>new Vector3(...delta.slice(i*3,i*3+3));
 const triangles=[];for(let i=0;i<index.length;i+=3){const ids=index.slice(i,i+3),a=p(ids[0]),e=p(ids[1]).sub(a),f=p(ids[2]).sub(a),n=e.clone().cross(f);if(n.lengthSq()>1e-24)triangles.push({ids,e,f,n});}
 function clearance(t,scale=1){const [a,b,c]=t.ids,da=d(a),de=d(b).sub(da).multiplyScalar(scale),df=d(c).sub(da).multiplyScalar(scale),base=t.n.lengthSq();const linear=de.clone().cross(t.f).add(t.e.clone().cross(df)).dot(t.n)/base,quadratic=de.clone().cross(df).dot(t.n)/base;let low=Math.min(1,1+linear+quadratic);const critical=-linear/(2*quadratic);if(critical>0&&critical<1)low=Math.min(low,1+linear*critical+quadratic*critical*critical);return low;}
 for(let pass=0;pass<24;pass++){
  const bad=triangles.filter(t=>clearance(t)<.10);if(!bad.length)return {vertices:changed.size,maxCorrection:Math.max(...delta.map((v,i)=>Math.abs(v-original[i]))),passes:pass};
  for(const t of bad){let lo=0,hi=1;for(let j=0;j<20;j++){const mid=(lo+hi)/2;if(clearance(t,mid)>=.12)lo=mid;else hi=mid;}for(const id of new Set(t.ids.flatMap(i=>weld[i]))){changed.add(id);for(let k=0;k<3;k++)delta[id*3+k]*=lo;}}
 }
 throw Error('Facial target cannot preserve triangle orientation within 24 bounded passes.');
}
for(const mesh of doc.meshes){
 if(!mesh.primitives.some(p=>/^[fm]\d{3}_head$/.test(doc.materials[p.material]?.name)))continue;
 if((mesh.weights?.length||mesh.primitives.some(p=>p.targets?.length))&&JSON.stringify(mesh.extras?.targetNames)!==JSON.stringify(['Musou_Snarl']))throw Error('Only Musou_Snarl can be replaced. Other targets need an explicit merge.');
 for(const p of mesh.primitives){
  const name=doc.materials[p.material]?.name,pos=read(p.attributes.POSITION),delta=new Array(pos.length).fill(0);let maxUVError=0,maxPositionError=0,mapped=0;
  const triangles=source.triangles.filter(t=>t.material===name);
  if(triangles.length&&/_(head|opacity)$/.test(name)){
   const uv=read(p.attributes.TEXCOORD_0),corners=triangles.flatMap(t=>t.v.map((v,i)=>({v,uv:t.uv[i]})));
   for(let i=0;i<pos.length/3;i++){
    let best=null,score=Infinity;
    for(const c of corners){const d=Math.hypot(c.uv[0]-uv[i*2],c.uv[1]-uv[i*2+1]),q=source.positions[c.v],space=Math.hypot(q[0]-pos[i*3],q[1]-pos[i*3+1],q[2]-pos[i*3+2]);const s=d+space*.000001;if(s<score){score=s;best={v:c.v,d,space};}}
    if(best.d>1e-5)throw Error(`${hero}/${name} vertex ${i} lacks exact source UV correspondence (${best.d}).`);
    maxUVError=Math.max(maxUVError,best.d);maxPositionError=Math.max(maxPositionError,best.space);mapped++;
    for(const [shape,weight]of Object.entries(report.weights))for(let axis=0;axis<3;axis++)delta[i*3+axis]+=source.shapes[shape][best.v][axis]*weight;
   }
  }
  const index=read(p.indices),correction=preserveTriangleOrientation(pos,delta,index),base=normals(pos,index),posed=normals(pos.map((v,i)=>v+delta[i]),index),normalDelta=Array.from(posed,(v,i)=>v-base[i]);
  p.targets=[{POSITION:append(delta),NORMAL:append(normalDelta)}];
  report.primitives.push({name,vertices:pos.length/3,mapped,maxUVError,maxPositionError,maxDelta:Math.max(...delta.map(Math.abs)),correction});
 }
 mesh.weights=[0];mesh.extras={...mesh.extras,targetNames:['Musou_Snarl']};
}
doc.buffers[0].byteLength=offset;
const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const bin=Buffer.concat(chunks),out=Buffer.alloc(28+json.length+bin.length);input.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);
if(!originalBin.equals(bin.subarray(0,originalBin.length)))throw Error('Original binary data changed.');
fs.mkdirSync(path.dirname(options.output),{recursive:true});fs.writeFileSync(options.output,out);report.addedBytes=out.length-input.length;report.originalBinaryPreserved=true;fs.writeFileSync(options.output+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
