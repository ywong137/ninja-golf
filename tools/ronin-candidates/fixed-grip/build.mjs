import fs from 'node:fs';
import pathModule from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {parseGlb} from '../../bake-native-golf.mjs';
import {patchAnimationTransforms} from '../../patch-animation-rotations.mjs';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/build.mjs --output DIRECTORY\nRun from the repository root. Rebuilds the offline Ronin Ready/Cleave candidate from the retained controls. Does not edit game assets.');process.exit(0);}
if(!values.output)throw Error('Supply --output DIRECTORY. See --help.');
const output=name=>pathModule.join(pathModule.resolve(values.output),name);
const profile=JSON.parse(fs.readFileSync(new URL('./profile.json',import.meta.url))),path={knots:profile.knots};
const raw=fs.readFileSync('public/models/ronin.glb'),hash=crypto.createHash('sha256').update(raw).digest('hex');
if(hash!==profile.sourceSha256)throw Error('The Ronin input changed. Refit and review the candidate before rebuilding.');
const {sampleAt,grips}=await import('./solver.mjs'),data={grips,keys:[]};
for(let i=0;i<=Math.ceil(profile.duration*profile.sampleRate);i++){
 const t=Math.min(profile.duration,i/profile.sampleRate);let j=0;while(j<profile.keys.length-2&&t>profile.keys[j+1].time)j++;
 const a=profile.keys[j],b=profile.keys[j+1],f=(t-a.time)/(b.time-a.time),lerp=(a,b)=>a+(b-a)*f;
 const input={sourceTime:lerp(a.sourceTime,b.sourceTime),pitch:lerp(a.pitch,b.pitch),target:a.target.map((v,k)=>lerp(v,b.target[k])),controls:a.controls.map((v,k)=>lerp(v,b.controls[k]))};
 const result=sampleAt(input);
 if(!result.feasible||Object.values(result.violations).flat().length)throw Error('The fixed grip violates its constraints at '+t+' seconds.');
 data.keys.push({key:{motionTime:t},...result});
}
fs.mkdirSync(values.output,{recursive:true});
const {doc}=parseGlb(raw),entries=[];
for(const clip of ['Ronin_Heavy_Cleave','Ronin_Ready']){
 const animation=doc.animations.find(a=>a.name===clip),rows=clip==='Ronin_Ready'?[data.keys[0],data.keys[0]]:data.keys,times=clip==='Ronin_Ready'?[0,2]:rows.map(k=>k.key.motionTime),rotations={},translations={};
 for(const channel of animation.channels){
  const name=doc.nodes[channel.target.node].name,property=channel.target.path;if(!rows[0].pose[name])throw Error('Missing pose bone '+name);
  if(property==='rotation'){
   let previous=null;rotations[name]=rows.flatMap(row=>{const q=new T.Quaternion().fromArray(row.pose[name].q).normalize();if(previous&&q.dot(previous)<0)q.set(-q.x,-q.y,-q.z,-q.w);previous=q;return q.toArray();});
  }else if(property==='translation')translations[name]=rows.flatMap(row=>row.pose[name].p);
  else throw Error('Unexpected existing animation channel '+property);
 }
 // Ready omitted the primary wrist because its original pose used the bind
 // rotation. The new fitted wrist must also exist in the exported Ready clip.
 const newRotations=clip==='Ronin_Ready'?{hand_r:rows.flatMap(row=>row.pose.hand_r.q)}:{};
 entries.push({clip,times,rotations,newRotations,translations,extras:{fixedGripReviewCandidate:2}});
}
const candidate=patchAnimationTransforms(raw,entries);fs.writeFileSync(output('ronin.glb'),candidate);
const original=JSON.parse(fs.readFileSync('src/motion-data.json')),gripProfiles=JSON.parse(fs.readFileSync('src/grip-data.json'));
gripProfiles.ronin.sword=data.grips;fs.writeFileSync(output('grips.json'),JSON.stringify(gripProfiles));
const native=await loadNativeSkin(output('ronin.glb')),bones={};native.scene.traverse(o=>{if(o.isBone)bones[o.name]=o});
const actions=Object.fromEntries(native.animations.filter(a=>['Ronin_Ready','Ronin_Heavy_Cleave'].includes(a.name)).map(a=>[a.name,native.mixer.clipAction(a)]));
const source=v=>[v.x,-v.z,v.y],point=n=>bones[n].getWorldPosition(new T.Vector3());
const baseFoot=Object.fromEntries(['r','l'].map(s=>[s,point('foot_'+s).y]));
const motions={};
for(const name of Object.keys(actions)){
 native.mixer.stopAllAction();const action=actions[name].reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const times=name==='Ronin_Ready'?[0,2]:data.keys.map(k=>k.key.motionTime),rows=[];
 for(const t of times){action.time=t;native.mixer.update(0);native.scene.updateMatrixWorld(true);
  const palms=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].localToWorld(new T.Vector3().fromArray(data.grips[s].center))]));
  const weapon=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(data.grips.r.frame)).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(weapon);
  const legacy=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft),delta=legacy.invert().multiply(weapon);
  rows.push({t:t/action.getClip().duration,roll:2*Math.atan2(delta.y,delta.w),grip:source(palms.r),secondaryGrip:source(palms.l),tip:source(palms.r.clone().addScaledVector(shaft,1.15)),hip:0,chest:0,bend:0,pelvisBend:0,shift:[0,0,0],footR:source(point('foot_r').add(new T.Vector3(0,-baseFoot.r,0))),footL:source(point('foot_l').add(new T.Vector3(0,-baseFoot.l,0))),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),yawR:-.2545329252,yawL:-.0754670748,step:0,heel:0});
 }
 const record={...original[name],pairedGrip:true,fixedGripFrame:true,gripSpacing:.12,poses:rows};
 if(name==='Ronin_Heavy_Cleave'){
  const remap=source=>{let i=0;while(i<path.knots.length-2&&source>path.knots[i+1].source)i++;const a=path.knots[i],b=path.knots[i+1];return a.t+(source-a.source)/(b.source-a.source)*(b.t-a.t);};
  record.footPlants=Object.fromEntries(Object.entries(original[name].footPlants).map(([s,ranges])=>[s,ranges.map(range=>range.map(remap))]));
  record.toePlants=Object.fromEntries(Object.entries(original[name].toePlants??{}).map(([s,ranges])=>[s,ranges.map(range=>range.map(remap))]));
 }
 motions[name]=record;
 fs.writeFileSync(output(name==='Ronin_Ready'?'ready.json':'motion.json'),JSON.stringify({[name]:record}));
}
const manifest={inputHash:hash,outputHash:crypto.createHash('sha256').update(candidate).digest('hex'),samples:data.keys.length,model:output('ronin.glb'),status:profile.status};fs.writeFileSync(output('manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
