#!/usr/bin/env node
// Re-author the Ace's forefoot pivots from the pre-pivot reviewed motion.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {gunzipSync,gzipSync} from 'node:zlib';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {calibrateLegHinge,alignLegHinge} from '../src/leg-hinge.js';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {samplePlanarRoot} from '../src/attack-root-motion.js';
import {bakeAttackCurves} from './bake-attack-curves.mjs';
const {values:options}=parseArgs({options:{input:{type:'string'},curves:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(options.help){console.log('node tools/author-ace-pivot.mjs --input BASE.glb --curves BASE.json.gz --output CANDIDATE.glb --record RECORD.json\nUse the pre-pivot Ace motion from commit a9d1142. Writes a separate model, record, and .curves.json.gz source.');process.exit(0);}
if(!options.input||!options.curves||!options.output?.endsWith('.glb')||!options.record?.endsWith('.json'))throw Error('Supply --input, --curves, --output, and --record. See --help.');
if(path.resolve(options.input)===path.resolve(options.output)||path.resolve(options.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a separate candidate outside public/.');
const curves=JSON.parse(gunzipSync(fs.readFileSync(options.curves))),spec=curves.motion;
if(curves.clip!=='Fan_Heavy_Rising'||spec.duration!==1.55||spec.poses.length!==373||curves.source.rearPivot)throw Error('Use the reviewed pre-pivot Ace rising motion from commit a9d1142.');
const g=await loadNativeSkin(options.input),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});g.scene.updateMatrixWorld(true);
const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize(),up=new T.Vector3(0,1,0);
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const base=Object.fromEntries(['r','l'].map(s=>[s,p('foot_'+s).y]));
const clip=g.animations.find(c=>c.name===curves.clip),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
function scalar(rows,t){if(t<=rows[0][0])return rows[0][1];if(t>=rows.at(-1)[0])return rows.at(-1)[1];let i=0;while(i<rows.length-2&&t>rows[i+1][0])i++;const[x,v]=rows[i],[y,w]=rows[i+1],u=(t-x)/(y-x);const slope=j=>{if(!j||j===rows.length-1)return 0;const left=(rows[j][1]-rows[j-1][1])/(rows[j][0]-rows[j-1][0]),right=(rows[j+1][1]-rows[j][1])/(rows[j+1][0]-rows[j][0]);return left*right<=0?0:2*left*right/(left+right)};return (2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*(y-x)*slope(i)+(-2*u**3+3*u*u)*w+(u**3-u*u)*(y-x)*slope(i+1);}
const yawRows=[[0,0],[.3,0],[.42,4],[.5,3],[.626,45],[.7,80],[.78,105],[.83,104],[.9,73],[1.04,20],[1.18,0],[1.55,0]];
const smooth=(a,b,t)=>{let u=T.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*u*(10+u*(-15+6*u))};
a.time=1;g.mixer.update(0);g.scene.updateMatrixWorld(true);const flatFoot=q('foot_l'),flatBall=q('ball_l'),flatVector=p('ball_l').sub(p('foot_l')),flatYaw=Math.atan2(flatVector.x,flatVector.z);
const heelRows=[[0,0],[.1,0],[.2,.10],[.3,.2],[.42,.25],[.5,.28],[.626,.38],[.7,.55],[.72,.72],[.78,.50],[.84,.30],[.9,.22],[1.04,.12],[1.18,0],[1.55,0]];
const worldToeAt=t=>{a.time=t;g.mixer.update(0);g.scene.updateMatrixWorld(true);const root=samplePlanarRoot(spec.planarRoot,t);return p('ball_l').add(new T.Vector3(root.x,0,root.z));};
const departure=worldToeAt(.72);departure.z-=.08;departure.y=.0065;const arrival=worldToeAt(1);arrival.y=.0065;
const names=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l','ball_l'],values=Object.fromEntries(names.map(n=>[n,[]])),times=[];let reach=0;
for(let i=0;i<=372;i++){
 const time=i/240;times.push(time);a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 for(const s of ['r','l']){
  const ankle=p('foot_'+s),footq=q('foot_'+s),toe=p('ball_'+s);
  let ballRotation=null;
  if(s==='l'){
   const oldForward=toe.clone().sub(ankle),oldYaw=Math.atan2(oldForward.x,oldForward.z);
   const fade=smooth(.30,.42,time),yaw=oldYaw+(scalar(yawRows,time)*Math.PI/180-oldYaw)*fade;
   const yawQ=new T.Quaternion().setFromAxisAngle(up,yaw-flatYaw),axis=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),heel=scalar(heelRows,time);
   footq.copy(new T.Quaternion().setFromAxisAngle(axis,heel).multiply(yawQ).multiply(flatFoot));
   ballRotation=yawQ.clone().multiply(flatBall);
   if(time>.72&&time<1.04){const u=(time-.72)/.32;ballRotation.premultiply(new T.Quaternion().setFromAxisAngle(axis,heel*.35*Math.sin(Math.PI*u)**2));}
   // Native foot and ball axes are oblique. Use their measured local offset.
   const targetToe=toe.clone();targetToe.z-=.08*smooth(.1,.2,time);
   if(time<=.1)targetToe.y=.0065;
   else if(time<.2)targetToe.y=T.MathUtils.lerp(toe.y,.0065,smooth(.1,.2,time));
   else if(time<=.72)targetToe.y=.0065;
   else {
    const u=T.MathUtils.clamp((time-.72)/.32,0,1),root=samplePlanarRoot(spec.planarRoot,time);
    targetToe.copy(departure).lerp(arrival,smooth(0,1,u)).add(new T.Vector3(-root.x+.16*Math.cos(spec.poses[i].hip)*16*u*u*(1-u)**2,.06*16*u*u*(1-u)**2,-root.z-.16*Math.sin(spec.poses[i].hip)*16*u*u*(1-u)**2));
   }
   ankle.copy(targetToe).sub(b.ball_l.position.clone().applyQuaternion(footq));
  }
  if(s==='r'){
   const delta=(-20*smooth(.21,.39,time)*(1-smooth(.44,.53,time))-14*smooth(1.02,1.07,time)*(1-smooth(1.10,1.25,time)))*Math.PI/180,rotation=new T.Quaternion().setFromAxisAngle(up,delta);
   const forward=toe.clone().sub(ankle);footq.premultiply(rotation);ankle.copy(toe).sub(forward.applyQuaternion(rotation));
  }
  const kneeSolver=(h,f,upper,lower,forward)=>{
   const desired=headingKnee(h,f,upper,lower,forward),axis=f.clone().sub(h).normalize();
   const center=h.clone().addScaledVector(axis,desired.clone().sub(h).dot(axis)),bend=desired.clone().sub(center);
   // Five degrees distributes rotation between the rear hip and ankle. Dense
   // frame checks limit hip axial rotation to45deg and ankle rotation to15deg.
   if(s==='l')bend.applyAxisAngle(axis,5*Math.PI/180*smooth(.3,.5,time)*(1-smooth(.75,.95,time)));
   return center.add(bend);
  };
  reach=Math.max(reach,solveLeg(b['thigh_'+s],b['calf_'+s],b['foot_'+s],ankle,footq,{maxReach:.9999,kneeSolver}));alignLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s],cal[s]);
  if(ballRotation){b.ball_l.quaternion.copy(q('foot_l').invert().multiply(ballRotation)).normalize();g.scene.updateMatrixWorld(true);}
  const actual=p('foot_'+s),f=p('ball_'+s).sub(actual);spec.poses[i][s==='l'?'footL':'footR']=[actual.x,-actual.z,actual.y-base[s]];spec.poses[i][s==='l'?'yawL':'yawR']=Math.atan2(f.x,f.z);
 }
 for(const n of names){const rotation=b[n].quaternion.clone().normalize(),track=values[n];if(i&&rotation.dot(new T.Quaternion().fromArray(track,track.length-4))<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);track.push(...rotation.toArray())}
}
for(const c of curves.channels)if(c.path==='rotation'&&values[c.name]){c.times=times;c.values=values[c.name]}
spec.nativeKneeHeading=true;spec.footPlants.l=[[0,.1],[1.18,1.55]];spec.toePlants.l=[[.2,.72],[1.04,1.18]];curves.source.rearPivot={baseCommit:'a9d1142',yawRows,heelRows,toeOff:.72,landing:1.04,rearStepBack:.08,flightLift:.06,outsideArc:.16,forefootHeight:.0065};
if(reach>1e-5)throw Error(`Unreachable foot target: ${reach}m`);
fs.writeFileSync(options.output,bakeAttackCurves(fs.readFileSync(options.input),curves));fs.writeFileSync(options.output.replace(/\.glb$/,'.curves.json.gz'),gzipSync(JSON.stringify(curves),{level:9}));fs.writeFileSync(options.record,JSON.stringify({[curves.clip]:spec}));console.log({reach});
