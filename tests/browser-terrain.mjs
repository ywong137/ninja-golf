import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();});
 for(let theme=0;theme<4;theme++){
  const data=await page.evaluate(async theme=>{const g=window.__golfTest;g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;return{theme:g.course.theme,regions:Object.keys(g.world.regions),vertices:g.world.horizon.geometry.attributes.position.count};},theme);
  assert.deepEqual(data.regions.sort(),['desert','highlands','japanese']);assert.ok(data.vertices<220000);
  for(const view of ['aerial','tee','bunker','fairway','green','path']){
   const info=await page.evaluate(async view=>{const g=window.__golfTest,{heightAt,lieAt,routePoint}=await import('/src/course.js'),c=g.course;let x=58,z=-42,y=42,tx=0,tz=135,ty=5;
    if(view==='tee'){x=0;z=-9;y=heightAt(c,x,z)+2.4;tx=c.layout.route[1][0];tz=c.layout.route[1][1];ty=heightAt(c,tx,tz)+1;}
    if(view==='bunker'){const b=c.bunkers.at(-1);[tx,tz]=b;ty=heightAt(c,tx,tz);x=tx+b[2]*1.8;z=tz-b[3]*1.6;y=heightAt(c,x,z)+6;}
    if(view==='fairway'){const p=routePoint(c,.22);tx=p.x;tz=p.z;ty=heightAt(c,tx,tz);x=tx+2.5;z=tz-3;y=ty+1.9;}
    if(view==='green'){tx=c.greenX+2;tz=c.length-7;ty=heightAt(c,tx,tz);x=tx+2;z=tz-3;y=ty+1.2;}
    if(view==='path'){const path=g.world.root.getObjectByName('Course path'),p=path.geometry.attributes.position;let chosen=path.geometry.index.array[Math.floor(path.geometry.index.count*.21)];tx=p.getX(chosen);tz=p.getZ(chosen);ty=p.getY(chosen);x=tx+2;z=tz-3;y=ty+2;}
    g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(x,y,z);g.camera.lookAt(tx,ty,tz);g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);let blockedGrass=0;if(view==='path'){const matrix=g.player.root.matrix.clone();for(let i=0;i<g.world.grass.count;i++){g.world.grass.getMatrixAt(i,matrix);if(g.world.root.userData.pathContains(matrix.elements[12],matrix.elements[14],.1))blockedGrass++;}}return{lie:lieAt(c,tx,tz),triangles:g.renderer.info.render.triangles,blockedGrass};},view);
   assert.equal(info.blockedGrass,0,'Paths must remain clear of grass');if(view==='bunker')assert.equal(info.lie,'Bunker');await page.screenshot({path:`/tmp/ninja-terrain-${theme}-${view}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log('Surveyed regional grids, four themes, golf-edge seams, tee views, shaped bunkers, short turf, greens, and textured paths passed.');
}finally{await browser.close();}
