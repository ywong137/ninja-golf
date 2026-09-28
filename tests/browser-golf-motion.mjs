import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const modelDir=process.argv[2];
if(modelDir==='--help'){console.log('node tests/browser-golf-motion.mjs [CANDIDATE_MODEL_DIRECTORY]\nChecks native golf grip, wrists, fixed club length, feet, and ball contact. Chrome stays muted.');process.exit(0);}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 if(modelDir)for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])await page.route(`**/models/${hero}.glb?*`,r=>r.fulfill({path:path.resolve(modelDir,hero+'.glb')}));
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {motions}=await import('/src/motion.js');
  const {handSurface,measureGripSurface}=await import('/tools/grip-contact.mjs');
  await loadWarriorAssets();const rows=[];
  for(let i=0;i<WARRIORS.length;i++){
   const actor=new Warrior(i),surfaces={r:handSurface(actor.model,'r'),l:handSurface(actor.model,'l')};
   for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
    actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play(name,0,true);
    const action=actor.actions.get(name),duration=action.getClip().duration;
    const times=name==='Golf_Swing'?[0,.25,.53,.75,.96,1.044,1.15,1.25,1.32,1.4,1.55,1.75,1.9,2.15,2.4]:[0,duration*.38,duration*22/45,duration*.72,duration];
    for(const time of times){
     actor.handGrip.restore();action.time=Math.min(time,duration-1e-7);actor.mixer.update(0);actor.root.updateMatrixWorld(true);
     const before=Object.fromEntries(['r','l'].map(s=>[s,actor.bones['hand_'+s].getWorldQuaternion(new T.Quaternion())]));
     actor.syncHeldObjects(undefined,true);
     const grips=Object.fromEntries(['r','l'].map(s=>{
      const palm=actor.bones['hand_'+s].localToWorld(actor.palmGrips[s].clone()),station=s==='r'?0:-motions[name].gripSpacing;
      const gap=palm.distanceTo(actor.club.localToWorld(new T.Vector3(0,station,0)))/actor.root.scale.x;
      return[s,{gap,wristCorrection:before[s].angleTo(actor.bones['hand_'+s].getWorldQuaternion(new T.Quaternion())),...measureGripSurface(surfaces[s],actor.club,actor.handGrip.active[s].radius)}];
     }));
     const tip=actor.root.worldToLocal(actor.club.localToWorld(new T.Vector3(0,actor.clubHead.position.y,0)));
     rows.push({hero:WARRIORS[i].model,name,time,duration,length:actor.clubHead.position.y,tip:tip.toArray(),grips});
    }
   }
   actor.dispose();
  }
  return rows;
 });
 fs.writeFileSync('/tmp/ninja-golf-runtime-validation.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 for(const r of report){
  assert.ok(Math.abs(r.length-Math.hypot(.625,.722))<1e-7,`${r.hero}/${r.name}: club length`);
  for(const [side,g]of Object.entries(r.grips)){
   const label=`${r.hero}/${r.name}/${r.time}/${side}`;
   assert.ok(g.gap<.003,label+': detached grip');assert.ok(g.wristCorrection<.02,label+': runtime changed native wrist');
   assert.ok(g.maxPenetration<.0021&&Object.values(g.groups).every(x=>x.contactGap<.005),label+': fingers lost contact');
  }
  if(r.name==='Golf_Swing'&&r.time===1.4)assert.ok(Math.hypot(r.tip[0],r.tip[1]-.118,r.tip[2]-.945)<.003,`${r.hero}: club misses ball`);
 }
 console.log(`Checked ${report.length} native golf phases, both hands, fixed club length, and six exact swing contacts.`);
}finally{await browser.close();}
