import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disableHmr} from '../tools/disable-hmr.mjs';

// Bone and blade transforms only; this test does not create a WebGL renderer.
const measure=process.argv.includes('--measure');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.GAME_URL??'http://localhost:5173').replace(/\/$/,'')+'/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{attackDefinition}=await import('/src/combat.js'),{WARRIORS}=await import('/src/warriors.js'),{sampleMotion,combatMotionName,motions}=await import('/src/motion.js');await loadWarriorAssets();
  const reports=[];
  for(let hero=0;hero<6;hero++)for(const source of ['idle','guard','run','repeat'])for(const kind of ['light','heavy']){
   const p=new Warrior(hero);
   for(let frame=0;frame<60;frame++)p.update(frame/60,1/60,source==='guard'?{blocking:true}:source==='run'?{moving:true,moveSpeed:5.6}:{});
   const definition=attackDefinition(kind,0,WARRIORS[hero].combatStyle),attack={...definition,kind,step:0,token:1,time:0};
   if(source==='repeat'){const name=combatMotionName(WARRIORS[hero],kind,0);p.play(name,0,true);p.actions.get(name).time=definition.duration*.4;p.mixer.update(0);p.syncHeldObjects();}
   const prior=p.weapon.quaternion.clone(),initialShaft=new T.Vector3(0,1,0).applyQuaternion(prior);let firstTurn=0,maxFrameTurn=0,maxPalmGap=0,impactPathError=0;const paired=!!motions[combatMotionName(WARRIORS[hero],kind,0)].pairedGrip;
   for(let frame=0;frame<=Math.ceil(definition.duration*120);frame++){
    attack.time=frame/120;p.update(2+attack.time,1/120,{action:attack});p.root.updateMatrixWorld(true);
    const rotation=p.weapon.quaternion.clone(),turn=prior.angleTo(rotation);if(frame===0)firstTurn=turn;maxFrameTurn=Math.max(maxFrameTurn,turn);prior.copy(rotation);
    const palm=p.bones.hand_r.localToWorld(p.palmGrips.r.clone());maxPalmGap=Math.max(maxPalmGap,palm.distanceTo(p.weapon.localToWorld(new T.Vector3(0,p.weapon.userData.primaryGrip,0))));
    if(frame/120>=definition.hits[0]){
     const pose=sampleMotion(p.current,p.actions.get(p.current).time),expected=new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
     const actual=new T.Vector3(0,1,0).applyQuaternion(p.weapon.quaternion);impactPathError=Math.max(impactPathError,expected.angleTo(actual));
    }
   }
   reports.push({hero,source,kind,paired,firstTurn,maxFrameTurn,maxPalmGap,impactPathError,initialShaft:initialShaft.toArray()});p.dispose();
  }
  return reports;
 });
 const output=measure?'/tmp/ninja-attack-transitions-before.json':'/tmp/ninja-attack-transitions-after.json';fs.writeFileSync(output,JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports.map(({initialShaft,...r})=>r),null,2));assert.deepEqual(errors,[]);
 if(!measure)for(const r of reports){
  assert.ok(r.firstTurn<.45,`Weapon snaps at attack entry: ${JSON.stringify(r)}`);
  assert.ok(r.maxPalmGap<(r.paired?.002:1e-6),`Handle leaves the palm: ${JSON.stringify(r)}`);
  assert.ok(r.impactPathError<(r.paired?.001:1e-6),`Attack blend changes the impact path: ${JSON.stringify(r)}`);
 }
}finally{await browser.close();}
