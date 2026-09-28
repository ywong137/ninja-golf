#!/usr/bin/env node
// Bake golf directly on the native human. No source mannequin or shoulder IK.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {palmWeaponBasis} from '../src/weapon-frame.js';
import {nativeGolfPhase,golfRecords,GOLF_GRIP_SPACING} from './golf-motion-profile.mjs';

const {values}=parseArgs({options:{hero:{type:'string'},output:{type:'string'},input:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-golf.mjs --hero ronin --output /tmp/ronin-golf.glb [--input MODEL.glb]\nBakes native golf candidates. Preserves geometry and unrelated animation bytes. Output must remain outside public/.');process.exit(0);}
if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(values.hero)||!values.output?.endsWith('.glb'))throw Error('Supply --hero and --output. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Use a review output outside public/.');
const input=values.input??new URL(`../public/models/${values.hero}.glb`,import.meta.url);
const raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
const chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3());
const worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:worldQ(n)}]));
const pelvisOrigin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),toe:point('ball_'+s),q:worldQ('foot_'+s)}]));
const armRest=Object.fromEntries(['r','l'].map(side=>{const a=point('upperarm_'+side),b=point('lowerarm_'+side),c=point('hand_'+side),upper=b.clone().sub(a).normalize(),lower=c.clone().sub(b).normalize();return[side,{upper,lower,normal:new T.Vector3().crossVectors(upper,lower).normalize()}];}));
const gripData=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)))[values.hero].golf;
const armRatio=point('upperarm_r').distanceTo(point('lowerarm_r'))+point('lowerarm_r').distanceTo(point('hand_r'));
const armScale=armRatio/.5567214;
const motionData=golfRecords();
const handFrames=Object.fromEntries(['r','l'].map(side=>[side,palmWeaponBasis(new T.Vector3().fromArray(gripData[side].axis),bones['hand_'+side].worldToLocal(point('middle_01_'+side)))]));
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const rotation=(yaw,bend,side=0)=>new T.Quaternion().setFromAxisAngle(X,bend).multiply(new T.Quaternion().setFromAxisAngle(Z,side)).multiply(new T.Quaternion().setFromAxisAngle(Y,yaw));
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
function reset(){for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);b.scale.copy(rest[n].s);}g.scene.updateMatrixWorld(true);}
function segmentFrame(direction,normal){const x=direction.clone().normalize(),z=normal.clone().normalize(),y=new T.Vector3().crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
function solveArm(side,target,pole,handRotation){
 const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
 const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side),a=elbow.distanceTo(shoulder),b=wrist.distanceTo(elbow);
 const axis=target.clone().sub(shoulder),d=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,(a+b)*.998);axis.normalize();
 const bend=pole.clone().sub(shoulder).addScaledVector(axis,-pole.clone().sub(shoulder).dot(axis)).normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),wanted=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const end=shoulder.clone().addScaledVector(axis,d),upperDirection=wanted.clone().sub(shoulder).normalize(),lowerDirection=end.clone().sub(wanted).normalize(),normal=new T.Vector3().crossVectors(upperDirection,lowerDirection).normalize(),base=armRest[side];
 setWorld(upper.name,segmentFrame(upperDirection,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest[upper.name].world));
 setWorld(lower.name,segmentFrame(lowerDirection,normal).multiply(segmentFrame(base.lower,base.normal).invert()).multiply(rest[lower.name].world));
 setWorld(hand.name,handRotation);return end.distanceTo(target);
}
// Fit the grip roll against the actual wrist and elbow geometry.
// Limit roll changes near a parallel forearm and shaft.
function fittedHand(side,center,shaft,pole,previous){
 const shoulder=point('upperarm_'+side),a=point('lowerarm_'+side).distanceTo(shoulder),b=point('hand_'+side).distanceTo(point('lowerarm_'+side));
 const entry=gripData[side],offset=new T.Vector3().fromArray(entry.center),mcp=bones['middle_01_'+side].position.clone().normalize();
 const base=previous?new T.Quaternion().setFromUnitVectors(new T.Vector3().fromArray(entry.axis).applyQuaternion(previous).normalize(),shaft).multiply(previous).multiply(handFrames[side]):palmWeaponBasis(shaft,center.clone().sub(shoulder));
 const frameInverse=handFrames[side].clone().invert();
 const evaluate=angle=>{
  const handQ=new T.Quaternion().setFromAxisAngle(shaft,angle).multiply(base).multiply(frameInverse);
  const target=center.clone().sub(offset.clone().applyQuaternion(handQ)),axis=target.clone().sub(shoulder),distance=axis.length(),d=T.MathUtils.clamp(distance,Math.abs(a-b)+.001,(a+b)*.998);axis.normalize();
  const bend=pole.clone().sub(shoulder).addScaledVector(axis,-pole.clone().sub(shoulder).dot(axis)).normalize();
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const forearm=axis.clone().multiplyScalar(d-along).addScaledVector(bend,-height).normalize();
  const wrist=forearm.angleTo(mcp.clone().applyQuaternion(handQ));
  return{handQ,target,score:wrist*wrist+100*(distance-d)**2+.10*(previous?.angleTo(handQ)??0)**2};
 };
 let angle=0,best=evaluate(0);const step=previous?.01:Math.PI/12,limit=previous?.06:Math.PI;
 for(let a=-limit;a<=limit+1e-8;a+=step){const test=evaluate(a);if(test.score<best.score){angle=a;best=test;}}
 let lo=Math.max(-limit,angle-step),hi=Math.min(limit,angle+step);
 for(let n=0;n<16;n++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3,fa=evaluate(a),fb=evaluate(b);if(fa.score<fb.score)hi=b;else lo=a;}
 return evaluate((lo+hi)/2);
}
// Keep the trail wrist's lateral bend within its natural plane by choosing
// an elbow swivel before the wrist is posed. Bone lengths remain unchanged.
let trailSwivels=[],trailFrame=0,trailPass=0;
function trailElbowPole(target,pole,handQ){
 const shoulder=point('upperarm_l'),axis=target.clone().sub(shoulder),a=point('lowerarm_l').distanceTo(shoulder),b=point('hand_l').distanceTo(point('lowerarm_l'));
 const d=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,(a+b)*.998);axis.normalize();
 const bend=pole.clone().sub(shoulder).addScaledVector(axis,-pole.clone().sub(shoulder).dot(axis)).normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
 const long=bones.middle_01_l.position.clone().normalize().applyQuaternion(handQ);
 const across=bones.index_01_l.position.clone().sub(bones.pinky_01_l.position);across.addScaledVector(bones.middle_01_l.position.clone().normalize(),-across.dot(bones.middle_01_l.position.clone().normalize())).normalize().applyQuaternion(handQ);
 const normal=new T.Vector3().crossVectors(long,across).normalize();
 const score=angle=>{
  const guide=bend.clone().applyAxisAngle(axis,angle),forearm=axis.clone().multiplyScalar(d-along).addScaledVector(guide,-height).normalize();
  const sideways=Math.abs(Math.atan2(forearm.dot(across),forearm.dot(long))),extension=Math.abs(Math.atan2(forearm.dot(normal),forearm.dot(long))),total=forearm.angleTo(long);
  return 12*Math.max(0,sideways-T.MathUtils.degToRad(25))**2+3*Math.max(0,extension-T.MathUtils.degToRad(65))**2+3*Math.max(0,total-T.MathUtils.degToRad(70))**2+.035*angle*angle;
 };
 let angle=0,best=score(0);for(let a=-1.5;a<=1.5;a+=.025){const value=score(a);if(value<best){best=value;angle=a;}}
 let lo=Math.max(-1.5,angle-.025),hi=Math.min(1.5,angle+.025);for(let n=0;n<15;n++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(score(a)<score(b))hi=b;else lo=a;}
 const desired=(lo+hi)/2;
 if(!trailPass)trailSwivels[trailFrame]=desired;
 let smooth=desired;
 if(trailPass){let sum=0,weight=0;for(let j=-4;j<=4;j++){const w=5-Math.abs(j),index=Math.max(0,Math.min(trailSwivels.length-1,trailFrame+j));sum+=trailSwivels[index]*w;weight+=w;}smooth=sum/weight;}
 return shoulder.add(bend.applyAxisAngle(axis,smooth));
}
function distributeForearmTwist(side,handQ){
 const lower='lowerarm_'+side,hand='hand_'+side,axis=point(hand).sub(point(lower)).normalize();
 const neutral=worldQ(lower).multiply(rest[hand].q),delta=handQ.clone().multiply(neutral.invert()).normalize();
 const projection=axis.clone().multiplyScalar(new T.Vector3(delta.x,delta.y,delta.z).dot(axis));
 const twist=new T.Quaternion(projection.x,projection.y,projection.z,delta.w).normalize();
 setWorld(lower,twist.multiply(worldQ(lower)));setWorld(hand,handQ);
}
function boundedShaft(forearm,desired,limit){
 const angle=forearm.angleTo(desired),neutral=handFrames.r?Math.acos(T.MathUtils.clamp(new T.Vector3().fromArray(gripData.r.axis).dot(bones.middle_01_r.position.clone().normalize()),-1,1)):1.18;
 const bounded=T.MathUtils.clamp(angle,neutral-limit,neutral+limit),radial=desired.clone().addScaledVector(forearm,-desired.dot(forearm)).normalize();
 return forearm.clone().multiplyScalar(Math.cos(bounded)).addScaledVector(radial,Math.sin(bounded)).normalize();
}
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
for(const name of ['Golf_Address','Golf_Swing','Golf_Putt'])if(!doc.animations?.some(a=>a.name===name))throw Error('Input model is missing '+name);
let sharedLeftFrame=null;
const reports=[];
for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
 const spec=motionData[name],duration=spec.duration,count=Math.ceil(duration*240),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/240,duration));
 g.mixer.stopAllAction();
 const tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
 const lastHands={r:null,l:null};
 const report={clip:name,maxArmReachError:0,maxFootReachError:0,maxGripCorrection:0,contactGripCorrection:0,maxContactBodyCorrection:0};
 const contactCorrections={address:new T.Vector3(),strike:new T.Vector3()};
 for(let pass=0;pass<2;pass++){lastHands.r=null;lastHands.l=null;trailPass=pass;if(!pass)trailSwivels=[];
 for(let i=0;i<times.length;i++){
  trailFrame=i;reset();const t=Math.min(1,times[i]/duration),{body,grip,direction}=nativeGolfPhase(name,t,armScale);
  const clearance=values.hero==='monk'?.08:.035;body.x-=clearance*Math.sin(body.chest);body.z-=clearance*Math.cos(body.chest);body.y-=.006+(values.hero==='monk'?.017*Math.max(0,Math.sin(body.chest)):0);
  const hip=rotation(body.hip,body.hinge,0),chest=rotation(body.chest,body.bend,body.side);
  const pelvis=pelvisOrigin.clone().add(new T.Vector3(body.x,body.y,body.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));
  orient('pelvis',hip);orient('spine_01',hip);orient('spine_02',rotation(T.MathUtils.lerp(body.hip,body.chest,.55),T.MathUtils.lerp(body.hinge,body.bend,.5),body.side*.45));orient('spine_03',chest);orient('neck_01',chest);
  const headFollow=name==='Golf_Swing'?T.MathUtils.smoothstep(t,.625,.85):0;
  orient('Head',rotation(T.MathUtils.lerp(body.chest*.25,body.chest*.88,headFollow),T.MathUtils.lerp(.40,.045,headFollow),body.side*.15));
  const footGoals={};
  for(const side of ['r','l']){
   // Move the lead shoulder forward during release. Retraction crossed the torso.
   const backswing=Math.max(0,body.chest)/1.57,release=Math.max(0,-body.chest)/1.92,protraction=side==='r'?.16+.19*backswing+.45*release:-.12+.20*backswing-.14*release;
   const shoulder=chest.clone().multiply(new T.Quaternion().setFromAxisAngle(Y,protraction));orient('clavicle_'+side,shoulder);
   const base=footBase[side],outward=side==='r'?-.12:.08,turn=side==='l'?-body.heel*.48:0;
   const footQ=rotation(outward+turn,side==='l'?body.heel*.92:0).multiply(base.q),ankle=base.p.clone();ankle.x=side==='r'?-.205:.205;
   if(side==='l'){
    const toe=base.toe.clone().add(new T.Vector3(.205-base.p.x,0,0));const relative=base.toe.clone().sub(base.p).applyQuaternion(base.q.clone().invert()).applyQuaternion(footQ);ankle.copy(toe.sub(relative));
   }
   footGoals[side]={ankle:ankle.clone(),q:footQ.clone()};
   const footError=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,footQ,{maxReach:.999});if(footError>report.maxFootReachError){report.maxFootReachError=footError;report.worstFoot={time:times[i],side,ankle:ankle.toArray(),hip:point('thigh_'+side).toArray()};}
  }
  const primary=new T.Vector3(grip.x,grip.z,-grip.y),authoredPrimary=primary.clone(),shaft=new T.Vector3(direction.x,direction.z,-direction.y);
  const poles={};
  for(const side of ['r','l']){
   const back=Math.max(0,body.chest)/1.57,finish=Math.max(0,-body.chest)/1.92;
   const clearance=values.hero==='monk'?.60*(1-T.MathUtils.smoothstep(t,.64,.80)):values.hero==='sora'?.08:0;
   const guide=side==='r'?new T.Vector3(-.18+.06*back,-.38+.18*back,.24+clearance+.30*Math.min(1,finish*1.4)):new T.Vector3(.30-.30*back-.10*finish,-.20+.03*back,.34-.20*back);
   poles[side]=point('upperarm_'+side).add(guide.applyQuaternion(chest));
  }
  if(!sharedLeftFrame){
   const r=fittedHand('r',primary,shaft,poles.r,null),l=fittedHand('l',primary.clone().addScaledVector(shaft,-GOLF_GRIP_SPACING),shaft,poles.l,null);
   sharedLeftFrame=l.handQ.clone().invert().multiply(r.handQ).multiply(handFrames.r);
  }
  if(name==='Golf_Putt'){
   for(let fit=0;fit<6;fit++)for(const side of ['r','l']){
    const center=primary.clone().addScaledVector(shaft,side==='l'?-GOLF_GRIP_SPACING:0),shoulder=point('upperarm_'+side);
    const {handQ,target}=fittedHand(side,center,shaft,poles[side],lastHands[side]);
    const error=solveArm(side,target,poles[side],handQ);distributeForearmTwist(side,handQ);
    if(error>1e-9)primary.add(shoulder.clone().sub(target).normalize().multiplyScalar(error));
   }
  }else{
  const leadShoulder=point('upperarm_r'),leadLength=armRatio;
  const initial=fittedHand('r',primary,shaft,poles.r,lastHands.r);
  let leadQ=initial.handQ,leadTarget=initial.target;
  const fold=name==='Golf_Swing'?T.MathUtils.smoothstep(t,1.57/2.4,.82):0;
  const reach=T.MathUtils.lerp(.992,.74,fold);
  leadTarget=leadShoulder.clone().add(leadTarget.sub(leadShoulder).normalize().multiplyScalar(leadLength*reach));
  let outputShaft=shaft.clone();
  for(let iteration=0;iteration<5;iteration++){
   solveArm('r',leadTarget,poles.r,leadQ);
   const forearm=point('hand_r').sub(point('lowerarm_r')).normalize();
   outputShaft=boundedShaft(forearm,shaft,T.MathUtils.degToRad(30));
   leadQ=palmWeaponBasis(outputShaft,forearm).multiply(handFrames.r.clone().invert());
  }
  solveArm('r',leadTarget,poles.r,leadQ);distributeForearmTwist('r',leadQ);
  primary.copy(point('hand_r').add(new T.Vector3().fromArray(gripData.r.center).applyQuaternion(leadQ)));
  const clubFrame=leadQ.clone().multiply(handFrames.r),trailQ=clubFrame.clone().multiply(sharedLeftFrame.clone().invert());
  const trailTarget=primary.clone().addScaledVector(outputShaft,-GOLF_GRIP_SPACING).sub(new T.Vector3().fromArray(gripData.l.center).applyQuaternion(trailQ));
  const clavicle='clavicle_l',clavicleQ=worldQ(clavicle),origin=point(clavicle),shoulderVector=point('upperarm_l').sub(origin);
  const trailLength=point('upperarm_l').distanceTo(point('lowerarm_l'))+point('lowerarm_l').distanceTo(point('hand_l'));
  if(trailTarget.distanceTo(point('upperarm_l'))>trailLength*.998){
   const turn=new T.Quaternion().setFromUnitVectors(shoulderVector.clone().normalize(),trailTarget.clone().sub(origin).normalize());
   const angle=2*Math.acos(T.MathUtils.clamp(Math.abs(turn.w),0,1)),cap=Math.min(1,.25/Math.max(angle,1e-9));
   let lo=0,hi=cap;
   for(let n=0;n<16;n++){const u=(lo+hi)/2,q=new T.Quaternion().slerp(turn,u),candidate=origin.clone().add(shoulderVector.clone().applyQuaternion(q));if(candidate.distanceTo(trailTarget)>trailLength*.998)lo=u;else hi=u;}
   setWorld(clavicle,new T.Quaternion().slerp(turn,hi).multiply(clavicleQ));
  }
  const trailError=solveArm('l',trailTarget,trailElbowPole(trailTarget,poles.l,trailQ),trailQ);distributeForearmTwist('l',trailQ);
  report.maxArmReachError=Math.max(report.maxArmReachError,trailError);
  const time=times[i],rawDelta=authoredPrimary.clone().addScaledVector(shaft,spec.fixedShaftLength).sub(primary.clone().addScaledVector(outputShaft,spec.fixedShaftLength));
  if(!pass){if(i===0)contactCorrections.address.copy(rawDelta);if(name==='Golf_Swing'&&Math.abs(time-1.4)<.00001)contactCorrections.strike.copy(rawDelta);}
  const contactDelta=pass?(name==='Golf_Swing'?contactCorrections.address.clone().multiplyScalar(Math.exp(-Math.pow(time/.15,4))).addScaledVector(contactCorrections.strike,Math.exp(-Math.pow((time-1.4)/.1,4))):contactCorrections.address.clone()):new T.Vector3();
  report.maxContactBodyCorrection=Math.max(report.maxContactBodyCorrection,contactDelta.length());
  const adjusted=point('pelvis').add(contactDelta);bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(adjusted));bones.pelvis.updateWorldMatrix(false,true);
  primary.add(contactDelta);
  for(const side of ['r','l']){const goal=footGoals[side];solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],goal.ankle,goal.q,{maxReach:.999});}
  }
  for(const side of ['r','l'])for(const [n,q]of Object.entries(gripData[side].rotations))bones[n].quaternion.fromArray(q);
  for(const side of ['r','l'])lastHands[side]=worldQ('hand_'+side);
  report.maxGripCorrection=Math.max(report.maxGripCorrection,primary.distanceTo(authoredPrimary));
  if(name==='Golf_Swing'&&Math.abs(times[i]-1.4)<.00001)report.contactGripCorrection=primary.distanceTo(authoredPrimary);
  for(const [n,b]of Object.entries(bones)){const out=tracks[n],q=b.quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);b.position.toArray(out.translation,i*3);q.toArray(out.rotation,i*4);b.scale.toArray(out.scale,i*3);}
 }
 }
 const time=accessor(times,'SCALAR'),animation={name,channels:[],samplers:[],extras:{nativeGolfVersion:3,reviewCandidate:true}};
 const constantTime=accessor(new Float32Array([0,duration]),'SCALAR');
 for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
  const stride=property==='rotation'?4:3,bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray();
  const constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);
  if(constant&&array.subarray(0,stride).every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
  const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);if(node<0)throw Error('Missing '+n);
  animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});
  animation.samplers.push({input:constant?constantTime:time,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
 }
 doc.animations=doc.animations.map(a=>a.name===name?animation:a);reports.push(report);
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));console.log(JSON.stringify({hero:values.hero,output:values.output,reports},null,2));
