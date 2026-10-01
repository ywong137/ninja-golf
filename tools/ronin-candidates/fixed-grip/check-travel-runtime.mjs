import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from '../../disable-hmr.mjs';
import {routeFixedGripCandidate} from './route.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},rate:{type:'string',default:'144'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-travel-runtime.mjs --candidate DIRECTORY [--rate 45|60|144]\nRequires a candidate with guards.json and diagonal.json, and Vite on localhost:5173. Checks paired runs and their attack transitions through Warrior.update. Chrome runs headlessly with audio muted.');process.exit(0);}
const rate=Number(values.rate);if(!values.candidate||![45,60,144].includes(rate))throw Error('Supply --candidate DIRECTORY and a supported --rate. See --help.');
if(!fs.existsSync(path.join(values.candidate,'travel.json')))throw Error('Missing travel.json. Build the paired-travel candidate first.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await routeFixedGripCandidate(page,values.candidate,{withDiagonal:true,withGuards:true});await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async({rate})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{attackDefinition}=await import('/src/combat.js'),{WARRIORS}=await import('/src/warriors.js'),{handSurface,measureGripSurface}=await import('/tools/grip-contact.mjs');await loadWarriorAssets();
  const {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations}=await import('/tools/native-arm-anatomy.mjs');
  const {skinGroups,measureArmSkin}=await import('/tests/native-skin-helper.mjs');
  const {measureBladeHeadClearance}=await import('/tools/blade-head-surface.mjs');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const bind=await new GLTFLoader().loadAsync('/models/ronin.glb?bind-calibration'),bindBones={};bind.scene.traverse(o=>{if(o.isBone)bindBones[o.name]=o});
  const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bindBones,s))]));
  const rows=[],dt=1/rate;
  for(const source of ['forward','backward','left','right','diagonal','sprint','turn'])for(const kind of ['light','heavy']){
   const actor=new Warrior(0),hands=Object.fromEntries(['r','l'].map(s=>[s,handSurface(actor.model,s)]));let time=0;
   const g={scene:actor.model},surfaces=skinGroups(g),body=[];
   actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const index=mesh.geometry.index,triangles=[];for(let i=0;i<(index?index.count:mesh.geometry.attributes.position.count);i+=3)triangles.push([0,1,2].map(k=>index?index.getX(i+k):i+k));body.push({mesh,triangles});});
   const angle={forward:0,backward:Math.PI,left:-Math.PI/2,right:Math.PI/2,diagonal:Math.PI/4}[source]??0;
   const step=options=>{time+=dt;actor.update(time,dt,{groundHeight:()=>0,...options});};
   for(let i=0;i<Math.ceil(.5*rate);i++)step({});
   const row={source,kind,maxGap:0,maxFrameError:0,maxGripDepth:0,maxFittingDepth:0,minBladeClearance:.03,violations:[],crossings:[],worst:null};
   function measure(stage,t){actor.root.updateMatrixWorld(true);
    const frame=actor.weapon.getWorldQuaternion(new T.Quaternion()).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),palms={};let frameError=0;
    for(const s of ['r','l']){
     const grip=actor.handGrip.active[s];palms[s]=actor.bones['hand_'+s].localToWorld(grip.center.clone());
     frameError=Math.max(frameError,actor.bones['hand_'+s].getWorldQuaternion(new T.Quaternion()).normalize().multiply(grip.frame).normalize().angleTo(frame)*180/Math.PI);
     const contact=measureGripSurface(hands[s],actor.weapon,.014);row.maxGripDepth=Math.max(row.maxGripDepth,contact.maxPenetration);row.maxFittingDepth=Math.max(row.maxFittingDepth,contact.fittingPenetration);
     const bad=armAuthoringViolations(measureArmAnatomy(cal[s],captureArmPose(actor.bones,s)),{maxHingeDeviationDegrees:.1});if(bad.length)row.violations.push({stage,t,side:s,bad});
     const hits=Object.values(measureArmSkin(g,surfaces,s)).reduce((n,r)=>n+r.pairs,0);if(hits)row.crossings.push({stage,t,side:s,hits});
    }
    const gap=palms.l.distanceTo(palms.r.clone().addScaledVector(shaft,-.12*actor.root.scale.x))/actor.root.scale.x;
    if(gap>row.maxGap){row.maxGap=gap;row.worst={stage,time:t,frameError};}row.maxFrameError=Math.max(row.maxFrameError,frameError);
    row.minBladeClearance=Math.min(row.minBladeClearance,measureBladeHeadClearance(body,{r:actor.weapon},{distanceCap:.03}).minimumClearance);
   }
   const running=i=>({moving:true,sprinting:source==='sprint',moveSpeed:source==='sprint'?8:5.6,moveAngle:source==='turn'?i/rate*Math.PI:angle});
   for(let i=0;i<Math.ceil(1*rate);i++){step(running(i));measure('run',i*dt);}
   const from=actor.current,action={...attackDefinition(kind,0,WARRIORS[0].combatStyle),kind,step:0,token:1,time:0};
   actor.update(time,0,{action,groundHeight:()=>0});
   Object.assign(row,{from,to:actor.current,blended:!!actor.heldBlend,continuedArms:!!actor.armContinuation?.active});
   for(let i=0;i<=Math.ceil((action.duration+.3)*rate);i++){
    action.time=i*dt;if(i)step({action:action.time<action.duration?action:null});actor.root.updateMatrixWorld(true);
    measure('attack',action.time);
   }
   for(let i=0;i<Math.ceil(.45*rate);i++){step(running(i));measure('resume-run',i*dt);}
   for(let i=0;i<Math.ceil(.3*rate);i++){step({});measure('stop',i*dt);}
   row.finalClip=actor.current;actor.dispose();rows.push(row);
  }
  return rows;
 },{rate});
 fs.writeFileSync(path.join(values.candidate,`run-entry-${rate}.json`),JSON.stringify({rate,rows,errors},null,2));console.log(JSON.stringify({rate,cases:rows.length,errors,maxGap:Math.max(...rows.map(r=>r.maxGap)),maxFrameError:Math.max(...rows.map(r=>r.maxFrameError)),violations:rows.flatMap(r=>r.violations).slice(0,3),crossings:rows.flatMap(r=>r.crossings).slice(0,3)}));
 assert.deepEqual(errors,[]);
 for(const row of rows){
  assert.equal(row.to,row.kind==='light'?'Ronin_Cut_Diagonal':'Ronin_Heavy_Cleave');
  assert.equal(row.finalClip,'Ronin_Ready');
  assert.equal(row.blended,true,'Run body must retain its transition.');
  assert.equal(row.continuedArms,true,'Matching paired arms must continue together.');
  assert.deepEqual(row.violations,[],'Run transition exceeds native arm limits.');
  assert.deepEqual(row.crossings,[],'Run transition crosses arm/torso surfaces.');
  assert.ok(row.minBladeClearance>=.0299,'Blade approaches the body.');
  assert.ok(row.maxGripDepth<.0015&&row.maxFittingDepth===0,'Grip intersects the handle or fittings.');
  assert.ok(row.maxGap<.00025&&row.maxFrameError<.04,'Run transition breaks the complete grip.');
 }
}finally{await browser.close();}
