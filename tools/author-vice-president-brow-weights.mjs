#!/usr/bin/env node
// Apply the reviewed eight-row skin correction without regenerating geometry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {readModel,packedStream,replaceStream,serializeModel} from './preserve-vice-president-head.mjs';

const RECIPE=new URL('../assets/characters/vice-president-brow-weights.json',import.meta.url);
const MARKER='vicePresidentBrowWeights';
const VERTICES=[700,706,755,756,1275,1281,1331,1334];
const LAYOUT={POSITION:['VEC3',5126,1713],NORMAL:['VEC3',5126,1713],TEXCOORD_0:['VEC2',5126,1713],JOINTS_0:['VEC4',5121,1713],WEIGHTS_0:['VEC4',5126,1713],indices:['SCALAR',5123,9246]};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const loadVicePresidentBrowRecipe=()=>JSON.parse(fs.readFileSync(RECIPE));

function validateRecipe(recipe){
 if(recipe?.schemaVersion!==1||recipe.id!=='vice-president-inner-brow-weights-v1'||recipe.material!=='m009_head'||recipe.vertexCount!==1713)throw Error('Unsupported brow-weight recipe. Use the reviewed version 1 recipe.');
 if(!equal(Object.keys(recipe.streams??{}).sort(),Object.keys(LAYOUT).sort()))throw Error('The recipe must fingerprint all six original head streams.');
 for(const[name,[type,componentType,count]]of Object.entries(LAYOUT)){
  const r=recipe.streams[name];
  if(r.type!==type||r.componentType!==componentType||r.count!==count||![r.sourceSha256,r.resultSha256].every(v=>/^[a-f0-9]{64}$/.test(v)))throw Error(`Invalid ${name} recipe fingerprint.`);
  if(!['JOINTS_0','WEIGHTS_0'].includes(name)&&r.sourceSha256!==r.resultSha256)throw Error(`The recipe may not change ${name}.`);
 }
 if(!Array.isArray(recipe.rows)||!equal(recipe.rows.map(r=>r.vertex).sort((a,b)=>a-b),VERTICES))throw Error('The recipe must contain exactly the eight reviewed skin rows.');
 if(!Array.isArray(recipe.rig?.jointNames)||recipe.rig.jointNames.some(n=>typeof n!=='string')||!/^[a-f0-9]{64}$/.test(recipe.rig?.inverseBindMatricesSha256))throw Error('The recipe has no valid native rig fingerprint.');
 const decoded=[];
 for(const row of recipe.rows){
  const bytes={};
  for(const name of ['JOINTS_0','WEIGHTS_0']){
   bytes[name]={};
   for(const state of ['source','result']){
    const value=row[name]?.[state],b=typeof value==='string'?Buffer.from(value,'base64'):Buffer.alloc(0);
    if(b.length!==(name==='JOINTS_0'?4:16)||b.toString('base64')!==value)throw Error(`Corrupt ${name} ${state} payload at vertex ${row.vertex}.`);
    bytes[name][state]=b;
   }
  }
  for(const state of ['source','result']){
   let sum=0;const seen=new Set();
   for(let k=0;k<4;k++){
    const joint=bytes.JOINTS_0[state].readUInt8(k),weight=bytes.WEIGHTS_0[state].readFloatLE(k*4);
    if(joint>=recipe.rig.jointNames.length||!Number.isFinite(weight)||weight<0||weight>1||(weight>0&&seen.has(joint)))throw Error(`Invalid skin influence at vertex ${row.vertex}.`);
    if(weight>0)seen.add(joint);sum+=weight;
   }
   if(Math.abs(sum-1)>1e-6)throw Error(`Unnormalized skin weights at vertex ${row.vertex}.`);
  }
  decoded.push({vertex:row.vertex,...bytes});
 }
 const folds=[{triangle:1444,vertices:[755,700,706]},{triangle:1445,vertices:[706,756,755]},{triangle:2291,vertices:[1334,1331,1281]},{triangle:2292,vertices:[1281,1275,1334]}];
 if(!equal(recipe.triangles,folds))throw Error('The reviewed crease topology is missing from the recipe.');
 return decoded;
}
function validateAccessor(model,id,expected,name){
 const a=model.doc.accessors?.[id],v=model.doc.bufferViews?.[a?.bufferView];
 if(!a||!v||a.type!==expected[0]||a.componentType!==expected[1]||a.count!==expected[2]||a.normalized||a.sparse||v.buffer!==0)throw Error(`Unsupported ${name} accessor. Preserve the original native layout.`);
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],componentBytes={5121:1,5123:2,5126:4}[a.componentType],size=components*componentBytes,start=(a.byteOffset??0)+(v.byteOffset??0),stride=v.byteStride??size;
 if(!Number.isInteger(start)||start<0||!Number.isInteger(stride)||stride<size||start+(a.count-1)*stride+size>model.bin.length||start+(a.count-1)*stride+size>(v.byteOffset??0)+v.byteLength)throw Error(`The ${name} accessor leaves its binary view.`);
 return packedStream(model,id);
}
function revise(model,recipe,restore){
 const decoded=validateRecipe(recipe),doc=model?.doc;
 if(!doc||!Buffer.isBuffer(model.bin)||doc.buffers?.length!==1||doc.buffers[0].uri||!Number.isInteger(doc.buffers[0].byteLength)||doc.buffers[0].byteLength>model.bin.length||model.bin.length-doc.buffers[0].byteLength>3)throw Error('Expected one complete embedded GLB buffer.');
 const marker=doc.extras?.[MARKER];
 if(!restore&&marker)throw Error('The brow weights already contain a correction. Start from the unchanged source.');
 if(restore&&(!marker||marker.version!==1||marker.recipeId!==recipe.id||marker.recipeSha256!==hash(Buffer.from(JSON.stringify(recipe)))))throw Error('Restore requires a model produced by this exact brow-weight recipe.');
 const matches=(doc.meshes??[]).flatMap((mesh,mi)=>mesh.primitives.map(p=>({p,mi}))).filter(({p})=>doc.materials?.[p.material]?.name===recipe.material);
 if(matches.length!==1)throw Error('Expected exactly one m009_head primitive.');
 const {p,mi}=matches[0];
 if((p.mode??4)!==4||p.targets||p.extensions||!equal(Object.keys(p.attributes??{}).sort(),Object.keys(LAYOUT).filter(n=>n!=='indices').sort()))throw Error('Unsupported head primitive. Do not overwrite a refined or morphed surface.');
 const nodes=doc.nodes.filter(n=>n.mesh===mi),skin=doc.skins?.[nodes[0]?.skin];
 if(nodes.length!==1||!skin||!equal(skin.joints.map(i=>doc.nodes[i]?.name),recipe.rig.jointNames))throw Error('Native skin joint mapping differs from the reviewed source.');
 const binds=validateAccessor(model,skin.inverseBindMatrices,['MAT4',5126,skin.joints.length],'inverse bind matrices');
 if(hash(binds)!==recipe.rig.inverseBindMatricesSha256)throw Error('Native inverse bind matrices differ from the reviewed source.');
 const current={},ids={...p.attributes,indices:p.indices},from=restore?'result':'source',to=restore?'source':'result';
 for(const[name,layout]of Object.entries(LAYOUT)){
  current[name]=validateAccessor(model,ids[name],layout,name);
  if(hash(current[name])!==recipe.streams[name][from+'Sha256'])throw Error(`${name} differs from the reviewed ${from} surface. Refuse a duplicate or incompatible correction.`);
 }
 for(const fold of recipe.triangles)if(!equal([0,1,2].map(k=>current.indices.readUInt16LE((fold.triangle*3+k)*2)),fold.vertices))throw Error('Crease triangle indices differ from the reviewed topology.');
 const replacement={};
 for(const name of ['JOINTS_0','WEIGHTS_0']){
  const size=name==='JOINTS_0'?4:16,bytes=Buffer.from(current[name]);
  for(const row of decoded){
   const start=row.vertex*size;
   if(!bytes.subarray(start,start+size).equals(row[name][from]))throw Error(`The ${name} source row ${row.vertex} does not match its recipe payload.`);
   row[name][to].copy(bytes,start);
  }
  if(hash(bytes)!==recipe.streams[name][to+'Sha256'])throw Error(`Corrupt ${name} replacement payload: the result fingerprint does not match.`);
  replacement[name]=bytes;
 }
 // Complete every check before modifying either stream. Unrelated binary
 // ranges, animation data and document fields retain their exact contents.
 for(const name of Object.keys(replacement))replaceStream(model,ids[name],replacement[name]);
 if(restore)delete doc.extras[MARKER];
 else{doc.extras??={};doc.extras[MARKER]={version:1,recipeId:recipe.id,recipeSha256:hash(Buffer.from(JSON.stringify(recipe))),vertices:[...VERTICES]};}
 return {model,report:{operation:restore?'restore-legacy':'apply',recipeId:recipe.id,changedVertices:[...VERTICES],streams:Object.fromEntries(Object.entries(replacement).map(([k,b])=>[k,hash(b)])),preserved:['positions','normals','UVs','indices','eyeballs','other skin rows','rig','animations']}};
}
export function applyVicePresidentBrowWeights(model,recipe=loadVicePresidentBrowRecipe()){return revise(model,recipe,false);}
export function restoreVicePresidentLegacyBrowWeights(model,recipe=loadVicePresidentBrowRecipe()){return revise(model,recipe,true);}

