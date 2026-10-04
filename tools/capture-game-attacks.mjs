import {preloadWarriorFixtures} from './preload-warrior-fixtures.mjs';
// Run the real combat controller, then freeze evaluated poses for a close study.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
import {routeMotionCandidate} from './route-motion-candidate.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('node tools/capture-game-attacks.mjs before|after [--baseline DIRECTORY] [--hero 0..5] [--clip CLIP_NAME] [--times T0,T1,T2,T3,T4,T5,T6,T7] [--motion standing|moving|both]\nCandidate: --model FILE.glb --motion-record FILE.json --replace-clip ORIGINAL_NAME [--ready-record FILE.json]\nSample times are eight increasing values in seconds and require --clip.\nRuns attacks through the game controller on flat ground. Saves contact sheets and joint samples in /tmp. Audio stays muted.');process.exit(0);}
const label=args.shift();if(!['before','after'].includes(label))throw Error('Use before or after. See --help.');
let baseline=null,hero=3,clipName=null,sampleTimes=null,movement='both',model=null,motionRecord=null,replaceClip=null,readyRecord=null;
while(args.length){const key=args.shift(),value=args.shift();if(key==='--baseline'&&value)baseline=value;else if(key==='--hero'&&/^[0-5]$/.test(value))hero=Number(value);else if(key==='--clip'&&value)clipName=value;else if(key==='--times'&&value)sampleTimes=value.split(',').map(Number);else if(key==='--motion'&&['standing','moving','both'].includes(value))movement=value;else if(key==='--model'&&value)model=value;else if(key==='--motion-record'&&value)motionRecord=value;else if(key==='--replace-clip'&&value)replaceClip=value;else if(key==='--ready-record'&&value)readyRecord=value;else throw Error('Invalid option. See --help.');}
if(baseline&&(model||motionRecord||replaceClip||readyRecord))throw Error('Choose --baseline or a candidate, not both.');
if(sampleTimes&&(!clipName||sampleTimes.length!==8||sampleTimes.some((t,i)=>!Number.isFinite(t)||t<0||i>0&&t<=sampleTimes[i-1])))throw Error('--times requires --clip and eight increasing, nonnegative seconds.');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:2400,height:1000}}),errors=[];await disableHmr(page);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await routeMotionCandidate(page,{hero,model,motionRecord,replaceClip,readyRecord});
 if(baseline){
  for(const name of ['ronin','shinobi','monk','kaede','ayame','sora'])await page.route(`**/models/${name}.glb?*`,route=>route.fulfill({path:path.join(baseline,name+'.glb')}));
  for(const name of ['actors','foot-placement','main','travel-pose','warriors']){
   const file=path.join(baseline,'src',name+'.js');if(fs.existsSync(file))await page.route(`**/src/${name}.js*`,async route=>{
    // Reuse Vite's resolved import URLs. Mixing timestamped and bare modules would
    // create duplicate asset registries and invalidate the baseline controller.
    const compiled=await(await route.fetch()).text(),imports=new Map(),pattern=/import\s+([^;\n]+?)\s+from\s*(['"])(.*?)\2/g,key=bindings=>bindings.split(',')[0].replace(/[\s{}]/g,'');
    for(const match of compiled.matchAll(pattern))imports.set(key(match[1]),match[3]);
    const body=fs.readFileSync(file,'utf8').replaceAll('import.meta.env.BASE_URL',"'/'").replaceAll('import.meta.env.DEV','true').replace(pattern,(full,bindings,quote,url)=>`import ${bindings} from '${imports.get(key(bindings))||url}'`);
    await route.fulfill({contentType:'application/javascript',body});
   });
  }
  const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+fs.readFileSync(path.join(baseline,'motion-data.json'),'utf8')+';');
  await page.route('**/src/motion.js*',route=>route.fulfill({contentType:'application/javascript',body:source}));
 }
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest||document.body.innerText.includes('The course could not load.'),null,{timeout:120000});await preloadWarriorFixtures(page);
 if(!await page.evaluate(()=>!!window.__golfTest))throw Error('Game boot failed; see browser errors above.');
 await page.evaluate(async hero=>{
  const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{clone}=await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');g.frame=()=>{};g.begin(hero,0);g.paused=true;g.audio.pause();g.clearEnemies();g.groundHeight=()=>0;g.slideOnLand=p=>{p.y=0;};
  const scene=new T.Scene();scene.background=new T.Color('#667077');scene.add(new T.HemisphereLight(0xffffff,0x393a35,2));const sun=new T.DirectionalLight(0xfff4e4,3);sun.position.set(-3,7,5);scene.add(sun);
  const camera=new T.OrthographicCamera(-12,12,9.5,-.5,.01,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(2400,1000);document.body.replaceChildren(renderer.domElement);
  const captions=document.createElement('div');captions.style.cssText='position:absolute;inset:0;color:#fff;font:18px sans-serif;pointer-events:none';document.body.append(captions);
  window.study={g,T,clone,scene,camera,renderer,captions,poses:[]};
 },hero);
 const reports=[];
 for(const moving of movement==='both'?[false,true]:[movement==='moving'])for(const [kind,step]of [['light',0],['light',1],['light',2],['light',3],['heavy',0],['heavy',1],['heavy',2],['heavy',3],['musou',0]]){
  const report=await page.evaluate(async({moving,kind,step,label,hero,clipName,sampleTimes})=>{
   const {g,T,clone,scene,camera,renderer,captions,poses}=window.study,{combatMotionName,motions}=await import('/src/motion.js');
   const requested=combatMotionName(g.warrior,kind,step);if(clipName&&requested!==clipName)return null;
   if(sampleTimes?.at(-1)>=motions[requested].duration)throw Error('Sample times must precede the attack duration.');
   for(const pose of poses)scene.remove(pose);poses.length=0;captions.replaceChildren();g.action=null;g.player.oneShot=0;g.player.actionToken=-1;g.player.mixer.stopAllAction();g.player.current='';g.player.play(g.warrior.readyClip||'Idle_Loop',0);g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.phase='combat';g.spawnTime=999;g.dodgeTimer=0;g.cinematic=0;g.input.clear();g.ball.position.set(0,0,190);g.camera.position.set(0,4,36);g.camera.lookAt(0,0,45);
   for(let i=0;i<24;i++)g.player.update(g.time,1/60,{groundHeight:g.groundHeight});
   if(moving){g.input.keys.add('KeyW');for(let i=0;i<30;i++){g.time+=1/60;g.updateCombat(1/60);}}
   g.lightChain=kind==='heavy'?step+1:step;g.chainExpires=g.time+10;g.startAttack(kind);
   const a=g.action,name=combatMotionName(g.warrior,kind,step),duration=a.duration,times=sampleTimes||[0,a.hits[0]*.5,a.hits[0]-.03,a.hits[0],kind==='musou'?a.hits[2]:a.hits.at(-1)+.04,duration*.72,duration*.87,duration-.002],samples=[];let t=0;
   for(let col=0;col<times.length;col++){
    while(t<times[col]-1e-7){const dt=Math.min(1/120,times[col]-t);g.time+=dt;g.updateCombat(dt);t+=dt;}
    if(col===0)g.player.update(g.time,0,{groundHeight:g.groundHeight,action:g.action,moving});g.player.root.updateMatrixWorld(true);
    const joints={};for(const key of ['pelvis','spine_01','spine_03','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'])joints[key]=g.player.bones[key].getWorldPosition(new T.Vector3()).toArray();samples.push({t,root:g.player.root.position.toArray(),joints,feet:g.player.footPlacement.report});
    for(let row=0;row<2;row++){
     const frozen=clone(g.player.root);frozen.position.set((col-3.5)*3,row===0?4.8:0,0);frozen.rotation.set(0,row===0?0:Math.PI/2,0);scene.add(frozen);poses.push(frozen);
     const text=document.createElement('div');text.style.cssText=`position:absolute;left:${col*12.5+1}%;top:${row===0?3:53}%`;text.textContent=`${t.toFixed(3)}s`;captions.append(text);
    }
   }
   const title=document.createElement('div');title.style.cssText='position:absolute;bottom:5px;left:12px';title.textContent=`${label.toUpperCase()} · hero ${hero} · ${name} · ${moving?'MOVING':'STANDING'} · real combat controller`;captions.append(title);renderer.render(scene,camera);g.input.clear();return{name,moving,samples};
  },{moving,kind,step,label,hero,clipName,sampleTimes});if(!report)continue;reports.push(report);
  await page.screenshot({path:`/tmp/ninja-game-attacks-${label}-${hero}-${moving?'moving':'standing'}-${report.name}.png`});
 }
 if(!reports.length)throw Error(`No attack matches ${clipName} for hero ${hero}.`);
 fs.writeFileSync(`/tmp/ninja-game-attacks-${label}-${hero}.json`,JSON.stringify(reports,null,2));if(errors.length)throw Error(errors.join('\n'));console.log(`Captured ${reports.length} gameplay attack sequences for hero ${hero}.`);
}finally{await browser.close();}
