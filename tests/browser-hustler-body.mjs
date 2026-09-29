import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeMotionCandidate} from '../tools/route-motion-candidate.mjs';

// Native clip clearance alone misses contacts introduced by the running carry
// transition. Inspect the actual skinned head and blade after every overlay.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 if(process.env.HUSTLER_BODY_MODEL)await routeMotionCandidate(page,{hero:4,model:process.env.HUSTLER_BODY_MODEL,motionRecord:process.env.HUSTLER_BODY_RECORDS,replaceClip:'Ring_Heavy_Cleave'});
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{attackDefinition}=await import('/src/combat.js');
  const {headSurfaceMetadata,measureBladeHeadClearance}=await import('/tools/blade-head-surface.mjs');await loadWarriorAssets();
  const reports=[],rate=240,dt=1/rate;
  const entries=[{source:'idle'},{source:'guard'},{source:'repeat'},...[0,Math.PI/2,Math.PI,-Math.PI/2].flatMap(angle=>[.55,.8,1.05].map(runTime=>({source:'run',angle,runTime})))];
  for(const entry of entries){
   const p=new Warrior(4),surfaces=headSurfaceMetadata({scene:p.model}),definition=attackDefinition('heavy',0,'ring');
   for(let frame=0;frame<Math.ceil((entry.runTime??.5)*rate);frame++)p.update(frame*dt,dt,entry.source==='guard'?{blocking:true}:entry.source==='run'?{moving:true,moveSpeed:5.6,moveAngle:entry.angle}:{});
   if(entry.source==='repeat'){p.play('Ring_Heavy_Cleave',0,true);p.actions.get(p.current).time=definition.duration*.4;p.mixer.update(0);p.syncHeldObjects();}
   const action={...definition,kind:'heavy',step:0,token:1,time:0},row={...entry,samples:0,crossings:0,minimumClearance:.03,maxPalmGap:0,maxArmStep120:0,maxWrist:0,closest:null};
   const previous={};
   for(let frame=0;frame<=Math.ceil(definition.duration*rate);frame++){
    action.time=frame*dt;p.update(2+action.time,dt,{action});p.root.updateMatrixWorld(true);row.samples++;
    const contact=measureBladeHeadClearance(surfaces,{r:p.weapon});row.crossings+=contact.crossings;
    if(contact.minimumClearance<row.minimumClearance){row.minimumClearance=contact.minimumClearance;row.closest={time:action.time,...contact.closest};}
    const palm=p.bones.hand_r.localToWorld(p.palmGrips.r.clone());row.maxPalmGap=Math.max(row.maxPalmGap,palm.distanceTo(p.weapon.localToWorld(new T.Vector3(0,p.weapon.userData.primaryGrip,0))));
    for(const side of ['r','l']){
     row.maxWrist=Math.max(row.maxWrist,p.bones['hand_'+side].quaternion.clone().normalize().angleTo(p.neutralHandRotations[side].clone().normalize())*180/Math.PI);
     for(const prefix of ['upperarm_','lowerarm_','hand_']){
      const name=prefix+side,q=p.bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
      if(previous[name])row.maxArmStep120=Math.max(row.maxArmStep120,previous[name].angleTo(q)*180/Math.PI/dt/120);
      previous[name]=q;
     }
    }
   }
   reports.push(row);p.dispose();
  }
  return reports;
 });
 fs.writeFileSync('/tmp/ninja-hustler-runtime-body.json',JSON.stringify(reports,null,2));assert.deepEqual(errors,[]);
 for(const row of reports){const context=JSON.stringify(row);assert.equal(row.crossings,0,context);assert.ok(row.minimumClearance>.005,context);assert.ok(row.maxPalmGap<1e-6,context);assert.ok(row.maxWrist<20,context);assert.ok(row.maxArmStep120<20,context);}
 console.log(JSON.stringify({cases:reports.length,samples:reports.reduce((n,r)=>n+r.samples,0),minimumClearance:Math.min(...reports.map(r=>r.minimumClearance)),maxWrist:Math.max(...reports.map(r=>r.maxWrist)),maxArmStep120:Math.max(...reports.map(r=>r.maxArmStep120))}));
}finally{await browser.close();}