function canonical(file){const absolute=path.resolve(file);return fs.existsSync(absolute)?fs.realpathSync(absolute):path.join(fs.realpathSync(path.dirname(absolute)),path.basename(absolute));}
function protectPaths(files){
 const rows=files.map(file=>({file,canonical:canonical(file),stat:fs.existsSync(file)?fs.statSync(file):null}));
 for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++)if(rows[i].canonical===rows[j].canonical||(rows[i].stat&&rows[j].stat&&rows[i].stat.dev===rows[j].stat.dev&&rows[i].stat.ino===rows[j].stat.ino))throw Error(`Use distinct input, recipe, output, and report paths: ${rows[i].file} aliases ${rows[j].file}.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {values:v}=parseArgs({options:{input:{type:'string'},output:{type:'string'},recipe:{type:'string'},report:{type:'string'},'restore-legacy':{type:'boolean'},help:{type:'boolean'}}});
  if(v.help){console.log('node tools/author-vice-president-brow-weights.mjs --input SOURCE.glb --output CANDIDATE.glb [--recipe RECIPE.json] [--report REPORT.json] [--restore-legacy]\nApply the exact reviewed eight-row weight correction. Restore mode reverses only that correction for diagnostics. Input, recipe, output and report must be distinct. The output directory must exist.');process.exit(0);}
  if(!v.input||!v.output||path.extname(v.output).toLowerCase()!=='.glb')throw Error('Supply --input and a separate --output ending in .glb. See --help.');
  const recipePath=v.recipe??fileURLToPath(RECIPE),reportPath=v.report??v.output+'.json';
  if(path.extname(reportPath).toLowerCase()!=='.json')throw Error('Use a .json report path.');
  protectPaths([v.input,recipePath,v.output,reportPath]);
  const raw=fs.readFileSync(v.input);
  if(raw.length<28||raw.readUInt32LE(0)!==0x46546c67||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length||raw.readUInt32LE(16)!==0x4e4f534a)throw Error('Input must be a complete GLB 2 file.');
  const jsonLength=raw.readUInt32LE(12),binHeader=20+jsonLength;
  if(binHeader+8>raw.length||raw.readUInt32LE(binHeader+4)!==0x004e4942||raw.readUInt32LE(binHeader)!==raw.length-binHeader-8)throw Error('Input must have one complete embedded binary chunk.');
  const recipe=JSON.parse(fs.readFileSync(recipePath)),result=(v['restore-legacy']?restoreVicePresidentLegacyBrowWeights:applyVicePresidentBrowWeights)(readModel(raw),recipe),bytes=serializeModel(result.model);
  const report={...result.report,input:path.resolve(v.input),output:path.resolve(v.output),sourceSha256:hash(raw),outputSha256:hash(bytes)};
  fs.writeFileSync(v.output,bytes);fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
