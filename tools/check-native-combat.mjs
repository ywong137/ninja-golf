/** CPU audit of attack timing, support contacts, wrist axes, and protected bytes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const args=process.argv.slice(2),option=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
if(args.includes('--help')){console.log('node tools/check-native-combat.mjs --before DIRECTORY [--heroes ronin,kaede]');process.exit(0);}
const before=option('--before',null);if(!before)throw new Error('Pass --before DIRECTORY containing baseline hero GLBs and motion-data.json');
const data=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))),heroes=option('--heroes','ronin,kaede').split(',');
const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(data)+';').replace("import selectionMotions from './selection-data.json';",'const selectionMotions={};');
const {sampleMotion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.ProgressEvent??=class{};
function read(file){const raw=fs.readFileSync(file),size=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+size)),bin:raw.subarray(28+size)};}
function bytes(asset,index){const a=asset.doc.accessors[index],v=asset.doc.bufferViews[a.bufferView];return asset.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}
async function rig(asset){const j=structuredClone(asset.doc);j.buffers[0].uri='data:application/octet-stream;base64,'+asset.bin.toString('base64');for(const k of ['images','textures','materials','meshes','skins'])delete j[k];for(const n of j.nodes){delete n.mesh;delete n.skin;}const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),'');return{gltf,mixer:new T.AnimationMixer(gltf.scene)};}
const reports=[];
for(const hero of heroes){
 const old=read(path.join(before,hero+'.glb')),current=read(new URL('../public/models/'+hero+'.glb',import.meta.url));let protectedClips=0;
 for(const key of ['meshes','nodes','skins','materials','textures','images'])assert.deepEqual(current.doc[key],old.doc[key],`${hero}: changed ${key}`);
 for(const mesh of old.doc.meshes)for(const primitive of mesh.primitives)for(const i of [...Object.values(primitive.attributes),primitive.indices].filter(v=>v!==undefined))assert.ok(bytes(old,i).equals(bytes(current,i)),`${hero}: body bytes changed`);
 for(const image of old.doc.images){const v=old.doc.bufferViews[image.bufferView];assert.ok(old.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength).equals(current.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength)),`${hero}: texture bytes changed`);}
 for(const a of old.doc.animations){if(data[a.name]?.athleticAttack)continue;const b=current.doc.animations.find(c=>c.name===a.name);assert.deepEqual(a,b,`${hero}: protected ${a.name} descriptor`);for(const sampler of a.samplers)for(const key of ['input','output'])assert.ok(bytes(old,sampler[key]).equals(bytes(current,sampler[key])),`${hero}: protected ${a.name} bytes`);protectedClips++;}
 const {gltf,mixer}=await rig(current),point=name=>gltf.scene.getObjectByName(name).getWorldPosition(new T.Vector3()),hand=gltf.scene.getObjectByName('hand_r');gltf.scene.updateMatrixWorld(true);
 const axis=hand.worldToLocal(point('PalmShaft_r')).sub(hand.worldToLocal(point('PalmGrip_r'))).normalize();
 for(const clip of gltf.animations.filter(c=>data[c.name]?.athleticAttack)){
  const spec=data[clip.name],samples=[],stanceRefs={},action=mixer.clipAction(clip);mixer.stopAllAction();action.play();let maxShaft=0,maxKeyShaft=0,maxSupportDrift=0,minimumKnee=1;
  for(let i=0;i<=Math.ceil(spec.duration*240);i++){
   const t=Math.min(spec.duration,i/240);action.time=t;mixer.update(0);gltf.scene.updateMatrixWorld(true);const pose=sampleMotion(clip.name,t),authored=new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize(),shaft=axis.clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
   const error=authored.angleTo(shaft);maxShaft=Math.max(maxShaft,error);if(Math.abs(t*60-Math.round(t*60))<1e-5)maxKeyShaft=Math.max(maxKeyShaft,error);
   const hips=point('thigh_l').sub(point('thigh_r')),chest=point('upperarm_l').sub(point('upperarm_r'));
   const pelvis=point('thigh_l').add(point('thigh_r')).multiplyScalar(.5),shoulders=point('upperarm_l').add(point('upperarm_r')).multiplyScalar(.5),torso=shoulders.sub(pelvis);
   samples.push({t,hip:Math.atan2(-hips.z,hips.x),chest:Math.atan2(-chest.z,chest.x),pelvisY:pelvis.y,pelvisZ:pelvis.z,torsoLean:Math.atan2(torso.z,torso.y)*180/Math.PI});
   for(const side of ['r','l']){
    const foot=point('foot_'+side);for(const [index,[start,end]]of spec.footPlants[side].entries())if(t>=start+.008&&t<=end-.008){const key=side+index;if(!stanceRefs[key])stanceRefs[key]=foot;maxSupportDrift=Math.max(maxSupportDrift,foot.distanceTo(stanceRefs[key]));}
    const hip=point('thigh_'+side),knee=point('calf_'+side).sub(hip),chord=foot.clone().sub(hip);knee.addScaledVector(chord,-knee.dot(chord)/chord.lengthSq());minimumKnee=Math.min(minimumKnee,knee.z);
   }
  }
  const peak=(key,hit)=>{let speed=0,time=0;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(b.t<hit-.10||b.t>hit+.02)continue;let delta=b[key]-a[key];delta=Math.atan2(Math.sin(delta),Math.cos(delta));const v=Math.abs(delta/(b.t-a.t));if(v>speed){speed=v;time=b.t;}}return time;};
  reports.push({hero,clip:clip.name,protectedClips,maxSupportDrift,minimumKnee,maxShaftDegrees:maxShaft*180/Math.PI,maxKeyShaftDegrees:maxKeyShaft*180/Math.PI,pelvisAdvance:Math.max(...samples.map(s=>s.pelvisZ))-samples[0].pelvisZ,pelvisLoad:samples[0].pelvisY-Math.min(...samples.map(s=>s.pelvisY)),maximumTorsoLean:Math.max(...samples.map(s=>s.torsoLean)),impacts:spec.impacts.map(hit=>({hit,hipPeak:peak('hip',hit),chestPeak:peak('chest',hit),lead:peak('chest',hit)-peak('hip',hit)}))});
 }
}
console.log(JSON.stringify(reports,null,2));
for(const r of reports){assert.ok(r.maxSupportDrift<.003,`Support target drift: ${JSON.stringify(r)}`);assert.ok(r.minimumKnee>.02,`Forward knee bend lost: ${JSON.stringify(r)}`);}

for(const r of reports){assert.ok(r.maxKeyShaftDegrees<.05,`Baked shaft alignment lost: ${JSON.stringify(r)}`);assert.ok(r.maxShaftDegrees<12,`Shaft interpolation regressed: ${JSON.stringify(r)}`);for(const impact of r.impacts)assert.ok(impact.lead>=.025,`Hip initiation lost: ${JSON.stringify(r)}`);}

for(const r of reports.filter(r=>r.clip.includes('Heavy'))){assert.ok(r.pelvisAdvance>.13,`Heavy pelvis transfer lost: ${JSON.stringify(r)}`);assert.ok(r.pelvisLoad>.10,`Heavy loading lost: ${JSON.stringify(r)}`);assert.ok(r.maximumTorsoLean>6,`Heavy torso follow-through lost: ${JSON.stringify(r)}`);}
