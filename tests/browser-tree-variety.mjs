import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,{},{timeout:60000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 for(const theme of [0,1]){
  const counts=await page.evaluate(theme=>{const g=__golfTest;g.setCourse(theme);g.loadHole(0);g.paused=true;g.mode='inspection';g.audio.pause();for(const o of [g.player.root,g.ball,g.aimLine,g.aimMarker,g.puttingGuide.root])o.visible=false;g.camera.position.set(58,42,-42);g.camera.lookAt(0,5,135);g.world.update(g.time,0,null,g.camera.position);g.rendering.render(g.quality);return g.world.vegetation.records.reduce((counts,p)=>(counts[p.species]=(counts[p.species]||0)+1,counts),{});},theme);
  assert.equal(Object.keys(counts).length,3);await page.screenshot({path:`/tmp/ninja-tree-variety-theme-${theme}.png`});console.log('species',theme,counts);
 }
 for(const name of ['pine-open','pine-young','fir-layered'])for(const [label,distance,expectedLod]of [['near',28,[0]],['mid',40,[1]],['transition',48,[1,2]],['atlas',65,[2]],['far',145,[2]]]){
  const stats=await page.evaluate(async({name,distance})=>{const g=__golfTest,T=await import('/node_modules/three/build/three.module.js'),t=g.world.vegetation.records.find(t=>t.species===name&&t.z>15),h=name==='pine-open'?17:name==='pine-young'?12:19;if(!t)throw new Error('No planted '+name);g.camera.position.set(t.x+distance*.546,t.y+h*t.scale*.46,t.z-distance*.838);g.camera.lookAt(t.x,t.y+h*t.scale*.52,t.z);g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);const active=[],matrix=new T.Matrix4();
   for(const group of g.world.vegetation.groups.filter(o=>o.isTree&&o.records.includes(t)))for(let i=0;i<group.mesh.count;i++){group.mesh.getMatrixAt(i,matrix);if(Math.abs(matrix.elements[12]-t.x)<.001&&Math.abs(matrix.elements[14]-t.z)<.001)active.push(group.lod);}
   return{active,draws:g.rendering.renderer.info.render.calls,triangles:g.rendering.renderer.info.render.triangles};},{name,distance});
  assert.ok(expectedLod.every(lod=>stats.active.includes(lod)),`${name}: missing ${label} tree instance`);console.log(name,label,stats);await page.screenshot({path:`/tmp/ninja-tree-variety-${name}-${label}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Three authored tree anatomies, distinct theme mixes and native near geometry passed.');
}finally{await browser.close();}
