// Render native golf poses with the same fitted hands and club used during play.
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const [heroText,clipName,output,...options]=process.argv.slice(2);
if(heroText==='--help'){
 console.log('node tools/capture-native-golf.mjs HERO_INDEX CLIP_NAME OUTPUT.png [--model CANDIDATE.glb --motion-record RECORDS.json] [--times 0,1.044,1.4,1.97]\nCaptures four native golf phases from front and side. Audio stays muted.');
 process.exit(0);
}
if(!/^[0-5]$/.test(heroText??'')||!['Golf_Address','Golf_Swing','Golf_Putt'].includes(clipName)||!output?.endsWith('.png'))throw Error('Pass HERO_INDEX (0–5), CLIP_NAME and OUTPUT.png. See --help.');
let model=null,motionRecord=null,sampleTimes=null;
while(options.length){const option=options.shift();if(option==='--model'&&options[0])model=options.shift();else if(option==='--motion-record'&&options[0])motionRecord=options.shift();else if(option==='--times'&&options[0])sampleTimes=options.shift().split(',').map(Number);else throw Error('Unknown option: '+option);}
if(sampleTimes&&(sampleTimes.length!==4||sampleTimes.some(t=>!Number.isFinite(t)||t<0)))throw Error('--times requires four nonnegative seconds.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:2400,height:1200}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await disableHmr(page);
 if(model){const name=['ronin','shinobi','monk','kaede','ayame','sora'][Number(heroText)];await page.route(`**/models/${name}.glb?*`,route=>route.fulfill({path:model}));}
 if(model&&!motionRecord)throw Error('Golf candidates require matching --motion-record to preserve the native wrist pose.');
 if(motionRecord){const records=JSON.parse(fs.readFileSync(motionRecord,'utf8')),motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8'));for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){if(!records[name])throw Error('Missing candidate motion '+name);motions[name]=records[name];}const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';');await page.route('**/src/motion.js*',route=>route.fulfill({contentType:'application/javascript',body:source}));}
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async({hero,clipName,sampleTimes})=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  
  await loadWarriorAssets();
  const scene=new T.Scene();scene.background=new T.Color('#677077');
  scene.add(new T.HemisphereLight(0xffffff,0x3c3b36,2));
  const light=new T.DirectionalLight(0xfff5e8,3);light.position.set(-3,7,5);scene.add(light);
  const camera=new T.OrthographicCamera(-6,6,5,-1,.01,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(2400,1200);document.body.replaceChildren(renderer.domElement);
  const labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;color:#fff;font:22px sans-serif';document.body.append(labels);
  const samples=[];
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){
   const actor=new Warrior(hero),action=actor.actions.get(clipName);
   if(!action)throw Error('Missing native clip: '+clipName);
   actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play(clipName,0,true);
   const time=sampleTimes?sampleTimes[i]:clipName==='Golf_Swing'?[0,1.044,1.4,1.97][i]:action.getClip().duration*i/3;
   if(time>action.getClip().duration)throw Error('A sample exceeds the clip duration.');
   action.time=Math.min(time,action.getClip().duration-.000001);actor.mixer.update(0);actor.syncHeldObjects(undefined,true);actor.weapon.visible=false;actor.club.visible=true;if(actor.offhand)actor.offhand.visible=false;
   const joints={};for(const name of ['pelvis','spine_03','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'])joints[name]=actor.bones[name].getWorldPosition(new T.Vector3()).toArray();
   if(row===0)samples.push({time,joints});
   actor.root.position.set((i-1.5)*3,row===0?2.1:-.9,0);actor.root.rotation.y=row===0?0:Math.PI/2;scene.add(actor.root);
   const label=document.createElement('div');label.style.cssText=`position:absolute;left:${i*25+1}%;top:${row===0?3:53}%`;label.textContent=time.toFixed(3)+' s';labels.append(label);
  }
  const title=document.createElement('div');title.style.cssText='position:absolute;left:14px;bottom:10px';title.textContent=`${WARRIORS[hero].name} · ${clipName} · native clip · front / side`;labels.append(title);
  renderer.render(scene,camera);return samples;
 },{hero:Number(heroText),clipName,sampleTimes});
 await page.screenshot({path:output});
 if(errors.length)throw Error(errors.join('\n'));
 console.log(JSON.stringify({hero:Number(heroText),clip:clipName,output,samples:report}));
}finally{await browser.close();}
