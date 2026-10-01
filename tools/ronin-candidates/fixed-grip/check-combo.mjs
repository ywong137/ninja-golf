import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from '../../disable-hmr.mjs';
import {routeFixedGripCandidate} from './route.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},rate:{type:'string',default:'144'},'follow-up':{type:'string',default:'heavy'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-combo.mjs --candidate DIRECTORY [--rate 60|144|480] [--follow-up heavy|return]\nRequires the diagonal candidate and Vite on localhost:5173. Queues the selected follow-up during the first light cut through the game controller. Chrome runs headlessly with audio muted.');process.exit(0);}
const rate=Number(values.rate);
if(!values.candidate||![60,144,480].includes(rate))throw Error('Supply --candidate DIRECTORY and a valid --rate. See --help.');
if(!['heavy','return'].includes(values['follow-up']))throw Error('--follow-up must be heavy or return.');
const follow=values['follow-up'];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await disableHmr(page);
 await routeFixedGripCandidate(page,values.candidate,{withDiagonal:true,withReturn:follow==='return'});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const report=await page.evaluate(async({rate,follow})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createPlayerGuard}=await import('/src/combat.js');
  const {handSurface,measureGripSurface}=await import('/tools/grip-contact.mjs');
  const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.enabled=false;g.audio.pause();g.clearEnemies();g.selectWarrior(0);g.phase='combat';g.spawnTime=999;g.time+=10;g.groundHeight=()=>0;g.slideOnLand=p=>{p.y=0;};g.player.root.position.set(0,0,45);g.ball.position.set(0,0,190);g.input.clear();g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;
  const actor=g.player;actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play('Ronin_Ready',0);actor.mixer.update(0);actor.syncHeldObjects();
  const hands=Object.fromEntries(['r','l'].map(side=>[side,handSurface(actor.model,side)]));
  const tick=()=>{g.time+=1/rate;g.updateCombat(1/rate);g.input.end();};for(let i=0;i<rate/2;i++)tick();
  g.paused=false;g.attack('light');g.paused=true;const start=g.time,report={rate,transitions:[],rows:[],maxPalmGap:0,maxFrameError:0,maxGripDepth:0,maxFittingDepth:0};let queued=false;
  for(let i=0;i<Math.ceil(1.8*rate);i++){
   if(!queued&&g.time-start>=.2){g.paused=false;g.attack(follow==='return'?'light':'heavy');g.paused=true;queued=true;report.queued=!!g.attackBuffer;}
   tick();actor.root.updateMatrixWorld(true);
   const t=g.time-start,clip=actor.current;
   if(report.transitions.at(-1)?.clip!==clip)report.transitions.push({t,clip,step:g.action?.step,duration:g.action?.duration,blended:!!actor.heldBlend});
   const frame=actor.weapon.getWorldQuaternion(new T.Quaternion()).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),palms={};let gap=0,angle=0;
   for(const side of ['r','l']){
    const grip=actor.handGrip.active[side];palms[side]=actor.bones['hand_'+side].localToWorld(grip.center.clone());
    angle=Math.max(angle,actor.bones['hand_'+side].getWorldQuaternion(new T.Quaternion()).normalize().multiply(grip.frame).normalize().angleTo(frame)*180/Math.PI);
    const contact=measureGripSurface(hands[side],actor.weapon,.014);report.maxGripDepth=Math.max(report.maxGripDepth,contact.maxPenetration);report.maxFittingDepth=Math.max(report.maxFittingDepth,contact.fittingPenetration);
   }
   gap=palms.l.distanceTo(palms.r.clone().addScaledVector(shaft,-.12*actor.root.scale.x))/actor.root.scale.x;
   report.maxPalmGap=Math.max(report.maxPalmGap,gap);report.maxFrameError=Math.max(report.maxFrameError,angle);report.rows.push({t,clip,gap,angle});
  }
  report.remainingAction=!!g.action;g.audio.pause();return report;
 },{rate,follow});
 fs.writeFileSync(path.join(values.candidate,`combo-${follow==='return'?'return-':''}${rate}.json`),JSON.stringify({...report,errors},null,2));const{rows,...summary}=report;console.log(JSON.stringify({...summary,errors}));
 assert.deepEqual(errors,[]);assert.equal(report.queued,true,'The follow-up input was not buffered.');
 assert.deepEqual(report.transitions.map(t=>t.clip),['Ronin_Cut_Diagonal',follow==='return'?'Ronin_Cut_Return':'Ronin_Heavy_Cleave','Ronin_Ready']);
 const next=report.transitions[1];assert.equal(next.step,follow==='return'?1:0);assert.equal(next.duration,follow==='return'?.85:.76);assert.ok(next.t>=.6&&next.t<.6+2/rate,'The controller skipped the end of the light cut.');
 assert.equal(next.blended,false,'Matching completed-attack poses should continue directly.');
 assert.equal(report.remainingAction,false);assert.ok(report.maxGripDepth<.0015&&report.maxFittingDepth===0,'The combo intersects the handle or fittings.');
 assert.ok(report.maxPalmGap<.00025&&report.maxFrameError<.04,'The combo transition distorts the complete hand grip.');
}finally{await browser.close();}
