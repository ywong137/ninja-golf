import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const output=process.argv[2]||'/tmp/ninja-strafe/runtime';
if(output==='--help'){console.log('Usage: node tools/capture-strafe-study.mjs [OUTPUT_DIRECTORY]\nCapture six heroes, lateral run phases, and a muted realtime turn sequence.');process.exit(0);}
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();
  const r=new T.WebGLRenderer({antialias:true});r.setSize(1500,1000);document.body.append(r.domElement);const players=[];
  for(let hero=0;hero<6;hero++){
   const p=new Warrior(hero),scene=new T.Scene();scene.background=new T.Color('#677077');scene.add(p.root,new T.HemisphereLight(0xffffff,0x444444,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,7,5);scene.add(light,new T.GridHelper(100,200,0xaaaaaa,0x888888));
   const camera=new T.PerspectiveCamera(33,1,.01,200),speed=5.3*WARRIORS[hero].speed;
   for(let i=0;i<60;i++)p.update(i/60,1/60,{moving:true,focused:true,moveAngle:Math.PI/2,moveSpeed:speed,groundHeight:()=>0});
   players.push({p,scene,camera,speed});
   const label=document.createElement('div');label.textContent=WARRIORS[hero].name;label.style=`position:absolute;top:${Math.floor(hero/3)*500+10}px;left:${hero%3*500+10}px;color:white;font:20px sans-serif`;document.body.append(label);
  }
  function render(time,dt,angle,phase=null){
   r.setScissorTest(true);
   for(const [i,{p,scene,camera,speed}]of players.entries()){
    if(phase!==null)p.runPhase=phase;else p.root.position.add(new T.Vector3(Math.sin(angle)*speed*dt,0,Math.cos(angle)*speed*dt));
    p.update(time,dt,{moving:true,focused:true,moveAngle:angle,moveSpeed:speed,groundHeight:()=>0});
    const target=p.root.position.clone().add(new T.Vector3(0,1,0));camera.position.copy(target).add(new T.Vector3(-2.6,1,4));camera.lookAt(target);
    r.setViewport(i%3*500,(1-Math.floor(i/3))*500,500,500);r.setScissor(i%3*500,(1-Math.floor(i/3))*500,500,500);r.render(scene,camera);
   }
  }
  window.study={players,render,r};render(0,0,Math.PI/2,0);
 });
 for(const direction of [-1,1])for(const phase of [0,1/6,2/6,.5,2/3,5/6]){
  await page.evaluate(({direction,phase})=>window.study.render(phase,0,direction*Math.PI/2,phase),{direction,phase});
  await page.screenshot({path:path.join(output,`${direction<0?'left':'right'}-${Math.round(phase*100)}.png`)});
 }
 const data=await page.evaluate(async()=>{
  const {r,render}=window.study,chunks=[],recorder=new MediaRecorder(r.domElement.captureStream(30),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const ended=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
  await new Promise(resolve=>{const start=performance.now();let old=start;function frame(now){const t=(now-start)/1000,dt=Math.min((now-old)/1000,.05);old=now;const angle=t<3?Math.PI/2:t<4?Math.PI/2-(t-3)*Math.PI:-Math.PI/2;render(t,dt,angle);if(t<7)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});recorder.stop();await ended;
  const array=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));return btoa(binary);
 });fs.writeFileSync(path.join(output,'six-hero-strafe.webm'),Buffer.from(data,'base64'));console.log(output);
}finally{await browser.close();}
