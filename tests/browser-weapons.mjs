import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
try{
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createWeapon}=await import('/src/weapons.js');
  const scene=new T.Scene();scene.background=new T.Color('#687078');scene.add(new T.HemisphereLight(0xffffff,0x41405c,2));const key=new T.DirectionalLight(0xffe4c6,3);key.position.set(2,5,5);scene.add(key);
  const camera=new T.PerspectiveCamera(35,1500/900,.01,100),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,900);document.body.append(renderer.domElement);
  const weapons=['odachi','twin','naginata','fan','ring','sickle'].map((kind,i)=>{const weapon=createWeapon(kind);weapon.position.set((i-2.5)*1.3,0,0);weapon.rotation.y=.22;scene.add(weapon);return weapon;});
  camera.position.set(0,1.1,10);camera.lookAt(0,.35,0);renderer.render(scene,camera);window.__weapons={scene,camera,renderer,weapons};
 });
 await page.screenshot({path:'/tmp/ninja-weapon-craft-lineup.png'});
 for(let i=0;i<6;i++){
  await page.evaluate(i=>{const {scene,camera,renderer,weapons}=window.__weapons;weapons.forEach((w,n)=>w.visible=n===i);const w=weapons[i];camera.position.set(w.position.x+.45,i<3?.8:.65,i<3?3.5:2.4);camera.lookAt(w.position.x,i<3?.65:.45,0);renderer.render(scene,camera);},i);
  await page.screenshot({path:`/tmp/ninja-weapon-craft-${i}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Weapon front/bevel/cord captures completed without WebGL errors.');
}finally{await browser.close();}
