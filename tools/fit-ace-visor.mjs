// Replace only the visor surface. Keep the original body, skin rig, and clips.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {BufferGeometry,Float32BufferAttribute,Vector3,Mesh,MeshBasicMaterial,Raycaster,DoubleSide} from 'three';
import {parseGlb} from './bake-native-golf.mjs';
const {values:v}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/fit-ace-visor.mjs --input ORIGINAL.glb --output FITTED.glb\nFits a narrower curved visor and weights it to Head. Never use the output as the next input.');process.exit(0);}
if(!v.input||!v.output||v.input===v.output)throw Error('Supply different --input and --output paths. See --help.');
const {doc:d,bin}=parseGlb(fs.readFileSync(v.input));
if(d.extras?.wardrobeDefault?.id!==5)throw Error('Expected the Ace Major Threat outfit.');
if(d.extras.wardrobeDefault.visorFit)throw Error('Input is already fitted. Use the preserved original wardrobe input.');
const primitive=d.meshes.flatMap(m=>m.primitives).find(p=>d.materials[p.material]?.name==='Major Threat warm cream cotton');
if(!primitive)throw Error('The input has no approved cream visor.');
const head=d.skins[0].joints.findIndex(j=>d.nodes[j].name==='Head');if(head<0)throw Error('Missing Head joint.');
function read(id){
 const a=d.accessors[id],b=d.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],method={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
 return Array.from({length:a.count*n},(_,i)=>bin[method]((b.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/n)*(b.byteStride||n*size)+(i%n)*size));
}
// The solid head primitive includes the scalp. Opacity hair cards have gaps and
// cannot define the head circumference.
const headPrimitive=d.meshes.flatMap(m=>m.primitives).find(p=>d.materials[p.material]?.name==='f003_head');
const headGeometry=new BufferGeometry();headGeometry.setAttribute('position',new Float32BufferAttribute(read(headPrimitive.attributes.POSITION),3));headGeometry.setIndex(read(headPrimitive.indices));
const surface=new Mesh(headGeometry,new MeshBasicMaterial({side:DoubleSide})),ray=new Raycaster();surface.updateMatrixWorld(true);
const hairPrimitive=d.meshes.flatMap(m=>m.primitives).find(p=>d.materials[p.material]?.name==='f003_opacity');
const hairGeometry=new BufferGeometry();hairGeometry.setAttribute('position',new Float32BufferAttribute(read(hairPrimitive.attributes.POSITION),3));hairGeometry.setIndex(read(hairPrimitive.indices));
const hair=new Mesh(hairGeometry,new MeshBasicMaterial({side:DoubleSide}));hair.updateMatrixWorld(true);
const positions=[],colors=[],indices=[];
const cream=[1,1,1],navy=[.012,.024,.05];
const point=(x,y,z)=>new Vector3(x,y,z);
function patch(rows,normal,color=()=>cream){
 const start=positions.length,cols=rows[0].length;
 for(let r=0;r<rows.length;r++)for(let c=0;c<cols;c++){positions.push(rows[r][c].toArray());colors.push(color(r/(rows.length-1),c/(cols-1)));}
 for(let r=0;r<rows.length-1;r++)for(let c=0;c<cols-1;c++){
  const a=start+r*cols+c,b=a+1,e=a+cols,f=e+1;
  const n=new Vector3().subVectors(rows[r][c+1],rows[r][c]).cross(new Vector3().subVectors(rows[r+1][c],rows[r][c]));
  const wanted=normal(rows[r][c]);
  indices.push(...(n.dot(wanted)>0?[a,b,e,b,f,e]:[a,e,b,b,e,f]));
 }
}
// A real visor sits against the forehead, then slopes down over the temples.
const bandY=(angle,t)=>1.632+.012*Math.cos(angle)+(.027+.011*Math.max(0,Math.cos(angle)))*t;
const sampleCount=128;
const profiles=[0,.5,1].map(t=>{
 const values=Array.from({length:sampleCount},(_,i)=>{
  const angle=i*Math.PI/64,y=bandY(angle,t);
  ray.set(point(0,y,-.028),point(Math.sin(angle),0,Math.cos(angle)));
  const hits=ray.intersectObject(surface).filter(hit=>hit.distance>.05&&hit.distance<.15);
  if(!hits.length)throw Error(`No solid head surface at band angle ${angle}, height ${y}.`);
  const headRadius=Math.max(...hits.map(hit=>hit.distance));
  const closeHair=ray.intersectObject(hair).filter(hit=>hit.distance>=headRadius&&hit.distance<headRadius+.012);
  return Math.max(headRadius,...closeHair.map(hit=>hit.distance));
 });
 // Smooth adjacent triangles without inventing a larger circular head.
 return values.map((_,i)=>[-2,-1,0,1,2].reduce((s,k)=>s+values[(i+k+sampleCount)%sampleCount]*[1,2,3,2,1][k+2],0)/9+.004);
});
const ring=(angle,t,outer=true)=>{
 const x=((angle/(Math.PI*2)%1)+1)%1*sampleCount,i=Math.floor(x),f=x-i;
 const slice=Math.min(1,Math.floor(t*2)),blend=t*2-slice;
 const at=p=>p[i]*(1-f)+p[(i+1)%sampleCount]*f;
 const radius=at(profiles[slice])*(1-blend)+at(profiles[slice+1])*blend+(outer ? .0015 : 0);
 return point(radius*Math.sin(angle),bandY(angle,t),-.028+radius*Math.cos(angle));
};
for(const outer of [true,false])patch(Array.from({length:5},(_,j)=>Array.from({length:65},(_,k)=>ring(k*Math.PI/32,[0,.04,.5,.96,1][j],outer))),p=>point(p.x,0,p.z+.028).multiplyScalar(outer?1:-1),t=>t===0||t===1?navy:cream);
for(const t of [0,1])patch([false,true].map(outer=>Array.from({length:65},(_,k)=>ring(k*Math.PI/32,t,outer))),()=>point(0,t?1:-1,0),()=>navy);
const brim=(angle,t,top=true)=>{
 const span=Math.pow(Math.max(0,Math.cos(angle/1.2*Math.PI/2)),.55),length=.055*span*t;
 const root=ring(angle,0);
 return point(root.x+.006*span*t*Math.sin(angle),root.y+.006*t-.009*t*Math.sin(angle)**2-(top?0:.0025),root.z+length);
};
for(const top of [true,false])patch(Array.from({length:8},(_,j)=>Array.from({length:49},(_,k)=>brim(-1.2+2.4*k/48,[0,.15,.3,.45,.6,.8,.97,1][j],top))),()=>point(0,top?1:-1,0),t=>!top||t===1?navy:cream);
patch([false,true].map(top=>Array.from({length:49},(_,k)=>brim(-1.2+2.4*k/48,1,top))),p=>point(p.x,0,p.z+.028),()=>navy);
const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions.flat(),3));geometry.setIndex(indices);geometry.computeVertexNormals();
const chunks=[bin];let length=bin.length;
function add(rows,type,componentType=5126){
 const size=componentType===5123?2:4,flat=rows.flat(),bytes=Buffer.alloc(flat.length*size);
 flat.forEach((n,i)=>componentType===5123?bytes.writeUInt16LE(n,i*size):bytes.writeFloatLE(n,i*size));
 const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const bufferView=d.bufferViews.length;d.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;
 const accessor={bufferView,componentType,count:rows.length,type};
 if(type==='VEC3'){accessor.min=[0,1,2].map(k=>Math.min(...rows.map(r=>r[k])));accessor.max=[0,1,2].map(k=>Math.max(...rows.map(r=>r[k])));}
 d.accessors.push(accessor);return d.accessors.length-1;
}
const normals=Array.from({length:positions.length},(_,i)=>[0,1,2].map(k=>geometry.attributes.normal.array[i*3+k]));
primitive.attributes={POSITION:add(positions,'VEC3'),NORMAL:add(normals,'VEC3'),COLOR_0:add(colors,'VEC3'),JOINTS_0:add(positions.map(()=>[head,0,0,0]),'VEC4',5123),WEIGHTS_0:add(positions.map(()=>[1,0,0,0]),'VEC4')};
primitive.indices=add(indices.map(i=>[i]),'SCALAR',5123);
d.extras.wardrobeDefault.visorFit={version:2,attachment:'Head',curvedBrim:true,navyBoundEdges:true,fittedToHeadSurface:true};d.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(d));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(v.output,Buffer.concat([header,json,bh,binary]));console.log(JSON.stringify({output:v.output,vertices:positions.length,triangles:indices.length/3,headJoint:head}));
