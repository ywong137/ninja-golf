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
    actor.setGolfClub(name==='Golf_Putt'?'PT':'DR');actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play(name,0,true);
    const action=actor.actions.get(name),duration=action.getClip().duration;
    const times=name==='Golf_Swing'?[0,.25,.53,.75,.96,1.044,1.15,1.25,1.32,1.4,1.55,1.75,1.9,2.15,2.4]:[0,duration*.38,duration*22/45,duration*.72,duration];
    for(const time of times){
     actor.handGrip.restore();action.time=Math.min(time,duration-1e-7);actor.mixer.update(0);actor.root.updateMatrixWorld(true);
     const before=Object.fromEntries(['r','l'].map(s=>[s,actor.bones['hand_'+s].getWorldQuaternion(new T.Quaternion())]));
     actor.syncHeldObjects(undefined,true);
     const grips=Object.fromEntries(['r','l'].map(s=>{
      const palm=actor.bones['hand_'+s].localToWorld(actor.palmGrips[s].clone()),station=s==='r'?0:-(actor.handGrip.active.gripSpacing??motions[name].gripSpacing);
      const gap=palm.distanceTo(actor.club.localToWorld(new T.Vector3(0,station,0)))/actor.root.scale.x;
      return[s,{gap,wristCorrection:before[s].angleTo(actor.bones['hand_'+s].getWorldQuaternion(new T.Quaternion())),...measureGripSurface(surfaces[s],actor.club,actor.handGrip.active[s].radius)}];
     }));
     const tip=actor.root.worldToLocal(actor.club.localToWorld(new T.Vector3(0,actor.clubHead.position.y,0)));
     const grip=actor.club.getObjectByName('Golf club grip'),shaft=actor.clubShaft;
     const shaftStart=shaft.position.y-shaft.scale.y*.5,shaftEnd=shaft.position.y+shaft.scale.y*.5,gripEnd=grip.position.y+grip.scale.y*.5;
     let faceGap=null,soleHeight=null;
     if(time===(name==='Golf_Putt'?22/30:1.4)){
      const ball=actor.root.localToWorld(actor.golfClubFit.ballOffsetNative.clone()),nearest=new T.Vector3();let distance=Infinity,minY=Infinity;
      actor.clubHead.traverse(mesh=>{if(!mesh.isMesh)return;const {position,normal}=mesh.geometry.attributes,index=mesh.geometry.index;for(let i=0;i<position.count;i++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).y);if(!['Titanium face','Face insert'].includes(mesh.name))return;for(let i=0;i<(index?.count??position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(!ids.every(k=>normal.getZ(k)<-.999))continue;const triangle=new T.Triangle(...ids.map(k=>new T.Vector3().fromBufferAttribute(position,k).applyMatrix4(mesh.matrixWorld)));distance=Math.min(distance,triangle.closestPointToPoint(ball,nearest).distanceTo(ball));}});
      faceGap=distance-(await import('/src/golf-equipment.js')).BALL_RADIUS;soleHeight=minY;
     }
     rows.push({hero:WARRIORS[i].model,name,time,duration,length:actor.clubHead.position.y,fittedLength:actor.golfClubFit.shaftLengthNative,faceGap,soleHeight,tip:tip.toArray(),grips,clubJoins:{overlap:gripEnd-shaftStart,headGap:Math.abs(shaftEnd-actor.clubHead.position.y)}});
    }
   }
   actor.dispose();
  }
  return rows;
 });
 fs.writeFileSync('/tmp/ninja-golf-runtime-validation.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 for(const r of report){
  assert.ok(Math.abs(r.length-r.fittedLength)<1e-7,`${r.hero}/${r.name}: club length`);
  assert.ok(r.clubJoins.overlap>=.009&&r.clubJoins.headGap<1e-7,`${r.hero}/${r.name}: disconnected club geometry`);
  for(const [side,g]of Object.entries(r.grips)){
   const label=`${r.hero}/${r.name}/${r.time}/${side}`;
   assert.ok(g.gap<.00025,label+': detached grip');assert.ok(g.wristCorrection<.002,label+': runtime changed native wrist');
   assert.ok(g.maxPenetration<.0008&&Object.values(g.groups).every(x=>x.contactGap<.0012),label+': fingers lost contact');
  }
  if(r.faceGap!==null){assert.ok(Math.abs(r.faceGap)<1e-6,`${r.hero}: finite face misses the ball`);assert.ok(Math.abs(r.soleHeight-.002)<1e-6,`${r.hero}: club sole height`);}
 }
 console.log(`Checked ${report.length} native golf phases, both hands, fixed club length, and twelve finite clubface contacts.`);
}finally{await browser.close();}
