import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {WARRIORS} from '../src/warriors.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {samplePlanarRoot} from '../src/attack-root-motion.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';

const readJSON=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url)));
const motions=readJSON(process.env.NINJA_MOTION_RECORD||'../src/motion-data.json');
const selections=readJSON('../src/selection-data.json');
const gaits=readJSON('../src/locomotion-data.json');
const regular=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'];
const up=new THREE.Vector3(0,1,0);
const degrees=180/Math.PI;
const peak=()=>({value:0});
function retain(metric,value,clip,seconds,side){
 if(value>metric.value)Object.assign(metric,{value,clip,seconds,side});
}
function sourceFootHeight(spec,seconds,side){
 const rows=spec.poses,t=Math.max(0,Math.min(1,seconds/spec.duration));
 let i=0;while(i<rows.length-2&&rows[i+1].t<t)i++;
 const a=rows[i],b=rows[i+1],u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
 const key=side==='r'?'footR':'footL';
 assert.ok(a[key]&&b[key],'Guard source needs explicit foot targets');
 return a[key][2]+(b[key][2]-a[key][2])*u;
}
function supportState(kind,name,spec,seconds,side){
 if(kind==='idle')return{loaded:true,plant:null};
 if(kind==='selection'||kind==='ready')return{loaded:true,plant:'static'};
 if(kind==='attack'){
  const intervals=spec.footPlants?.[side];
  assert.ok(intervals?.length||spec.supportWindows?.[side]?.length,`${name}: missing ${side} support records`);
  const index=intervals.findIndex(([a,b])=>seconds>=a-1e-7&&seconds<=b+1e-7);
  const toe=(spec.toePlants?.[side]??[]).findIndex(([a,b])=>seconds>=a-1e-7&&seconds<=b+1e-7);
  const sourceContact=(spec.supportWindows?.[side]??[]).some(([a,b])=>seconds>=a&&seconds<=b);
  return{loaded:index>=0||toe>=0||sourceContact,plant:index>=0?index:null,toePlant:toe>=0?toe:null};
 }
 if(kind==='gait'&&spec.sourceGait){
  const [start,end]=spec.sourceGait.feet[side].supportInterval;
  const phase=((seconds/spec.duration-start)%1+1)%1;
  return{loaded:phase<end-start,plant:null};
 }
 if(kind==='gait'){
  const phase=((seconds/spec.duration+(side==='l'?.5:0))%1+1)%1;
  return{loaded:phase<spec.support,plant:null};
 }
 // Guard walks deliberately travel backward in local space during support.
 // Use authored lift, not the current knee angle, to classify that support.
 return{loaded:sourceFootHeight(spec,seconds,side)<=.001,plant:/_Walk_/.test(name)?null:'static'};
}

