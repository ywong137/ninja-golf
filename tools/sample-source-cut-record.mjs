import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {gripFrame} from '../src/hand-grip.js';
import {captureFootSoles,sampleFootSole} from '../src/foot-sole.js';
const {values}=parseArgs({options:{input:{type:'string'},grips:{type:'string'},hero:{type:'string'},clip:{type:'string'},output:{type:'string'},'combat-duration':{type:'string'},impact:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/sample-source-cut-record.mjs --input MODEL.glb --grips grip-data.json --hero MODEL --clip CLIP --combat-duration SECONDS --impact NATIVE_SECONDS --output RECORD.json\nSample a complete imported cut and its sole-contact windows. Support windows describe floor contact; they do not claim stationary ankles.');process.exit(0);}
for(const key of ['input','grips','hero','clip','output','combat-duration','impact'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
const combatDuration=Number(values['combat-duration']),impact=Number(values.impact);
const rig=await loadNativeSkin(values.input),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
const clip=rig.animations.find(c=>c.name===values.clip);if(!clip||!(combatDuration>0&&impact>0&&impact<clip.duration))throw Error('Choose an existing clip, positive combat duration, and an interior impact time.');
const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const profile=gripFrame(bones,JSON.parse(fs.readFileSync(values.grips))[values.hero].sword.r,'r');
const soles=captureFootSoles(rig.scene),rest={pelvis:rotation('pelvis'),chest:rotation('spine_03')},origin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,point('foot_'+s).y]));
const action=rig.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
const count=Math.ceil(clip.duration*120),poses=[],supportWindows={r:[],l:[]},open={r:null,l:null},previous={};
const source=p=>[p.x,-p.z,p.y];
function unwrap(key,value){if(previous[key]!==undefined)value=previous[key]+T.MathUtils.euclideanModulo(value-previous[key]+Math.PI,Math.PI*2)-Math.PI;previous[key]=value;return value;}
for(let i=0;i<=count;i++){
 const time=i/count*clip.duration;action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
 const primary=bones.hand_r.localToWorld(profile.center.clone()),weapon=rotation('hand_r').multiply(profile.frame),shaft=new T.Vector3(0,1,0).applyQuaternion(weapon);
 const rollQ=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(weapon);
 const hip=new T.Euler().setFromQuaternion(rotation('pelvis').multiply(rest.pelvis.clone().invert()),'YXZ');
 const chest=new T.Euler().setFromQuaternion(rotation('spine_03').multiply(rest.chest.clone().invert()),'YXZ');
 const row={t:i/count,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),roll:unwrap('roll',2*Math.atan2(rollQ.y,rollQ.w)),hip:unwrap('hip',hip.y),chest:unwrap('chest',chest.y),bend:chest.x,pelvisBend:hip.x,shift:source(point('pelvis').sub(origin)),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),step:0,heel:0};
 for(const s of ['r','l']){
  const foot=point('foot_'+s),forward=point('ball_'+s).sub(foot);row['foot'+s.toUpperCase()]=source(foot.clone().add(new T.Vector3(0,-footBase[s],0)));row['yaw'+s.toUpperCase()]=unwrap('yaw'+s,Math.atan2(forward.x,forward.z));
  const gap=Math.min(...sampleFootSole(soles[s]).map(p=>p.y)),supported=gap<.025;
  if(supported&&open[s]===null)open[s]=time;
  if((!supported||i===count)&&open[s]!==null){const end=supported?time:Math.max(open[s],(i-1)/count*clip.duration);supportWindows[s].push([open[s],end]);open[s]=null;}
 }
 poses.push(row);
}
const record={duration:clip.duration,combatDuration,impacts:[impact],twoHanded:false,nativeAttachment:true,nativeStanceFeet:true,nativeKneeHinges:true,nativeKneeHeading:true,nativeSourceMotion:true,athleticAttack:true,rootAdvance:0,movementScale:0,footPlants:{r:[],l:[]},supportWindows,source:'Quaternius Universal Animation Library 1: Sword_Attack (CC0)',poses};
fs.writeFileSync(values.output,JSON.stringify({[values.clip]:record}));
console.log(JSON.stringify({output:values.output,samples:poses.length,supportWindows,impactSupported:Object.values(supportWindows).some(w=>w.some(([a,b])=>impact>=a&&impact<=b)),maxTorsoTwist:Math.max(...poses.map(p=>Math.abs(p.hip-p.chest)))}));
