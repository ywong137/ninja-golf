// Record real-time combat for review and measure the rendered frame rate.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {disableHmr} from './disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('node tools/capture-combat-playback.mjs [OUTPUT.webm]\nRecords ten seconds of Ronin combat at1440x900 with at least12 enemies. Audio remains muted.');process.exit(0);}
if(process.argv.length>3||process.argv[2]?.startsWith('--'))throw Error('Invalid options. See --help.');
const output=process.argv[2]||'/tmp/ninja-combat-playback.webm';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 await page.evaluate(async()=>{
  const g=window.__golfTest,{heightAt}=await import('/src/course.js');g.audio.enabled=false;g.ui.showScreen('game');g.begin(0,0);g.audio.pause();g.phase='combat';
  g.player.root.position.set(0,heightAt(g.course,0,70),70);g.ball.position.set(0,heightAt(g.course,0,220),220);
  g.spawnTime=2;g.health=10000;g.resolve=100;g.enemyBudget=120;g.enemiesSpawned=0;g.spawnWave(24);g.input.clear();
  if(g.enemies.length<12)throw Error(`Crowd setup failed: ${g.enemies.length} enemies`);
  const samples=[],chunks=[],stream=g.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
  const frame=g.frame.bind(g);g.frame=()=>{frame();samples.push({time:performance.now(),enemies:g.enemies.length,pixelRatio:g.renderer.getPixelRatio()});};
  let step=0;const interval=setInterval(()=>{g.input.clear();if(step%4<2)g.input.keys.add(step%4===0?'KeyW':'KeyD');if(!g.action){g.lightChain=0;g.startAttack('heavy');}step++;},1100);
  window.playback={samples,chunks,stream,recorder,interval};
 });
 await page.waitForTimeout(10000);
 const result=await page.evaluate(async()=>{
  const {samples,chunks,stream,recorder,interval}=window.playback;clearInterval(interval);window.__golfTest.input.clear();
  await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(track=>track.stop());
  const measured=samples.filter(x=>x.time>samples[0].time+2000),fps=(measured.length-1)*1000/(measured.at(-1).time-measured[0].time);
  return{fps,minEnemies:Math.min(...measured.map(x=>x.enemies)),maxEnemies:Math.max(...measured.map(x=>x.enemies)),pixelRatio:measured.at(-1).pixelRatio,video:Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()))};
 });
 const {video,...metrics}=result;fs.writeFileSync(output,Buffer.from(video));fs.writeFileSync(output+'.json',JSON.stringify({...metrics,errors},null,2));
 await page.screenshot({path:output+'.png'});console.log(JSON.stringify({output,...metrics,errors}));
 if(errors.length||metrics.fps<40||metrics.minEnemies<12)throw Error('Combat playback failed its frame-rate, crowd, or console check. See the JSON report.');
}finally{await browser.close();}
