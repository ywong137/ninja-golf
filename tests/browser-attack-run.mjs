import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,combatMotionName}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs');await loadWarriorAssets();const rows=[];
 for(let hero=0;hero<6;hero++)for(const hz of [40,120])for(const slope of [0,.1,-.1])for(const movement of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['light','heavy']){
 const w=new Warrior(hero),b=w.bones,saved=[];for(const [bone,rest]of w.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}w.root.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),spec=motions[combatMotionName(WARRIORS[hero],kind,0)],groundHeight=(x,z)=>slope*(x+z);
 for(const[bone,p,q,s]of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}let time=0;
 for(let i=0;i<30;i++){time+=1/hz;w.update(time,1/hz,{groundHeight});}
 const action={token:1,kind,step:0,time:0,duration:spec.duration};
 function update(action){time+=1/hz;w.root.position.x+=Math.sin(movement)*2.5/hz;w.root.position.z+=Math.cos(movement)*2.5/hz;w.root.position.y=groundHeight(w.root.position.x,w.root.position.z);w.update(time,1/hz,{action,groundHeight,moving:true,moveSpeed:2.5,moveAngle:movement});}
 while(action.time<spec.duration){action.time+=1/hz;update(action);}
 let feet=['r','l'].map(s=>b['foot_'+s].getWorldPosition(new T.Vector3()));const row={hero,hz,slope,movement,kind,hip:0,ankle:0,loadedAnkle:0,hinge:0,footSpeed:0,kneeClearance:Infinity};
 for(let i=0;i<Math.ceil(hz*.5);i++){
 update(null);const next=['r','l'].map(s=>b['foot_'+s].getWorldPosition(new T.Vector3()));
 for(let j=0;j<2;j++)row.footSpeed=Math.max(row.footSpeed,next[j].distanceTo(feet[j])*hz);feet=next;
 if(!w.running)continue;
 if(w.runFootwork.entry&&!row.entryFeet)row.entryFeet=['r','l'].map(s=>w.root.worldToLocal(w.runFootwork.entry[s].p.clone()).toArray());
 if(w.attackLocomotion.weight>0)throw Error('Moving attack layer overlaps run');
 for(const s of ['r','l']){const knee=b['calf_'+s].getWorldPosition(new T.Vector3());row.kneeClearance=Math.min(row.kneeClearance,knee.y-groundHeight(knee.x,knee.z));const m=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);row.hip=Math.max(row.hip,Math.abs(m.hipTwist));row.ankle=Math.max(row.ankle,Math.abs(m.ankleTwist));row.hinge=Math.max(row.hinge,m.kneeDeviation);if(w.footPlacement.report.feet.find(f=>f.side===s).weight>.9)row.loadedAnkle=Math.max(row.loadedAnkle,Math.abs(m.ankleTwist));}
 }
 rows.push(row);w.dispose();
 }
 return rows;
 });
 assert.deepEqual(errors,[]);
 for(const row of rows){
  const flat=rows.find(r=>r.hero===row.hero&&r.hz===row.hz&&r.slope===0&&r.movement===row.movement&&r.kind===row.kind);
  assert.ok(row.entryFeet&&flat.entryFeet,'The transition must capture the outgoing feet');
  const terrainCarry=Math.max(...row.entryFeet.flatMap((foot,j)=>foot.map((v,i)=>Math.abs(v-flat.entryFeet[j][i]))));
  assert.ok(terrainCarry<.001,`Terrain support was captured into the run and will apply twice: ${JSON.stringify({...row,terrainCarry})}`);
  assert.ok(row.hip<40&&row.ankle<25&&row.loadedAnkle<20,JSON.stringify(row));
  assert.ok(row.hinge<.01&&row.footSpeed<12&&row.kneeClearance>.12,JSON.stringify(row));
 }
 console.log(JSON.stringify({cases:rows.length,minKneeClearance:Math.min(...rows.map(r=>r.kneeClearance)),...Object.fromEntries(['hip','ankle','loadedAnkle','hinge','footSpeed'].map(metric=>[metric,Math.max(...rows.map(r=>r[metric]))]))}));
}finally{await browser.close();}
