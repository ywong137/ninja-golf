#!/usr/bin/env node
// Export native source geometry. This tool does not apply terrain or modify a model.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {createWeapon} from '../../src/weapons.js';
import {FootPlacement,attackFootContacts} from '../../src/foot-placement.js';
import {HandGrip} from '../../src/hand-grip.js';

const project=fileURLToPath(new URL('../../',import.meta.url));
const defaultGrips=fileURLToPath(new URL('./ronin-grip-patch.json',import.meta.url));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const finiteVector=(v,label)=>{
 if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error(label+' must contain three finite numbers.');
 return new T.Vector3().fromArray(v);
};

function inputFile(file,extension,label){
 if(!file||path.extname(file)!==extension)throw Error(label+' must name an existing '+extension+' file.');
 const resolved=fs.realpathSync(file);
 if(!fs.statSync(resolved).isFile())throw Error(label+' must name a regular file.');
 return resolved;
}

function candidateOutput(file,inputs){
 if(!file||path.extname(file)!=='.json')throw Error('--output must name a .json candidate file.');
 const absolute=path.resolve(file),parent=fs.realpathSync(path.dirname(absolute));
 if(fs.lstatSync(absolute,{throwIfNoEntry:false})?.isSymbolicLink())throw Error('The candidate output must not be a symbolic link.');
 const resolved=fs.existsSync(absolute)?fs.realpathSync(absolute):path.join(parent,path.basename(absolute));
 if(inputs.includes(resolved))throw Error('The output must differ from every input file.');
 for(const dir of ['public','src']){
  const protectedPath=path.join(project,dir);
  if(resolved===protectedPath||resolved.startsWith(protectedPath+path.sep))throw Error('Keep candidate output outside '+dir+'/.');
 }
 return absolute;
}

function checkSchedule(spec){
 for(const side of ['r','l'])for(const kind of ['footPlants','toePlants']){
  const intervals=spec[kind]?.[side]??[];
  if(!Array.isArray(intervals))throw Error(kind+'.'+side+' must be an array.');
  for(const range of intervals){
   if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]<0||range[1]<range[0]||range[1]>spec.duration+1e-7)
    throw Error(kind+'.'+side+' contains an invalid support interval.');
  }
 }
 if(!spec.footPlants?.r||!spec.footPlants?.l)throw Error('The native motion needs both foot support schedules.');
}

function bladeHull(weapon){
 weapon.updateMatrixWorld(true);
 const blade=weapon.getObjectByName('Flat steel blade');
 if(!blade?.geometry?.attributes.position)throw Error('The mounted weapon has no steel blade geometry.');
 const attribute=blade.geometry.attributes.position,inverse=weapon.matrixWorld.clone().invert(),map=new Map();
 for(let i=0;i<attribute.count;i++){
  const point=new T.Vector3().fromBufferAttribute(attribute,i).applyMatrix4(blade.matrixWorld).applyMatrix4(inverse),key=point.toArray().join(',');
  if(!map.has(key))map.set(key,{point,sourceIndex:i});
 }
 const unique=[...map.values()],hull=new ConvexHull().setFromPoints(unique.map(row=>row.point));
 if(!hull.faces.length)throw Error('The blade must have a nondegenerate three-dimensional convex hull.');
 const points=new Set();
 for(const face of hull.faces){let edge=face.edge;do{points.add(edge.head().point);edge=edge.next;}while(edge!==face.edge);}
 const vertices=unique.filter(row=>points.has(row.point));
 let outside=0,extremaError=0;
 for(const face of hull.faces)for(const {point}of unique)outside=Math.max(outside,face.distanceToPoint(point));
 // Hull vertices are original geometry points. Containment certifies all planar extrema.
 // Independent directions also catch matrix, ordering, or hull extraction mistakes.
 const directions=[...hull.faces.map(face=>face.normal.clone()),new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)];
 for(let i=0;i<256;i++){const y=1-2*(i+.5)/256,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));directions.push(new T.Vector3(r*Math.cos(a),y,r*Math.sin(a)));}
 for(const direction of directions){
  const original=unique.map(row=>row.point.dot(direction)),reduced=vertices.map(row=>row.point.dot(direction));
  extremaError=Math.max(extremaError,Math.abs(Math.min(...original)-Math.min(...reduced)),Math.abs(Math.max(...original)-Math.max(...reduced)));
 }
 if(outside>1e-9||extremaError>1e-9)throw Error('The blade hull failed containment or planar-extrema verification.');
 return{blade,vertices,uniqueCount:unique.length,geometryCount:attribute.count,faceCount:hull.faces.length,outside,extremaError,
  geometrySha256:sha(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength))};
}

