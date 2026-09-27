import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const args=process.argv.slice(2),label=args[0]||'after';
if(label==='--help'){
 console.log('Usage: node tools/capture-combat-study.mjs before|after [--baseline DIRECTORY]\nCaptures front and side attack sequences. The baseline directory must contain hero GLBs and motion-data.json. Audio stays muted.');process.exit(0);
}
if(!['before','after'].includes(label))throw new Error('Use before or after. See --help.');
const baseline=args.includes('--baseline')?args[args.indexOf('--baseline')+1]:null;
if(args.includes('--baseline')&&!baseline)throw new Error('Pass a directory after --baseline.');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:2400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 if(baseline){
  for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])await page.route(`**/models/${hero}.glb?*`,route=>route.fulfill({path:path.join(baseline,hero+'.glb')}));
  const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+fs.readFileSync(path.join(baseline,'motion-data.json'),'utf8')+';');
  await page.route('**/src/motion.js',route=>route.fulfill({contentType:'application/javascript',body:source}));
 }
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions}=await import('/src/motion.js');await loadWarriorAssets();
  const scene=new T.Scene();scene.background=new T.Color('#667077');scene.add(new T.HemisphereLight(0xffffff,0x393a35,2));
  const sun=new T.DirectionalLight(0xfff4e4,3);sun.position.set(-3,7,5);scene.add(sun);
  const camera=new T.OrthographicCamera(-12,12,7.25,-.65,.01,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(2400,1000);document.body.append(renderer.domElement);
  const captions=document.createElement('div');captions.style.cssText='position:absolute;inset:0;color:#fff;font:18px sans-serif;pointer-events:none';document.body.append(captions);
  const players=[];window.combatStudy={Warrior,motions,scene,camera,renderer,captions,players};
 });
 for(const [hero,prefix]of [[0,''],[3,'Fan_']])for(const [clip,hits]of [['Cut_Diagonal',[.15]],['Heavy_Cleave',[.36]],['Heavy_Sweep',[.28,.53]]]){
  await page.evaluate(({hero,name,hits,label})=>{
   const {Warrior,motions,scene,camera,renderer,captions,players}=window.combatStudy;
   for(const p of players){scene.remove(p.root);p.dispose();}players.length=0;captions.replaceChildren();
   const duration=motions[name].duration,times=[0,hits[0]*.5,hits[0]-.035,hits[0],hits.at(-1),duration*.77,duration*.91,duration];
   for(let row=0;row<2;row++)for(let col=0;col<times.length;col++){
    const p=new Warrior(hero),time=times[col];p.mixer.stopAllAction();p.current='';p.play(name,0,true);p.actions.get(name).time=Math.min(time,duration-.000001);p.mixer.update(0);p.syncHeldObjects();
    p.root.position.set((col-3.5)*3,row===0?3.9:0,0);p.root.rotation.y=row===0?0:Math.PI/2;scene.add(p.root);players.push(p);
    const text=document.createElement('div');text.style.cssText=`position:absolute;left:${col*12.5+1}%;top:${row===0?3:53}%`;text.textContent=`${time.toFixed(3)}s${hits.some(t=>Math.abs(time-t)<.001)?' · HIT':''}`;captions.append(text);
   }
   const title=document.createElement('div');title.style.cssText='position:absolute;bottom:5px;left:12px';title.textContent=`${label.toUpperCase()} — ${hero===0?'Ronin':'Kaede'} · ${name} · FRONT / SIDE`;captions.append(title);
   renderer.render(scene,camera);
  },{hero,name:prefix+clip,hits,label});
  await page.screenshot({path:`/tmp/ninja-combat-study-${label}-${hero}-${clip}.png`});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`Combat study ${label}: six clips, eight phases, front and side.`);
}finally{await browser.close();}
