import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {projectPlaybackMotions} from '../tools/playback-motion.mjs';
import {disableHmr} from '../tools/disable-hmr.mjs';

const compareSampler=process.argv.includes('--sampler');
const output=compareSampler?'/tmp/ninja-sampling/browser':'/tmp/ninja-playback-motion';fs.mkdirSync(output,{recursive:true});
const full=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const reports=[];
try {
 for(const [variant,records]of [['reference',compareSampler?projectPlaybackMotions(full):full],['playback',projectPlaybackMotions(full)]]){
  const context=await browser.newContext({viewport:{width:1200,height:800}}),page=await context.newPage(),errors=[];
  try {
   await disableHmr(page);page.on('pageerror',error=>errors.push(error.message));
   // Use the same module projection as the release plugin, against the actual actor runtime.
   await page.route('**/src/motion-data.json*',route=>route.fulfill({contentType:'application/javascript',body:`export default ${JSON.stringify(records)};`}));
   if(compareSampler&&variant==='reference'){
    const current=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8');
    const before=fs.readFileSync(new URL('./fixtures/motion-sampler-before.js',import.meta.url),'utf8');
    const wrappers=`export function sampleMotion(name,seconds){return sampleReference(motions[name]||selectionMotions[name],seconds,name);}
export function sampleMotionInto(name,seconds,_output){return sampleMotion(name,seconds);}\n`;
    const body=current.slice(0,current.indexOf('// Cubic Hermite'))+before+wrappers+current.slice(current.indexOf('export const ATTACK_CLIPS'));
    await page.route('**/src/motion.js*',route=>route.fulfill({contentType:'application/javascript',body}));
   }
   await page.goto('http://localhost:5173/tests/rig-stage.html');
   const report=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),{combatMotionName}=await import('/src/motion.js');
    await loadWarriorAssets();
    const scene=new T.Scene();scene.background=new T.Color('#626c75');scene.add(new T.HemisphereLight('#fff7ed','#546572',2));const sun=new T.DirectionalLight('#fff3df',3);sun.position.set(3,5,7);scene.add(sun);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,800);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);
    const camera=new T.OrthographicCamera(-1.4,1.4,2.5,-.05,.01,30);camera.position.set(3,0,9);camera.lookAt(0,0,0);
    const rows=[],actors=[],matrices=[];
    const measure=(actor,label)=>{
     actor.root.updateMatrixWorld(true);const values=[];
     actor.model.traverse(o=>{if(o.isBone)values.push(...o.matrixWorld.elements);});
     for(const o of [actor.weapon,actor.offhand,actor.club])if(o)values.push(...o.matrixWorld.elements);
     if(!values.every(Number.isFinite))throw Error(`Nonfinite transform: ${label}`);
     matrices.push(...values);rows.push({label,values:values.length});
    };
    for(let hero=0;hero<6;hero++){
     const p=new Warrior(hero);scene.add(p.root);actors.push(p);
     for(const [name,action]of p.actions){
      const golf=name.startsWith('Golf'),duration=action.getClip().duration;
      p.setGolfClub(name==='Golf_Putt'?'PT':'DR');
      for(const fraction of [0,.15,.3,.5,.7,.85,1]){
       p.update(duration*fraction,1/60,{golf,groundHeight:()=>0,previewPose:{clip:name,time:duration*fraction}});
       measure(p,`${hero}/${name}/${fraction}`);
      }
     }
     for(let frame=0;frame<90;frame++){
      const attacking=frame>=30&&frame<70,action=attacking?{kind:'light',step:0,time:(frame-30)/60,duration:.7,token:1}:null;
      p.root.position.z+=.06;
      p.update(frame/60,1/60,{moving:true,moveSpeed:3.6,moveAngle:.35,action,groundHeight:(x,z)=>.02*x+.015*z});
      measure(p,`${hero}/moving/${frame}`);
     }
     p.root.position.set(0,0,0);p.root.visible=false;
    }
    // Enemy legacy attachments also consume the projected shaft directions.
    for(let type=0;type<4;type++){
     const p=new Warrior(type,true);scene.add(p.root);
     for(const [name,action]of p.actions)for(const fraction of [0,.25,.5,.75,1]){
      p.update(fraction,1/60,{previewPose:{clip:name,time:action.getClip().duration*fraction}});measure(p,`enemy-${type}/${name}/${fraction}`);
     }
     p.root.visible=false;
    }
    const bytes=new Float64Array(matrices),digest=await crypto.subtle.digest('SHA-256',bytes.buffer),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    window.playbackReview={actors,WARRIORS,combatMotionName,scene,renderer,camera,rows};
    return{samples:rows.length,transformValues:matrices.length,hash,rows};
   });
   report.images=[];
   for(const kind of ['golf','heavy','musou']){
    const pixelHash=await page.evaluate(async kind=>{
     const {actors,WARRIORS,combatMotionName,scene,renderer,camera}=window.playbackReview;
     renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
     for(let hero=0;hero<6;hero++){
      const p=actors[hero];actors.forEach(a=>a.root.visible=a===p);p.root.position.set(0,0,0);p.setGolfClub('DR');
      const name=kind==='golf'?'Golf_Swing':combatMotionName(WARRIORS[hero],kind,0),time=kind==='golf'?1.4:p.actions.get(name).getClip().duration*.4;
      p.update(time,1,{golf:kind==='golf',previewPose:{clip:name,time}});
      renderer.setViewport((hero%3)*400,(1-Math.floor(hero/3))*400,400,400);renderer.setScissor((hero%3)*400,(1-Math.floor(hero/3))*400,400,400);renderer.render(scene,camera);
     }
     const gl=renderer.getContext(),pixels=new Uint8Array(1200*800*4);gl.readPixels(0,0,1200,800,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     const digest=await crypto.subtle.digest('SHA-256',pixels);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    },kind);
    const path=`${output}/${variant}-${kind}.png`;await page.screenshot({path});report.images.push({kind,hash:pixelHash,path});
   }
   assert.deepEqual(errors,[]);reports.push({variant,...report,errors});
  } finally {await context.close();}
 }
 const [reference,playback]=reports;
 assert.deepEqual(playback.rows,reference.rows);assert.equal(playback.hash,reference.hash,'Bone and held-object transforms must remain exact');
 assert.deepEqual(playback.images.map(x=>x.hash),reference.images.map(x=>x.hash),'Rendered golf, heavy, and Musou poses must remain pixel-identical');
 fs.writeFileSync(`${output}/comparison.json`,JSON.stringify(reports.map(({rows,...report})=>report),null,2));
 console.log(JSON.stringify({samples:playback.samples,transformValues:playback.transformValues,matchingTransforms:true,matchingRenderedPixels:true,output}));
} finally {await browser.close();}