export async function exportSlamProbes({model,record,output,grips=defaultGrips,clipName='Ronin_Heavy_Slam',gameScale=1.1}={}){
 if(!Number.isFinite(gameScale)||gameScale<=0||gameScale>10)throw Error('--game-scale must be positive and at most 10.');
 model=inputFile(model,'.glb','--model');record=inputFile(record,'.json','--record');grips=inputFile(grips,'.json','--grips');
 output=candidateOutput(output,[model,record,grips]);
 const modelBytes=fs.readFileSync(model),recordBytes=fs.readFileSync(record),gripBytes=fs.readFileSync(grips),records=JSON.parse(recordBytes),spec=records[clipName],profiles=JSON.parse(gripBytes);
 if(!spec?.nativeAttachment||!spec.pairedGrip||!spec.twoHanded||!(spec.duration>0)||!Number.isFinite(spec.duration)||!(spec.gripSpacing>0)||!Number.isFinite(spec.gripSpacing))
  throw Error('The selected record must describe a finite native paired attack.');
 if(spec.nativeSlamVersion!==2)throw Error('This exporter requires the reviewed native Slam V2 record.');
 if(modelBytes.length<28||modelBytes.readUInt32LE(0)!==0x46546c67||modelBytes.readUInt32LE(4)!==2||modelBytes.readUInt32LE(8)!==modelBytes.length)
  throw Error('The candidate must be a complete GLB version 2 file.');
 const modelDocument=JSON.parse(modelBytes.subarray(20,20+modelBytes.readUInt32LE(12))),nativeClips=modelDocument.animations?.filter(a=>a.name===clipName)??[];
 if(nativeClips.length!==1||nativeClips[0].extras?.nativeSlamVersion!==2)throw Error('The model must contain exactly one native Slam V2 clip.');
 checkSchedule(spec);
 for(const side of ['r','l']){
  const p=profiles.sword?.[side];if(!p)throw Error('The fixed sword mount needs both hands.');
  finiteVector(p.center,side+' palm center');const axis=finiteVector(p.axis,side+' shaft axis');
  if(Math.abs(axis.length()-1)>1e-4)throw Error(side+' shaft axis must have unit length.');
  if(!Array.isArray(p.frame)||p.frame.length!==4||!p.frame.every(Number.isFinite)||Math.abs(new T.Quaternion().fromArray(p.frame).length()-1)>1e-4)
   throw Error(side+' fixed mount must contain a unit quaternion.');
 }
 const g=await loadNativeSkin(model),clip=g.animations.find(c=>c.name===clipName),root=new T.Group(),bones={};
 if(!clip||Math.abs(clip.duration-spec.duration)>2e-6)throw Error('The model clip and motion duration must match.');
 root.scale.setScalar(gameScale);root.add(g.scene);root.updateMatrixWorld(true);g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 for(const name of ['spine_02','pelvis',...['r','l'].flatMap(s=>['thigh_','calf_','foot_','ball_','hand_'].map(n=>n+s))])if(!bones[name])throw Error('Missing native bone '+name+'.');
 // The runtime's heel proxy is 65 mm in world space. Calibrate at the actual
 // game scale, then export all results back into unscaled actor coordinates.
 const footPlacement=new FootPlacement(root,bones);
 const actor={root,bones,palmGrips:{r:new T.Vector3(),l:new T.Vector3()},shaftAxes:{r:new T.Vector3(),l:new T.Vector3()}};
 const grip=new HandGrip(actor,{sword:profiles.sword});grip.secondaryWeight=1;
 const weapon=createWeapon('odachi'),station=spec.primaryGrip??weapon.userData.primaryGrip;
 if(!Number.isFinite(station))throw Error('The primary grip station must be finite.');
 const hull=bladeHull(weapon);root.add(weapon);
 const duration=spec.duration,exact=[0,.34,.50,.60,.6125,.633333,.70,.78,duration];
 if(duration<.78)throw Error('The native Slam is too short for its reviewed strike and recovery intervals.');
 const times=new Set(exact);
 for(let i=0;i/30<duration;i++)times.add(i/30);
 for(let i=Math.ceil(.34*60);i/60<=.70;i++)times.add(i/60);
 // Include support transitions and their short ramps, so interpolation retains contact changes.
 for(const kind of ['footPlants','toePlants'])for(const intervals of Object.values(spec[kind]??{}))for(const [start,end]of intervals){
  times.add(start);times.add(end);const fade=Math.min(.04,(end-start)/3);if(start>0)times.add(start+fade);if(end<duration)times.add(end-fade);
 }
 const sorted=[...times].filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b),samples=[];
 const action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const footOnly={...spec,toePlants:undefined},toeOnly={...spec,footPlants:{r:spec.toePlants?.r??[],l:spec.toePlants?.l??[]},toePlants:undefined};
 const localPoint=bone=>root.worldToLocal(bone.getWorldPosition(new T.Vector3()));
 let reconstructionError=0,soleReconstructionError=0,maxPalmGap=0;
 for(const time of sorted){
  action.time=Math.min(time,clip.duration);g.mixer.update(0);root.updateMatrixWorld(true);grip.attachPair(weapon,station,spec.gripSpacing);root.updateMatrixWorld(true);
  const combined=attackFootContacts(spec,time,{}).contactWeights,foot=attackFootContacts(footOnly,time,{}).contactWeights,toe=attackFootContacts(toeOnly,time,{}).contactWeights;
  const row={time,pivot:localPoint(bones.spine_02).toArray(),pelvis:localPoint(bones.pelvis).toArray(),feet:{},blade:[]};
  for(const side of ['r','l']){
   const ankle=localPoint(bones['foot_'+side]),worldAnkle=bones['foot_'+side].getWorldPosition(new T.Vector3()),rotation=bones['foot_'+side].getWorldQuaternion(new T.Quaternion());
   const solePoints=footPlacement.feet[side].contacts.map(vector=>{
    const actual=vector.clone().applyQuaternion(rotation).add(worldAnkle),local=root.worldToLocal(actual.clone()).sub(ankle);
    soleReconstructionError=Math.max(soleReconstructionError,root.localToWorld(local.clone().add(ankle)).distanceTo(actual));return local.toArray();
   });
   row.feet[side]={hip:localPoint(bones['thigh_'+side]).toArray(),knee:localPoint(bones['calf_'+side]).toArray(),ankle:ankle.toArray(),toe:localPoint(bones['ball_'+side]).toArray(),solePoints,weight:combined[side],footWeight:foot[side],toeWeight:toe[side]};
   const palm=bones['hand_'+side].localToWorld(grip.active[side].center.clone()),mounted=weapon.localToWorld(new T.Vector3(0,station-(side==='l'?spec.gripSpacing:0),0));maxPalmGap=Math.max(maxPalmGap,palm.distanceTo(mounted)/gameScale);
  }
  for(const vertex of hull.vertices){
   const actual=new T.Vector3().fromBufferAttribute(hull.blade.geometry.attributes.position,vertex.sourceIndex).applyMatrix4(hull.blade.matrixWorld);
   const exported=root.worldToLocal(weapon.localToWorld(vertex.point.clone())),restored=root.localToWorld(exported.clone());
   reconstructionError=Math.max(reconstructionError,restored.distanceTo(actual));row.blade.push(exported.toArray());
  }
  for(const vector of [row.pivot,row.pelvis,...row.blade,...Object.values(row.feet).flatMap(f=>[f.hip,f.knee,f.ankle,f.toe,...f.solePoints])])finiteVector(vector,'Exported geometry');
  samples.push(row);
 }
 if(reconstructionError>1e-9||soleReconstructionError>1e-9)throw Error('Source reconstruction differs from actual mounted geometry.');
 if(maxPalmGap>.001)throw Error('The supplied model and fixed weapon mount leave a palm gap above 1 mm.');
 const result={schemaVersion:1,clip:clipName,duration,sourceScale:1,units:'metres',axes:{up:'+Y',forward:'+Z',anatomicalRight:'-X'},footCalibrationRootScale:gameScale,
  modelSha256:sha(modelBytes),recordSha256:sha(recordBytes),gripsSha256:sha(gripBytes),bladeGeometrySha256:hull.geometrySha256,
  weapon:{kind:'odachi',primaryGrip:station,gripSpacing:spec.gripSpacing,hullVertexCount:hull.vertices.length},
  sampling:{baseHz:30,strikeHz:60,strikeInterval:[.34,.70],exactTimes:exact,includesSupportRampBoundaries:true},
  conventions:{positions:'Actor-local metres before root game scale.',solePoints:'Posed vectors from ankle to [toe, heel], in actor-local axes.',weight:'Merged foot/toe contact weight from attackFootContacts; use this for runtime support.',footWeight:'Independent full-foot interval weight.',toeWeight:'Independent toe-only interval weight.'},
  verification:{originalBladeVertices:hull.geometryCount,deduplicatedBladeVertices:hull.uniqueCount,hullFaces:hull.faceCount,maximumHullOutsideDistance:hull.outside,maximumPlaneExtremaError:hull.extremaError,maximumBladeReconstructionError:reconstructionError,maximumSoleReconstructionError:soleReconstructionError,maximumPalmGap:maxPalmGap},samples};
 fs.writeFileSync(output,JSON.stringify(result));
 return{output,samples:samples.length,hullVertices:hull.vertices.length,bytes:fs.statSync(output).size,verification:result.verification};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},grips:{type:'string'},clip:{type:'string',default:'Ronin_Heavy_Slam'},'game-scale':{type:'string',default:'1.1'},help:{type:'boolean'}}});
 if(values.help){
  console.log('node tools/ronin-candidates/export-slam-probes.mjs --model CANDIDATE.glb --record MOTIONS.json --output /tmp/probes.json [--grips FIXED.json] [--clip Ronin_Heavy_Slam] [--game-scale 1.1]\nExports unscaled actor-local source probes. Explicit model, record, and output paths are required. The fixed Ronin sword mount is the default. Game scale affects only calibration of the runtime 65 mm heel proxy. No terrain or source mutation occurs.');
 }else{
  for(const key of ['model','record','output'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
  console.log(JSON.stringify(await exportSlamProbes({model:values.model,record:values.record,output:values.output,grips:values.grips,clipName:values.clip,gameScale:Number(values['game-scale'])}),null,2));
 }
}
