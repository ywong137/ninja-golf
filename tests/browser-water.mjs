import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const shaderAudit=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),C=await import('/src/course.js'),L=await import('/src/course-layout.js'),S=await import('/src/shoreline.js'),U=await import('/src/water-uniforms.js'),g=window.__golfTest;g.frame=()=>{};g.audio.pause();
  const scene=new T.Scene(),camera=new T.Camera(),geometry=new T.PlaneGeometry(2,2),target=new T.WebGLRenderTarget(64,64),pixels=new Uint8Array(64*64*4);let samples=0;
  try{for(const c of C.COURSE_SETS.flatMap(s=>s.holes)){
   const basins=C.waterBasins(c),bounds=[Math.min(...basins.map(b=>b[0]-b[2])),Math.min(...basins.map(b=>b[1]-b[3])),Math.max(...basins.map(b=>b[0]+b[2])),Math.max(...basins.map(b=>b[1]+b[3]))];
   const material=new T.ShaderMaterial({uniforms:{...U.pondUniforms(c),bounds:{value:new T.Vector4(...bounds)}},vertexShader:'varying vec2 at;void main(){at=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:L.DRY_LAND_GLSL+`uniform vec4 bounds;uniform int pondCount;uniform vec4 shoreBasins[4];uniform vec4 shoreShapes[4];varying vec2 at;void main(){vec2 p=mix(bounds.xy,bounds.zw,at);bool wet=false;for(int i=0;i<4;i++){if(i>=pondCount)break;if(shoreDistance(p,shoreBasins[i],shoreShapes[i])<0.)wet=true;}wet=wet&&dryDistance(p)>0.;gl_FragColor=vec4(wet?1.:0.,0.,0.,1.);}`,toneMapped:false});
   const mesh=new T.Mesh(geometry,material);scene.add(mesh);g.renderer.setRenderTarget(target);g.renderer.render(scene,camera);g.renderer.readRenderTargetPixels(target,0,0,64,64,pixels);
   for(let j=0;j<64;j++)for(let i=0;i<64;i++){const x=bounds[0]+(bounds[2]-bounds[0])*(i+.5)/64,z=bounds[1]+(bounds[3]-bounds[1])*(j+.5)/64;
    if(basins.some(b=>Math.abs(S.shorelineDistance(x,z,b))<.002)||Math.abs(L.dryLandDistance(c,x,z))<.002)continue;
    if((pixels[(j*64+i)*4]>127)!==C.waterAt(c,x,z))throw Error(`${c.name}: GPU/CPU water mismatch at ${x},${z}`);samples++;
   }scene.remove(mesh);material.dispose();
  }}finally{g.renderer.setRenderTarget(null);target.dispose();geometry.dispose();}
  return{courses:36,samples};
 });
 assert.ok(shaderAudit.samples>140000);console.log('Shared water shader parity',JSON.stringify(shaderAudit));
 const results=await page.evaluate(async()=>{
  const C=await import('/src/course.js'),{findWaterEmergence}=await import('/src/water-emergence.js'),g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();const reports=[];
  for(const [theme,hole]of [[0,1],[0,6],[0,8],[1,4],[2,5],[3,7]]){
   g.setCourse(theme);g.loadHole(hole);await g.world.waitForAssets();const c=g.course,sites=g.world.ambushSites,site=sites.find(s=>s.kind==='water'&&findWaterEmergence(c,s,{x:0,z:0},g.world.collision));if(!site)throw Error(`${c.name}: no safe water entrance`);
   const entry=findWaterEmergence(c,site,{x:0,z:0},g.world.collision),surface=C.waterSurfaceAt(c,site.x,site.z),planes=g.world.pond.children.map(m=>m.position.y);
   const original=g.penalty.bind(g);let contact=null;g.penalty=message=>{contact={message,position:g.ball.position.toArray()};original(message);};
   g.ball.position.set(site.x,surface+2,site.z);g.club=0;g.power=0;g.launchBall();g.shotOrigin.set(0,C.heightAt(c,0,0)+.13,0);g.shotStartLie='Tee';g.phase='flight';g.rolling=false;g.flightTime=0;g.velocity.set(0,0,0);g.strokes=1;g.penalties=0;g.stillTime=0;
   for(let i=0;i<240&&g.phase==='flight';i++)g.updateBall(1/120);g.penalty=original;
   const penalty={contact,strokes:g.strokes,count:g.penalties,phase:g.phase,reset:g.ball.position.distanceTo(g.shotOrigin)};
   g.phase='combat';g.player.root.position.copy(entry.landing);g.player.root.position.x+=12;g.player.root.position.y=C.heightAt(c,g.player.root.position.x,g.player.root.position.z);g.ball.position.copy(g.player.root.position).add({x:0,y:0,z:30});g.world.ambushSites=[{...site,readyAt:0}];g.enemyBudget=10;g.enemiesSpawned=0;g.spawnTime=999;g.health=1e6;g.spawnWave(6);g.world.ambushSites=sites;
   if(!g.enemies.length)throw Error(`${c.name}: main loop did not spawn from water`);const count=g.enemies.length;let minClearance=Infinity,frames=0;
   while(g.enemies.some(e=>e.emerging)&&frames++<300){g.time+=1/120;g.updateCombat(1/120);for(const e of g.enemies)if(e.root.visible)minClearance=Math.min(minClearance,e.root.position.y-C.heightAt(c,e.root.position.x,e.root.position.z));}
   const dry=g.enemies.every(e=>!e.emerging&&C.waterSurfaceAt(c,e.root.position.x,e.root.position.z)==null),trunksOnBridges=g.world.vegetation.records.filter(t=>c.layout.bridgeSegments.some(s=>{const dx=s[2]-s[0],dz=s[3]-s[1],u=Math.max(0,Math.min(1,((t.x-s[0])*dx+(t.z-s[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(t.x-s[0]-dx*u,t.z-s[1]-dz*u)<s[4]+(s[5]-s[4])*u+3;})).length;
   g.camera.position.set(site.x+22,surface+17,site.z-24);g.camera.lookAt(site.x,surface,site.z);g.world.update(g.time,0,null,g.camera.position);g.rendering.render('high');g.rendering.render('high');reports.push({name:c.name,surface,planes,penalty,count,minClearance,dry,trunksOnBridges});g.clearEnemies();
  }return reports;
 });
 for(const r of results){assert.ok(r.planes.includes(r.surface));assert.ok(r.penalty.contact?.message.startsWith('Water'));assert.equal(r.penalty.strokes,2);assert.equal(r.penalty.count,1);assert.equal(r.penalty.phase,'aim');assert.ok(r.penalty.reset<1e-8);assert.equal(r.count,6);assert.ok(r.minClearance>-.03,JSON.stringify(r));assert.ok(r.dry);assert.equal(r.trunksOnBridges,0);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));console.log('Rendered local water, live penalties, main-loop water entrances, and bridge clearance passed.');
}finally{await browser.close();}
