import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy} from '../src/arm-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {calibrateWristAnatomy,captureWristPose,measureWristAnatomy} from '../src/wrist-anatomy.js';

const {values:v}=parseArgs({options:{input:{type:'string'},clip:{type:'string'},name:{type:'string'},output:{type:'string'},grips:{type:'string'},hero:{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/mirror-sword-motion.mjs --input MODEL.glb --clip SOURCE --name MIRRORED --output REVIEW.glb --grips GRIPS.json --hero MODEL\nMirror a native sword performance about its sagittal plane. Preserve the mesh and existing clips. Use a separate review file outside public/. This operation needs anatomy, blade-direction, and clearance review before publication.');process.exit(0);}
for(const key of ['input','clip','name','output','grips','hero'])if(!v[key])throw Error('Supply --'+key+'. See --help.');
if(!v.output.endsWith('.glb')||path.resolve(v.output)===path.resolve(v.input)||path.resolve(v.output).split(path.sep).includes('public'))throw Error('Choose a separate review GLB outside public/.');
const file=v.input,rig=await loadNativeSkin(file),bones={},order=[];
rig.scene.traverse(b=>{if(b.isBone){bones[b.name]=b;order.push(b);}});rig.scene.updateMatrixWorld(true);
const bind=new Map(order.map(b=>[b.name,{q:b.getWorldQuaternion(new T.Quaternion()),p:b.getWorldPosition(new T.Vector3())}]));
const swap=n=>n.endsWith('_r')?n.slice(0,-2)+'_l':n.endsWith('_l')?n.slice(0,-2)+'_r':n;
// Reflect the world-space delta from each opposite bind frame. Local Euler
// signs are not interchangeable between left and right bone axes.
const reflect=q=>new T.Quaternion(q.x,-q.y,-q.z,q.w);
const arms={},legs={},wrists={};for(const s of ['r','l']){arms[s]=calibrateArmAnatomy(captureArmPose(bones,s));legs[s]=calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);wrists[s]=calibrateWristAnatomy(captureWristPose(bones,s));}
const clip=rig.animations.find(c=>c.name===v.clip);if(!clip)throw Error('No source clip named '+v.clip);
const action=rig.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
const named=new Set(clip.tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>t.name.slice(0,-11))),count=Math.ceil(clip.duration*240),times=Array.from({length:count+1},(_,i)=>i/count*clip.duration);
const entry={clip:v.name,template:clip.name,times,rotations:{},translations:{pelvis:[]},extras:{sourceMirror:v.clip,mirrorPlane:'world X at the bind pelvis',reviewRequired:true}};
for(const name of named)entry.rotations[name]=[];
const grips=JSON.parse(fs.readFileSync(v.grips))[v.hero]?.sword;if(!grips?.r||!grips?.l)throw Error('Missing sword grip profiles for '+v.hero);
const report={samples:times.length,minElbow:180,maxElbowDeviation:0,maxKneeDeviation:0,minKnee:180,maxWrist:0};
for(const time of times){
 action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
 const world=new Map(order.map(b=>[b.name,b.getWorldQuaternion(new T.Quaternion())]));
 const root=bones.pelvis.getWorldPosition(new T.Vector3());root.x=2*bind.get('pelvis').p.x-root.x;
 const desired=new Map(order.map(b=>{const opposite=swap(b.name);if(!world.has(opposite))throw Error('Missing mirror partner '+opposite);return[b.name,reflect(world.get(opposite).clone().multiply(bind.get(opposite).q.clone().invert())).multiply(bind.get(b.name).q)];}));
 for(const b of order){b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(desired.get(b.name)));b.updateWorldMatrix(false,true);}
 bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(root));
 for(const side of ['r','l'])for(const [name,q]of Object.entries(grips[side].rotations))bones[name].quaternion.fromArray(q);
 rig.scene.updateMatrixWorld(true);
 for(const side of ['r','l']){
  const a=measureArmAnatomy(arms[side],captureArmPose(bones,side)),l=measureLegAnatomy(legs[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
  report.minElbow=Math.min(report.minElbow,a.signedFlexionDegrees);report.maxElbowDeviation=Math.max(report.maxElbowDeviation,a.hingeDeviationDegrees);
  report.minKnee=Math.min(report.minKnee,l.kneeFlexion);report.maxKneeDeviation=Math.max(report.maxKneeDeviation,l.kneeDeviation);
  report.maxWrist=Math.max(report.maxWrist,measureWristAnatomy(wrists[side],captureWristPose(bones,side)).totalDegrees);
 }
 for(const name of named)entry.rotations[name].push(...bones[name].quaternion.toArray());entry.translations.pelvis.push(...bones.pelvis.position.toArray());
}
fs.mkdirSync(path.dirname(v.output),{recursive:true});
const raw=fs.readFileSync(file),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),nativeNames=new Map(doc.nodes.filter(n=>n.name).map(n=>[T.PropertyBinding.sanitizeNodeName(n.name),n.name]));
entry.rotations=Object.fromEntries(Object.entries(entry.rotations).map(([name,v])=>[nativeNames.get(name),v]));
fs.writeFileSync(v.output,patchAnimationTransforms(fs.readFileSync(file),[entry]));
fs.writeFileSync(v.output+'.json',JSON.stringify({clip:entry.clip,duration:clip.duration,dualWield:true,...report},null,2));console.log(report);
