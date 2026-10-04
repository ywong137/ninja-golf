import {preloadWarriorFixtures} from './preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node tools/benchmark-shorelines.mjs [--retina]\nMeasure charging previews and 64-enemy pond combat in muted Chrome. Output is JSON.');process.exit(0);}
if(args.some(a=>a!=='--retina')||args.length>1)throw Error('Use --help.');
const retina=args.includes('--retina'),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:retina?2:1}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.locator('#asset-curtain').waitFor({state:'detached'});
 for(const [theme,hole,mode]of [[0,0,'charging'],[1,4,'water combat'],[2,5,'water combat'],[3,7,'water combat']]){
  await page.evaluate(async({theme,hole,mode})=>{
   const g=window.__golfTest,C=await import('/src/course.js'),{findWaterEmergence}=await import('/src/water-emergence.js');clearInterval(window.shoreAttack);g.begin(0,theme);g.ui.showScreen('game');g.loadHole(hole);await g.world.waitForAssets();g.audio.pause();g.audio.enabled=false;g.paused=false;g.spawnTime=999;g.health=g.warrior.health;g.invincible=1e6;
   if(mode==='charging'){g.phase='aim';g.club=0;g.charging=true;g.chargeTime=0;}
   else{
    const sites=g.world.ambushSites,site=sites.find(s=>s.kind==='water'&&findWaterEmergence(g.course,s,{x:0,z:0},g.world.collision));
    if(!site)throw Error('No safe water benchmark entrance');const entry=findWaterEmergence(g.course,site,{x:0,z:0},g.world.collision),dx=entry.landing.x-site.x,dz=entry.landing.z-site.z,length=Math.hypot(dx,dz),hero={x:entry.landing.x+dx/length*5,z:entry.landing.z+dz/length*5};hero.y=C.heightAt(g.course,hero.x,hero.z);
    g.player.root.position.set(entry.landing.x+dx/length*12,hero.y,entry.landing.z+dz/length*12);g.phase='combat';g.enemyBudget=80;g.enemiesSpawned=0;g.world.ambushSites=[{...site,readyAt:0}];g.spawnWave(64);g.world.ambushSites=sites;g.player.root.position.copy(hero);if(g.enemies.length!==64)throw Error(`Expected 64 enemies, got ${g.enemies.length}`);
    const positions=[];for(let radius=3;radius<50&&positions.length<64;radius+=1.2)for(let a=0;a<Math.PI*2&&positions.length<64;a+=.31){const x=hero.x+Math.cos(a)*radius,z=hero.z+Math.sin(a)*radius,p={x,y:C.heightAt(g.course,x,z),z};if(!['Water','Out of bounds'].includes(C.lieAt(g.course,x,z))&&!g.world.collision.blocked(p,.35,2))positions.push(p);}
    if(positions.length!==64)throw Error('Not enough safe crowd positions');g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.root.position.copy(positions[i]);e.hp=1e9;e.cooldown=0;});const pond=C.pondProfiles(g.course).find(p=>Math.hypot((site.x-p.basin[0])/p.basin[2],(site.z-p.basin[1])/p.basin[3])<1);g.cameraYaw=Math.atan2(pond.basin[0]-hero.x,pond.basin[1]-hero.z);g.cameraPitch=.35;g.ball.position.copy(g.world.cup);
    let step=0;window.shoreAttack=setInterval(()=>{g.player.root.position.copy(hero);g.attack(step++%4===3?'heavy':'light');},350);
   }
  },{theme,hole,mode});
  await page.waitForTimeout(retina?15000:6000);
  const result=await page.evaluate(({mode})=>new Promise(resolve=>{let last=performance.now(),start=last,frames=0,intervals=[];function sample(now){intervals.push(now-last);last=now;frames++;if(now-start<10000)requestAnimationFrame(sample);else{intervals.sort((a,b)=>a-b);const g=window.__golfTest,gl=g.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');resolve({mode,name:g.course.name,fps:frames*1000/(now-start),p95:intervals[Math.floor(intervals.length*.95)],enemies:g.enemies.length,ratio:g.renderer.getPixelRatio(),contactShading:g.rendering.contact.enabled,renderer:extension&&gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles});}}requestAnimationFrame(sample);}),{mode});
  results.push(result);console.log(JSON.stringify(result));await page.screenshot({path:`/tmp/ninja-shore-performance-${theme}-${retina?'retina':'desktop'}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({viewport:[1440,900],displayScale:retina?2:1,results},null,2));
}finally{await browser.close();}
