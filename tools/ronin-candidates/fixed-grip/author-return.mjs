#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {parseGlb} from '../../bake-native-golf.mjs';
import {patchAnimationTransforms} from '../../patch-animation-rotations.mjs';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
import {sampleBodyAt,samplePose,bind,grips} from './solver.mjs';
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/author-return.mjs --input FAMILY.glb --output CANDIDATE.glb --record RETURN.json\nAdds the fitted return slash to the fixed-grip candidate. Keeps both complete palm frames and source foot paths. Outputs must remain outside public/.');process.exit(0);}
for(const key of ['input','output','record'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
for(const name of [values.output,values.record])if(path.resolve(name).startsWith(path.resolve('public')+path.sep))throw Error('Keep candidate outputs outside public/.');
const profile=JSON.parse(fs.readFileSync(new URL('./return-profile.json',import.meta.url))),source=fs.readFileSync('public/models/ronin.glb');
if(crypto.createHash('sha256').update(source).digest('hex')!==profile.sourceSha256)throw Error('The source model changed. Refit the return slash before rebuilding.');
const raw=fs.readFileSync(values.input),{doc}=parseGlb(raw),original=doc.animations.find(a=>a.name==='Cut_Return');
if(!original||!doc.animations.some(a=>a.name==='Ronin_Cut_Diagonal'))throw Error('Supply the fixed-grip family with its first light cut.');
const rows=[];
for(const reference of profile.reference){
 let i=0;while(i<profile.keys.length-2&&reference.time>profile.keys[i+1].time)i++;
 const a=profile.keys[i],b=profile.keys[i+1],fraction=(reference.time-a.time)/(b.time-a.time),controls=a.controls.map((v,j)=>T.MathUtils.lerp(v,b.controls[j],fraction)),bodyPose=sampleBodyAt(reference.sourceTime);
 for(const [name,rotation]of Object.entries(reference.bodyRotations))bodyPose[name].q=rotation.slice();
 const result=samplePose({bodyPose,weaponFrame:reference.weaponFrame,target:reference.target,controls,skin:true});
 const intersections=Object.values(result.skin??{}).flatMap(side=>Object.values(side)).reduce((sum,value)=>sum+value.pairs,0);
 if(!result.feasible||Object.values(result.violations??{}).flat().length||intersections)throw Error('The return fails its native constraints at '+reference.time+' seconds.');
 rows.push({time:reference.time,pose:result.pose});
}
const rotations={},newRotations={},translations={},times=rows.map(row=>row.time);
for(const [name,rest]of Object.entries(bind)){
 let previous=null;const samples=rows.flatMap(row=>{const q=new T.Quaternion().fromArray(row.pose[name].q).normalize();if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);previous=q;return q.toArray();});
 const channel=property=>original.channels.some(c=>doc.nodes[c.target.node].name===name&&c.target.path===property);
 if(channel('rotation'))rotations[name]=samples;
 else if(rows.some(row=>new T.Quaternion().fromArray(row.pose[name].q).normalize().angleTo(new T.Quaternion().fromArray(rest.q).normalize())>1e-7))newRotations[name]=samples;
 if(channel('translation'))translations[name]=rows.flatMap(row=>row.pose[name].p);
 else if(rows.some(row=>row.pose[name].p.some((v,i)=>Math.abs(v-rest.p[i])>1e-7)))throw Error('Missing translation channel for '+name+'. Add it explicitly before authoring.');
 if(rows.some(row=>row.pose[name].s.some((v,i)=>Math.abs(v-rest.s[i])>1e-7)))throw Error('Unexpected scale change on '+name+'.');
}
const patched=patchAnimationTransforms(raw,[{clip:'Cut_Return',times,rotations,newRotations,translations,extras:{fixedGripReturnVersion:1,reviewCandidate:true}}]);
// Change only this clip's name after appending its new native channels.
const parsed=parseGlb(patched),animation=parsed.doc.animations.find(a=>a.name==='Cut_Return');animation.name='Ronin_Cut_Return';
// The authored body uses its bind scales, verified above. The retired clip has
// slightly different scale tracks. Leaving them would change the legs and force
// a blend even when the completed first cut matches this cut's entire pose.
animation.channels=animation.channels.filter(channel=>channel.target.path!=='scale');
let json=Buffer.from(JSON.stringify(parsed.doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const chunks=parsed.chunks.map(chunk=>({...chunk,data:chunk.type===0x4e4f534a?json:chunk.data})),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+chunks.reduce((sum,c)=>sum+8+c.data.length,0),8);
fs.writeFileSync(values.output,Buffer.concat([header,...chunks.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data];})]));
const native=await loadNativeSkin(values.output),bones={};native.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});const point=name=>bones[name].getWorldPosition(new T.Vector3()),baseFeet=Object.fromEntries(['r','l'].map(s=>[s,point('foot_'+s).y]));
const clip=native.animations.find(a=>a.name==='Ronin_Cut_Return'),action=native.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const src=p=>[p.x,-p.z,p.y],poses=[];
for(const {time}of rows){action.time=time;native.mixer.update(0);native.scene.updateMatrixWorld(true);const palm=s=>bones['hand_'+s].localToWorld(new T.Vector3().fromArray(grips[s].center)),primary=palm('r'),frame=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips.r.frame)).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),delta=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(frame);
 poses.push({t:time/profile.duration,grip:src(primary),secondaryGrip:src(palm('l')),tip:src(primary.clone().addScaledVector(shaft,1.15)),roll:2*Math.atan2(delta.y,delta.w),hip:0,chest:0,bend:0,pelvisBend:0,shift:[0,0,0],footR:src(point('foot_r').add(new T.Vector3(0,-baseFeet.r,0))),footL:src(point('foot_l').add(new T.Vector3(0,-baseFeet.l,0))),elbowR:src(point('lowerarm_r')),elbowL:src(point('lowerarm_l')),yawR:-.2545329252,yawL:-.0754670748,step:0,heel:0});}
const remap=t=>{let i=0;const keys=profile.bodyTimeKeys;while(i<keys.length-2&&t>keys[i+1][1])i++;const a=keys[i],b=keys[i+1];return T.MathUtils.lerp(a[0],b[0],(t-a[1])/(b[1]-a[1]));};
const originalMotion=JSON.parse(fs.readFileSync('src/motion-data.json')).Ronin_Heavy_Cleave,record={...originalMotion,duration:profile.duration,impacts:[profile.impact],fixedGripFrame:true,pairedGrip:true,gripSpacing:.12,nativeSampleRate:profile.sampleRate,poses};
for(const type of ['footPlants','toePlants'])if(originalMotion[type])record[type]=Object.fromEntries(Object.entries(originalMotion[type]).map(([side,ranges])=>[side,ranges.map(range=>range.map(remap))]));
fs.writeFileSync(values.record,JSON.stringify({Ronin_Cut_Return:record}));console.log(JSON.stringify({model:values.output,record:values.record,frames:rows.length,duration:profile.duration,impact:profile.impact}));
