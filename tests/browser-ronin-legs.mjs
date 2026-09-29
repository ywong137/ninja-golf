import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,combatMotionName}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs');await loadWarriorAssets();
 const rows=[];
 for(const hz of [40,60,120])for(const slope of [0,.10,-.10])for(const movement of [null,0,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['light','heavy'])for(let step=0;step<4;step++){
 const w=new Warrior(0),b=w.bones,saved=[];for(const [bone,rest]of w.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}w.root.updateMatrixWorld(true);const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),name=combatMotionName(WARRIORS[0],kind,step),spec=motions[name],groundHeight=(x,z)=>slope*(x+z),row={hz,slope,movement,name,hip:0,ankle:0,hinge:0,drift:0,};
 for(const[bone,p,q,s]of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}let time=0;for(let i=0;i<30;i++){time+=1/hz;w.update(time,1/hz,{groundHeight});}
 const action={token:Math.random(),kind,step,time:0,duration:spec.duration};const anchors={};
 while(action.time<spec.duration){action.time+=1/hz;time+=1/hz;const moving=movement!==null,speed=moving?2.5:0;if(moving){w.root.position.x+=Math.sin(movement)*speed/hz;w.root.position.z+=Math.cos(movement)*speed/hz;w.root.position.y=groundHeight(w.root.position.x,w.root.position.z);}
 w.update(time,1/hz,{groundHeight,action,moving,moveSpeed:speed,moveAngle:movement??0});w.root.updateMatrixWorld(true);
 for(const s of ['r','l']){const a=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);row.hinge=Math.max(row.hinge,a.kneeDeviation);if(action.time>.12&&action.time<spec.duration-.04){row.hip=Math.max(row.hip,Math.abs(a.hipTwist));row.ankle=Math.max(row.ankle,Math.abs(a.ankleTwist));}
 if(!moving)for(const[j,[from,to]]of spec.footPlants[s].entries()){if(action.time<Math.max(.12,from+.04)||action.time>to-.04)continue;const p=b['foot_'+s].getWorldPosition(new T.Vector3()),key=s+j;anchors[key]??=p;row.drift=Math.max(row.drift,p.distanceTo(anchors[key]));}
 }
 }
 rows.push(row);w.dispose();
 }
 return rows;
 });
 assert.deepEqual(errors,[]);
 for(const row of report){
  assert.ok(row.hinge<.1,JSON.stringify(row));
  assert.ok(row.hip<50&&row.ankle<22,JSON.stringify(row));
  if(row.movement===null)assert.ok(row.drift<.004,JSON.stringify(row));
 }
 console.log(JSON.stringify({cases:report.length,maxHip:Math.max(...report.map(r=>r.hip)),maxAnkle:Math.max(...report.map(r=>r.ankle)),maxKneeSidebend:Math.max(...report.map(r=>r.hinge)),maxPlantDrift:Math.max(...report.map(r=>r.drift))}));
}finally{await browser.close();}
