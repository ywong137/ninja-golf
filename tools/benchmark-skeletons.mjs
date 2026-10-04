import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('Usage: GAME_URL=http://localhost:5174 node tools/benchmark-skeletons.mjs [OUTPUT_DIRECTORY]\nCompares separate and shared enemy skeletons in a fixed, muted 64-enemy scene.');process.exit(0);}
const output=process.argv[2]??'/tmp/ninja-skeleton-benchmark';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await disableHmr(page);await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.evaluate(async()=>{
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(4,0);await g.world.waitForAssets();g.audio.pause();g.phase='combat';g.clearEnemies();g.enemyBudget=1000;g.enemiesSpawned=0;g.spawnWave(64);g.crowd.update(g.enemies);
  const {heightAt}=await import('/src/course.js');g.player.root.position.set(0,heightAt(g.course,0,90),90);
  g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.root.position.set((i%8-3.5)*2.8,0,87+Math.floor(i/8)*3.5);e.root.position.y=heightAt(g.course,e.root.position.x,e.root.position.z);e.root.rotation.y=i*.72;e.play('Sprint_Loop',0);e.mixer.update(i*.03);});
  const p=g.player.root.position;g.camera.position.set(p.x,p.y+4,p.z-8);g.camera.lookAt(p.x,p.y+1.5,p.z+13);g.camera.updateMatrixWorld(true);
  g.renderer.setPixelRatio(.75);g.renderer.setSize(innerWidth,innerHeight);g.rendering.resize();g.scene.userData.crowdCount=64;g.world.update(12,0,p,g.camera.position);
  window.palettePairs=[];for(const e of g.enemies)e.model.traverse(mesh=>{if(mesh.isSkinnedMesh)window.palettePairs.push({mesh,shared:mesh.skeleton,separate:mesh.skeleton.clone()});});
 });
 const results=[];
 for(const shared of [false,true,true,false]){
  const result=await page.evaluate(async shared=>{
   const g=window.__golfTest;for(const p of window.palettePairs)p.mesh.skeleton=shared?p.shared:p.separate;
   const run=frameCount=>new Promise(resolve=>{let start=null,previous=null,frames=0,totalCPU=0,intervals=[],cpu=[];const frame=now=>{start??=now;previous??=now;const before=performance.now();g.enemies.forEach((e,i)=>e.mixer.setTime((frames%180)/60+i*.03));g.rendering.render('balanced');const elapsed=performance.now()-before;cpu.push(elapsed);totalCPU+=elapsed;intervals.push(now-previous);previous=now;frames++;if(frames<frameCount)requestAnimationFrame(frame);else{cpu.sort((a,b)=>a-b);intervals.sort((a,b)=>a-b);resolve({shared,fps:(frames-1)*1000/(now-start),cpuMean:totalCPU/frames,cpuP95:cpu[Math.floor(cpu.length*.95)],p95:intervals[Math.floor(intervals.length*.95)],calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,palettes:new Set(window.palettePairs.map(p=>p.mesh.skeleton)).size,frames});}};requestAnimationFrame(frame);});
   await run(180);return run(360);
  },shared);results.push(result);console.log(JSON.stringify(result));
 }
 fs.writeFileSync(output+'/comparison.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
