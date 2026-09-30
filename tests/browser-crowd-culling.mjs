import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const output='/tmp/ninja-crowd-culling';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.addStyleTag({content:'#app > :not(#game){visibility:hidden!important}'});
 await page.evaluate(async()=>{
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.begin(3,0);await g.world.waitForAssets();g.paused=true;g.audio.pause();g.phase='combat';g.enemyBudget=1000;g.enemiesSpawned=0;g.spawnWave(48);g.crowd.update(g.enemies);
  if(g.enemies.length!==48)throw Error('The culling fixture needs 48 enemies; found '+g.enemies.length);
  for(const object of [g.ball,g.aimLine,g.aimMarker,g.puttingGuide.root,g.portraitLights,g.ballBeacon])object.visible=false;
  g.renderer.setPixelRatio(1);g.rendering.resize();g.camera.clearViewOffset();g.camera.fov=52;g.camera.updateProjectionMatrix();
 });
 const rows=[];
 for(const [pose,fraction]of [['Sprint_Loop',.13],['Sprint_Loop',.62],['Jump_Loop',.4],['Enemy_Thrust',.7],['Heavy_Cleave',.48],['Death01',.8]])for(const view of ['front','reverse','edge']){
  const row=await page.evaluate(async({pose,fraction,view})=>{
   const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js'),p=g.player.root.position;
   g.enemies.forEach((e,i)=>{
    e.emerging=null;e.root.visible=true;e.dead=0;e.root.scale.setScalar(1.1);e.mixer.stopAllAction();e.current='';e.overlays=[];
    const x=p.x+(i%8-3.5)*3,z=p.z+(Math.floor(i/8)-1)*7;e.root.position.set(x,heightAt(g.course,x,z),z);e.root.rotation.set(0,i*.7,0);
    const clip=e.actions.get(pose).getClip();e.update(12.5,1,{previewPose:{clip:pose,time:clip.duration*fraction}});
    if(pose==='Death01'){e.root.rotation.x=(i%3-1)*.8;e.root.scale.setScalar(.25+(i%4)*.28);e.root.position.y+=i%2*1.6;}
   });
   if(view==='front'){g.camera.position.set(p.x,p.y+3,p.z-12);g.camera.lookAt(p.x,p.y+1,p.z+12);}
   else if(view==='reverse'){g.camera.position.set(p.x,p.y+3,p.z+34);g.camera.lookAt(p.x,p.y+1,p.z+5);}
   else{g.camera.position.set(p.x+14,p.y+2.5,p.z-2);g.camera.lookAt(p.x+8,p.y+1,p.z+8);}
   g.world.update(12.5,0,p,g.camera.position);g.scene.userData.crowdCount=g.enemies.length;
   const bounds=g.enemies.flatMap(e=>e.skinBounds.bounds),gl=g.renderer.getContext(),size=g.renderer.getDrawingBufferSize(new T.Vector2());
   const capture=enabled=>{
    for(const b of bounds)b.mesh.frustumCulled=enabled;
    g.rendering.render('balanced');g.rendering.render('balanced');
    const pixels=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return{pixels,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
   };
   const before=capture(false),after=capture(true);let changed=0,maxDelta=0;
   for(let i=0;i<before.pixels.length;i+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(before.pixels[i+k]-after.pixels[i+k]));if(delta>1)changed++;maxDelta=Math.max(maxDelta,delta);}
   // Inspect the production hook's result after whole-actor movement and death
   // scaling, without an extra explicit call to the bounds updater.
   const point=new T.Vector3();let vertices=0;
   for(const b of bounds){b.mesh.skeleton.update();for(let i=0;i<b.mesh.geometry.attributes.position.count;i+=17){b.mesh.getVertexPosition(i,point).applyMatrix4(b.mesh.matrixWorld);if(!b.box.containsPoint(point))throw Error('Rendered pose escaped '+b.mesh.name);vertices++;}}
   return{pose,fraction,view,changed,maxDelta,pixels:size.x*size.y,vertices,callsBefore:before.calls,callsAfter:after.calls,trianglesBefore:before.triangles,trianglesAfter:after.triangles};
  },{pose,fraction,view});rows.push(row);
  assert.equal(row.changed,0,`Culling changed visible bodies or shadows: ${JSON.stringify(row)}`);assert.ok(row.callsAfter<=row.callsBefore);
  if(pose==='Enemy_Thrust')await page.screenshot({path:`${output}/${view}.png`});
 }
 const saved=rows.reduce((sum,r)=>sum+r.callsBefore-r.callsAfter,0);assert.ok(saved>rows.length*20,'The real camera and shadow passes must skip meaningful work.');
 // Changing holes removes actors and restores the original mesh methods.
 const cleanup=await page.evaluate(()=>{const g=window.__golfTest,old=g.enemies.flatMap(e=>e.skinBounds.bounds);g.clearEnemies();g.crowd.update([]);g.rendering.render('balanced');return old.every(b=>b.mesh.intersectsFrustum===b.previous.intersectsFrustum&&b.mesh.frustumCulled===b.previous.frustumCulled)&&g.crowd.active.size===0;});
 assert.equal(cleanup,true);assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({rows,saved,cleanup,errors},null,2));console.log(JSON.stringify({cases:rows.length,saved,cleanup,errors}));
}finally{await browser.close();}
