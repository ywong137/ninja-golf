import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const dir=process.argv[2];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 if(dir){
  for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])await page.route(`**/models/${hero}.glb?*`,r=>r.fulfill({path:path.resolve(dir,hero+'.glb')}));
  const records=JSON.parse(fs.readFileSync(path.join(dir,'motions.json'))),motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));Object.assign(motions,records);
  const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';');await page.route('**/src/motion.js*',r=>r.fulfill({contentType:'application/javascript',body:source}));
 }
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/src/leg-anatomy.js');await loadWarriorAssets();const rows=[];
  for(let hero=0;hero<6;hero++)for(const clip of ['Golf_Address','Golf_Swing','Golf_Putt'])for(const slope of [0,.08,-.08])for(const hz of [60,120]){
   const w=new Warrior(hero),b=w.bones,rest=[];
   for(const [bone,pose]of w.golfRestPose)if(bone.isBone){rest.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(pose.position);bone.quaternion.copy(pose.quaternion);bone.scale.copy(pose.scale);}w.root.updateMatrixWorld(true);
   const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));for(const[bone,p,q,s]of rest){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}
   w.setGolfClub(clip==='Golf_Putt'?'PT':'DR');w.mixer.stopAllAction();w.current='';w.play(clip,0,true);const duration=w.actions.get(clip).getClip().duration,groundHeight=(x,z)=>slope*(x+.5*z),row={hero,clip,slope,hz,hip:0,ankle:0,offPitch:0,hinge:0,clubDrift:0,reach:0,toeDrift:0},anchors={};
   for(let frame=0;frame<=Math.ceil(duration*hz);frame++){
    const time=Math.min(duration,frame/hz);w.update(time,1/hz,{golf:true,putting:clip==='Golf_Putt',previewPose:{clip,time},groundHeight});w.root.updateMatrixWorld(true);
    for(const s of ['r','l']){const m=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);row.hip=Math.max(row.hip,Math.abs(m.hipTwist));row.ankle=Math.max(row.ankle,Math.abs(m.ankleTwist));row.offPitch=Math.max(row.offPitch,m.ankleOffPitch);row.hinge=Math.max(row.hinge,m.kneeDeviation);const toe=b['ball_'+s].getWorldPosition(new T.Vector3()).setY(0);anchors[s]??=toe;if(slope===0)row.toeDrift=Math.max(row.toeDrift,toe.distanceTo(anchors[s]));}
    row.reach=Math.max(row.reach,...w.footPlacement.report.feet.map(f=>f.reachError));
    const before=w.club.getWorldPosition(new T.Vector3());w.footPlacement.restore();w.root.updateMatrixWorld(true);w.syncHeldObjects(undefined,true);row.clubDrift=Math.max(row.clubDrift,before.distanceTo(w.club.getWorldPosition(new T.Vector3())));
   }
   rows.push(row);w.dispose();
  }return rows;
 });
 fs.writeFileSync('/tmp/ninja-golf-leg-runtime.json',JSON.stringify({errors,report},null,2));assert.deepEqual(errors,[]);assert.equal(report.length,108);
 for(const r of report){assert.ok(r.hinge<.1&&r.hip<55&&r.ankle<22&&r.offPitch<35,JSON.stringify(r));assert.ok(r.clubDrift<1e-7&&r.reach<.003&&r.toeDrift<.0005,JSON.stringify(r));}
 console.log(JSON.stringify({cases:report.length,...Object.fromEntries(['hip','ankle','offPitch','hinge','clubDrift','reach','toeDrift'].map(k=>[k,Math.max(...report.map(r=>r[k]))]))}));
}finally{await browser.close();}
