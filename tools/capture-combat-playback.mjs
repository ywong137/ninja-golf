// Record real-time combat for review and measure the rendered frame rate.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {disableHmr} from './disable-hmr.mjs';
import {routeMotionCandidate} from './route-motion-candidate.mjs';
import {routeModelDirectory} from './route-model-directory.mjs';
const {values,positionals}=parseArgs({allowPositionals:true,options:{hero:{type:'string',default:'0'},kind:{type:'string',default:'heavy'},step:{type:'string',default:'0'},model:{type:'string'},'motion-record':{type:'string'},'ready-record':{type:'string'},'replace-clip':{type:'string'},'expect-clip':{type:'string'},sprint:{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/capture-combat-playback.mjs [OUTPUT.webm] [--hero 0..5] [--kind light|heavy] [--step 0..3] [--expect-clip NAME] [--sprint]\nStep is the zero-based attack index: heavy 0 is cleave, heavy 1 is rising.\nOptional candidate: --model FILE.glb --motion-record FILE.json --replace-clip ORIGINAL_NAME --ready-record FILE.json\nOr set NINJA_MODEL_DIRECTORY to route complete candidate models. Do not combine both candidate methods.\nRecords ten seconds of combat at 1440x900 with at least 12 enemies. Verifies the selected clip and records each clip interval.\n--sprint records sprint, attack, sprint, attack, sprint and verifies that sequence. Audio remains muted.');process.exit(0);}
if(positionals.length>1||!/^[0-5]$/.test(values.hero)||!['light','heavy'].includes(values.kind)||!/^[0-3]$/.test(values.step))throw Error('Invalid options. See --help.');
if(process.env.NINJA_MODEL_DIRECTORY&&[values.model,values['motion-record'],values['ready-record'],values['replace-clip']].some(Boolean))throw Error('Choose NINJA_MODEL_DIRECTORY or the individual motion candidate options. See --help.');
const output=positionals[0]||'/tmp/ninja-combat-playback.webm',hero=Number(values.hero),attackStep=Number(values.step),kind=values.kind;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await routeModelDirectory(page,process.env.NINJA_MODEL_DIRECTORY);
 const candidateName=await routeMotionCandidate(page,{hero,model:values.model,motionRecord:values['motion-record'],readyRecord:values['ready-record'],replaceClip:values['replace-clip']});
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const expectedClip=await page.evaluate(async({hero,kind,attackStep,requestedClip,candidateName,sprint})=>{
  const g=window.__golfTest,{heightAt}=await import('/src/course.js');g.audio.enabled=false;g.ui.showScreen('game');g.begin(hero,0);g.audio.pause();g.phase='combat';
  const {combatMotionName}=await import('/src/motion.js'),expectedClip=combatMotionName(g.warrior,kind,attackStep);
  for(const wanted of [requestedClip,candidateName])if(wanted&&wanted!==expectedClip)throw Error(`Selected ${kind} step ${attackStep} plays ${expectedClip}, not ${wanted}. Correct --kind/--step before recording.`);
  g.player.root.position.set(0,heightAt(g.course,0,70),70);g.ball.position.set(0,heightAt(g.course,0,220),220);
  g.spawnTime=2;g.health=10000;g.resolve=100;g.enemyBudget=120;g.enemiesSpawned=0;g.spawnWave(24);g.input.clear();
  if(g.enemies.length<12)throw Error(`Crowd setup failed: ${g.enemies.length} enemies`);
  const samples=[],chunks=[],stream=g.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
  const frame=g.frame.bind(g);g.frame=()=>{frame();samples.push({time:performance.now(),enemies:g.enemies.length,clip:g.player.current,pixelRatio:g.renderer.getPixelRatio()});};
  const startAttack=()=>{g.lightChain=kind==='heavy'?attackStep+1:attackStep;g.chainExpires=g.time+10;g.startAttack(kind);};
  const started=performance.now();let step=0,lastStage=-1;
  const drive=()=>{
   g.input.clear();
   if(sprint){
    g.input.keys.add('KeyW');g.input.keys.add('ShiftLeft');
    const stage=Math.floor((performance.now()-started)/2000);
    if(stage!==lastStage&&(stage===1||stage===3)&&!g.action)startAttack();
    lastStage=stage;
   }else{if(step%4<2)g.input.keys.add(step%4===0?'KeyW':'KeyD');if(!g.action)startAttack();step++;}
  };
  if(sprint)drive();const interval=setInterval(drive,sprint?100:1100);
  window.playback={samples,chunks,stream,recorder,interval};return expectedClip;
 },{hero,kind,attackStep,requestedClip:values['expect-clip'],candidateName,sprint:!!values.sprint});
 await page.waitForTimeout(10000);
 const result=await page.evaluate(async()=>{
  const {samples,chunks,stream,recorder,interval}=window.playback;clearInterval(interval);window.__golfTest.input.clear();
  await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(track=>track.stop());
  const measured=samples.filter(x=>x.time>samples[0].time+2000),fps=(measured.length-1)*1000/(measured.at(-1).time-measured[0].time);
  const intervals=[];for(const sample of samples){const time=(sample.time-samples[0].time)/1000,last=intervals.at(-1);if(last?.clip===sample.clip){last.end=time;last.frames++;}else intervals.push({clip:sample.clip,start:time,end:time,frames:1});}
  return{clips:[...new Set(samples.map(s=>s.clip))],intervals,fps,minEnemies:Math.min(...measured.map(x=>x.enemies)),maxEnemies:Math.max(...measured.map(x=>x.enemies)),pixelRatio:measured.at(-1).pixelRatio,video:Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()))};
 });
 const {video,...metrics}=result;fs.writeFileSync(output,Buffer.from(video));fs.writeFileSync(output+'.json',JSON.stringify({hero,kind,attackStep,sprint:!!values.sprint,expectedClip,...metrics,errors},null,2));
 await page.screenshot({path:output+'.png'});const {intervals,...summary}=metrics;console.log(JSON.stringify({output,expectedClip,...summary,intervalCount:intervals.length,errors}));
 if(!metrics.intervals.some(interval=>interval.clip===expectedClip&&interval.frames>=3))throw Error(`The recording did not capture ${expectedClip} for three frames. See the JSON report.`);
 if(values.sprint){
  const sequence=metrics.intervals.filter(x=>x.frames>=3&&[expectedClip,'Sprint_Forward'].includes(x.clip)).map(x=>x.clip).filter((x,i,a)=>i===0||x!==a[i-1]);
  const expected=['Sprint_Forward',expectedClip,'Sprint_Forward',expectedClip,'Sprint_Forward'];
  if(expected.some((clip,i)=>clip!==sequence[i]))throw Error(`Sprint/attack recovery sequence failed: ${sequence.join(' → ')}. See the JSON report.`);
 }
 if(errors.length||metrics.fps<40||metrics.minEnemies<12)throw Error('Combat playback failed its frame-rate, crowd, or console check. See the JSON report.');
}finally{await browser.close();}
