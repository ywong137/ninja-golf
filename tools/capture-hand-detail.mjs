// Render the actual runtime grip at useful review scale, not a crop of a distant character.
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {disableHmr} from './disable-hmr.mjs';
import {routeMotionCandidate} from './route-motion-candidate.mjs';
const {values}=parseArgs({options:{hero:{type:'string'},clip:{type:'string'},times:{type:'string'},output:{type:'string'},framing:{type:'string',default:'hand'},model:{type:'string'},'motion-record':{type:'string'},'ready-record':{type:'string'},'replace-clip':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/capture-hand-detail.mjs --hero 0..5 --clip CLIP --times 0.05,0.15,0.30 --output /tmp/review-prefix [--framing hand|grip|body]\nOptional candidate: --model MODEL.glb --motion-record MOTION.json --ready-record READY.json --replace-clip ORIGINAL_CLIP\nRenders front, right, left, and three-quarter views from fixed model axes at 1200x800. The left view looks behind the golf finish. Supports golf clips and playable attacks. Audio stays muted.');process.exit(0);}
const hero=Number(values.hero),times=values.times?.split(',').map(Number);
if(!/^[0-5]$/.test(values.hero??'')||!values.clip||!values.output||!times?.length||times.some(t=>!Number.isFinite(t)||t<0)||!['hand','grip','body'].includes(values.framing))throw Error('Supply valid --hero, --clip, --times, --output, and --framing. See --help.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await routeMotionCandidate(page,{hero,model:values.model,motionRecord:values['motion-record'],readyRecord:values['ready-record'],replaceClip:values['replace-clip']});
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async({hero,clip,times})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),{ATTACKS,attackDefinition}=await import('/src/combat.js'),{combatMotionName,motions}=await import('/src/motion.js');await loadWarriorAssets();
  const definition=Object.entries(ATTACKS).flatMap(([kind,steps])=>(Array.isArray(steps)?steps:[steps]).map((a,step)=>({...attackDefinition(kind,step,WARRIORS[hero].combatStyle),kind,step}))).find(a=>combatMotionName(WARRIORS[hero],a.kind,a.step)===clip);
  const golf=['Golf_Address','Golf_Swing','Golf_Putt'].includes(clip);
  if(!definition&&!golf)throw Error('The clip is not a golf motion or playable attack for this hero.');if(times.some(t=>t>motions[clip].duration||(!golf&&t===motions[clip].duration)))throw Error('Sample times must lie within the clip duration.');
  const scene=new T.Scene();scene.background=new T.Color('#58646b');scene.add(new T.HemisphereLight(0xffffff,0x393a35,2));const sun=new T.DirectionalLight(0xfff4e4,3);sun.position.set(-3,7,5);scene.add(sun);
  const camera=new T.PerspectiveCamera(31,1.5,.01,100),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);document.body.append(renderer.domElement);
  const label=document.createElement('div');label.style.cssText='position:absolute;left:20px;top:16px;color:white;font:18px sans-serif';document.body.append(label);
  window.detail={T,Warrior,hero,clip,golf,definition,scene,camera,renderer,label,actor:null};
 },{hero,clip:values.clip,times});
 const report=[];
 for(const time of times){
  const pose=await page.evaluate(time=>{
   const d=window.detail;if(d.actor){d.scene.remove(d.actor.root);d.actor.dispose();}const p=d.actor=new d.Warrior(d.hero);d.scene.add(p.root);
   if(d.golf){
    p.mixer.stopAllAction();p.current='';p.play(d.clip,0,true);
    for(let elapsed=0;elapsed<time-1e-8;){const dt=Math.min(1/240,time-elapsed);elapsed+=dt;p.update(elapsed,dt,{golf:true,previewPose:{clip:d.clip,time:Math.min(elapsed,p.actions.get(d.clip).getClip().duration-1e-5)}});}
    if(time===0)p.update(0,0,{golf:true,previewPose:{clip:d.clip,time:0}});
    p.root.updateMatrixWorld(true);return{time,clip:p.current,clipTime:p.actions.get(p.current).time};
   }
   for(let f=0;f<30;f++)p.update(f/60,1/60,{groundHeight:()=>0});
   const action={...d.definition,token:1,time:0};p.update(1,0,{action,groundHeight:()=>0});
   for(let elapsed=0;elapsed<time-1e-8;){const dt=Math.min(1/240,time-elapsed);elapsed+=dt;action.time=elapsed;p.update(1+elapsed,dt,{action,groundHeight:()=>0});}
   p.root.updateMatrixWorld(true);return{time,clip:p.current,clipTime:p.actions.get(p.current).time};
  },time);report.push(pose);
  for(const [name,offset]of [['front',[0,.12,2.15]],['right',[-2.15,.12,0]],['left',[2.15,.12,0]],['three-quarter',[-1.5,.20,1.5]]]){
   await page.evaluate(({time,name,offset,framing})=>{const {T,actor,camera,scene,renderer,label,clip}=window.detail,hand=actor.bones.hand_r.getWorldPosition(new T.Vector3()),elbow=actor.bones.lowerarm_r.getWorldPosition(new T.Vector3());const target=framing==='body'?new T.Vector3(0,1.12,0):framing==='grip'?hand.lerp(actor.bones.hand_l.getWorldPosition(new T.Vector3()),.5):hand.lerp(elbow,.25);camera.position.copy(target).add(new T.Vector3(...offset).multiplyScalar(framing==='body'?2.4:framing==='grip'?.4:1));camera.lookAt(target);label.textContent=`${clip} · ${time.toFixed(3)}s · ${name} · runtime ${framing}`;renderer.render(scene,camera);},{time,name,offset,framing:values.framing});
   await page.screenshot({path:`${values.output}-${time.toFixed(3)}-${name}.png`});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(values.output+'.json',JSON.stringify(report,null,2));console.log(`Rendered ${times.length*4} runtime hand detail views.`);
}finally{await browser.close();}
