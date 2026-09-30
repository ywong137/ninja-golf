// Record the runtime golf pose from two fixed cameras, with audio muted.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{
  hero:{type:'string',default:'3'},speed:{type:'string',default:'1'},
  model:{type:'string'},'grip-profiles':{type:'string'},help:{type:'boolean'},
}});
if(values.help){
  console.log('node tools/capture-golf-playback.mjs OUTPUT.webm [--hero 0..5] [--speed 0.1..1] [--model CANDIDATE.glb] [--grip-profiles GRIPS.json]\nRecords one Golf_Swing and its final hold through Warrior.update. Uses fixed address-front and address-side cameras. Audio stays muted. Writes a frame-time report beside the video. Requires the local Vite server on port 5173.');
  process.exit(0);
}
const [output]=positionals,hero=Number(values.hero),speed=Number(values.speed);
if(positionals.length!==1||!output.endsWith('.webm')||!/^[0-5]$/.test(values.hero)||!Number.isFinite(speed)||speed<.1||speed>1)
  throw Error('Supply OUTPUT.webm, --hero 0..5, and --speed 0.1..1. See --help.');
if(!fs.existsSync(path.dirname(output)))throw Error('Create the output directory first: '+path.dirname(output));
if(values.model&&!fs.existsSync(values.model))throw Error('Candidate model does not exist: '+values.model);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
  if(values.model){const name=['ronin','shinobi','monk','kaede','ayame','sora'][hero];await page.route(`**/models/${name}.glb?*`,route=>route.fulfill({path:values.model}));}
  if(values['grip-profiles']){const profiles=JSON.parse(fs.readFileSync(values['grip-profiles'],'utf8'));if(!profiles[['ronin','shinobi','monk','kaede','ayame','sora'][hero]]?.golf)throw Error('The grip profiles lack the selected hero golf grasp.');await page.route('**/src/grip-data.json*',route=>route.fulfill({contentType:'application/javascript',body:'export default '+JSON.stringify(profiles)+';'}));}
  await page.goto('http://localhost:5173/tests/rig-stage.html');
  const result=await page.evaluate(async({hero,speed})=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
    const {WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();
    const actor=new Warrior(hero),scene=new T.Scene();scene.background=new T.Color('#677077');
    scene.add(actor.root,new T.HemisphereLight(0xffffff,0x444444,2));
    const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-3,7,5);scene.add(sun,new T.GridHelper(6,24,0x999999,0x888888));
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.setScissorTest(true);
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;
    document.body.replaceChildren(canvas);const ctx=canvas.getContext('2d');
    const cameras=[new T.OrthographicCamera(-1.5,1.5,1.875,-1.875,.01,100),new T.OrthographicCamera(-1.5,1.5,1.875,-1.875,.01,100)];
    cameras[0].position.set(0,1.5,5);cameras[1].position.set(-5,1.5,0);for(const c of cameras)c.lookAt(0,1.5,0);
    const clip='Golf_Swing',duration=actor.actions.get(clip).getClip().duration,samples=[],chunks=[];
    actor.mixer.stopAllAction();actor.current='';actor.play(clip,0,true);
    const render=(time,dt)=>{
      actor.update(time,dt,{golf:true,previewPose:{clip,time:Math.min(time,duration-1e-5)}});
      for(let i=0;i<2;i++){renderer.setViewport(i*640,0,640,800);renderer.setScissor(i*640,0,640,800);renderer.render(scene,cameras[i]);}
      ctx.drawImage(renderer.domElement,0,0);ctx.fillStyle='white';ctx.font='18px sans-serif';
      for(let i=0;i<2;i++)ctx.fillText(`${WARRIORS[hero].name} · ${i?'address-side':'address-front'} · ${time.toFixed(3)} s · ${speed}×`,i*640+14,28);
    };
    render(0,0);
    const stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();
    const start=performance.now();let previous=start;
    await new Promise(resolve=>{
      const frame=now=>{
        const elapsed=(now-start)/1000,dt=(now-previous)/1000;previous=now;
        const time=Math.min(duration,elapsed*speed);render(time,dt);samples.push({elapsed,time,dt});
        if(elapsed>=duration/speed+.6)resolve();else requestAnimationFrame(frame);
      };requestAnimationFrame(frame);
    });
    await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(t=>t.stop());
    const video=Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
    const result={clip,duration,samples,video};actor.dispose();renderer.dispose();return result;
  },{hero,speed});
  const {video,...report}=result;
  fs.writeFileSync(output,Buffer.from(video));fs.writeFileSync(output+'.json',JSON.stringify({hero,speed,...report,errors},null,2));
  await page.screenshot({path:output+'.png'});
  if(errors.length)throw Error(errors.join('\n'));
  const wallSeconds=report.samples.at(-1).elapsed;
  console.log(JSON.stringify({output,hero,speed,clip:report.clip,frames:report.samples.length,wallSeconds,fps:report.samples.length/wallSeconds,errors}));
}finally{await browser.close();}
