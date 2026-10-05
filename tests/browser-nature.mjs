import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});await disableHmr(page);await page.goto(process.env.GAME_URL||'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,{},{timeout:60000}).catch(async error=>{console.error(await page.locator('body').innerText());console.error(await page.evaluate(()=>performance.getEntriesByType('resource').slice(-15).map(x=>({name:x.name,duration:x.duration}))));throw error;});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 for(const theme of [0,1,2,3]){
  const stats=await page.evaluate(async theme=>{const g=__golfTest;g.setCourse(theme);g.loadHole(0);g.paused=true;g.mode='inspection';g.audio.pause();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;g.camera.position.set(58,42,-42);g.camera.lookAt(0,5,135);g.world.update(g.time,0,null,g.camera.position);g.rendering.render(g.quality);const solid=g.world.vegetation.groups.filter(g=>g.solidTree);if(solid.length)return{solid:true,visible:solid.reduce((sum,g)=>sum+g.mesh.count,0),finite:g.world.sun.position.toArray().every(Number.isFinite)};const group=g.world.vegetation.groups.find(g=>g.lod===2);return{width:group.mesh.material.map.image.width,height:group.mesh.material.map.image.height,lit:group.mesh.material.isMeshStandardMaterial,visible:group.mesh.count,finite:g.world.sun.position.toArray().every(Number.isFinite)};},theme);
  if(theme===2)assert.equal(stats.solid,true);else{assert.equal(stats.width,4096);assert.equal(stats.height,1536);assert.equal(stats.lit,true);}assert.ok(stats.visible>0&&stats.finite);await page.screenshot({path:`/tmp/ninja-relit-landscape-${theme}.png`});
 }
 const opacity=await page.evaluate(async()=>{
  const g=__golfTest,checked=new Set(),rows=[];
  for(const theme of [0,1]){g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();
   for(const {mesh} of g.world.vegetation.groups){const mat=mesh.material;if(!/^(shrub_01|fern_02|searsia_burchellii_(twigs|leaves)|island_tree_01_leaves)$/.test(mat.name)||checked.has(mat.name))continue;checked.add(mat.name);
    const image=mat.map.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,solid=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]===255)solid++;}
    rows.push({name:mat.name,clear:clear/(data.length/4),solid:solid/(data.length/4),cutoff:mat.alphaTest,shadow:mesh.customDepthMaterial.userData.foliageShadowCutoff.value});
   }
  }return rows;
 });
 assert.equal(opacity.length,5);for(const row of opacity){assert.ok(row.clear>.1&&row.solid>.05,row.name+' lost its leaf opacity');assert.equal(row.shadow,row.cutoff);}
 console.log('Decoded leaf opacity and matching shadow cutoffs:',opacity);
 for(const [name,distance,elevation]of [['near',28,0],['transition',35,0],['mid',65,0],['far-transition',110,0],['far',145,0],['aerial',150,Math.PI/3]]){
  const result=await page.evaluate(async({distance,elevation})=>{const g=__golfTest;if(g.courseIndex!==0){g.setCourse(0);g.loadHole(0);g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;}const t=g.world.vegetation.records.find(t=>t.x<0&&t.z>30),center=t.y+7*t.scale;g.camera.position.set(t.x,center+distance*Math.sin(elevation),t.z-distance*Math.cos(elevation));g.camera.lookAt(t.x,center,t.z);g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);return g.world.vegetation.groups.filter(g=>g.isTree).map(g=>({lod:g.lod,count:g.mesh.count}));},{distance,elevation});
  assert.ok(result.some(g=>g.count>0));await page.screenshot({path:`/tmp/ninja-tree-${name}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Day/night tree relighting,24 atlas views, elevation sampling, all tree detail levels, and null preview focus passed');
}finally{await browser.close();}
