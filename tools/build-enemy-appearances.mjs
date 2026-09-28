#!/usr/bin/env node
/** Assemble licensed enemy wardrobe templates and preserve native joint lengths. */
import fs from 'node:fs';import path from 'node:path';import{parseArgs}from'node:util';import*as T from'three';
const {values}=parseArgs({options:{'output-dir':{type:'string'},'ninja-texture':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/build-enemy-appearances.mjs --output-dir /tmp/enemies --ninja-texture ATLAS.png\nBuild three enemy appearances from the licensed Rocketbox bodies.');process.exit(0);}
if(!values['output-dir']||!values['ninja-texture'])throw Error('Supply --output-dir and --ninja-texture.');
const root=new URL('../',import.meta.url),load=name=>{let raw=fs.readFileSync(new URL('public/models/'+name+'.glb',root)),n=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+n)),bin:raw.subarray(28+n)}};
const sources={hoodie:load('ninja'),tshirt:load('shinobi')};const attacks=[['ninja','Enemy_Scout_Cut'],['enemy-guard','Heavy_Cleave'],['enemy-lancer','Enemy_Thrust'],['enemy-skirmisher','Enemy_Throw']];
const common=['Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Jump_Start','Jump_Loop','Jump_Land','Hit_Chest'];
function write(file,doc,bin){bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);doc.buffers[0].byteLength=bin.length;let j=Buffer.from(JSON.stringify(doc));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);doc.buffers[0].byteLength=bin.length;const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([h,j,bh,bin]));}
for(const family of ['hoodie','tshirt','cloth-ninja']){
 const source=sources[family==='tshirt'?'tshirt':'hoodie'],doc=structuredClone(source.doc);doc.animations=[];const chunks=[source.bin],addedViews=new Map();let size=source.bin.length;
 const appendView=bytes=>{const p=(4-size%4)%4;if(p){chunks.push(Buffer.alloc(p));size+=p;}let index=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});chunks.push(bytes);addedViews.set(index,bytes);size+=bytes.length;return index;};
 const addAccessor=(values,type,componentType=5126)=>{const bytes=Buffer.from(values.buffer,values.byteOffset,values.byteLength),view=appendView(bytes),n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type];const a={bufferView:view,componentType,count:values.length/n,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){const k=i%3;a.min[k]=Math.min(a.min[k],values[i]);a.max[k]=Math.max(a.max[k],values[i]);}}doc.accessors.push(a);return doc.accessors.length-1;};
 function appendClip(src,clip){const map=new Map(),nodeByName=new Map(doc.nodes.map((n,i)=>[n.name,i]));let a=structuredClone(clip);
  function copyAccessor(index){if(map.has(index))return map.get(index);let ac=structuredClone(src.doc.accessors[index]),v=src.doc.bufferViews[ac.bufferView],bytes=Buffer.from(src.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));ac.bufferView=appendView(bytes);let out=doc.accessors.length;doc.accessors.push(ac);map.set(index,out);return out;}
  for(const s of a.samplers){s.input=copyAccessor(s.input);s.output=copyAccessor(s.output);}for(const c of a.channels){const old=src.doc.nodes[c.target.node],dest=nodeByName.get(old.name);if(dest===undefined)throw Error('Missing joint '+old.name);c.target.node=dest;
   // Express source rotations as native-bind deltas on the destination body.
   const sampler=a.samplers[c.sampler],ac=doc.accessors[sampler.output],v=doc.bufferViews[ac.bufferView],bytes=addedViews.get(ac.bufferView);
   const target=doc.nodes[dest];if(c.target.path==='rotation'){
    const correction=new T.Quaternion().fromArray(target.rotation||[0,0,0,1]).multiply(new T.Quaternion().fromArray(old.rotation||[0,0,0,1]).invert());for(let i=0;i<ac.count;i++){const at=(ac.byteOffset||0)+i*(v.byteStride||16),q=new T.Quaternion(...[0,1,2,3].map(k=>bytes.readFloatLE(at+k*4))).premultiply(correction).normalize();q.toArray().forEach((x,k)=>bytes.writeFloatLE(x,at+k*4));}
   }else if(c.target.path==='translation'){
    const base=old.translation||[0,0,0],to=target.translation||[0,0,0],ratio=old.name==='pelvis'?1:new T.Vector3().fromArray(to).length()/Math.max(1e-8,new T.Vector3().fromArray(base).length());for(let i=0;i<ac.count;i++)for(let k=0;k<3;k++){const at=(ac.byteOffset||0)+i*(v.byteStride||12)+k*4;bytes.writeFloatLE(to[k]+(bytes.readFloatLE(at)-base[k])*ratio,at);}
   }
  }delete a.extras?.enemyKneePlaneVersion;doc.animations.push(a);
 }
 for(const name of common){let a=sources.hoodie.doc.animations.find(a=>a.name===name);appendClip(sources.hoodie,a);}for(const [model,name]of attacks){const s=load(model);appendClip(s,s.doc.animations.find(a=>a.name===name));}
 for(const mat of doc.materials){mat.extras={...mat.extras,enemyAppearanceFamily:family};if(family==='tshirt'&&mat.name==='m017_body')mat.name='Enemy T-shirt';}
 if(family==='cloth-ninja'){
  const texture=fs.readFileSync(values['ninja-texture']),image=doc.images.length;doc.images.push({bufferView:appendView(texture),mimeType:'image/png'});const tex=doc.textures.length;doc.textures.push({source:image,sampler:0});const body=doc.materials.find(m=>m.name==='m023_body');body.pbrMetallicRoughness.baseColorTexture={index:tex};delete body.normalTexture;body.name='Woven enemy tunic';body.extras.enemyGarment=true;
  const read=(index)=>{const a=source.doc.accessors[index],v=source.doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5123:2,5125:4,5121:1}[a.componentType],read={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>source.bin[read]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*bytes)+k*bytes)));};
  function surface(name,sourceMaterial,planes,offset){const primitive=doc.meshes[0].primitives.find(p=>source.doc.materials[p.material]?.name===sourceMaterial),arrays=Object.fromEntries(Object.entries(primitive.attributes).map(([key,a])=>[key,read(a)])),indices=read(primitive.indices).flat();let result={POSITION:[],NORMAL:[],TEXCOORD_0:[],JOINTS_0:[],WEIGHTS_0:[]};
   const blend=(a,b,t)=>{const out={};for(const key of ['POSITION','NORMAL','TEXCOORD_0'])out[key]=a[key].map((v,i)=>T.MathUtils.lerp(v,b[key][i],t));let weights=new Map();for(const [v,gain]of[[a,1-t],[b,t]])v.JOINTS_0.forEach((j,k)=>weights.set(j,(weights.get(j)||0)+v.WEIGHTS_0[k]*gain));let pairs=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=pairs.reduce((n,p)=>n+p[1],0);while(pairs.length<4)pairs.push([0,0]);out.JOINTS_0=pairs.map(p=>p[0]);out.WEIGHTS_0=pairs.map(p=>p[1]/sum);return out;};
   for(let i=0;i<indices.length;i+=3){let poly=indices.slice(i,i+3).map(index=>Object.fromEntries(Object.entries(arrays).map(([k,v])=>[k,v[index]])));for(const plane of planes){let next=[];for(let j=0;j<poly.length;j++){let a=poly[j],b=poly[(j+1)%poly.length],da=plane(a.POSITION),db=plane(b.POSITION);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(blend(a,b,da/(da-db)));}poly=next;}for(let j=1;j<poly.length-1;j++)for(const vertex of [poly[0],poly[j],poly[j+1]]){const normal=new T.Vector3().fromArray(vertex.NORMAL).normalize();const p=new T.Vector3().fromArray(vertex.POSITION).addScaledVector(normal,offset);
    for(const key in result)result[key].push(...(key==='POSITION'?p.toArray():key==='NORMAL'?normal.toArray():vertex[key]));}}
   const mat=doc.materials.length;doc.materials.push({name:'Woven '+name,extras:{enemyAppearanceFamily:family,enemyGarment:true},pbrMetallicRoughness:{baseColorFactor:[.25,.26,.27,1],roughnessFactor:.94,metallicFactor:0},doubleSided:true});const attributes={};for(const key in result)attributes[key]=addAccessor(key==='JOINTS_0'?new Uint16Array(result[key]):new Float32Array(result[key]),key==='TEXCOORD_0'?'VEC2':['JOINTS_0','WEIGHTS_0'].includes(key)?'VEC4':'VEC3',key==='JOINTS_0'?5123:5126);doc.meshes[0].primitives.push({attributes,material:mat,mode:4});console.log(family,name,result.POSITION.length/9,'triangles');
  }
  // Surface patches retain the original weighted anatomy and follow the same skin.
  // A continuous cloth panel bridges the mouth instead of duplicating its
  // holes and lip topology. Original eyes, skin and head remain beneath it.
  {
   const primitive=doc.meshes[0].primitives.find(p=>source.doc.materials[p.material]?.name==='m023_head');
   const original=Object.fromEntries(Object.entries(primitive.attributes).map(([key,a])=>[key,read(a)]));
   const positions=[],uv=[],joints=[],weights=[],indices=[],cols=32,rows=14;
   for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const v=row/rows,angle=(col/cols-.5)*3.35,front=Math.max(0,Math.cos(angle)),top=1.646+.026*front**4;
    const y=T.MathUtils.lerp(1.455,top,v),rx=T.MathUtils.lerp(.085,.098,v),rz=.13+.065*Math.sin(v*Math.PI/2);
    const p=[Math.sin(angle)*rx,y,-.016+Math.cos(angle)*rz+.0003*Math.sin(v*Math.PI*5)*front];
    positions.push(...p);uv.push(col/cols,v);
    let closest=0,distance=Infinity;for(let i=0;i<original.POSITION.length;i++){const q=original.POSITION[i],d=(q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2;if(d<distance){distance=d;closest=i;}}
    joints.push(...original.JOINTS_0[closest]);weights.push(...original.WEIGHTS_0[closest]);
    if(row<rows&&col<cols){const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const mat=doc.materials.length;doc.materials.push({name:'Woven Enemy face wrap',extras:{enemyAppearanceFamily:family,enemyGarment:true},pbrMetallicRoughness:{baseColorFactor:[.25,.26,.27,1],roughnessFactor:.94,metallicFactor:0},doubleSided:true});
   doc.meshes[0].primitives.push({attributes:{POSITION:addAccessor(new Float32Array(positions),'VEC3'),NORMAL:addAccessor(geometry.attributes.normal.array,'VEC3'),TEXCOORD_0:addAccessor(new Float32Array(uv),'VEC2'),JOINTS_0:addAccessor(new Uint16Array(joints),'VEC4',5123),WEIGHTS_0:addAccessor(new Float32Array(weights),'VEC4')},indices:addAccessor(new Uint16Array(indices),'SCALAR',5123),material:mat,mode:4});geometry.dispose();
  }
  surface('Enemy waist sash','m023_body',[p=>p[1]-.985,p=>1.075-p[1],p=>.255-Math.abs(p[0])],.005);
  surface('Enemy shin wraps','m023_body',[p=>p[1]-.14,p=>.405-p[1]],.004);
 }
 // Compact unused hero animation payloads and obsolete texture views.
 const all=Buffer.concat(chunks),used=new Set();for(const mesh of doc.meshes)for(const p of mesh.primitives){Object.values(p.attributes).forEach(a=>used.add(a));if(p.indices!==undefined)used.add(p.indices);}for(const skin of doc.skins)if(skin.inverseBindMatrices!==undefined)used.add(skin.inverseBindMatrices);for(const a of doc.animations)for(const s of a.samplers){used.add(s.input);used.add(s.output);}const amap=new Map([...used].sort((a,b)=>a-b).map((n,i)=>[n,i])),accessors=[...amap.keys()].map(n=>doc.accessors[n]);for(const mesh of doc.meshes)for(const p of mesh.primitives){for(const k in p.attributes)p.attributes[k]=amap.get(p.attributes[k]);if(p.indices!==undefined)p.indices=amap.get(p.indices);}for(const skin of doc.skins)if(skin.inverseBindMatrices!==undefined)skin.inverseBindMatrices=amap.get(skin.inverseBindMatrices);for(const a of doc.animations)for(const s of a.samplers){s.input=amap.get(s.input);s.output=amap.get(s.output);}doc.accessors=accessors;
 const views=new Set(accessors.map(a=>a.bufferView));for(const im of doc.images)if(im.bufferView!==undefined)views.add(im.bufferView);const vmap=new Map(),packed=[];let offset=0;for(const i of views){let v=doc.bufferViews[i],p=(4-offset%4)%4;if(p){packed.push(Buffer.alloc(p));offset+=p;}vmap.set(i,{...v,byteOffset:offset});let bytes=all.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);packed.push(bytes);offset+=bytes.length;}const indexes=new Map([...vmap.keys()].map((v,i)=>[v,i]));doc.bufferViews=[...vmap.values()];for(const a of doc.accessors)a.bufferView=indexes.get(a.bufferView);for(const im of doc.images)if(im.bufferView!==undefined)im.bufferView=indexes.get(im.bufferView);doc.buffers=[{byteLength:offset}];doc.extras={...doc.extras,enemyAppearanceFamily:family};fs.mkdirSync(values['output-dir'],{recursive:true});const file=path.join(values['output-dir'],'enemy-'+family+'.glb');write(file,doc,Buffer.concat(packed));console.log(file,fs.statSync(file).size);
}
