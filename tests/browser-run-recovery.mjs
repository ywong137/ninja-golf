import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js');
  const {measureLegAnatomy}=await import('/src/leg-anatomy.js');await loadWarriorAssets();
  const position=b=>b.getWorldPosition(new T.Vector3()),rotation=b=>b.getWorldQuaternion(new T.Quaternion()).normalize(),rows=[];
  const cases=[{angle:0,sprint:false,focused:false},{angle:0,sprint:true,focused:false},...[0,1,2,3,4,5,6,7].map(i=>({angle:i*Math.PI/4,sprint:false,focused:true}))].map(c=>({...c,slope:0,rate:120}));
  for(const rate of [40,60])for(const slope of [-.1,.1])for(const sprint of [false,true])cases.push({angle:0,sprint,focused:false,slope,rate});
  for(let hero=0;hero<6;hero++)for(const c of cases){
   const p=new Warrior(hero),speed=(c.sprint?8:c.focused?5.3:5.6)*WARRIORS[hero].speed,dt=1/c.rate;
   const ground=(x,z)=>c.slope*z,travel=new T.Vector3(Math.sin(c.angle),0,Math.cos(c.angle));
   const row={hero:WARRIORS[hero].model,...c,hinge:0,hip:0,ankleTwist:0,freePitch:0,freeOffPitch:0,supportDrift:0,shoeSpeed:0,kneeSpeed:0,minimumFlex:Infinity,maximumFlex:0,minimumClearance:Infinity,freeSamples:0,worst:{}};
   const holds={},previous={};
   for(let i=0;i<c.rate*2;i++){
    p.root.position.addScaledVector(travel,speed*dt);p.root.position.y=ground(p.root.position.x,p.root.position.z);
    p.update(i*dt,dt,{moving:true,sprinting:c.sprint,focused:c.focused,moveAngle:c.angle,moveSpeed:speed,groundHeight:ground});p.root.updateMatrixWorld(true);
    if(i<c.rate/2)continue;
    for(const side of ['r','l']){
     const phase=(p.runPhase+(side==='r'?0:.5))%1,thigh=p.bones['thigh_'+side],calf=p.bones['calf_'+side],foot=p.bones['foot_'+side];
     const m=measureLegAnatomy(p.runFootwork.anatomy[side],thigh,calf,foot),ankle=position(foot),shoe=rotation(foot);
     const axis=ankle.clone().sub(position(thigh)),bend=position(calf).sub(position(thigh));bend.addScaledVector(axis,-bend.dot(axis)/axis.lengthSq()).normalize();
     row.minimumFlex=Math.min(row.minimumFlex,m.kneeFlexion);row.maximumFlex=Math.max(row.maximumFlex,m.kneeFlexion);
     const values={hinge:m.kneeDeviation,hip:Math.abs(m.hipTwist),ankleTwist:Math.abs(m.ankleTwist)};
     if(phase>=.44&&phase<=.82){Object.assign(values,{freePitch:Math.abs(m.anklePitch),freeOffPitch:m.ankleOffPitch});row.freeSamples++;}
     if(phase>.04&&phase<.24){holds[side]??=ankle.clone();row.supportDrift=Math.max(row.supportDrift,ankle.distanceTo(holds[side]));}else holds[side]=null;
     if(previous[side]){values.shoeSpeed=shoe.angleTo(previous[side].shoe)/dt;values.kneeSpeed=bend.angleTo(previous[side].bend)/dt;}
     previous[side]={shoe,bend};
     for(const contact of p.footPlacement.feet[side].contacts){const v=contact.clone().applyQuaternion(shoe).add(ankle);row.minimumClearance=Math.min(row.minimumClearance,v.y-ground(v.x,v.z));}
     for(const[k,v]of Object.entries(values))if(v>row[k]){row[k]=v;row.worst[k]={phase,side,...m};}
    }
   }
   rows.push(row);p.dispose();
  }return rows;
 });
 // A finite-difference convergence check detects one-frame direction flips.
 // Fixed human-speed guesses cannot distinguish those from a fast sprint.
 const sampleContinuity=async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),rows=[];await loadWarriorAssets();
  for(let hero=0;hero<6;hero++)for(const samples of [240,960]){
   const p=new Warrior(hero),speed=8*WARRIORS[hero].speed,options={moving:true,sprinting:true,moveSpeed:speed,groundHeight:()=>0};
   for(let i=0;i<120;i++)p.update(i/60,1/60,options);
   const row={hero:WARRIORS[hero].model,samples,shoe:0,calf:0,knee:0,position:0},previous={};
   for(let i=0;i<=samples;i++){
    p.runPhase=i/samples;p.update(2,0,options);p.root.updateMatrixWorld(true);
    for(const side of ['r','l']){
     const foot=p.bones['foot_'+side],calf=p.bones['calf_'+side],thigh=p.bones['thigh_'+side],shoe=foot.getWorldQuaternion(new T.Quaternion()).normalize();
     const calfQ=calf.getWorldQuaternion(new T.Quaternion()).normalize();
     const hip=thigh.getWorldPosition(new T.Vector3()),ankle=foot.getWorldPosition(new T.Vector3()),knee=calf.getWorldPosition(new T.Vector3());
     const axis=ankle.clone().sub(hip),bend=knee.clone().sub(hip);bend.addScaledVector(axis,-bend.dot(axis)/axis.lengthSq()).normalize();
     if(previous[side]){
      row.calf=Math.max(row.calf,calfQ.angleTo(previous[side].calfQ)*samples);
      row.shoe=Math.max(row.shoe,shoe.angleTo(previous[side].shoe)*samples);
      row.knee=Math.max(row.knee,bend.angleTo(previous[side].bend)*samples);
      row.position=Math.max(row.position,knee.distanceTo(previous[side].position)*samples);
     }previous[side]={shoe,calfQ,bend,position:knee};
    }
   }rows.push(row);p.dispose();
  }return rows;
 };
 const continuity=await page.evaluate(sampleContinuity);
 // Force only the recovery weight to zero in an isolated control page.
 // The real actor, terrain solve, source paths, and cadence remain unchanged.
 const recoverySource=fs.readFileSync(new URL('../src/leg-recovery.js',import.meta.url),'utf8');
 const controlSource=recoverySource.replace(/return MathUtils\.smootherstep[^;]+;/,'return 0;');
 assert.notEqual(controlSource,recoverySource,'Control must disable the recovery correction');
 const disabled=controlSource.replace("from 'three'","from '/node_modules/three/build/three.module.js'");let routed=0;
 await page.route('**/src/leg-recovery.js*',r=>{routed++;return r.fulfill({body:disabled,contentType:'application/javascript'});});
 await page.reload();const sourceContinuity=await page.evaluate(sampleContinuity);assert.ok(routed>0,'Source control route was not used');
 fs.writeFileSync('/tmp/ninja-run-recovery.json',JSON.stringify({errors,rows,continuity,sourceContinuity},null,2));
 assert.deepEqual(errors,[]);assert.equal(rows.length,108);
 for(const row of rows){
  assert.ok(row.freeSamples>20,JSON.stringify(row));
  assert.ok(row.hinge<.01&&row.hip<30&&row.ankleTwist<18&&row.minimumFlex>=-.01&&row.maximumFlex<160.1,JSON.stringify(row));
  assert.ok(row.freePitch<40&&row.freeOffPitch<15,JSON.stringify(row));
  assert.ok(row.supportDrift<.035&&row.minimumClearance>-.003,JSON.stringify(row));
 }
 for(let i=0;i<continuity.length;i+=2)for(const key of ['shoe','calf','knee','position'])assert.ok(continuity[i+1][key]<continuity[i][key]*1.15,JSON.stringify(continuity.slice(i,i+2)));
 for(let i=0;i<continuity.length;i++)assert.ok(continuity[i].calf<sourceContinuity[i].calf*1.1,JSON.stringify({corrected:continuity[i],source:sourceContinuity[i]}));
 console.log(JSON.stringify({cases:rows.length,...Object.fromEntries(['hinge','hip','ankleTwist','freePitch','freeOffPitch','supportDrift','shoeSpeed','kneeSpeed'].map(k=>[k,Math.max(...rows.map(r=>r[k]))])),minimumClearance:Math.min(...rows.map(r=>r.minimumClearance))}));
}finally{await browser.close();}
