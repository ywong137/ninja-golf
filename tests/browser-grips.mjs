import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.on('pageerror',error=>console.error(error));page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},on(){},off(){},invalidate(){}});export const injectQuery=(url)=>url;'}));
try{
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const g={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(35,1.6,.01,100),renderer:new THREE.WebGLRenderer({antialias:true})};window.__rigStage=g;g.renderer.setSize(1600,1000);document.body.append(g.renderer.domElement);g.scene.background=new THREE.Color('#59626c');g.scene.add(new THREE.HemisphereLight(0xffffff,0x41405c,2));const light=new THREE.DirectionalLight(0xffe4c6,3);light.position.set(2,5,5);g.scene.add(light);
  const {Warrior,PALM_GRIPS,loadWarriorAssets}=await import('/src/actors.js');const {WARRIORS}=await import('/src/warriors.js');
  await loadWarriorAssets();const results=[];window.__gripHeroes=[];
  for(let i=0;i<WARRIORS.length;i++){
   const p=new Warrior(i);window.__gripHeroes.push(p);const prefix=WARRIORS[i].motionPrefix||'';const names=[WARRIORS[i].readyClip||'Idle_Loop','Sword_Idle',...Array.from(p.actions.keys()).filter(n=>n.startsWith(prefix)&&/^(Cut_|Heavy_|Musou_)/.test(n.slice(prefix.length)))];
   for(const name of names)for(const t of [0,.18,.43,.71,.96]){
    p.mixer.stopAllAction();p.current='';p.play(name,0,true);p.actions.get(name).time=t*p.actions.get(name).getClip().duration;p.mixer.update(0);p.syncHeldObjects();p.root.updateMatrixWorld(true);
    for(const side of p.offhand?['r','l']:['r']){const held=side==='r'?p.weapon:p.offhand;const palm=p.bones['hand_'+side].localToWorld(PALM_GRIPS[side].clone());const distance=held.getWorldPosition(palm.clone()).distanceTo(palm);const center=new THREE.Vector3();
     for(const joint of ['01','02','03','04_leaf'])center.add(p.bones['middle_'+joint+'_'+side].getWorldPosition(new THREE.Vector3()));center.multiplyScalar(.25);
     const shaft=held.localToWorld(new THREE.Vector3(0,1,0)).sub(held.getWorldPosition(new THREE.Vector3())).normalize();
     const offset=center.clone().sub(held.getWorldPosition(new THREE.Vector3()));const cavityDistance=offset.addScaledVector(shaft,-offset.dot(shaft)).length();
     results.push({hero:i,name,t,side,distance,cavityDistance});}
   }
   p.mixer.stopAllAction();p.current='';p.play(WARRIORS[i].readyClip||'Idle_Loop',0);p.mixer.update(.2);p.update(.2,0,{selection:true});p.root.position.set((i-2.5)*1.65,0,0);g.scene.add(p.root);
  }
  g.camera.position.set(0,2.3,11);g.camera.lookAt(0,1.2,0);g.renderer.render(g.scene,g.camera);
  for(const el of document.querySelectorAll('.screen,#hud,#toast,#hole-banner,#audio-toggle'))el.style.display='none';
  return results;
 });
 assert.ok(report.length>200);assert.ok(report.every(r=>r.distance<1e-6),JSON.stringify(report.filter(r=>r.distance>=1e-6)));
 assert.ok(report.every(r=>r.cavityDistance<.025),JSON.stringify(report.filter(r=>r.cavityDistance>=.025).slice(0,5)));console.log('Maximum measured finger cavity distance',Math.max(...report.map(r=>r.cavityDistance)));
 await page.screenshot({path:'/tmp/ninja-six-heroes.png'});
 for(let i=0;i<6;i++){await page.evaluate(i=>{const g=window.__rigStage,p=window.__gripHeroes[i];window.__gripHeroes.forEach((h,j)=>h.root.visible=j===i);g.camera.position.set(p.root.position.x+.4,1.95,2.25);g.camera.lookAt(p.root.position.x,1.58,0);g.renderer.render(g.scene,g.camera);},i);await page.screenshot({path:`/tmp/ninja-face-${i}.png`});}
 await page.evaluate(()=>{const g=window.__rigStage,p=window.__gripHeroes[4];window.__gripHeroes.forEach((h,j)=>h.root.visible=j===4);const v=p.bones.hand_r.getWorldPosition(g.camera.position.clone());g.camera.position.copy(v).add({x:-.23,y:.14,z:.35});g.camera.lookAt(v);g.renderer.render(g.scene,g.camera);});await page.screenshot({path:'/tmp/ninja-hand-grip.png'});
 console.log(`Verified ${report.length} palm grip checkpoints across all six heroes. Maximum separation: ${Math.max(...report.map(r=>r.distance))}m`);
}finally{await browser.close();}
