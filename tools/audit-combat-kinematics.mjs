// Measure the native pose, runtime arm layers, and final visible weapon separately.
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
import {routeMotionCandidate} from './route-motion-candidate.mjs';

const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('node tools/audit-combat-kinematics.mjs [--hero 0..5] [--kind light|heavy] [--step 0..3] [--output FILE.json]\nCandidate: --model FILE.glb --motion-record FILE.json --replace-clip ORIGINAL_NAME [--ready-record FILE.json]\nMeasures every 1/240 second from ready, running, and guard. Includes recovery. No renderer or audio.');process.exit(0);
}
let hero=0,kind='heavy',step=0,output='/tmp/ninja-combat-kinematics.json',model=null,motionRecord=null,replaceClip=null,readyRecord=null;
while(args.length){const key=args.shift(),value=args.shift();
 if(key==='--hero'&&/^[0-5]$/.test(value))hero=Number(value);
 else if(key==='--kind'&&['light','heavy'].includes(value))kind=value;
 else if(key==='--step'&&/^[0-3]$/.test(value))step=Number(value);
 else if(key==='--output'&&value)output=value;
 else if(key==='--model'&&value)model=value;
 else if(key==='--motion-record'&&value)motionRecord=value;
 else if(key==='--replace-clip'&&value)replaceClip=value;else if(key==='--ready-record'&&value)readyRecord=value;
 else throw Error('Invalid option. See --help.');
}
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await disableHmr(page);await routeMotionCandidate(page,{hero,model,motionRecord,replaceClip,readyRecord});
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async({hero,kind,step})=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {combatMotionName,motions}=await import('/src/motion.js');
  const {ATTACKS}=await import('/src/combat.js');await loadWarriorAssets();
  const name=combatMotionName(WARRIORS[hero],kind,step),spec=motions[name],definition=ATTACKS[kind][step];
  const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),degrees=180/Math.PI;
  const report={hero,clip:name,duration:definition.duration,hitTimes:definition.hits,nativeAttachment:!!spec.nativeAttachment,scenarios:[]};
  for(const source of ['ready','run','guard'])for(const moving of [false,true]){
   const actor=new Warrior(hero),pos=bone=>bone.getWorldPosition(V()),rot=bone=>bone.getWorldQuaternion(Q()).normalize();
   const snapshot=()=>{
    actor.root.updateMatrixWorld(true);const joints={},rotations={};
    for(const name of ['pelvis','spine_01','spine_03','upperarm_r','lowerarm_r','hand_r','middle_01_r','upperarm_l','lowerarm_l','hand_l','middle_01_l','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'])joints[name]=pos(actor.bones[name]).toArray();
    for(const name of ['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'])rotations[name]=rot(actor.bones[name]).toArray();
    const hands={};
    for(const side of ['r','l']){
     const hand=actor.bones['hand_'+side],lower=actor.bones['lowerarm_'+side],upper=actor.bones['upperarm_'+side];
     const forearm=pos(hand).sub(pos(lower)).normalize(),metacarpal=pos(actor.bones['middle_01_'+side]).sub(pos(hand)).normalize();
     const neutral=rot(lower).multiply(actor.neutralHandRotations[side]).normalize();
     hands[side]={worldRotation:rot(hand).toArray(),wristNeutralDegrees:neutral.angleTo(rot(hand))*degrees,metacarpalBendDegrees:forearm.angleTo(metacarpal)*degrees,elbowFlexionDegrees:pos(lower).sub(pos(upper)).angleTo(forearm)*degrees};
    }
    return{joints,hands,rotations};
   };
   for(let i=0;i<90;i++)actor.update(i/60,1/60,source==='run'?{moving:true,moveSpeed:5.6,groundHeight:()=>0}:source==='guard'?{blocking:true,groundHeight:()=>0}:{groundHeight:()=>0});
   let native=null,beforeGrip=null,previousNative=null,previousRuntime=null;
   report.attachmentFrames??=Object.fromEntries(['r','l'].map(side=>[side,actor.handGrip.active[side].frame.toArray()]));
   const mixerUpdate=actor.mixer.update.bind(actor.mixer);actor.mixer.update=dt=>{const result=mixerUpdate(dt);native=snapshot();return result;};
   const syncHeldObjects=actor.syncHeldObjects.bind(actor);actor.syncHeldObjects=(...args)=>{beforeGrip=snapshot();return syncHeldObjects(...args);};
   const attack={...definition,kind,step,token:1,time:0},samples=[],blade=actor.weapon.getObjectByName('Flat steel blade');
   if(!blade?.geometry.attributes.position)throw Error('Cannot measure visible blade geometry.');
   const priorRotation=rot(actor.weapon),scenario={source,moving,samples,maximums:{nativeWristR:0,nativeWristL:0,runtimeWristR:0,runtimeWristL:0,nativeBendR:0,nativeBendL:0,runtimeBendR:0,runtimeBendL:0,gripWristCorrectionR:0,gripWristCorrectionL:0,elbowDisplacement:0,wristDisplacement:0,palmGap:0,secondaryGap:0,weaponFrameTurn:0,nativeArmFrameTurn:0,runtimeArmFrameTurn:0},minimumBladeHeight:Infinity};
   const points=blade.geometry.attributes.position;
   for(let frame=0;frame<=Math.ceil((definition.duration+.22)*240);frame++){
    const time=frame/240,active=time<definition.duration;attack.time=time;
    actor.update(2+time,1/240,{action:active?attack:null,moving,moveSpeed:moving?5.6:0,groundHeight:()=>0});
    const runtime=snapshot(),corrections={},armFrameTurns={native:{},runtime:{}};let bladeHeight=Infinity;
    if(previousNative)for(const bone of Object.keys(native.rotations)){
     armFrameTurns.native[bone]=Q().fromArray(previousNative.rotations[bone]).angleTo(Q().fromArray(native.rotations[bone]))*degrees;
     armFrameTurns.runtime[bone]=Q().fromArray(previousRuntime.rotations[bone]).angleTo(Q().fromArray(runtime.rotations[bone]))*degrees;
     if(active){scenario.maximums.nativeArmFrameTurn=Math.max(scenario.maximums.nativeArmFrameTurn,armFrameTurns.native[bone]);scenario.maximums.runtimeArmFrameTurn=Math.max(scenario.maximums.runtimeArmFrameTurn,armFrameTurns.runtime[bone]);}
    }
    previousNative=native;previousRuntime=runtime;
    for(let i=0;i<points.count;i++)bladeHeight=Math.min(bladeHeight,blade.localToWorld(V().fromBufferAttribute(points,i)).y);
    const primary=actor.bones.hand_r.localToWorld(actor.handGrip.active.r.center.clone());
    const station=actor.weapon.userData.primaryGrip,palmGap=primary.distanceTo(actor.weapon.localToWorld(new T.Vector3(0,station,0)));
    const secondary=actor.bones.hand_l.localToWorld(actor.handGrip.active.l.center.clone());
    const secondaryGap=spec.twoHanded?secondary.distanceTo(actor.weapon.localToWorld(new T.Vector3(0,station-spec.gripSpacing,0))):null;
    const weaponRotation=rot(actor.weapon),weaponFrameTurn=priorRotation.angleTo(weaponRotation)*degrees;priorRotation.copy(weaponRotation);
    for(const side of ['r','l']){
     const hand='hand_'+side,elbow='lowerarm_'+side;
     corrections[side]={wristRotationDegrees:Q().fromArray(beforeGrip.hands[side].worldRotation).angleTo(Q().fromArray(runtime.hands[side].worldRotation))*degrees,
      elbowDisplacement:V().fromArray(beforeGrip.joints[elbow]).distanceTo(V().fromArray(runtime.joints[elbow])),
      wristDisplacement:V().fromArray(beforeGrip.joints[hand]).distanceTo(V().fromArray(runtime.joints[hand]))};
     if(active){const suffix=side.toUpperCase(),max=scenario.maximums;
      max['nativeWrist'+suffix]=Math.max(max['nativeWrist'+suffix],native.hands[side].wristNeutralDegrees);
      max['runtimeWrist'+suffix]=Math.max(max['runtimeWrist'+suffix],runtime.hands[side].wristNeutralDegrees);
      max['nativeBend'+suffix]=Math.max(max['nativeBend'+suffix],native.hands[side].metacarpalBendDegrees);
      max['runtimeBend'+suffix]=Math.max(max['runtimeBend'+suffix],runtime.hands[side].metacarpalBendDegrees);
      max['gripWristCorrection'+suffix]=Math.max(max['gripWristCorrection'+suffix],corrections[side].wristRotationDegrees);
      max.elbowDisplacement=Math.max(max.elbowDisplacement,corrections[side].elbowDisplacement);
      max.wristDisplacement=Math.max(max.wristDisplacement,corrections[side].wristDisplacement);
     }
    }
    if(active){scenario.minimumBladeHeight=Math.min(scenario.minimumBladeHeight,bladeHeight);scenario.maximums.palmGap=Math.max(scenario.maximums.palmGap,palmGap);scenario.maximums.weaponFrameTurn=Math.max(scenario.maximums.weaponFrameTurn,weaponFrameTurn);
     if(actor.handGrip.secondaryWeight>.999&&secondaryGap!==null)scenario.maximums.secondaryGap=Math.max(scenario.maximums.secondaryGap,secondaryGap);
    }
    samples.push({time,active,clipTime:actor.actions.get(name).time,current:actor.current,native,beforeGrip,runtime,corrections,bladeHeight,palmGap,secondaryGap,secondaryWeight:actor.handGrip.secondaryWeight,weaponFrameTurn,armFrameTurns,feet:structuredClone(actor.footPlacement.report)});
   }
   report.scenarios.push(scenario);actor.dispose();
  }
  return report;
 },{hero,kind,step});
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(output,JSON.stringify(report));
 console.log(JSON.stringify({...report,scenarios:report.scenarios.map(({samples,...scenario})=>scenario),output},null,2));
}finally{await browser.close();}
