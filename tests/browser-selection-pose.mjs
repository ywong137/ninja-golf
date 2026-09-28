import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await disableHmr(page);
try{
 await page.goto(process.env.NINJA_TEST_URL||'http://localhost:5173');
 await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 await page.click('#play');
 assert.deepEqual(await page.locator('[data-warrior]').evaluateAll(cards=>cards.map(card=>Number(card.dataset.warrior))),[0,3,1,4,2,5],'Selection presents alternating men and women without changing saved hero IDs');
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.paused=true;g.frame=()=>{};await g.world.waitForAssets();});
 const results=[];
 for(let hero=0;hero<6;hero++){
  await page.click(`[data-warrior="${hero}"]`);await page.mouse.move(0,0);
  const report=await page.evaluate(async hero=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {WARRIORS}=await import('/src/warriors.js');
   const {selectionHandleClearance}=await import('/tools/selection-clearance.mjs');
   const g=window.__golfTest;g.audio.pause();
   g.camera.fov=48;g.camera.updateProjectionMatrix();g.updateCamera(10);
   const p=g.player,expected=WARRIORS[hero].selectionClip;
   const result={hero,name:WARRIORS[hero].name,clip:'',maxPalmGap:0,maxCavityGap:0,maxAxisError:0,maxShaftObliquity:0,maxWristDeviation:0,maxMetacarpalDeviation:0,minHandleClearance:Infinity,minBladeY:Infinity,finite:true};
   for(let frame=0;frame<=240;frame++){
    p.update(frame/30,1/30,{selection:true,gazeTarget:g.camera.position});p.root.updateMatrixWorld(true);
    result.clip=p.current;
    if(result.clip!==expected)throw Error(`${result.name} uses ${p.current} instead of ${expected}`);
    for(const side of p.offhand?['r','l']:['r']){
     const weapon=side==='r'?p.weapon:p.offhand,hand=p.bones['hand_'+side];
     const center=weapon.localToWorld(new T.Vector3(0,weapon.userData.primaryGrip,0)),palm=hand.localToWorld(p.palmGrips[side].clone());
     const axis=new T.Vector3(0,1,0).applyQuaternion(weapon.getWorldQuaternion(new T.Quaternion()));
     const nativeAxis=p.shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
     const forearm=hand.getWorldPosition(new T.Vector3()).sub(p.bones['lowerarm_'+side].getWorldPosition(new T.Vector3())).normalize();
     result.maxShaftObliquity=Math.max(result.maxShaftObliquity,Math.asin(Math.min(1,Math.abs(nativeAxis.dot(forearm))))*180/Math.PI);
     result.maxWristDeviation=Math.max(result.maxWristDeviation,hand.quaternion.clone().normalize().angleTo(p.neutralHandRotations[side].clone().normalize())*180/Math.PI);
     const metacarpal=p.bones['middle_01_'+side].getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
     result.maxMetacarpalDeviation=Math.max(result.maxMetacarpalDeviation,metacarpal.angleTo(forearm)*180/Math.PI);
     result.maxPalmGap=Math.max(result.maxPalmGap,center.distanceTo(palm)/p.root.scale.x);
     result.maxAxisError=Math.max(result.maxAxisError,axis.angleTo(nativeAxis));
     const fingers=['01','02','03','04_leaf'].map(n=>p.bones['middle_'+n+'_'+side]).filter(Boolean);
     const cavity=fingers.reduce((sum,b)=>sum.add(b.getWorldPosition(new T.Vector3())),new T.Vector3()).multiplyScalar(1/fingers.length).sub(center);
     result.maxCavityGap=Math.max(result.maxCavityGap,cavity.addScaledVector(axis,-cavity.dot(axis)).length()/p.root.scale.x);
     result.minBladeY=Math.min(result.minBladeY,(weapon.localToWorld(new T.Vector3(...weapon.userData.tip)).y-p.root.position.y)/p.root.scale.x);
     if(frame%120===0)result.minHandleClearance=Math.min(result.minHandleClearance,selectionHandleClearance(p,weapon).clearance);
    }
    result.finite&&=Object.values(p.bones).every(b=>[...b.position,...b.quaternion,...b.scale].every(Number.isFinite));
   }
   g.updateCamera(10);g.portraitLights.visible=true;g.portraitLights.position.copy(p.root.position);g.rendering.render('high');
   return result;
  },hero);
  results.push(report);
  await page.screenshot({path:`/tmp/ninja-selection-screen-${hero}.png`});
  for(const view of ['front','side','sword-side']){
   await page.evaluate(view=>{
    const g=window.__golfTest,p=g.player.root.position;
    for(const el of document.querySelectorAll('#app > :not(canvas)'))el.style.opacity='0';
    g.player.root.rotation.y=0;g.player.update(0,0,{selection:true});
    g.camera.fov=34;g.camera.updateProjectionMatrix();
    g.camera.position.set(p.x+(view==='side'?7:view==='sword-side'?-7:0),p.y+2.05,p.z+(view==='front'?8:0));g.camera.lookAt(p.x,p.y+1.65,p.z);
    g.rendering.render('high');
   },view);
   await page.screenshot({path:`/tmp/ninja-selection-${view}-${hero}.png`});
  }
  for(const side of hero===1?['r','l']:['r']){
   await page.evaluate(side=>{
    const g=window.__golfTest,p=g.player,hand=p.bones['hand_'+side];
    const palm=hand.localToWorld(p.palmGrips[side].clone());
    g.camera.fov=34;g.camera.updateProjectionMatrix();
    g.camera.position.copy(palm).add({x:-.65,y:.25,z:1.3});g.camera.lookAt(palm);g.rendering.render('high');
   },side);
   await page.screenshot({path:`/tmp/ninja-selection-grip-${hero}-${side}.png`});
  }
  const transition=await page.evaluate(async()=>{
   const {WARRIORS}=await import('/src/warriors.js');const g=window.__golfTest,p=g.player;
   p.update(0,1/60,{action:{kind:'heavy',step:0,token:37,time:0,duration:.9}});
   p.update(0,1/60,{selection:true});const reentry=p.current;
   for(let i=0;i<30;i++)p.update(i/60,1/60,{golf:true});
   const result={reentry,expected:WARRIORS[p.type].selectionClip,golf:p.current,club:p.club.visible,sword:p.weapon.visible};
   for(const el of document.querySelectorAll('#app > :not(canvas)'))el.style.opacity='';
   g.camera.fov=48;g.camera.updateProjectionMatrix();return result;
  });
  assert.equal(transition.reentry,transition.expected,'An unfinished attack must not hold the selection screen in combat');
  assert.equal(transition.golf,'Golf_Address');assert.equal(transition.club,true);assert.equal(transition.sword,false);
 }
 for(const [width,height]of [[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const hero of [0,1,2,3,4,5]){
   await page.click(`[data-warrior="${hero}"]`);await page.mouse.move(0,0);
   const frame=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');const g=window.__golfTest,p=g.player;
    g.camera.fov=48;g.camera.updateProjectionMatrix();g.updateCamera(10);
    for(let i=0;i<30;i++)p.update(i/60,1/60,{selection:true,gazeTarget:g.camera.position});p.root.updateMatrixWorld(true);
    g.portraitLights.position.copy(p.root.position);g.rendering.render('high');
    const screen=v=>{v.project(g.camera);return[(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];};
    return{head:screen(p.bones.Head.getWorldPosition(new T.Vector3())),feet:['r','l'].map(s=>screen(p.bones['foot_'+s].getWorldPosition(new T.Vector3()))),cardsRight:document.querySelector('.warrior-cards').getBoundingClientRect().right};
   });
   for(const point of [frame.head,...frame.feet])assert.ok(point[0]>frame.cardsRight+12&&point[0]<width-30&&point[1]>65&&point[1]<height-95,`Character outside the visible portrait at ${width}×${height}: ${JSON.stringify(frame)}`);
   await page.screenshot({path:`/tmp/ninja-selection-layout-${width}-${hero}.png`});
  }
 }
 console.log(JSON.stringify(results,null,2));
 for(const result of results){
  assert.ok(result.finite,`${result.name}: non-finite bone transform`);
  assert.ok(result.maxPalmGap<1e-6,`${result.name}: weapon leaves the palm`);
  // Surface contact is checked by browser-grips.mjs, not a mean joint position.
  assert.ok(result.maxAxisError<.015,`${result.name}: weapon shaft disagrees with the native grip`);
  assert.ok(result.maxWristDeviation<.001,`${result.name}: wrist differs from the natural hand pose`);
  assert.ok(result.maxMetacarpalDeviation<12,`${result.name}: hand and forearm are misaligned`);
  assert.ok(result.maxShaftObliquity<16,`${result.name}: handle lies too far along the forearm`);
  assert.ok(result.minHandleClearance>.025,`${result.name}: handle approaches the body`);
  assert.ok(result.minBladeY>.035,`${result.name}: blade enters the ground`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
