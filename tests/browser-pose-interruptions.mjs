import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeFixedGripCandidate} from '../tools/ronin-candidates/fixed-grip/route.mjs';

// Exercise the real actor and every hero asset. This checks mixture ownership,
// not whether the authored choreography is visually acceptable.
const candidate=process.env.NINJA_CAPTURED_RUN_DIR;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await disableHmr(page);
 if(candidate)await routeFixedGripCandidate(page,candidate,{withDiagonal:true,withGuards:true,withReturn:true});
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async()=>{
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {motions,combatMotionName}=await import('/src/motion.js');
  await loadWarriorAssets();const rows=[];
  for(let hero=0;hero<WARRIORS.length;hero++)for(const hz of [40,120])for(const delay of [.025,.075]){
   const actor=new Warrior(hero),dt=1/hz,row={hero:WARRIORS[hero].model,hz,delay,maxWeightError:0,worst:null,stages:[]};let time=0;
   const stages=[
    ['run',delay,{moving:true,moveSpeed:5.6}],
    ['moving guard',delay,{blocking:true,moving:true,focused:true,moveAngle:Math.PI/4,moveSpeed:2.3}],
    ['guard impact',delay,{blocking:true,guardHitToken:1}],
    ['guard recovery',.45,{blocking:true}],
    ['moving guard again',delay,{blocking:true,moving:true,moveAngle:-Math.PI/4,moveSpeed:2.3}],
    ['light attack',delay,{action:{token:1,kind:'light',step:0,duration:motions[combatMotionName(WARRIORS[hero],'light',0)].duration,time:0}}],
    ['heavy attack',delay,{action:{token:2,kind:'heavy',step:0,duration:motions[combatMotionName(WARRIORS[hero],'heavy',0)].duration,time:0}}],
    ['guard cancel',delay,{blocking:true}],
    ['guard walk cancel',delay,{blocking:true,moving:true,moveAngle:Math.PI/2,moveSpeed:2.3}],
    ['run recovery',.5,{moving:true,moveSpeed:5.6}],
    ['standing guard',.3,{blocking:true}],
    ['ready',.4,{}],
   ];
   for(const [stage,seconds,options]of stages){
    for(let frame=0;frame<Math.ceil(seconds*hz);frame++){
     time+=dt;
     actor.update(time,dt,options);
     const active=[...new Set([...actor.actions.values(),...(actor.repeatActions?.values()??[])])].filter(a=>a.isScheduled()&&a.enabled);
     const weight=active.reduce((sum,a)=>sum+a.getEffectiveWeight(),0),error=Math.abs(weight-1);
     if(error>row.maxWeightError){row.maxWeightError=error;row.worst={stage,time,clip:actor.current,weight,active:active.map(a=>({clip:a.getClip().name,weight:a.getEffectiveWeight()}))};}
     if(actor.guardWalking&&actor.poseFade)row.competingOwners=true;
    }
    const expected=stage.includes('moving guard')||stage==='guard walk cancel'?/_Guard_Walk_/:
     stage==='guard impact'?/_Guard_Impact$/:
     ['guard recovery','guard cancel','standing guard'].includes(stage)?/_Guard_Loop$/:
     stage.includes('run')?/^Run_/:
     stage==='light attack'?combatMotionName(WARRIORS[hero],'light',0):
     stage==='heavy attack'?combatMotionName(WARRIORS[hero],'heavy',0):WARRIORS[hero].readyClip;
    const reached=typeof expected==='string'?actor.current===expected:expected.test(actor.current);
    row.stages.push({stage,clip:actor.current,reached});
   }
   row.finalClips=[...actor.actions.values()].filter(a=>a.isScheduled()&&a.getEffectiveWeight()>1e-8).map(a=>a.getClip().name);
   row.scheduledClips=[...new Set([...actor.actions.values(),...(actor.repeatActions?.values()??[])])].filter(a=>a.isScheduled()).map(a=>a.getClip().name);
   row.expectedReady=WARRIORS[hero].readyClip;actor.dispose();rows.push(row);
  }
  return rows;
 });
 const failures=rows.filter(row=>row.maxWeightError>1e-5||row.competingOwners||row.finalClips.length!==1||row.finalClips[0]!==row.expectedReady||row.scheduledClips.length!==1||row.stages.some(stage=>!stage.reached));
 const output=process.env.NINJA_POSE_REPORT??'/tmp/ninja-pose-interruptions.json';
 fs.writeFileSync(output,JSON.stringify({candidate,rows,failures,errors},null,2));
 console.log(JSON.stringify({cases:rows.length,failures:failures.map(({stages,...row})=>row),errors,output},null,2));
 assert.deepEqual(errors,[]);assert.equal(failures.length,0,'Pose interruptions must retain one complete mixture with one owner.');
}finally{await browser.close();}
