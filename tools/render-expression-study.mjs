import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const output='artifacts/expression-review';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1200}});await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');const{WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();
  const scene=new T.Scene();scene.background=new T.Color('#53616a');scene.add(new T.HemisphereLight('#fff5eb','#667080',2));
  const key=new T.DirectionalLight('#fff4e5',3);key.position.set(-3,5,7);scene.add(key);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,1200);renderer.toneMapping=T.ACESFilmicToneMapping;
  document.body.replaceChildren(renderer.domElement);const labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;color:#fff;font:22px sans-serif';document.body.append(labels);
  window.study={T,Warrior,WARRIORS,scene,renderer,labels};
 });
 for(let hero=0;hero<6;hero++){
  const name=await page.evaluate(hero=>{
   const {T,Warrior,WARRIORS,scene,renderer,labels}=window.study,actor=new Warrior(hero);
   actor.root.scale.setScalar(1);scene.add(actor.root);actor.update(0,0,{selection:true});actor.weapon.visible=false;if(actor.offhand)actor.offhand.visible=false;
   labels.replaceChildren();renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
   for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    const pose=actor.facialPose;pose.restore();pose.anger=pose.effort=pose.yaw=pose.pitch=0;
    for(let i=0;i<90;i++)pose.apply(1/60,{musou:col,exertion:col});actor.root.updateMatrixWorld(true);
    const center=actor.bones.Bip01_REye.getWorldPosition(new T.Vector3()).add(actor.bones.Bip01_LEye.getWorldPosition(new T.Vector3())).multiplyScalar(.5);center.y-=.03;
    const camera=new T.OrthographicCamera(-.175,.175,.175,-.175,.01,10);camera.position.copy(center).add(new T.Vector3(row?.60:.02,.012,row?.86:1));camera.lookAt(center);
    const x=col*600,y=(1-row)*600;renderer.setViewport(x,y,600,600);renderer.setScissor(x,y,600,600);renderer.render(scene,camera);
    const label=document.createElement('div');label.style.cssText=`position:absolute;left:${x+15}px;top:${row*600+15}px;background:#17222baa;padding:8px`;label.textContent=`${WARRIORS[hero].name} · ${col?'musou':'neutral'}`;labels.append(label);
   }
   actor.root.removeFromParent();actor.dispose();return WARRIORS[hero].model;
  },hero);
  await page.screenshot({path:`${output}/${name}.png`});
 }
 console.log(output);
}finally{await browser.close();}
