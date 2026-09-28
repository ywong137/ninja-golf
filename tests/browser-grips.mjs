import fs from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));await disableHmr(page);
try{
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {motions}=await import('/src/motion.js');
  const {handSurface,measureGripSurface}=await import('/tools/grip-contact.mjs');
  await loadWarriorAssets();const results=[];
  for(let i=0;i<WARRIORS.length;i++){
   const w=WARRIORS[i],p=new Warrior(i),surfaces={r:handSurface(p.model,'r'),l:handSurface(p.model,'l')};
   const prefix=w.motionPrefix;
   const sample=(name,time,transition=false)=>{
    const golf=name.startsWith('Golf'),clip=motions[name];
    p.root.updateMatrixWorld(true);
    for(const side of p.offhand&&!golf||p.handGrip.secondaryWeight>.999?['r','l']:['r']){
     const held=golf?p.club:side==='l'&&p.offhand?p.offhand:p.weapon;
     const radius=p.handGrip.active[side].radius;
     const contact=measureGripSurface(surfaces[side],held,radius);
     const palm=p.bones['hand_'+side].localToWorld(p.palmGrips[side].clone());
     const station=(golf?0:held.userData.primaryGrip)-(side==='l'&&!(p.offhand&&!golf)?clip?.gripSpacing??.09:0);
     const gap=palm.distanceTo(held.localToWorld(new T.Vector3(0,station,0)))/p.root.scale.x;
     results.push({hero:w.model,name,seconds:time,side,transition,gap,...contact});
    }
   };
   const names=[w.selectionClip,w.readyClip,`${prefix}Cut_Diagonal`,`${prefix}Heavy_Cleave`,`${prefix}Musou_Flow`,`${({odachi:'Odachi',twin:'Twin',naginata:'Naginata',fan:'Fan',ring:'Ring',sickle:'Sickle'})[w.combatStyle]}_Guard_Loop`,'Golf_Address','Golf_Swing','Golf_Putt'].map(name=>w.motionOverrides?.[name]??name);
   for(const name of names)for(const fraction of [0,.28,.55,.84]){
    p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(name,0,true);
    const action=p.actions.get(name);action.time=fraction*action.getClip().duration;p.mixer.update(0);
    p.syncHeldObjects(undefined,name.startsWith('Golf'));sample(name,action.time);
   }
   // Primary contact must survive action crossfades and running carry corrections.
   p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(w.readyClip,0);p.mixer.update(0);p.syncHeldObjects();
   for(let frame=0;frame<24;frame++){p.update(frame/60,1/60,{moving:true,moveSpeed:5.6,moveAngle:.7});sample(p.current,frame/60,true);}
   for(let frame=0;frame<24;frame++){p.update(frame/60,1/60,{action:{kind:'light',step:0,token:123,time:frame/60,duration:.40}});sample(p.current,frame/60,true);}
   if(i===0){
    // Inspect every 120 Hz phase of the reported heavy attack, including both
    // crossfades. Sparse fraction samples previously missed the actual impact.
    p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(w.readyClip,0);p.mixer.update(0);p.syncHeldObjects();
    const duration=motions[w.motionOverrides?.Heavy_Cleave??'Heavy_Cleave'].duration;
    for(let frame=0;frame<=Math.ceil((duration+.25)*120);frame++){
     const time=frame/120,action=time<=duration?{kind:'heavy',step:0,token:456,time,duration}:null;
     p.update(time,1/120,{action});sample(p.current,p.actions.get(p.current).time,true);
    }
   }
   p.dispose();
  }
  return results;
 });
 fs.mkdirSync('artifacts/grip-review',{recursive:true});fs.writeFileSync('artifacts/grip-review/runtime-contact.json',JSON.stringify(report,null,2));
 const failures=report.filter(r=>r.gap>.003||r.maxPenetration>.0021||r.fittingPenetration>.0021||Object.values(r.groups).some(g=>g.contactGap>.005));
 assert.deepEqual(errors,[]);assert.ok(report.length>500);
 assert.equal(failures.length,0,JSON.stringify(failures.slice(0,8),null,2));
 console.log(`Checked ${report.length} runtime hand samples. Maximum skin penetration: ${(Math.max(...report.map(r=>r.maxPenetration))*1000).toFixed(2)} mm. Maximum fitting penetration: ${(Math.max(...report.map(r=>r.fittingPenetration))*1000).toFixed(2)} mm. Maximum attachment gap: ${(Math.max(...report.map(r=>r.gap))*1000).toFixed(3)} mm.`);
}finally{await browser.close();}
