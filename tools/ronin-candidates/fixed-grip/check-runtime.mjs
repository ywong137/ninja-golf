import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from '../../disable-hmr.mjs';
import {routeFixedGripCandidate} from './route.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},rate:{type:'string',default:'144'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-runtime.mjs --candidate DIRECTORY [--rate 60|144|480]\nRequires Vite on localhost:5173. Checks one attack and recovery in the actual controller. Chrome runs headlessly with audio muted.');process.exit(0);}
const rate=Number(values.rate);
if(!values.candidate||![60,144,480].includes(rate))throw Error('Supply --candidate DIRECTORY and a valid --rate. See --help.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage();await disableHmr(page);
 const profiles=await routeFixedGripCandidate(page,values.candidate);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async ({profiles,rate})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),{attackDefinition}=await import('/src/combat.js');
  const {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations}=await import('/tools/native-arm-anatomy.mjs');
  const {skinGroups,measureArmSkin}=await import('/tests/native-skin-helper.mjs');
  const {handSurface,measureGripSurface}=await import('/tools/grip-contact.mjs');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const bind=await new GLTFLoader().loadAsync('/models/ronin.glb?bind-calibration'),bindBones={};bind.scene.traverse(o=>{if(o.isBone)bindBones[o.name]=o});
  const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bindBones,s))]));
  await loadWarriorAssets();const actor=new Warrior(0),g={scene:actor.model},bones=actor.bones;
  const surfaces=skinGroups(g),hands=Object.fromEntries(['r','l'].map(s=>[s,handSurface(actor.model,s)]));
  for(let i=0;i<30;i++)actor.update(i/60,1/60,{groundHeight:()=>0});
  const action={...attackDefinition('heavy',0,WARRIORS[0].combatStyle),kind:'heavy',step:0,token:1,time:0};actor.update(1,0,{action,groundHeight:()=>0});
  const report={rate,samples:0,violations:[],crossings:[],maxGripDepth:0,maxFittingDepth:0,maxPalmGap:0,maxFrameError:0,maxShoulderWeight:0};let time=0;
  for(let i=0;i<=rate;i++){
   const t=i/rate,dt=t-time;time=t;action.time=t;actor.update(1+t,dt,{action:t<.76?action:null,groundHeight:()=>0});actor.root.updateMatrixWorld(true);
   const frame=actor.weapon.getWorldQuaternion(new T.Quaternion()).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),palms=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].localToWorld(new T.Vector3().fromArray(profiles.ronin.sword[s].center))]));
   report.maxPalmGap=Math.max(report.maxPalmGap,palms.l.distanceTo(palms.r.clone().addScaledVector(shaft,-.12*actor.root.scale.x)));
   for(const s of ['r','l']){
    const bad=armAuthoringViolations(measureArmAnatomy(cal[s],captureArmPose(bones,s)),{maxHingeDeviationDegrees:.1});if(bad.length)report.violations.push({t,side:s,bad});
    const skin=measureArmSkin(g,surfaces,s),hits=Object.values(skin).reduce((n,r)=>n+r.pairs,0);if(hits)report.crossings.push({t,side:s,hits});
    const grip=measureGripSurface(hands[s],actor.weapon,.014);report.maxGripDepth=Math.max(report.maxGripDepth,grip.maxPenetration);report.maxFittingDepth=Math.max(report.maxFittingDepth,grip.fittingPenetration);
    report.maxFrameError=Math.max(report.maxFrameError,bones['hand_'+s].getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(profiles.ronin.sword[s].frame)).normalize().angleTo(frame)*180/Math.PI);
   }
   report.maxShoulderWeight=Math.max(report.maxShoulderWeight,actor.forearmTwist.report.upperArmWeight);report.samples++;
  }
  report.finalClip=actor.current;actor.dispose();return report;
 },{profiles,rate});
 fs.writeFileSync(path.join(values.candidate,`runtime-${rate}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,violations:report.violations.slice(0,3),violationCount:report.violations.length,crossings:report.crossings.slice(0,3),crossingCount:report.crossings.length}));
 assert.equal(report.finalClip,'Ronin_Ready','The attack did not return to Ready.');
 assert.equal(report.violations.length,0,'The runtime arm bounds failed. Inspect the report.');
 assert.equal(report.crossings.length,0,'The runtime skin intersects. Inspect the report.');
 assert.ok(report.maxGripDepth<.0015&&report.maxFittingDepth===0,'The grip crosses the handle surface or fittings.');
 assert.ok(report.maxPalmGap<.00025&&report.maxFrameError<.04,'The transition distorts the complete hand grip.');
}finally{await browser.close();}
