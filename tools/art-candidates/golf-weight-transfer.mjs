// Candidate study: move the hips onto the lead leg while retaining both grip frames.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../../src/leg-anatomy.js';
import {alignLegHinge} from '../../src/leg-hinge.js';
import {solveLeg} from '../../src/foot-placement.js';
import {headingKnee} from '../../src/knee-alignment.js';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../native-arm-anatomy.mjs';
import {patchAnimationTransforms} from '../patch-animation-rotations.mjs';
import {createGolfClub} from '../../src/golf-club.js';
import {captureGolfRestPose,calibrateGolfClub} from '../../src/golf-club-fit.js';

const {values:o}=parseArgs({options:{hero:{type:'string'},source:{type:'string'},output:{type:'string'},rate:{type:'string',default:'480'},'lie-degrees':{type:'string',default:'0'},help:{type:'boolean'}}});
if(o.help){console.log('node tools/art-candidates/golf-weight-transfer.mjs --hero kaede --source SOURCE.glb --output /tmp/NEW_DIR [--rate 480] [--lie-degrees 0]\nUses models from 4ddf88a. Produces a candidate for separate validation and review. Only the kaede candidate has passed release checks. No production files are changed.');process.exit(0);}
if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(o.hero)||!o.source||!o.output)throw Error('Supply --hero, --source, and --output.');
const folder=path.resolve(o.output),parent=fs.realpathSync(path.dirname(folder)),temp=fs.realpathSync('/tmp');
if((parent!==temp&&!parent.startsWith(temp+path.sep))||fs.existsSync(folder))throw Error('Use a new directory under /tmp.');
const lieDegrees=Number(o['lie-degrees']);if(!Number.isFinite(lieDegrees)||Math.abs(lieDegrees)>10)throw Error('Use --lie-degrees between -10 and 10.');
const rate=Number(o.rate);if(![30,60,120,240,480].includes(rate))throw Error('Use --rate 30, 60, 120, 240, or 480.');
const sources={
  "ronin": "604b8973b66aad159df5797bac97d6ca1d59ff1b367689c59a40159f27dbfae3",
  "shinobi": "bce73f5049daa654dc02dfffe12421bc1861bb4a8d83b1eef40ce1ab4d415e7a",
  "monk": "35534e3d694758681955acd1e87bae8afdf8562dd0f3b7be8ca8d0587442a747",
  "kaede": "54afe6dccc5bcfbc936329b41e3575edbbc293e8a682a1792645b0ed79862e05",
  "ayame": "2dab127fff3576dae1e9d4f60d04bbd8f86e6d2f1b243e0d3e9dfd603f59eebe",
  "sora": "4a568e790daadd09698a8f610a40bec8cab7fc54c93ba8332de4549c13df40dc"
};
const input=fs.readFileSync(o.source);
if(createHash('sha256').update(input).digest('hex')!==sources[o.hero])throw Error('Use the unchanged source model from 4ddf88a. A changed source requires another review.');
const g=await loadNativeSkin(o.source),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n});g.scene.updateMatrixWorld(true);
const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
const bind=Object.fromEntries(Object.entries(b).map(([n,v])=>[n,{q:v.quaternion.clone(),p:v.position.clone(),world:q(n)}]));
const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(b,s))]));
const armLengths=Object.fromEntries(['r','l'].map(s=>[s,[p('lowerarm_'+s).distanceTo(p('upperarm_'+s)),p('hand_'+s).distanceTo(p('lowerarm_'+s))]]));
const legLengths=Object.fromEntries(['r','l'].map(s=>[s,[p('calf_'+s).distanceTo(p('thigh_'+s)),p('foot_'+s).distanceTo(p('calf_'+s))]]));
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1),D=180/Math.PI;
const setQ=(n,w)=>{b[n].quaternion.copy(b[n].parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(w)).normalize();b[n].updateWorldMatrix(false,true)};
const setP=(n,v)=>{b[n].position.copy(b[n].parent.worldToLocal(v.clone()));b[n].updateWorldMatrix(false,true)};
const smooth=(t,a,z)=>{const u=T.MathUtils.clamp((t-a)/(z-a),0,1);return u*u*(3-2*u)};
const clip=g.animations.find(c=>c.name==='Golf_Swing'),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
const profile=JSON.parse(fs.readFileSync(new URL('../../src/grip-data.json',import.meta.url)))[o.hero].golf;
const grip={center:new T.Vector3().fromArray(profile.r.center),frame:new T.Quaternion().fromArray(profile.r.frame)};
const clubFit=calibrateGolfClub({root:g.scene,hand:b.hand_r,clip,restPose:captureGolfRestPose(g.scene),grip,club:createGolfClub(),contactTime:1.4});
const names=['pelvis','spine_01','spine_02','spine_03','neck_01','Head',...['r','l'].flatMap(s=>['thigh','calf','foot','clavicle','upperarm','lowerarm','hand'].map(n=>n+'_'+s))];
const times=[...new Set([...Array.from({length:Math.ceil(clip.duration*rate)+1},(_,i)=>Math.fround(Math.min(i/rate,clip.duration))),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
const tracks=Object.fromEntries(names.map(n=>[n,[]])),translations={pelvis:[]},report=[];
action.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
const shoes=Object.fromEntries(['r','l'].map(s=>[s,{ankle:p('foot_'+s),toe:p('ball_'+s),q:q('foot_'+s),vertices:[],floor:Infinity}]));
for(const s of ['r','l']){const shoe=shoes[s],inverse=shoe.q.clone().invert();g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const {skinIndex:ids,skinWeight:w,position}=mesh.geometry.attributes;for(let i=0;i<position.count;i++){let amount=0;for(let k=0;k<4;k++)if(['foot_'+s,'ball_'+s].includes(mesh.skeleton.bones[ids.getComponent(i,k)].name))amount+=w.getComponent(i,k);if(amount<=.9)continue;const v=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);shoe.floor=Math.min(shoe.floor,v.y);shoe.vertices.push(v.sub(shoe.ankle).applyQuaternion(inverse));}});}
function solveArm(s,target,handQ,reference,swivel){
 const c=arms[s],shoulder=p('upperarm_'+s),[u,l]=armLengths[s],v=target.clone().sub(shoulder),distance=T.MathUtils.clamp(v.length(),Math.abs(u-l)+.00001,Math.sqrt(u*u+l*l+2*u*l*Math.cos(reference.minimumFlex/D)));v.normalize();
 const guide=reference.elbow.clone().sub(reference.shoulder),axis0=reference.wrist.clone().sub(reference.shoulder).normalize();
 guide.addScaledVector(axis0,-guide.dot(axis0)).normalize().applyQuaternion(new T.Quaternion().setFromUnitVectors(axis0,v)).applyAxisAngle(v,swivel);
 const along=(u*u-l*l+distance*distance)/(2*distance),elbow=shoulder.clone().addScaledVector(v,along).addScaledVector(guide,Math.sqrt(Math.max(0,u*u-along*along)));
 const upper=elbow.clone().sub(shoulder).normalize(),lower=shoulder.clone().addScaledVector(v,distance).sub(elbow).normalize(),hinge=upper.clone().cross(lower).normalize();
 const transported=q('spine_03').multiply(c.bindChestQuaternion.clone().invert()).multiply(c.bindUpperArmQuaternion);
 const referenceAxis=c.upperAxisLocal.clone().applyQuaternion(transported),aim=new T.Quaternion().setFromUnitVectors(referenceAxis,upper).multiply(transported),nativeHinge=c.hingeAxisLocal.clone().applyQuaternion(aim);
 const roll=Math.atan2(upper.dot(nativeHinge.clone().cross(hinge)),nativeHinge.dot(hinge));
 setQ('upperarm_'+s,new T.Quaternion().setFromAxisAngle(upper,roll).multiply(aim));
 const flex=Math.acos(T.MathUtils.clamp(upper.dot(lower),-1,1));
 b['lowerarm_'+s].quaternion.copy(new T.Quaternion().setFromAxisAngle(c.hingeAxisLocal,flex-c.bindFlexionRadians)).multiply(bind['lowerarm_'+s].q);b['lowerarm_'+s].updateWorldMatrix(false,true);
 const preferred=reference.wristLocal.clone().slerp(bind['hand_'+s].q,reference.twistBlend);
 const neutral=q('lowerarm_'+s).multiply(preferred),delta=handQ.clone().multiply(neutral.invert()),projection=lower.clone().multiplyScalar(new T.Vector3(delta.x,delta.y,delta.z).dot(lower)),twist=new T.Quaternion(projection.x,projection.y,projection.z,delta.w).normalize();
 setQ('lowerarm_'+s,twist.multiply(q('lowerarm_'+s)));setQ('hand_'+s,handQ);
 const anatomy=measureArmAnatomy(c,captureArmPose(b,s)),wrist=b['hand_'+s].quaternion.angleTo(bind['hand_'+s].q)*D,error=p('hand_'+s).distanceTo(target);
 return{...anatomy,wrist,error};
}
let previousParameters=null,previousTime=null,previousVelocity=null;
for(const time of times){
 action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const base=Object.fromEntries(names.map(n=>[n,{p:p(n),q:q(n),localP:b[n].position.clone(),localQ:b[n].quaternion.clone()}]));
 const armRef=Object.fromEntries(['r','l'].map(s=>[s,captureArmPose(b,s)]));
 const drive=smooth(time,1.13,1.50),post=smooth(time,1.20,1.48),finish=smooth(time,1.50,1.95);
 for(const s of ['r','l'])Object.assign(armRef[s],{wristLocal:base['hand_'+s].localQ,twistBlend:drive,minimumFlex:.5+3.5*smooth(time,1.15,1.25),limits:{wrist:T.MathUtils.lerp(Math.max(29.5,base['hand_'+s].localQ.angleTo(bind['hand_'+s].q)*D),29.5,drive),humeral:T.MathUtils.lerp(Math.max(68,Math.abs(measureArmAnatomy(arms[s],armRef[s]).humeralRollDegrees)),68,drive),forearm:T.MathUtils.lerp(Math.max(68,Math.abs(measureArmAnatomy(arms[s],armRef[s]).forearmTwistDegrees)),68,drive)}});
 if(drive>0){
  const feet=Object.fromEntries(['r','l'].map(s=>{
   const shoe=shoes[s],forward=shoe.toe.clone().sub(shoe.ankle).setY(0).normalize();
   const yaw=s==='r'?-35/D*smooth(time,1.42,1.77):(-45*smooth(time,1.1,1.95)-20*smooth(time,1.4,1.8))/D;
   const heel=s==='r'?0:.9*smooth(time,1.1,1.95)+.25*smooth(time,1.4,1.8);
   const turn=new T.Quaternion().setFromAxisAngle(Y,yaw).multiply(new T.Quaternion().setFromAxisAngle(Y.clone().cross(forward).normalize(),heel));
   const rotation=turn.clone().multiply(shoe.q),ankle=shoe.ankle.clone().sub(shoe.toe).applyQuaternion(turn).add(shoe.toe);
   const floor=Math.min(...shoe.vertices.map(v=>v.clone().applyQuaternion(rotation).add(ankle).y));ankle.y+=shoe.floor-floor;
   // The ankle-to-toe segment slopes down through the shoe. Its projection
   // reverses during a high heel lift. Retain the flat sole's yaw direction.
   return[s,{p:ankle,q:rotation,forward:forward.clone().applyAxisAngle(Y,yaw)}];
  }));
  const pelvisQ=new T.Quaternion().setFromAxisAngle(X,.10*drive*(1-finish)).multiply(base.pelvis.q);
  // After contact, the shared grip travels with the extending torso.
  // One rigid transform moves both hands, retaining their fitted separation.
  const follow=smooth(time,1.4,1.49);
  const handTargets=()=>{
   const rotation=new T.Quaternion().slerp(q('spine_03').multiply(base.spine_03.q.clone().invert()),follow);
   const center=base.spine_03.p.clone().lerp(p('spine_03'),follow);
   const shaft=Y.clone().applyQuaternion(base.hand_r.q.clone().multiply(grip.frame));
   const clubhead=grip.center.clone().applyQuaternion(base.hand_r.q).add(base.hand_r.p).addScaledVector(shaft,clubFit.shaftLengthNative);
   const lie=new T.Quaternion().setFromAxisAngle(X,lieDegrees/D*smooth(time,1.15,1.3)*(1-follow));
   return Object.fromEntries(['r','l'].map(s=>[s,{p:base['hand_'+s].p.clone().sub(clubhead).applyQuaternion(lie).add(clubhead).sub(base.spine_03.p).applyQuaternion(rotation).add(center),q:rotation.clone().multiply(lie).multiply(base['hand_'+s].q)}]));
  };
  const pose=(pitch,side,yaw=0,girdle=0,leadGirdle=0,elevation=0)=>{
   for(const n of names){b[n].position.copy(base[n].localP);b[n].quaternion.copy(base[n].localQ);}g.scene.updateMatrixWorld(true);
   setP('pelvis',base.pelvis.p);setQ('pelvis',pelvisQ);
   const pelvis=base.pelvis.p.clone(),hip=p('thigh_r'),foot=feet.r.p;
   pelvis.x=T.MathUtils.lerp(pelvis.x,foot.x+.025-(hip.x-pelvis.x),drive);
   setP('pelvis',pelvis);const desiredFlex=T.MathUtils.lerp(20,12,finish)/D,[u,l]=legLengths.r,length=Math.sqrt(u*u+l*l+2*u*l*Math.cos(desiredFlex)),h=p('thigh_r');
   const y=foot.y+Math.sqrt(Math.max(0,length*length-(h.x-foot.x)**2-(h.z-foot.z)**2))-(h.y-pelvis.y);
   pelvis.y=T.MathUtils.lerp(pelvis.y,y,post);setP('pelvis',pelvis);
   const spineAxis=base.spine_03.p.clone().sub(base.spine_01.p).normalize();
   const delta=new T.Quaternion().setFromAxisAngle(X,pitch).multiply(new T.Quaternion().setFromAxisAngle(Z,side)).multiply(new T.Quaternion().setFromAxisAngle(spineAxis,yaw));
   for(const [n,weight]of [['spine_01',.35],['spine_02',.70],['spine_03',1],['neck_01',smooth(time,1.45,1.7)],['Head',smooth(time,1.45,1.7)]])setQ(n,new T.Quaternion().slerp(delta,weight).multiply(base[n].q));
   for(const s of ['r','l']){setQ('clavicle_'+s,new T.Quaternion().setFromAxisAngle(Z,s==='l'?elevation:0).multiply(new T.Quaternion().setFromAxisAngle(Y,s==='l'?girdle:leadGirdle)).multiply(delta).multiply(base['clavicle_'+s].q));}
   return pelvis;
  };
  const bounds=[[-.18,.35],[-.3,.25],[-.3,.25],[-.22,.22],[-.22,.22],[-.18,.18],[-1.6,1.6],[-1.6,1.6]].map((v,i)=>v.map(x=>i<6?x*drive:x));
  const dt=previousTime===null?1/120:Math.max(1e-6,time-previousTime);
  const predicted=previousParameters?.map((x,i)=>x+(previousVelocity?.[i]??0)*dt);
  const prior=[.10*drive*(1-finish),-.10*drive*(1-finish),-.10*drive*(1-finish),0,0,0,0,0];
  const clamp=v=>v.map((x,i)=>T.MathUtils.clamp(x,...bounds[i]));
  const score=v=>{
   pose(...v.slice(0,6));const targets=handTargets();let value=v.reduce((sum,x,i)=>sum+(i<6?1:.015)*(x-prior[i])**2,0);
   if(predicted)value+=4*(1/120/dt)**2*v.reduce((sum,x,i)=>sum+(i<6?1:.1)*(x-predicted[i])**2,0);
   for(const [i,s]of ['r','l'].entries()){
    const m=solveArm(s,targets[s].p,targets[s].q,armRef[s],v[6+i]);
    value+=1e12*Math.max(0,m.error-.00002)**2+1000*Math.max(0,m.wrist-armRef[s].limits.wrist)**2+1000*Math.max(0,Math.abs(m.humeralRollDegrees)-armRef[s].limits.humeral)**2+1000*Math.max(0,Math.abs(m.forearmTwistDegrees)-armRef[s].limits.forearm)**2;
    value+=1000*Math.max(0,m.signedFlexionDegrees-124)**2;
   }
   return value;
  };
  const fit=start=>{
   const vertex=x=>{const v=clamp(x);return{v,cost:score(v)}};
   let simplex=[vertex(start),...start.map((_,i)=>vertex(start.map((x,k)=>x+(k===i?(i<6?.025:.08)*Math.min(1,dt*120):0))))];
   for(let iteration=0;iteration<1100;iteration++){
    simplex.sort((a,b)=>a.cost-b.cost);const first=simplex[0],last=simplex.at(-1),center=start.map((_,i)=>simplex.slice(0,-1).reduce((sum,v)=>sum+v.v[i],0)/start.length);
    const move=f=>vertex(center.map((x,i)=>x+f*(x-last.v[i]))),reflected=move(1);
    if(reflected.cost<first.cost){const expanded=move(2);simplex[simplex.length-1]=expanded.cost<reflected.cost?expanded:reflected;}
    else if(reflected.cost<simplex.at(-2).cost)simplex[simplex.length-1]=reflected;
    else{const contracted=vertex(center.map((x,i)=>x+.5*((reflected.cost<last.cost?reflected:last).v[i]-x)));if(contracted.cost<Math.min(last.cost,reflected.cost))simplex[simplex.length-1]=contracted;else simplex=simplex.map((v,i)=>i?vertex(v.v.map((x,k)=>(x+first.v[k])/2)):v);}
    if(simplex.every(v=>v.v.every((x,i)=>Math.abs(x-first.v[i])<1e-6)))break;
   }
   simplex.sort((a,b)=>a.cost-b.cost);return simplex[0];
  };
  let fitted=fit(predicted?clamp(predicted):prior);
  if(fitted.cost>.2){const alternative=fit(prior);if(alternative.cost<fitted.cost)fitted=alternative;}
  const parameters=fitted.v,[pitch,side,yaw,girdle]=parameters;
  const repeatedCost=score(parameters);if(Math.abs(repeatedCost-fitted.cost)>1e-5)throw Error('Stateful body objective at '+time+': '+fitted.cost+' / '+repeatedCost);
  previousVelocity=previousParameters?parameters.map((x,i)=>(x-previousParameters[i])/dt):parameters.map(()=>0);
  previousParameters=parameters;previousTime=time;
  pose(...parameters.slice(0,6));const targets=handTargets(),armReport={};
  for(const [i,s]of ['r','l'].entries())armReport[s]=solveArm(s,targets[s].p,targets[s].q,armRef[s],parameters[6+i]);
  const legReport={};
  for(const s of ['r','l']){
   const solve=angle=>{const error=solveLeg(b['thigh_'+s],b['calf_'+s],b['foot_'+s],feet[s].p,feet[s].q,{maxReach:.999999,kneeSolver:(h,f,u,l)=>headingKnee(h,f,u,l,feet[s].forward,angle/D)});alignLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s],legs[s].hinge);return {...measureLegAnatomy(legs[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]),error};};
   const score=angle=>{const m=solve(angle);return(m.hipTwist/40)**4+(m.ankleTwist/15)**4+(m.ankleOffPitch/18)**4+(angle/80)**2+100*(Math.max(0,Math.abs(m.hipTwist)-43)**2+Math.max(0,Math.abs(m.ankleTwist)-15)**2+Math.max(0,m.ankleOffPitch-22)**2)};let lo=-85,hi=85;for(let i=0;i<20;i++){const a=lo+(hi-lo)/3,z=hi-(hi-lo)/3;if(score(a)<score(z))hi=z;else lo=a;}legReport[s]=solve((lo+hi)/2);
  }
  report.push({time,pitch,side,yaw,girdle,parameters,cost:fitted.cost,pelvis:p('pelvis').toArray(),before:base.pelvis.p.toArray(),arms:armReport,legs:legReport});
 }
 for(const n of names){const v=tracks[n],rotation=b[n].quaternion.clone().normalize();if(v.length&&rotation.dot(new T.Quaternion().fromArray(v,v.length-4))<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);v.push(...rotation.toArray());}
 translations.pelvis.push(...b.pelvis.position.toArray());
 for(const n of names){b[n].position.copy(base[n].localP);b[n].quaternion.copy(base[n].localQ);}g.scene.updateMatrixWorld(true);
}
fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,o.hero+'.glb'),patchAnimationTransforms(input,[{clip:'Golf_Swing',times,rotations:tracks,translations,extras:{nativeGolfWeightTransfer:1}}]));
fs.writeFileSync(path.join(folder,o.hero+'.json'),JSON.stringify(report));
console.log(JSON.stringify({hero:o.hero,frames:times.length,maxArmError:Math.max(...report.flatMap(r=>Object.values(r.arms).map(a=>a.error))),maxWrist:Math.max(...report.flatMap(r=>Object.values(r.arms).map(a=>a.wrist))),maxLegError:Math.max(...report.flatMap(r=>Object.values(r.legs).map(a=>a.error))),phases:report.filter(r=>[1.4,1.5,2.4].some(t=>Math.abs(r.time-t)<1e-6))},null,2));
