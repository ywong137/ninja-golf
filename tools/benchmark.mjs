import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
import {routeFixedGripCandidate} from './ronin-candidates/fixed-grip/route.mjs';
import {routeModelDirectory} from './route-model-directory.mjs';
const args=process.argv.slice(2);if(args.includes('--help')){console.log('Usage: node tools/benchmark.mjs [--retina] [--course=0..3] [--buildings|--forest] [--hero=0..5] [--moving|--planted]\nRequires the local development server. Measures 64 enemies during attacks, with audio muted.\nSet NINJA_BENCHMARK_CANDIDATE to a local Ronin candidate directory, or NINJA_MODEL_DIRECTORY to a directory of character GLBs, to measure unpublished assets.\n--buildings places the crowd across a solid structure and records combat-update cost.\n--forest places the crowd inside a dense grove to measure detailed foliage.\n--planted measures attacks after an actual recorded stop; requires a Ronin candidate.');process.exit(0);}if(args.some(x=>!['--retina','--buildings','--forest','--moving','--planted'].includes(x)&&!/^--course=[0-3]$/.test(x)&&!/^--hero=[0-5]$/.test(x)))throw new Error('Unknown option. Use --help.');
if(args.includes('--buildings')&&args.includes('--forest'))throw new Error('Choose either --buildings or --forest.');
const heroIndex=Number(args.find(x=>x.startsWith('--hero='))?.split('=')[1]||0),moving=args.includes('--moving'),planted=args.includes('--planted');
if(planted&&(moving||heroIndex!==0||!process.env.NINJA_BENCHMARK_CANDIDATE))throw Error('--planted requires a Ronin candidate and cannot combine with --moving.');
if(planted&&(args.includes('--buildings')||args.includes('--forest')))throw Error('--planted currently uses the unobstructed course benchmark.');
const courseIndex=Number(args.find(x=>x.startsWith('--course='))?.split('=')[1]||0),retina=args.includes('--retina'),buildings=args.includes('--buildings'),forest=args.includes('--forest'),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal','--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:retina?2:1});await disableHmr(page);
 if(process.env.NINJA_BENCHMARK_CANDIDATE&&process.env.NINJA_MODEL_DIRECTORY)throw Error('Choose a Ronin candidate or a model directory, not both.');
 // Candidate routing changes local test responses; public assets stay intact.
 if(process.env.NINJA_BENCHMARK_CANDIDATE)await routeFixedGripCandidate(page,process.env.NINJA_BENCHMARK_CANDIDATE,{withDiagonal:true,withGuards:true,withReturn:true});
 await routeModelDirectory(page,process.env.NINJA_MODEL_DIRECTORY);
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await page.evaluate(()=>{window.__golfTest.audio.enabled=false;});await page.click('#play');await page.click('#begin');await page.click(`[data-course="${courseIndex}"]`);await page.click('#start-round');
 await page.evaluate(async({buildings,forest,heroIndex,moving,planted})=>{const g=window.__golfTest,{heightAt,lieAt}=await import('/src/course.js');g.selectWarrior(heroIndex);g.clearEnemies();g.phase='combat';g.enemyBudget=80;g.enemiesSpawned=0;g.spawnTime=999;g.player.root.position.set(0,heightAt(g.course,0,90),90);g.ball.position.set(0,8,220);
  if(planted){
   g.audio.pause();g.input.clear();g.input.setContext('combat');g.cameraYaw=0;g.player.root.rotation.y=0;
   g.camera.position.copy(g.player.root.position).add({x:0,y:4,z:-10});g.camera.lookAt(g.player.root.position.clone().add({x:0,y:4,z:10}));g.camera.updateMatrixWorld(true);
   for(let i=0;i<480;i++){if(i===36)g.input.keys.add('KeyW');if(i===204)g.input.keys.delete('KeyW');g.time+=1/120;g.updateCombat(1/120);g.input.end();}
   if(!g.player.runAttackStep?.state?.parked)throw Error('The benchmark did not reach a planted recorded-stop stance.');
  }
  g.spawnWave(64);if(g.enemies.length!==64)throw new Error(`Expected 64 enemies, got ${g.enemies.length}`);g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.root.position.set(Math.sin(i*2.4)*(6+i*.22),0,90+Math.cos(i*2.4)*(6+i*.22));e.root.position.y=heightAt(g.course,e.root.position.x,e.root.position.z);e.cooldown=0;e.hp=100000;});g.cameraYaw=0;g.cameraPitch=.25;
  if(forest){
   const point=(x,z)=>({x,y:heightAt(g.course,x,z),z}),safe=p=>!['Water','Out of bounds'].includes(lieAt(g.course,p.x,p.z))&&!g.world.collision.blocked(p,.4,2),trees=g.world.vegetation.records;
   const candidates=trees.map(t=>point(t.x+5,t.z-4)).filter(safe).map(p=>({...p,neighbors:trees.filter(t=>Math.hypot(t.x-p.x,t.z-p.z)<35).length})).sort((a,b)=>b.neighbors-a.neighbors);
   const hero=candidates[0];if(!hero)throw new Error('No safe forest benchmark position');
   const positions=[];for(let row=0;row<20&&positions.length<64;row++)for(let col=0;col<20&&positions.length<64;col++){const p=point(hero.x+(col-9.5)*1.1,hero.z+(row-9.5)*1.1);if(safe(p))positions.push(p);}
   if(positions.length!==64)throw new Error(`Only ${positions.length} safe forest crowd positions`);
   g.player.root.position.copy(hero);g.enemies.forEach((e,i)=>e.root.position.copy(positions[i]));g.ball.position.copy(hero).add({x:0,y:0,z:40});g.vegetationBenchmark={forest:true,nearbyTrees:hero.neighbors};
  }
  if(buildings){
   const pattern=[/^jp-pagoda-foundation$/,/^highlands-0-tower-left$/,/^desert-0-body$/,/^cyberpunk-0-podium$/][g.courseIndex],body=g.world.collision.buildings.find(b=>pattern.test(b.id));
   if(!body)throw new Error('No benchmark building found');
   const point=(x,z)=>({x,y:heightAt(g.course,x,z),z}),safe=p=>!['Water','Out of bounds'].includes(lieAt(g.course,p.x,p.z))&&!g.world.collision.blocked(p,.4,2);
   let hero;for(let offset=4;offset<=32&&!hero;offset+=2)for(const dz of [0,-3,3]){const p=point(body.x+body.halfWidth+offset,body.z+dz);if(safe(p)){hero=p;break;}}
   if(!hero)throw new Error('No safe building benchmark hero position');g.player.root.position.copy(hero);
   const positions=[];for(let row=0;row<20&&positions.length<64;row++)for(let col=0;col<16&&positions.length<64;col++){const p=point(body.x-body.halfWidth-2-row*.7,body.z+(col-7.5)*.65);if(safe(p)&&!g.world.collision.segmentClear(p,hero,.3,2,true))positions.push(p);}
   if(positions.length!==64)throw new Error(`Only ${positions.length} safe obstructed crowd positions`);
   g.enemies.forEach((e,i)=>{e.root.position.copy(positions[i]);e.readyAt=0;});g.ball.position.copy(hero).add({x:0,y:0,z:40});g.cameraYaw=-Math.PI/2;
   g.buildingBenchmark={building:body.id,initiallyObstructed:64,maxCombatMs:0,navigationRoutes:0};const update=g.updateCombat.bind(g);g.updateCombat=dt=>{const before=performance.now();update(dt);g.buildingBenchmark.maxCombatMs=Math.max(g.buildingBenchmark.maxCombatMs,performance.now()-before);};
   const route=g.world.buildingNavigation.route.bind(g.world.buildingNavigation);g.world.buildingNavigation.route=(...args)=>{g.buildingBenchmark.navigationRoutes++;return route(...args);};
  }
  g.health=g.warrior.health;g.invincible=99999;let attackIndex=0;setInterval(()=>g.attack(attackIndex++%4===3?'heavy':'light'),350);
  g.movementBenchmark={hero:g.warrior.name,moving,planted,layerFrames:0};if(planted){const update=g.updateCombat.bind(g);g.updateCombat=dt=>{update(dt);if(g.player.runAttackStep?.state?.authoredTransfer)g.movementBenchmark.layerFrames++;};}if(moving){let direction=0;const move=()=>{g.input.clear();g.input.keys.add('KeyC');g.input.keys.add(['KeyW','KeyD','KeyS','KeyA'][direction++%4]);};move();setInterval(move,850);const update=g.updateCombat.bind(g);g.updateCombat=dt=>{update(dt);if(g.player.attackLocomotion?.weight>.1)g.movementBenchmark.layerFrames++;};}
 },{buildings,forest,heroIndex,moving,planted});
 await page.waitForTimeout(retina?16000:6000);
 const result=await page.evaluate(()=>new Promise(resolve=>{let frames=0,last=performance.now(),start=last,intervals=[];function frame(now){intervals.push(now-last);last=now;frames++;if(now-start<10000)requestAnimationFrame(frame);else{const g=window.__golfTest,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');intervals.sort((a,b)=>a-b);resolve({course:g.roundCourse.name,renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),viewport:[innerWidth,innerHeight],deviceScaleFactor:devicePixelRatio,renderRatio:g.renderer.getPixelRatio(),contactShading:g.rendering.contact.enabled,fps:frames*1000/(now-start),p95:intervals[Math.floor(intervals.length*.95)],enemies:g.enemies.length,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,...g.buildingBenchmark,...g.vegetationBenchmark,...g.movementBenchmark});}}requestAnimationFrame(frame);}));console.log(JSON.stringify({...result,candidate:process.env.NINJA_BENCHMARK_CANDIDATE??null,modelDirectory:process.env.NINJA_MODEL_DIRECTORY??null},null,2));await page.screenshot({path:`/tmp/ninja-benchmark-${courseIndex}-${retina?'retina':'desktop'}${buildings?'-buildings':forest?'-forest':''}${moving?'-moving':planted?'-planted':''}.png`});
}finally{await browser.close();}
