// Record real-time combat for review and measure the rendered frame rate.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {disableHmr} from './disable-hmr.mjs';
import {routeMotionCandidate} from './route-motion-candidate.mjs';
const {values,positionals}=parseArgs({allowPositionals:true,options:{hero:{type:'string',default:'0'},kind:{type:'string',default:'heavy'},step:{type:'string',default:'0'},model:{type:'string'},'motion-record':{type:'string'},'ready-record':{type:'string'},'replace-clip':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/capture-combat-playback.mjs [OUTPUT.webm] [--hero 0..5] [--kind light|heavy] [--step 0..3]\nOptional candidate: --model FILE.glb --motion-record FILE.json --replace-clip ORIGINAL_NAME --ready-record FILE.json\nRecords ten seconds of combat at1440x900 with at least12 enemies. Audio remains muted.');process.exit(0);}
if(positionals.length>1||!/^[0-5]$/.test(values.hero)||!['light','heavy'].includes(values.kind)||!/^[0-3]$/.test(values.step))throw Error('Invalid options. See --help.');
const output=positionals[0]||'/tmp/ninja-combat-playback.webm',hero=Number(values.hero),attackStep=Number(values.step),kind=values.kind;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await routeMotionCandidate(page,{hero,model:values.model,motionRecord:values['motion-record'],readyRecord:values['ready-record'],replaceClip:values['replace-clip']});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 await page.evaluate(async({hero,kind,attackStep})=>{
  const g=window.__golfTest,{heightAt}=await import('/src/course.js');g.audio.enabled=false;g.ui.showScreen('game');g.begin(hero,0);g.audio.pause();g.phase='combat';
  g.player.root.position.set(0,heightAt(g.course,0,70),70);g.ball.position.set(0,heightAt(g.course,0,220),220);
  g.spawnTime=2;g.health=10000;g.resolve=100;g.enemyBudget=120;g.enemiesSpawned=0;g.spawnWave(24);g.input.clear();
  if(g.enemies.length<12)throw Error(`Crowd setup failed: ${g.enemies.length} enemies`);
  const samples=[],chunks=[],stream=g.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
  const frame=g.frame.bind(g);g.frame=()=>{frame();samples.push({time:performance.now(),enemies:g.enemies.length,pixelRatio:g.renderer.getPixelRatio()});};
  let step=0;const interval=setInterval(()=>{g.input.clear();if(step%4<2)g.input.keys.add(step%4===0?'KeyW':'KeyD');if(!g.action){g.lightChain=kind==='heavy'?attackStep+1:attackStep;g.chainExpires=g.time+10;g.startAttack(kind);}step++;},1100);
  window.playback={samples,chunks,stream,recorder,interval};
 },{hero,kind,attackStep});
 await page.waitForTimeout(10000);
 const result=await page.evaluate(async()=>{
  const {samples,chunks,stream,recorder,interval}=window.playback;clearInterval(interval);window.__golfTest.input.clear();
  await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(track=>track.stop());
  const measured=samples.filter(x=>x.time>samples[0].time+2000),fps=(measured.length-1)*1000/(measured.at(-1).time-measured[0].time);
  return{fps,minEnemies:Math.min(...measured.map(x=>x.enemies)),maxEnemies:Math.max(...measured.map(x=>x.enemies)),pixelRatio:measured.at(-1).pixelRatio,video:Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()))};
 });
 const {video,...metrics}=result;fs.writeFileSync(output,Buffer.from(video));fs.writeFileSync(output+'.json',JSON.stringify({hero,kind,attackStep,...metrics,errors},null,2));
 await page.screenshot({path:output+'.png'});console.log(JSON.stringify({output,...metrics,errors}));
 if(errors.length||metrics.fps<40||metrics.minEnemies<12)throw Error('Combat playback failed its frame-rate, crowd, or console check. See the JSON report.');
}finally{await browser.close();}
