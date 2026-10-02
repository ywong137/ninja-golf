import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeModelDirectory} from '../tools/route-model-directory.mjs';
const selected=process.env.NINJA_COMBAT_LEG_CASES?JSON.parse(fs.readFileSync(process.env.NINJA_COMBAT_LEG_CASES)):null;
const trace=process.env.NINJA_COMBAT_LEG_TRACE==='1';
if(selected&&(!Array.isArray(selected)||!selected.length))throw Error('NINJA_COMBAT_LEG_CASES must name a nonempty JSON array of previously recorded case rows.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await routeModelDirectory(page,process.env.NINJA_MODEL_DIRECTORY);
 await page.goto((process.env.GAME_URL??'http://localhost:5173').replace(/\/$/,'')+'/tests/rig-stage.html');
 const report=await page.evaluate(async({selected,trace})=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,combatMotionName}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js'),{turnToward}=await import('/src/navigation.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs');await loadWarriorAssets();
 const rows=[];
 for(const hero of [0,1,2,3,4,5])for(const turning of hero<=2?[false,true]:[false])for(const hz of [40,120])for(const slope of [0,.10,-.10])for(const movement of [null,0,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['light','heavy'])for(let step=0;step<4;step++){
 if(selected&&!selected.some(c=>c.hero===hero&&c.turning===turning&&c.hz===hz&&c.slope===slope&&c.movement===movement&&c.name===combatMotionName(WARRIORS[hero],kind,step)))continue;
 const w=new Warrior(hero),b=w.bones,saved=[];for(const [bone,rest]of w.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}w.root.updateMatrixWorld(true);const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),name=combatMotionName(WARRIORS[hero],kind,step),spec=motions[name],groundHeight=(x,z)=>slope*(x+z),row={hero,hz,slope,movement,turning,name,hip:0,ankle:0,hinge:0,drift:0,minFlex:180,maxFlex:0};
 if(trace){
  const seed=w.runFootwork.seedContactEntry;
  w.runFootwork.seedContactEntry=function(...args){
   const phase=seed.apply(this,args),planner=this.turnPlanner,fit=planner.fitLanding;
   planner.fitLanding=function(side,end,options){
    const proposed=end.clone(),result=fit.call(this,side,end,options);
    this.feet[side].landingFit={proposed:proposed.toArray(),fitted:result.toArray(),remaining:options.remaining,
     support:options.support,landingHeading:options.heading};
    return result;
   };
   return phase;
  };
 }
 if(spec.planarRoot){if(name!=='Fan_Heavy_Rising')throw Error('Add a root-motion integration case for '+name);w.dispose();continue;}
 for(const[bone,p,q,s]of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}let time=0;for(let i=0;i<30;i++){time+=1/hz;w.update(time,1/hz,{groundHeight});}
 const action={token:Math.random(),kind,step,time:0,duration:spec.duration};const anchors={};row.attackBalanceFrames=0;row.pelvisExtraYaw=0;
 if(trace)row.attackFrames=[];
 while(action.time<spec.duration){action.time+=1/hz;time+=1/hz;const moving=movement!==null,speed=moving?2.5:0;if(moving){w.root.position.x+=Math.sin(movement)*speed/hz;w.root.position.z+=Math.cos(movement)*speed/hz;w.root.position.y=groundHeight(w.root.position.x,w.root.position.z);}
 w.update(time,1/hz,{groundHeight,action,moving,moveSpeed:speed,moveAngle:movement??0});w.root.updateMatrixWorld(true);
 if(moving&&w.legJointBalance?.report?.length===2)row.attackBalanceFrames++;
 row.pelvisExtraYaw=Math.max(row.pelvisExtraYaw,Math.abs(w.attackLocomotion?.report?.pelvisExtraYaw??0));
 if(trace)row.attackFrames.push({time:action.time,balance:w.legJointBalance?.report??null,pelvisYaw:w.attackLocomotion?.report?.pelvisYaw,
  pelvisYawBefore:w.attackLocomotion?.report?.pelvisYawBefore,pelvisExtraYaw:w.attackLocomotion?.report?.pelvisExtraYaw});
 for(const s of ['r','l']){const a=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);row.minFlex=Math.min(row.minFlex,a.kneeFlexion);row.maxFlex=Math.max(row.maxFlex,a.kneeFlexion);row.hinge=Math.max(row.hinge,a.kneeDeviation);if(action.time>.12&&action.time<spec.duration-.04){row.hip=Math.max(row.hip,Math.abs(a.hipTwist));row.ankle=Math.max(row.ankle,Math.abs(a.ankleTwist));}
 if(!moving)for(const[j,[from,to]]of spec.footPlants[s].entries()){if(action.time<Math.max(.12,from+.04)||action.time>to-.04)continue;const p=b['foot_'+s].getWorldPosition(new T.Vector3()),key=s+j;anchors[key]??=p;row.drift=Math.max(row.drift,p.distanceTo(anchors[key]));}
 }
 }
 row.exitHip=0;row.exitAnkle=0;row.exitLoadedAnkle=0;row.exitHinge=0;row.exitFootSpeed=0;
 let body=['pelvis','spine_03'].map(n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize());row.exitPelvisSpeed=0;row.exitChestSpeed=0;
 let pelvisPoint=b.pelvis.getWorldPosition(new T.Vector3());row.exitPelvisLinearSpeed=0;
  let feet=['r','l'].map(side=>b['foot_'+side].getWorldPosition(new T.Vector3()));
  row.exitSoleDrift=0;row.exitFootprintError=0;row.exitRunSupportFrames=0;
  const soleAnchors={};
 if(trace)row.frames=[];
 for(let i=0;i<Math.ceil(hz);i++){
  time+=1/hz;const moving=movement!==null,speed=moving?2.5:0;
  if(moving){w.root.position.x+=Math.sin(movement)*speed/hz;w.root.position.z+=Math.cos(movement)*speed/hz;w.root.position.y=groundHeight(w.root.position.x,w.root.position.z);}
  if(turning&&moving)w.root.rotation.y=turnToward(w.root.rotation.y,movement,18/hz,3*Math.PI/hz);
  // Match the controller: fixed-facing travel is focused, while free travel
  // turns the root. The footprint planner also receives actual root motion.
  const velocity={x:Math.sin(movement??0)*speed,z:Math.cos(movement??0)*speed};
  w.update(time,1/hz,{groundHeight,moving,focused:!turning,moveSpeed:speed,moveAngle:(movement??0)-w.root.rotation.y,
   runPrediction:{source:velocity,wanted:velocity,time:0,duration:.2}});
  const nextBody=['pelvis','spine_03'].map(n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize());
  const bodySpeeds=nextBody.map((q,i)=>q.angleTo(body[i])*hz*180/Math.PI);
  row.exitPelvisSpeed=Math.max(row.exitPelvisSpeed,bodySpeeds[0]);row.exitChestSpeed=Math.max(row.exitChestSpeed,bodySpeeds[1]);body=nextBody;
  const nextPelvis=b.pelvis.getWorldPosition(new T.Vector3());row.exitPelvisLinearSpeed=Math.max(row.exitPelvisLinearSpeed,nextPelvis.distanceTo(pelvisPoint)*hz);pelvisPoint=nextPelvis;
  const next=['r','l'].map(side=>b['foot_'+side].getWorldPosition(new T.Vector3()));
  if(trace){
   const planner=w.runFootwork?.turnPlanner;
   row.frames.push({time:(i+1)/hz,phase:w.runPhase,blend:w.runBlend,root:w.root.position.toArray(),rootYaw:w.root.rotation.y,bodySpeeds,
    attackWeight:w.attackLocomotion?.weight,heading:planner?.heading,actualHeading:w.runFootwork?.previousActualHeading,
    cadence:planner?.cadence,entryLandings:planner?.entryLandings,
    feet:['r','l'].map((side,j)=>({side,p:next[j].toArray(),speed:next[j].distanceTo(feet[j])*hz,
     anatomy:measureLegAnatomy(cal[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]),
     balance:w.legJointBalance?.report?.find(f=>f.side===side),placement:w.footPlacement.report?.feet.find(f=>f.side===side),
     plan:planner?{phase:planner.feet[side].phase,support:planner.feet[side].support,anchor:planner.feet[side].anchor?.toArray(),
      target:planner.feet[side].last?.toArray(),release:planner.feet[side].release,releaseType:planner.feet[side].releaseType,landingFit:planner.feet[side].landingFit,
      flight:planner.feet[side].flight?{start:planner.feet[side].flight.start.toArray(),end:planner.feet[side].flight.end.toArray(),
       departure:planner.feet[side].flight.departure,phase:planner.feet[side].flight.phase,outward:planner.feet[side].flight.outward.toArray(),
       sample:planner.feet[side].flight.sample(planner.feet[side].phase).p.toArray()}:null}:null}))});
  }
  for(let j=0;j<2;j++)row.exitFootSpeed=Math.max(row.exitFootSpeed,next[j].distanceTo(feet[j])*hz);feet=next;
  for(const side of ['r','l']){
   const plan=w.running?w.runFootwork?.turnPlanner?.feet[side]:null;
   const loaded=(w.footPlacement.report?.feet.find(f=>f.side===side)?.weight??0)>.99;
   if(plan?.anchor&&plan.contact!=null&&plan.contactAnchor&&loaded){
    const foot=b['foot_'+side],p=foot.getWorldPosition(new T.Vector3()),q=foot.getWorldQuaternion(new T.Quaternion());
    const sole=w.footPlacement.feet[side].contacts[plan.contact].clone().applyQuaternion(q).add(p);
    const key=side+plan.contact,old=soleAnchors[key];
    if(old?.anchor===plan.anchor)row.exitSoleDrift=Math.max(row.exitSoleDrift,Math.hypot(sole.x-old.p.x,sole.z-old.p.z));
    else soleAnchors[key]={anchor:plan.anchor,p:sole};
    row.exitFootprintError=Math.max(row.exitFootprintError,Math.hypot(sole.x-plan.contactAnchor.x,sole.z-plan.contactAnchor.z));
    row.exitRunSupportFrames++;
   }else for(const key of Object.keys(soleAnchors))if(key.startsWith(side))delete soleAnchors[key];
   const m=measureLegAnatomy(cal[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]);
   row.minFlex=Math.min(row.minFlex,m.kneeFlexion);row.maxFlex=Math.max(row.maxFlex,m.kneeFlexion);
   row.exitHip=Math.max(row.exitHip,Math.abs(m.hipTwist));row.exitAnkle=Math.max(row.exitAnkle,Math.abs(m.ankleTwist));row.exitHinge=Math.max(row.exitHinge,m.kneeDeviation);
   if((w.footPlacement.report?.feet.find(f=>f.side===side)?.weight??0)>.9)row.exitLoadedAnkle=Math.max(row.exitLoadedAnkle,Math.abs(m.ankleTwist));
  }
 }
 rows.push(row);w.dispose();
 }
 return rows;
 },{selected,trace});
 fs.writeFileSync(process.env.NINJA_COMBAT_LEG_REPORT??'/tmp/ninja-combat-leg-frames.json',JSON.stringify({errors,report},null,2));
 assert.deepEqual(errors,[]);assert.equal(report.length,selected?.length??2130);
 for(const row of report){
  assert.ok(row.minFlex>=-.05&&row.maxFlex<160.1,JSON.stringify(row));
  assert.ok(row.hinge<.1&&row.exitHinge<.1,JSON.stringify(row));
  assert.ok(row.exitHip<50&&row.exitAnkle<30&&row.exitLoadedAnkle<20&&row.exitFootSpeed<12,JSON.stringify(row));
  assert.ok(row.exitSoleDrift<.012&&row.exitFootprintError<.012,JSON.stringify(row));
  if(row.movement!==null){
   assert.ok(row.attackBalanceFrames>0,'Moving attacks skipped the shared joint correction: '+JSON.stringify(row));
   assert.ok(row.exitRunSupportFrames>0,'The recovery never exercised a supporting running foot: '+JSON.stringify(row));
  }
  assert.ok(row.hip<50&&row.ankle<22,JSON.stringify(row));
  if(row.hero===2){
   assert.ok(row.exitPelvisLinearSpeed<3.5,JSON.stringify(row));
   if(!row.turning)assert.ok(row.exitPelvisSpeed<500&&row.exitChestSpeed<500,JSON.stringify(row));
  }
  if(row.movement===null)assert.ok(row.drift<.004,JSON.stringify(row));
 }
 console.log(JSON.stringify({cases:report.length,maxHip:Math.max(...report.map(r=>r.hip)),maxAnkle:Math.max(...report.map(r=>r.ankle)),maxKneeSidebend:Math.max(...report.map(r=>r.hinge)),maxPlantDrift:Math.max(...report.map(r=>r.drift)),exitHip:Math.max(...report.map(r=>r.exitHip)),exitAnkle:Math.max(...report.map(r=>r.exitAnkle)),exitLoadedAnkle:Math.max(...report.map(r=>r.exitLoadedAnkle)),exitFootSpeed:Math.max(...report.map(r=>r.exitFootSpeed))}));
}finally{await browser.close();}
