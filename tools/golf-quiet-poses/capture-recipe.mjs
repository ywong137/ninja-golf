#!/usr/bin/env node
/** Capture only accepted local poses, grip profiles, and the native parent hierarchy. */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs, isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const {values} = parseArgs({options: {
  repo: {type:'string'}, study: {type:'string'}, 'swing-dir': {type:'string'},
  'kaede-anchor': {type:'string'}, output: {type:'string'}, help: {type:'boolean'},
}});
if (values.help) {
  console.log('node capture-recipe.mjs --repo REPO --study ADDRESS_PUTT_STUDY --swing-dir SWING_WORKER --kaede-anchor POSES.json --output NEW_DIRECTORY\nCapture accepted anchors only. Read inputs without mutation. Refuse an existing output directory.');
  process.exit(0);
}
for (const key of ['repo','study','swing-dir','kaede-anchor','output']) {
  if (!values[key]) throw Error(`Supply --${key}. Use --help.`);
}
const repo=path.resolve(values.repo), study=path.resolve(values.study), output=path.resolve(values.output);
if (fs.existsSync(output)) throw Error('Choose a new output directory.');
const {loadNativeSkin}=await import(pathToFileURL(path.join(repo,'tests/native-skin-helper.mjs')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs={};
function read(file) {
  const bytes=fs.readFileSync(file);
  inputs[file]={sha256:sha(bytes),bytes:bytes.length};
  return JSON.parse(bytes);
}
const owned=/^(clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;
const heroes=['ronin','shinobi','monk','kaede','ayame','sora'];
const recipes={};
for (const hero of heroes) {
  const inputPath=path.join(study,'dense-input',`input-${hero}.json`);
  const anchorPath=hero==='kaede' ? path.resolve(values['kaede-anchor']) : path.join(path.resolve(values['swing-dir']),hero,'poses.json');
  const acceptedPath=path.join(study,hero,'pendulum-poses.json');
  const reportPath=path.join(study,hero,'pendulum-report.json');
  const input=read(inputPath), anchor=read(anchorPath).rows.find(row=>row.name==='Golf_Swing'&&row.time===0);
  const accepted=read(acceptedPath), report=read(reportPath);
  if (!anchor) throw Error(`${hero}: missing accepted Swing0 anchor.`);
  const original=input.rows.filter(row=>row.name==='Golf_Address');
  const address=structuredClone(original[0].pose);
  for (const name of Object.keys(address)) {
    if (owned.test(name)) address[name]=structuredClone(anchor.pose[name]);
    else if (original.some(row=>!isDeepStrictEqual(row.pose[name],address[name]))) {
      throw Error(`${hero}: Address body is not constant. Capture its actual channels instead.`);
    }
  }
  const acceptedAddress=accepted.rows.filter(row=>row.name==='Golf_Address');
  if (acceptedAddress.length!==original.length || acceptedAddress.some(row=>!isDeepStrictEqual(row.pose,address))) {
    throw Error(`${hero}: the compact address does not match the accepted source.`);
  }
  const modelPath=path.join(repo,'public/models',`${hero}.glb`), raw=fs.readFileSync(modelPath);
  inputs[modelPath]={sha256:sha(raw),bytes:raw.length};
  if (input.provenance[modelPath]!==sha(raw)) throw Error(`${hero}: native model differs from the measured source.`);
  const gltf=await loadNativeSkin(modelPath), keep=new Set([gltf.scene]);
  gltf.scene.traverse(object=>{
    if (object.isBone) for (let parent=object;parent;parent=parent.parent) keep.add(parent);
  });
  const ordered=[];
  gltf.scene.traverse(object=>{if(keep.has(object))ordered.push(object);});
  const hierarchy=ordered.map(object=>({
    name:object.name, bone:!!object.isBone, parent:ordered.indexOf(object.parent),
    position:object.position.toArray(), quaternion:object.quaternion.toArray(), scale:object.scale.toArray(),
  }));
  recipes[hero]={
    version:1,hero,units:'native actor-local metres before game scale',
    hierarchy,addressPose:address,puttBasePose:anchor.pose,
    addressTimes:original.map(row=>row.time),profiles:input.profiles,spacing:input.spacing,
    nodes:report.nodes,actorScale:1.1,
    accepted:{path:acceptedPath,sha256:inputs[acceptedPath].sha256,rowsSha256:sha(JSON.stringify(accepted.rows))},
    originalProvenance:accepted.provenance,
    sourcePaths:{input:inputPath,anchor:anchorPath,model:modelPath,report:reportPath},
  };
}
const dependencies={};
for (const relative of ['src/golf-club.js','src/golf-club-fit.js','src/golf-equipment.js','tests/native-skin-helper.mjs','node_modules/three/package.json']) {
  const file=path.join(repo,relative),bytes=fs.readFileSync(file);
  dependencies[relative]={sha256:sha(bytes),bytes:bytes.length};
}
fs.mkdirSync(output,{recursive:true});
const outputs={};
for (const [hero,recipe] of Object.entries(recipes)) {
  const filename=hero+'.json',bytes=JSON.stringify(recipe)+'\n';
  fs.writeFileSync(path.join(output,filename),bytes,{flag:'wx'});
  outputs[filename]={sha256:sha(bytes),bytes:Buffer.byteLength(bytes)};
}
const manifest={version:1,node:process.version,three:JSON.parse(fs.readFileSync(path.join(repo,'node_modules/three/package.json'))).version,inputs,dependencies,outputs};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,heroes,recipeBytes:Object.values(outputs).reduce((sum,item)=>sum+item.bytes,0)}));