for(const hero of WARRIORS)test(`${hero.model}: native knees track the feet through stance and movement`,async t=>{
 const directory=process.env.NINJA_KNEE_MODEL_DIR;
 const file=directory?path.join(directory,hero.model+'.glb'):new URL('../public/models/'+hero.model+'.glb',import.meta.url);
 const g=await loadNativeSkin(file);
 const point=name=>{
  const bone=g.scene.getObjectByName(name);assert.ok(bone,`${hero.model}: missing ${name}`);
  return bone.getWorldPosition(new THREE.Vector3());
 };
 g.scene.updateMatrixWorld(true);
 const bones=Object.fromEntries(['r','l'].flatMap(s=>['thigh_','calf_','foot_'].map(n=>[n+s,g.scene.getObjectByName(n+s)])));
 const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const anatomic={samples:0,kneeDeviation:0,hipTwist:0,ankleTwist:0};
 const lengths=Object.fromEntries(['r','l'].map(side=>[side,{
  thigh:point('thigh_'+side).distanceTo(point('calf_'+side)),
  shin:point('calf_'+side).distanceTo(point('foot_'+side)),
 }]));
 const clips=new Map(g.animations.map(clip=>[clip.name,clip]));
 const guards=g.animations.filter(c=>/_Guard_(Loop|Impact|Break|Walk_(Forward|Backward|Left|Right))$/.test(c.name));
 assert.equal(guards.length,7,'Cover guard stance, recoil, break and all four walking directions');
 const cases=[
  {name:'Idle_Loop',kind:'idle',spec:{duration:clips.get('Idle_Loop').duration}},
  {name:hero.selectionClip,kind:'selection',spec:selections[hero.selectionClip]},
  {name:hero.readyClip,kind:'ready',spec:motions[hero.readyClip]},
  ...regular.map(suffix=>{const name=hero.motionOverrides?.[hero.motionPrefix+suffix]??hero.motionPrefix+suffix;return{name,kind:'attack',spec:motions[name]};}),
  ...guards.map(c=>({name:c.name,kind:'guard',spec:motions[c.name]})),
  ...Object.entries(gaits).map(([name,spec])=>({name,kind:'gait',spec:clips.get(name)?.userData?.sourceGait?{...spec,sourceGait:clips.get(name).userData.sourceGait,nativeKneeHeading:true}:spec})),
 ];
 const worst=Object.fromEntries(['loadedMedial','selectionMedial','swingMedial','shinMedialDegrees','lengthError','kneeSpeed','ankleSpeed','plantDrift','plantTurn'].map(k=>[k,peak()]));
 const loadedByKind=Object.fromEntries(['idle','ready','attack','guard','gait'].map(kind=>[kind,peak()]));
 const impactMedial=peak();
 let samples=0,loadedSamples=0,impactSamples=0;
 for(const {name,kind,spec}of cases){
  assert.ok(spec,`${name}: missing authored support metadata`);
  const clip=clips.get(name);assert.ok(clip,`${hero.model}: missing native ${name}`);
  g.mixer.stopAllAction();
  const action=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  const duration=spec.duration;
  assert.ok(Math.abs(clip.duration-duration)<1/120+.00001,`${name}: native duration differs from its support metadata`);
  const times=new Set(Array.from({length:Math.floor(duration*120)+1},(_,i)=>i/120));
  times.add(duration);for(const seconds of spec.impacts||[])times.add(seconds);
  const previous={},plants={};
  for(const seconds of [...times].sort((a,b)=>a-b)){
   action.time=Math.min(seconds,clip.duration);g.mixer.update(0);const root=spec.planarRoot?samplePlanarRoot(spec.planarRoot,seconds):{x:0,z:0};g.scene.position.set(root.x,0,root.z);g.scene.updateMatrixWorld(true);samples++;
   const impact=(spec.impacts||[]).some(hit=>Math.abs(hit-seconds)<1e-8);
   if(impact)impactSamples++;
   for(const side of ['r','l']){
    const hip=point('thigh_'+side),knee=point('calf_'+side),ankle=point('foot_'+side),toe=point('ball_'+side);
    const foot=g.scene.getObjectByName('foot_'+side).getWorldQuaternion(new THREE.Quaternion()).normalize();
    const forward=toe.clone().sub(ankle).setY(0);
    // An airborne shoe can point vertically. Its anatomical frames still
    // define the knee hinge; a horizontal toe projection does not.
    if(spec.sourceGait&&forward.length()<=.01)forward.set(0,0,1);
    else assert.ok(forward.length()>.01,`${name} ${side} at ${seconds}: ankle-to-toe heading is degenerate`);
    forward.normalize();
    // A positive value means the knee lies medial to the actual shoe's sagittal
    // plane. This catches toe-out and turned stances that actor-X checks miss.
    const outward=up.clone().cross(forward).multiplyScalar(side==='l'?1:-1);
    const shin=knee.clone().sub(ankle),rawMedial=-shin.dot(outward);
    const headingSolve=kind==='gait'&&/Run_(Right|Left)/.test(name)
     ||clip.userData?.nativeLegFrames===1&&/_Guard_Walk_(Right|Left)$/.test(name);
    // A running hip need not share the shoe's vertical plane. Measure the knee
    // relative to the straight hip–ankle line, not a vertical line from the shoe.
    // Strafe tests separately check native hip, knee and ankle frames.
    const legAxis=ankle.clone().sub(hip),fraction=knee.clone().sub(hip).dot(legAxis)/legAxis.lengthSq();
    const alignedShin=hip.clone().addScaledVector(legAxis,fraction).sub(ankle);
    const medial=headingSolve?-(shin.clone().sub(alignedShin)).dot(outward):rawMedial;
    // A heel pivot changes the foot's sagittal plane. Validate its actual joint
    // frames instead of forcing the knee back into a vertical shoe plane.
    if(spec.nativeKneeHeading||clip.userData?.nativeLegFrames===1){
     const measured=measureLegAnatomy(anatomy[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
     anatomic.samples++;
     for(const key of ['kneeDeviation','hipTwist','ankleTwist'])anatomic[key]=Math.max(anatomic[key],Math.abs(measured[key]));
     assert.ok(measured.kneeDeviation<.1&&Math.abs(measured.hipTwist)<45&&Math.abs(measured.ankleTwist)<(spec.nativeSourceMotion?22:15),`${name}/${seconds}/${side}: invalid joint frames ${JSON.stringify(measured)}`);
    }
    const state=supportState(kind,name,spec,seconds,side);
    if(impact)assert.ok(['r','l'].some(s=>supportState(kind,name,spec,seconds,s).loaded),`${name}: impact has no supporting foot`);
    if(state.loaded&&!spec.nativeKneeHeading){
     loadedSamples++;retain(worst[kind==='selection'?'selectionMedial':'loadedMedial'],medial,name,seconds,side);
     if(loadedByKind[kind])retain(loadedByKind[kind],medial,name,seconds,side);
     if(impact)retain(impactMedial,medial,name,seconds,side);
     // Report frontal shin tilt without dividing by a near-zero forward offset.
     retain(worst.shinMedialDegrees,Math.atan2(Math.max(0,medial),Math.max(1e-9,shin.y))*degrees,name,seconds,side);
    }else if(!spec.nativeKneeHeading)retain(worst.swingMedial,medial,name,seconds,side);
    retain(worst.lengthError,Math.abs(hip.distanceTo(knee)-lengths[side].thigh),name,seconds,side);
    retain(worst.lengthError,Math.abs(knee.distanceTo(ankle)-lengths[side].shin),name,seconds,side);
    // Captured clips use a distance clock. Compare speeds in playback time,
    // not their arbitrary baked duration. Use the common base travel speed;
    // hero speed bonuses scale the complete animation clock.
    const playbackScale=spec.sourceGait?spec.sourceGait.stride*1.1/((name==='Sprint_Forward'?8:5.6)*duration):1;
    const old=previous[side],dt=old?(seconds-old.seconds)*playbackScale:0;
    if(dt>1e-6){
     retain(worst.kneeSpeed,knee.distanceTo(old.knee)/dt,name,seconds,side);
     retain(worst.ankleSpeed,ankle.distanceTo(old.ankle)/dt,name,seconds,side);
    }
    previous[side]={seconds,knee,ankle};
    if(state.plant!==null){
     const key=side+':'+state.plant;
     plants[key]??={ankle:ankle.clone(),foot:foot.clone()};
     retain(worst.plantDrift,ankle.distanceTo(plants[key].ankle),name,seconds,side);
     retain(worst.plantTurn,foot.angleTo(plants[key].foot),name,seconds,side);
    }
    if(state.toePlant!=null){
     const key=side+':toe:'+state.toePlant;plants[key]??={toe:toe.clone()};
     retain(worst.plantDrift,toe.distanceTo(plants[key].toe),name,seconds,side);
    }
   }
  }
 }
 t.diagnostic(JSON.stringify({hero:hero.model,clips:cases.length,samples,loadedSamples,impactSamples,anatomic,loadedByKind,impactMedial,...worst}));
 assert.ok(loadedSamples>500&&impactSamples>=8,'Sample complete support intervals and exact regular-attack impacts');
 assert.ok(worst.loadedMedial.value<=.020,`Loaded knee collapses inside the foot plane: ${JSON.stringify(worst.loadedMedial)}`);
 // Near-straight selection legs have a small geometric residual. The measured
 // baseline minimum is about1.9cm;2.5cm retains that residual but rejects5–8cm collapse.
 assert.ok(worst.selectionMedial.value<=.025,`Selection knee remains medial: ${JSON.stringify(worst.selectionMedial)}`);
 assert.ok(worst.lengthError.value<=.0001,`Leg solve stretches native segments: ${JSON.stringify(worst.lengthError)}`);
 // The independent baseline's fastest knee is10.57m/s during sprint recovery.
 // These bounds reject ~10cm jumps within one120Hz sample while retaining that
 // fast recovery. They do not excuse loaded alignment errors above.
 assert.ok(worst.kneeSpeed.value<=12,`Knee branch changes abruptly: ${JSON.stringify(worst.kneeSpeed)}`);
 assert.ok(worst.ankleSpeed.value<=12,`Ankle trajectory jumps: ${JSON.stringify(worst.ankleSpeed)}`);
 assert.ok(worst.plantDrift.value<=.003,`Knee correction moves a planted ankle: ${JSON.stringify(worst.plantDrift)}`);
 assert.ok(worst.plantTurn.value<=.020,`Knee correction turns a planted foot: ${JSON.stringify(worst.plantTurn)}`);
});

for(const hero of ['ninja','enemy-guard','enemy-lancer','enemy-skirmisher'])test(`${hero}: both waiting poses keep knees aligned`,async t=>{
 const file=process.env.NINJA_KNEE_MODEL_DIR?path.join(process.env.NINJA_KNEE_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const g=await loadNativeSkin(file),worst=peak();
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 for(const name of ['Idle_Loop','Sword_Idle']){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`${hero} lacks ${name}`);
  g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  for(let frame=0;frame<=Math.ceil(clip.duration*120);frame++){
   const seconds=Math.min(frame/120,clip.duration);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const ankle=point('foot_'+side),forward=point('ball_'+side).sub(ankle).setY(0).normalize();
    const outward=up.clone().cross(forward).multiplyScalar(side==='l'?1:-1);
    retain(worst,-point('calf_'+side).sub(ankle).dot(outward),name,seconds,side);
   }
  }
 }
 t.diagnostic(JSON.stringify({hero,medial:worst}));
 assert.ok(worst.value<=.02,`Enemy waiting pose has inward knees: ${JSON.stringify(worst)}`);
});
