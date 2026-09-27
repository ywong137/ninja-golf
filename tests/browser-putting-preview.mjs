import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const results=await page.evaluate(async()=>{
  const {heightAt,lieAt}=await import('/src/course.js'),g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();
  const results=[],cases=[{theme:0,hole:4,kind:'fringe'},{theme:0,hole:4,kind:'overhit'},{theme:0,hole:0,kind:'sand'},{theme:1,hole:2,kind:'sand'},{theme:2,hole:6,kind:'sand'},{theme:0,hole:0,kind:'water'},{theme:2,hole:6,kind:'water'},{theme:1,hole:0,kind:'uphill'},{theme:1,hole:0,kind:'downhill'},{theme:3,hole:0,kind:'cup'}];
  const original={land:g.land,holed:g.holed,penalty:g.penalty};let observed,travel;
  const sampleTravel=()=>{const p=g.ball.position,lie=lieAt(g.course,p.x,p.z);travel.surfaces.add(lie);const distance=Math.hypot(p.x-travel.x,p.z-travel.z);if(distance>1e-6){const rise=heightAt(g.course,p.x,p.z)-heightAt(g.course,travel.x,travel.z);travel.distance+=distance;travel.rise+=rise;travel.slopes.push(rise/distance);}travel.x=p.x;travel.z=p.z;};
  const capture=outcome=>{sampleTravel();observed={outcome,x:g.ball.position.x,z:g.ball.position.z,lie:lieAt(g.course,g.ball.position.x,g.ball.position.z)};};
  g.land=function(){capture('Stopped');return original.land.call(this);};g.holed=function(){capture('Holed');return original.holed.call(this);};g.penalty=function(message){capture(message.startsWith('Water')?'Water':'Out of bounds');return original.penalty.call(this,message);};
  try{for(const spec of cases){
   g.clearEnemies();g.setCourse(spec.theme);g.loadHole(spec.hole);await g.world.waitForAssets();const c=g.course;let x=c.greenX,z=c.length-12,aim=Math.PI,power=1;
   if(spec.kind==='fringe')power=.9;
   if(spec.kind==='sand'||spec.kind==='water'){const basin=spec.kind==='sand'?c.bunkers[0]:c.pond;x=basin[0]-basin[2]-3;z=basin[1];aim=Math.PI/2;}
   if(spec.kind==='uphill'||spec.kind==='downhill'){z=c.length+7;aim=spec.kind==='uphill'?Math.PI/2:-Math.PI/2;power=.4;}
   if(spec.kind==='cup'){z=c.length-4;aim=0;power=.45;}
   g.ball.position.set(x,heightAt(c,x,z)+.13,z);g.lie=lieAt(c,x,z);g.club=7;g.aim=aim;g.power=power;g.charging=true;g.refreshAim();g.charging=false;const preview={...g.shotPreview,landing:{...g.shotPreview.landing}};
   observed=null;travel={x,z,distance:0,rise:0,surfaces:new Set([g.lie]),slopes:[]};g.launchBall();for(let frame=0;frame<1900&&g.phase==='flight';frame++){g.updateBall(frame%2?1/60:1/20);if(!observed)sampleTravel();}
   if(!observed)throw new Error(`Putt never terminated: ${spec.kind}`);
   results.push({...spec,preview:preview.outcome,actual:observed.outcome,error:Math.hypot(preview.landing.x-observed.x,preview.landing.z-observed.z),previewLie:preview.lie,actualLie:observed.lie,surfaces:[...travel.surfaces],traveled:travel.distance,meanSlope:travel.rise/travel.distance,minSlope:Math.min(...travel.slopes),maxSlope:Math.max(...travel.slopes)});
  }}finally{Object.assign(g,original);g.clearEnemies();}
  return results;
 });
 for(const r of results){assert.equal(r.actual,r.preview,JSON.stringify(r));assert.equal(r.actualLie,r.previewLie,JSON.stringify(r));assert.ok(r.error<.025,JSON.stringify(r));
  if(r.kind==='sand'){assert.ok(r.surfaces.includes('Fairway')&&r.surfaces.includes('Bunker'),JSON.stringify(r));assert.equal(r.actualLie,'Bunker');assert.equal(r.actual,'Stopped');}
  if(r.kind==='water'){assert.ok(r.surfaces.includes('Rough')&&r.surfaces.includes('Water'),JSON.stringify(r));assert.equal(r.actual,'Water');assert.ok(r.traveled<4);}
  if(r.kind==='fringe'){assert.ok(r.surfaces.includes('Green')&&r.surfaces.includes('Rough'),JSON.stringify(r));assert.equal(r.actual,'Stopped');assert.ok(r.traveled>10&&r.traveled<12);}
  if(r.kind==='overhit'){assert.ok(r.surfaces.includes('Green')&&r.surfaces.includes('Rough')&&r.surfaces.includes('Water'));assert.equal(r.actual,'Water');assert.ok(r.traveled>12&&r.traveled<14);}
  if(r.kind==='uphill'){assert.ok(r.minSlope>.004,JSON.stringify(r));assert.equal(r.actual,'Stopped');}
  if(r.kind==='downhill'){assert.ok(r.maxSlope<-.004,JSON.stringify(r));assert.equal(r.actual,'Stopped');}
  if(r.kind==='cup'){assert.equal(r.actual,'Holed');assert.deepEqual(r.surfaces,['Green']);}
 }
 const uphill=results.find(r=>r.kind==='uphill'),downhill=results.find(r=>r.kind==='downhill');assert.ok(downhill.traveled>uphill.traveled);
 assert.equal(results.filter(r=>r.kind==='sand').length,3);assert.equal(results.filter(r=>r.kind==='water').length,2);
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));console.log('Actual game putts match preview through fringe, sand, water, slopes, cup capture, and mixed frame durations');
}finally{await browser.close();}
