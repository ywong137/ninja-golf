import fs from 'node:fs';
import * as T from 'three';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import {createSourceSampler} from './source.mjs';
import {createBodyPlanner} from './body.mjs';
import {samplePose} from '../../../tools/ronin-candidates/fixed-grip/solver.mjs';
import {parseGlb} from '../../../tools/bake-native-golf.mjs';
import {patchAnimationTransforms} from '../../../tools/patch-animation-rotations.mjs';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
const Q=a=>new T.Quaternion().fromArray(a),V=a=>new T.Vector3().fromArray(a);
const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/connected-return/author.mjs --candidate DIRECTORY --output DIRECTORY\nAdds a connected second cut to the fitted Ronin family. Outputs must remain outside public/. Run check.mjs, check-inputs.mjs, and the combo runtime checks before use.');process.exit(0);}
if(!values.candidate||!values.output)throw Error('Supply --candidate and --output. See --help.');
const source=path.resolve(values.candidate),out=path.resolve(values.output),publicRoot=path.resolve('public');
if(out===source||out===publicRoot||out.startsWith(publicRoot+path.sep))throw Error('Use a separate output directory outside public/.');
const profile=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url)));
if(crypto.createHash('sha256').update(fs.readFileSync(source+'/ronin.glb')).digest('hex')!==profile.sourceSha256)throw Error('The source model changed. Refit the connected return before rebuilding.');
const snapshot=await createSourceSampler(source),{connectedReturn,interpolateBody}=await createBodyPlanner(source+'/ronin.glb');
fs.mkdirSync(out,{recursive:true});
const branch=.384,join=.38,bridgeDuration=.24,duration=bridgeDuration+.85-join,name='Ronin_Cut_Return_Connected';
const first=snapshot('Ronin_Cut_Diagonal',branch),last=connectedReturn(snapshot('Ronin_Cut_Return',join),first,join);
const rows=[],failures=[];
const times=Array.from(new Set([...Array.from({length:Math.ceil(duration*480)+1},(_,i)=>Math.min(duration,i/480)),bridgeDuration,duration])).sort((a,b)=>a-b);
for(const time of times){
 let pose;
 if(time===0)pose=first.bodyPose;
 else if(time>=bridgeDuration){const body=connectedReturn(snapshot('Ronin_Cut_Return',join+time-bridgeDuration),first,join+time-bridgeDuration);pose=body.bodyPose;for(const[s,m]of Object.entries(body.legs))if(Math.abs(m.hipTwist)>36||Math.abs(m.ankleTwist)>10||m.kneeFlexion<0||m.kneeDeviation>.1)failures.push({time,s,legs:m});}
 else{
  const t=time/bridgeDuration,w=T.MathUtils.smoothstep(t,0,1),body=interpolateBody(first,last,w),weapon=Q(first.weaponFrame).slerp(Q(last.weaponFrame),Math.pow(w,profile.power));
  weapon.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),profile.yaw*Math.PI/180*Math.sin(Math.PI*w)));
  let i=0;while(i<profile.rows.length-2&&t>profile.rows[i+1].t)i++;
  const a=profile.rows[i],b=profile.rows[i+1],f=(t-a.t)/(b.t-a.t),controls=a.controls.map((x,j)=>T.MathUtils.lerp(x,b.controls[j],f));
  // The dense checker evaluates skin with the same shoulder helper as runtime.
  const input={bodyPose:body.bodyPose,weaponFrame:weapon.toArray(),target:V(first.target).lerp(V(last.target),w).toArray()},r=samplePose({...input,controls});
  if(!r.feasible||Object.values(r.violations??{}).flat().length)failures.push({time,t,violations:r.violations,feasible:r.feasible});
  if(!r.pose)throw Error('No feasible bridge pose at '+time);pose=r.pose;
 }
 rows.push({time,pose});
}
if(failures.length)throw Error('Native joint bounds failed: '+JSON.stringify(failures[0]));
const raw=fs.readFileSync(source+'/ronin.glb'),parsed=parseGlb(raw),original=parsed.doc.animations.find(a=>a.name==='Ronin_Cut_Return'),copy=structuredClone(original);copy.name=name;parsed.doc.animations.push(copy);
let json=Buffer.from(JSON.stringify(parsed.doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const chunks=parsed.chunks.map(c=>({...c,data:c.type===0x4e4f534a?json:c.data})),header=Buffer.from(raw.subarray(0,12));header.writeUInt32LE(12+chunks.reduce((sum,c)=>sum+c.data.length+8,0),8);
const expanded=Buffer.concat([header,...chunks.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data];})]);
const rotations={},newRotations={},translations={};
for(const bone of Object.keys(first.bodyPose)){
 let previous;const values=rows.flatMap(row=>{const q=Q(row.pose[bone].q).normalize();if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);previous=q;return q.toArray();});
 const node=parsed.doc.nodes.find(n=>T.PropertyBinding.sanitizeNodeName(n.name??'')===bone),nodeName=node?.name;
 const exists=property=>copy.channels.some(c=>parsed.doc.nodes[c.target.node].name===nodeName&&c.target.path===property);
 if(exists('rotation'))rotations[nodeName]=values;
 else if(nodeName)newRotations[nodeName]=values;
 else if(rows.some(r=>Q(r.pose[bone].q).angleTo(Q(first.bodyPose[bone].q))>1e-7))throw Error('Unresolved changing bone: '+bone);
 if(exists('translation'))translations[nodeName]=rows.flatMap(r=>r.pose[bone].p);
}
fs.writeFileSync(out+'/ronin.glb',patchAnimationTransforms(expanded,[{clip:name,times,rotations,newRotations,translations,extras:{reviewCandidate:true,connectedReturnVersion:1}}]));
for(const file of ['diagonal.json','motion.json','ready.json','return.json','guards.json','grips.json'])fs.copyFileSync(source+'/'+file,out+'/'+file);
const native=await loadNativeSkin(out+'/ronin.glb'),bones={};native.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
const clip=native.animations.find(c=>c.name===name),action=native.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const grips=JSON.parse(fs.readFileSync(out+'/grips.json')).ronin.sword,record=JSON.parse(fs.readFileSync(out+'/return.json')),base=record.Ronin_Cut_Return,poses=[],src=p=>[p.x,-p.z,p.y],point=n=>bones[n].getWorldPosition(new T.Vector3());
for(const time of times){action.time=time;native.mixer.update(0);native.scene.updateMatrixWorld(true);const palm=s=>bones['hand_'+s].localToWorld(V(grips[s].center)),primary=palm('r'),frame=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(Q(grips.r.frame)).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),delta=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(frame);
 poses.push({...base.poses[0],t:time/duration,grip:src(primary),secondaryGrip:src(palm('l')),tip:src(primary.clone().addScaledVector(shaft,1.15)),roll:2*Math.atan2(delta.y,delta.w),footR:src(point('foot_r').add(new T.Vector3(0,-.10162374,0))),footL:src(point('foot_l').add(new T.Vector3(0,-.10162374,0))),elbowR:src(point('lowerarm_r')),elbowL:src(point('lowerarm_l'))});}
record[name]={...base,duration,combatDuration:.5,impacts:[bridgeDuration+.435-join],nativeSampleRate:480,footPlants:{r:[[0,bridgeDuration+.54-join]],l:[]},toePlants:{r:[],l:[[0,bridgeDuration+.54-join]]},poses};
fs.writeFileSync(out+'/return.json',JSON.stringify(record));
const diagonal=JSON.parse(fs.readFileSync(out+'/diagonal.json'));diagonal.Ronin_Cut_Diagonal.continuations={light:{at:branch,clip:name,step:1}};fs.writeFileSync(out+'/diagonal.json',JSON.stringify(diagonal));
fs.writeFileSync(out+'/bridge-author.json',JSON.stringify({branch,join,bridgeDuration,duration,name,rows,failures}));
console.log(JSON.stringify({output:out,frames:rows.length,failures:failures.length,examples:failures.slice(0,6)}));
