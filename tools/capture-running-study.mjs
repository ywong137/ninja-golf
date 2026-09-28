import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const label=process.argv[2]||'after';
if(label==='--help'){console.log('Usage: node tools/capture-running-study.mjs [before|pilot|after] [HERO_A,HERO_B]\nCaptures six phases of two heroes from four views. Hero IDs are 0–5; default 0,3. Chrome audio stays muted.');process.exit(0);}
if(!['before','pilot','after'].includes(label))throw new Error('Use before, pilot, or after. See --help.');
const heroText=process.argv[3]||'0,3';if(!/^[0-5],[0-5]$/.test(heroText))throw Error('Pass two comma-separated hero IDs from 0 to 5.');
const heroes=heroText.split(',').map(Number),suffix=process.argv[3]?'-'+heroes.join('-'):'';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async heroes=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();
  const scene=new T.Scene();scene.background=new T.Color('#667077');scene.add(new T.HemisphereLight(0xffffff,0x393a35,2));
  const sun=new T.DirectionalLight(0xfff4e4,3);sun.position.set(-3,7,5);scene.add(sun);
  const camera=new T.OrthographicCamera(-5.5,5.5,7.05,-.5125,.01,100);camera.position.set(0,0,15);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1100);document.body.append(renderer.domElement);
  const players=[];
  for(const [row,hero]of heroes.entries())for(const [column,yaw]of [0,Math.PI/2,Math.PI,-.6].entries()){
   const p=new Warrior(hero);p.root.position.set((column-1.5)*2.65,row===0?3.75:0,0);p.root.rotation.y=yaw;scene.add(p.root);
   for(let n=0;n<30;n++)p.update(n/60,1/60,{moving:true,moveSpeed:5.6});players.push(p);
  }
  const captions=document.createElement('div');captions.style.cssText='position:absolute;top:8px;left:0;width:100%;color:white;font:16px sans-serif;display:flex;justify-content:space-around';
  for(const name of ['FRONT','SIDE','BACK','THREE QUARTER']){const text=document.createElement('span');text.textContent=name;captions.append(text);}document.body.append(captions);
  window.runningStudy={scene,camera,renderer,players};
 },heroes);
 for(let frame=0;frame<6;frame++){
  await page.evaluate(phase=>{const {scene,camera,renderer,players}=window.runningStudy;for(const p of players){p.runPhase=phase;p.update(phase,0,{moving:true,moveSpeed:5.6});}renderer.render(scene,camera);},frame/6);
  await page.screenshot({path:`/tmp/ninja-running-study-${label}${suffix}-${frame}.png`});
 }
 if(errors.length)throw new Error(errors.join('\n'));console.log(`Running study ${label}: six phases, two heroes, four views.`);
}finally{await browser.close();}
