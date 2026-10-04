import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);await page.click('#audio-toggle');await page.click('#play');
 assert.equal(await page.locator('[data-warrior]').count(),6);
 for(let hero=0;hero<6;hero++){await page.click(`[data-warrior="${hero}"]`);await page.waitForTimeout(700);await page.screenshot({path:`/tmp/ninja-new-hero-${hero}.png`});}
 await page.click('#begin');assert.ok(await page.locator('#courses').isVisible());
 for(let c=0;c<4;c++){await page.click(`[data-course="${c}"]`);await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>window.__golfTest.courseIndex),c);await page.screenshot({path:`/tmp/ninja-course-select-${c}.png`});}
 await page.click('#start-round');assert.equal(await page.evaluate(()=>window.ninjaGolf.state().holes),9);
 // A restored hero must remain the selected hero when returning to the menus.
 await page.evaluate(()=>{const g=window.__golfTest;localStorage.setItem('ninja-golf-save',JSON.stringify({version:2,courseId:g.roundCourse.id,playerIndex:5,scores:[4],penalties:[0],nextHole:1,kills:8,bestCombo:7}));});
 await page.reload();await page.waitForSelector('#continue-round');await page.click('#continue-round');assert.equal(await page.evaluate(()=>window.__golfTest.bestCombo),7);
 await page.evaluate(()=>{const g=window.__golfTest;g.home();g.ui.showScreen('home');});await page.click('#play');assert.ok(await page.locator('[data-warrior="5"]').evaluate(el=>el.classList.contains('selected')));await page.click('#begin');await page.click('[data-course="3"]');await page.click('#start-round');assert.equal(await page.evaluate(()=>window.ninjaGolf.state().playerIndex),5);
 await page.keyboard.press('KeyR');await page.waitForFunction(()=>window.__golfTest.survey);await page.waitForTimeout(900);
 const initial=await page.evaluate(()=>{const g=window.__golfTest;return {aim:g.aim,target:g.surveyView.target.toArray(),distance:g.surveyView.distance,yaw:g.surveyView.yaw};});
 await page.mouse.move(750,370);await page.mouse.down();await page.mouse.move(850,410,{steps:10});await page.mouse.up();await page.mouse.wheel(0,-250);await page.waitForTimeout(300);
 await page.mouse.down({button:'right'});await page.mouse.move(900,440,{steps:6});await page.mouse.up({button:'right'});await page.waitForTimeout(200);
 const moved=await page.evaluate(()=>{const g=window.__golfTest;return{aim:g.aim,target:g.surveyView.target.toArray(),distance:g.surveyView.distance,yaw:g.surveyView.yaw};});
 assert.equal(moved.aim,initial.aim);assert.notDeepEqual(moved.target,initial.target);assert.ok(moved.distance<initial.distance);assert.notEqual(moved.yaw,initial.yaw);await page.screenshot({path:'/tmp/ninja-survey-moved.png'});await page.keyboard.press('KeyR');
 for(let c=0;c<4;c++){
  const result=await page.evaluate(async index=>{const g=window.__golfTest,{heightAt}=await import('/src/course.js');g.begin(0,index);g.paused=true;g.audio.pause();const results=[];
   for(let hole=0;hole<9;hole++){
    g.loadHole(hole);g.phase='aim';g.strokes=g.course.par-1;g.penalties=hole===3?1:0;g.club=7;g.lie='Green';g.power=.35;g.ball.position.copy(g.world.cup);g.ball.position.z-=3;g.ball.position.y=heightAt(g.course,g.ball.position.x,g.ball.position.z)+.13;g.aimAtPin();g.launchBall();for(let i=0;i<1500&&g.phase==='flight';i++)g.updateBall(1/120);
    clearTimeout(g.scoreTimer);results.push({hole,phase:g.phase,strokes:g.strokes,score:g.scores[hole],sites:g.world.ambushSites.length});
   }
   g.ui.scorecard(g);return {course:g.roundCourse.id,results,save:JSON.parse(localStorage.getItem('ninja-golf-save'))};
  },c);
  assert.equal(result.results.length,9);assert.ok(result.results.every(r=>r.phase==='holed'&&r.score===r.strokes&&r.sites>10),JSON.stringify(result));assert.equal(result.save.nextHole,9);assert.equal(result.save.courseId,result.course);assert.ok((await page.locator('#next-hole').textContent()).includes('another'));await page.screenshot({path:`/tmp/ninja-nine-hole-score-${c}.png`});console.log('Nine holes completed:',result.course);
 }
 const reachable=await page.evaluate(async()=>{const g=window.__golfTest,{heightAt,lieAt}=await import('/src/course.js');g.begin(0,2);g.paused=true;g.phase='combat';g.spawnTime=999;g.player.root.position.set(180,heightAt(g.course,180,g.course.length+110),g.course.length+110);g.ball.position.copy(g.player.root.position);g.updateCombat(1/60);return{position:g.player.root.position.toArray(),ball:g.ball.position.toArray(),lie:lieAt(g.course,g.ball.position.x,g.ball.position.z)};});
 assert.equal(reachable.lie,'Rough');assert.ok(Math.hypot(reachable.position[0]-reachable.ball[0],reachable.position[2]-reachable.ball[2])<.01,'Every dry in-bounds ball remains reachable');
 assert.deepEqual(errors,[]);console.log('Six heroes, four course previews, free survey camera, all 36 cups and course-aware scorecards passed');
}finally{await browser.close();}
