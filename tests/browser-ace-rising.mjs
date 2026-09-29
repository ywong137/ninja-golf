import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{motions,combatMotionName}=await import('/src/motion.js'),{SceneryCollision}=await import('/src/scenery-collision.js'),{heightAt}=await import('/src/course.js');
  const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();g.begin(3,0);g.world.collision=new SceneryCollision();
  const rows=[];
  for(const hz of [40,60,120]){
   g.clearEnemies();g.selectWarrior(3);g.input.clear();g.phase='combat';g.spawnTime=999;g.dodgeTimer=0;g.time+=10;
   g.player.root.position.set(0,heightAt(g.course,0,45),45);g.player.root.rotation.y=0;g.cameraYaw=0;g.ball.position.set(0,heightAt(g.course,0,190),190);
   for(let k=0;k<30;k++)g.player.update(g.time,1/60,{groundHeight:g.groundHeight});
   g.lightChain=2;g.chainExpires=g.time+10;g.startAttack('heavy');
   const a=g.action,name=combatMotionName(g.warrior,'heavy',1),spec=motions[name],anchors={},row={hz,name,hingeDeviation:0,ankleDrift:0,toeDrift:0,rootStart:g.player.root.position.toArray()};
   if(!spec.nativeKneeHinges||!a.planarRoot)throw Error('The installed attack lacks its native legs or root path.');
   while(g.action===a){
    g.time+=1/hz;g.updateCombat(1/hz);g.input.end();g.player.root.updateMatrixWorld(true);
    const b=g.player.bones,p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
    for(const s of ['r','l']){
     const lower=p('foot_'+s).sub(p('calf_'+s)).normalize(),hinge=g.player.footPlacement.hinges[s].hingeInThigh.clone().applyQuaternion(q('thigh_'+s));
     row.hingeDeviation=Math.max(row.hingeDeviation,Math.asin(Math.min(1,Math.abs(hinge.dot(lower)))));
     for(const[bone,intervals,metric]of [['foot_',spec.footPlants[s],'ankleDrift'],['ball_',spec.toePlants[s],'toeDrift']])for(const[j,[from,to]]of intervals.entries()){
      if(a.time<=Math.max(.10,from+.03)||a.time>=to-.03)continue;
      const point=p(bone+s),key=bone+s+j;anchors[key]??=point;row[metric]=Math.max(row[metric],point.distanceTo(anchors[key]));
     }
    }
   }
   row.rootEnd=g.player.root.position.toArray();rows.push(row);
  }
  g.audio.pause();return rows;
 });
 assert.deepEqual(errors,[]);
 for(const row of report){assert.equal(row.name,'Fan_Heavy_Rising');assert.ok(row.hingeDeviation<.1*Math.PI/180,JSON.stringify(row));assert.ok(row.ankleDrift<.004,JSON.stringify(row));assert.ok(row.toeDrift<.004,JSON.stringify(row));assert.ok(row.rootEnd[2]-row.rootStart[2]>1.2);}
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
