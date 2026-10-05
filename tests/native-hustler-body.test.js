import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {attackDefinition} from '../src/combat.js';
import {footForward} from '../src/knee-alignment.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';

// Read the exported skeleton, not the authoring curves. Environment overrides
// let a private candidate pass this same check before it replaces a game asset.
test('The retained Hustler heavy cleave steps, transfers weight, pivots, and returns to its entry pose',async t=>{
 const model=process.env.HUSTLER_BODY_MODEL||new URL('../public/models/ayame.glb',import.meta.url);
 const records=JSON.parse(fs.readFileSync(process.env.HUSTLER_BODY_RECORDS||new URL('../src/motion-data.json',import.meta.url)));
 const name='Ring_Heavy_Cleave',spec=records[name],g=await loadNativeSkin(model),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});
 const point=n=>b[n].getWorldPosition(new T.Vector3()),rotation=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const legBind=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const ready=g.mixer.clipAction(g.animations.find(c=>c.name===name)).play();ready.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const endpointNames=['pelvis','spine_01','spine_02','spine_03','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l','thigh_r','calf_r','foot_r','ball_r','thigh_l','calf_l','foot_l','ball_l',...Object.keys(b).filter(n=>/^(thumb|index|middle|ring|pinky)_\d+_[rl]$/.test(n))];
 const endpoints=Object.fromEntries(endpointNames.map(n=>[n,{p:point(n),q:rotation(n)}]));
 const endpointError=()=>{let position=0,rotationDegrees=0;for(const [n,expected]of Object.entries(endpoints)){position=Math.max(position,point(n).distanceTo(expected.p));rotationDegrees=Math.max(rotationDegrees,rotation(n).angleTo(expected.q)*180/Math.PI);}return{position,rotationDegrees};};
 const initialLeft=point('foot_l'),initialRight=point('foot_r');
 g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const supports=new Map(),samples=[];let maxSupportDrift=0,maxSupportTurn=0,maxMedialKnee=0,maxFootSpeed=0,maxFootStep=0,minKnee=180,maxKnee=0,minWidth=Infinity,maxLeftLift=0,maxRearHeel=0,previous=null;
 const duration=clip.duration;let entryError;
 for(let i=0;i<=Math.ceil(duration*240);i++){
  const time=Math.min(i/240,duration);action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  if(i===0)entryError=endpointError();
  const hip=point('thigh_r').add(point('thigh_l')).multiplyScalar(.5),left=point('foot_l'),right=point('foot_r'),line=left.clone().sub(right).setY(0);
  const shoulders=point('upperarm_r').add(point('upperarm_l')).multiplyScalar(.5),torso=shoulders.sub(hip),fraction=hip.clone().sub(right).dot(line)/line.lengthSq();
  const pelvisForward=new T.Vector3(0,0,1).applyQuaternion(rotation('pelvis').multiply(endpoints.pelvis.q.clone().invert()));
  const chestForward=new T.Vector3(0,0,1).applyQuaternion(rotation('spine_03').multiply(endpoints.spine_03.q.clone().invert()));
  samples.push({time,fraction,lean:Math.atan2(torso.z,torso.y)*180/Math.PI,hipYaw:Math.atan2(pelvisForward.x,pelvisForward.z)*180/Math.PI,chestYaw:Math.atan2(chestForward.x,chestForward.z)*180/Math.PI,leftAdvance:left.z-initialLeft.z});
  minWidth=Math.min(minWidth,left.x-right.x);maxLeftLift=Math.max(maxLeftLift,left.y-initialLeft.y);maxRearHeel=Math.max(maxRearHeel,right.y-initialRight.y);
  if(previous&&time>previous.time){for(const s of ['r','l']){const step=point('foot_'+s).distanceTo(previous[s]);maxFootStep=Math.max(maxFootStep,step);maxFootSpeed=Math.max(maxFootSpeed,step/(time-previous.time));}}
  previous={time,r:right,l:left};
  for(const s of ['r','l']){
   if(spec.nativeKneeHinges){
    const m=measureLegAnatomy(legBind[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
    assert.ok(Math.abs(m.hipTwist)<45&&Math.abs(m.ankleTwist)<15&&m.kneeDeviation<.01,`${time}/${s}: ${JSON.stringify(m)}`);
    assert.ok(m.kneeFlexion>0&&m.kneeFlexion<120,'Native knee folds backward or too far');
   }
   const ankle=point('foot_'+s),knee=point('calf_'+s),upper=point('thigh_'+s).sub(knee),lower=ankle.clone().sub(knee);
   const flex=180-upper.angleTo(lower)*180/Math.PI;minKnee=Math.min(minKnee,flex);maxKnee=Math.max(maxKnee,flex);
   const forward=footForward(b['foot_'+s],rotation('foot_'+s)),outward=new T.Vector3(forward.z,0,-forward.x).multiplyScalar(s==='r'?-1:1);
   maxMedialKnee=Math.max(maxMedialKnee,-knee.clone().sub(ankle).dot(outward));
   for(const [kind,bone]of [['footPlants','foot_'],['toePlants','ball_']])for(const [index,[start,end]]of (spec[kind]?.[s]??[]).entries())if(time>=start+1e-5&&time<=end-1e-5){
    const key=kind+s+index,p=point(bone+s),q=rotation('foot_'+s);if(!supports.has(key))supports.set(key,{p,q});const reference=supports.get(key);maxSupportDrift=Math.max(maxSupportDrift,p.distanceTo(reference.p));if(kind==='footPlants')maxSupportTurn=Math.max(maxSupportTurn,q.angleTo(reference.q));
   }
  }
 }
 const {position:endpointPosition,rotationDegrees:endpointRotation}=endpointError();
 const mean=(a,z,key)=>{const rows=samples.filter(s=>s.time>=a&&s.time<=z);assert.ok(rows.length>5);return rows.reduce((sum,row)=>sum+row[key],0)/rows.length;};
 const report={rearLoad:mean(.12,.18,'fraction'),leadBrace:mean(.38,.49,'fraction'),strikeLean:mean(.36,.49,'lean'),pelvisLead:mean(.27,.31,'hipYaw')-mean(.27,.31,'chestYaw'),maxAdvance:Math.max(...samples.map(x=>x.leftAdvance)),maxLeftLift,maxRearHeel,minWidth,minKnee,maxKnee,maxMedialKnee,maxSupportDrift,maxSupportTurn,maxFootSpeed,maxFootStep,entryError,endpointPosition,endpointRotation};
 t.diagnostic(JSON.stringify(report));
 assert.ok(report.rearLoad<.40&&report.leadBrace>.64&&report.leadBrace-report.rearLoad>.3,'Visible rear-to-lead weight transfer');
 assert.ok(report.strikeLean>18&&report.strikeLean<40,'Forward body commitment, without a deep bow');
 assert.ok(report.pelvisLead>10,'Pelvis turns before the shoulders');
 assert.ok(report.maxAdvance>.34&&report.maxAdvance<.45&&maxLeftLift>.04,'A deliberate, lifted lead step');
 assert.ok(maxRearHeel>.035&&minWidth>.38,'Rear heel pivots while the stance stays broad');
 assert.ok(minKnee>10&&maxKnee<100,'Knees retain the authored flexion range');
 // The full native joint frames above also constrain a turning leg's axial twist.
 if(!spec.nativeKneeHeading)assert.ok(maxMedialKnee<.025,'Loaded knee falls inside the legacy shoe plane');
 assert.ok(maxSupportDrift<.003&&maxSupportTurn<T.MathUtils.degToRad(.25),'Planted feet and toes stay anchored');
 assert.ok(maxFootSpeed<4&&maxFootStep<.018,'Foot transitions have no teleport');
 assert.ok(entryError.position<.003&&entryError.rotationDegrees<.5,'Entry matches Ready, including every finger');
 assert.ok(endpointPosition<.003&&endpointRotation<.5,'Recovery returns to the existing Ready pose');
 const attack=attackDefinition('heavy',0,'ring');assert.ok(Math.abs(attack.duration-duration)<1e-6);assert.deepEqual(attack.hits,spec.impacts);
});
