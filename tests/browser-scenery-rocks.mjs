import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();});
 for(const theme of [0,1,2,3,1]){
  const result=await page.evaluate(async theme=>{
   const {greenDistance,lieAt}=await import('/src/course.js'),g=window.__golfTest,Matrix4=g.camera.matrix.constructor;
   const check=(condition,message)=>{if(!condition)throw new Error(message);};
   const previous=window.rockLifecycle;
   g.clearEnemies();g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.paused=true;g.audio.pause();g.input.clear();
   if(previous){check(previous.geometries===previous.expected,'Course reload did not dispose every old scanned geometry');check(previous.materials===previous.expected,'Course reload did not dispose every old scanned material');check(previous.textures===0,'Course reload disposed shared scan textures');}
   g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;
   check(!g.world.root.userData.sceneryRocks,'Course left queued rocks unconsumed');
   const groups=g.world.vegetation.groups.filter(group=>group.records.some(r=>r.scaleX!==undefined));
   check(theme===3?groups.length===0:groups.length>=2,'Missing queued rock LOD groups');
   const fitted=groups.filter(group=>group.lod===0).flatMap(group=>group.records.filter(r=>r.scaleX!==undefined).map(record=>({group,record})));
   const matches=g.world.ambushSites.filter(s=>s.kind==='rock').map(site=>({site,fit:fitted.find(({record})=>Math.hypot(record.x-site.x,record.z-site.z)<.1)})).filter(p=>p.fit);
   if(theme!==3)check(matches.length>=3,'Scanned rocks do not represent registered ambush sites');
   for(const {site,fit:{group,record}}of matches){
    const matrix=new Matrix4().compose({x:record.x,y:record.y,z:record.z},g.camera.quaternion.clone().set(0,Math.sin(record.angle/2),0,Math.cos(record.angle/2)),{x:record.scaleX,y:record.scaleY,z:record.scaleZ});
    group.mesh.geometry.computeBoundingBox();const bounds=group.mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    check(Math.abs(bounds.max.y-site.y-site.height)<.03,`Scanned top differs from cover height: ${site.id}`);
    check(greenDistance(g.course,site.x,site.z)>17,'Rock cover occupies a green');check(Math.hypot(site.x,site.z)>6,'Rock cover occupies the tee');check(lieAt(g.course,site.x,site.z)!=='Water','Rock cover occupies water');
    check(group.mesh.material.map?.image?.width>0&&group.mesh.material.normalMap,'Rock lost its scanned maps');
   }
   const lifecycle={geometries:0,materials:0,textures:0,expected:groups.length};
   for(const group of groups){group.mesh.geometry.addEventListener('dispose',()=>lifecycle.geometries++);group.mesh.material.addEventListener('dispose',()=>lifecycle.materials++);group.mesh.material.map.addEventListener('dispose',()=>lifecycle.textures++);}
   window.rockLifecycle=lifecycle;
   const chosen=matches.find(p=>p.site.fairway)||matches[0];window.rockInspectionSite=chosen?.site;
   if(chosen){const s=chosen.site;g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(s.x+4,s.y+2.8,s.z-5);g.camera.lookAt(s.x,s.y+s.height*.5,s.z);}else{g.camera.position.set(12,15,-15);g.camera.lookAt(0,6,30);}
   g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);
   if(chosen){const {group,record}=chosen.fit,mat=new Matrix4();let shown=false;for(let i=0;i<group.mesh.count;i++){group.mesh.getMatrixAt(i,mat);if(Math.abs(mat.elements[12]-record.x)<.01&&Math.abs(mat.elements[14]-record.z)<.01)shown=true;}check(shown,'Selected rock has no rendered near-LOD instance');}
   return{theme,registeredScans:matches.length,groups:groups.length,queuedInstances:fitted.length};
  },theme);
  console.log(JSON.stringify(result));
  if(theme===1||theme===2){
   await page.screenshot({path:`/tmp/ninja-rock-close-${theme}.png`});
   const emergence=await page.evaluate(async()=>{
    const {heightAt,lieAt}=await import('/src/course.js'),g=window.__golfTest,s=window.rockInspectionSite;
    let position;for(let i=0;i<16;i++){const a=i*Math.PI/8,x=s.x+Math.sin(a)*18,z=s.z+Math.cos(a)*18;if(!['Water','Out of bounds'].includes(lieAt(g.course,x,z))){position={x,z};break;}}
    if(!position)throw new Error('Rock has no dry travel approach');
    g.player.root.position.set(position.x,heightAt(g.course,position.x,position.z),position.z);g.player.root.visible=true;g.ball.position.set(s.x,s.y,s.z+30);g.phase='combat';g.combatTime=0;g.spawnTime=999;g.enemiesSpawned=0;g.enemyBudget=10;g.time=100;g.invincible=999;
    const sites=g.world.ambushSites;g.world.ambushSites=[s];s.readyAt=0;g.spawnWave(1);g.world.ambushSites=sites;
    const enemy=g.enemies[0];if(!enemy||enemy.spawnSite!==s.id)throw new Error('Registered rock cannot supply an emergence');
    for(let i=0;i<30;i++){g.time+=1/60;g.input.poll(1/60,true);g.updateCombat(1/60);g.effects.update(1/60);g.input.end();}
    g.crowd.update(g.enemies);g.camera.position.set(s.x+8,s.y+4,s.z-8);g.camera.lookAt(s.x,s.y+1,s.z);g.world.update(g.time,0,g.player.root.position,g.camera.position);g.rendering.render(g.quality);
    return{visible:enemy.root.visible&&enemy.root.parent===g.scene,emerging:!!enemy.emerging,dry:!['Water','Out of bounds'].includes(lieAt(g.course,enemy.emerging?.landing.x??enemy.root.position.x,enemy.emerging?.landing.z??enemy.root.position.z))};
   });
   assert.ok(emergence.visible&&emergence.emerging&&emergence.dry);await page.screenshot({path:`/tmp/ninja-rock-emergence-${theme}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log('Four themes, scanned cover heights, LOD visibility, safe endpoints, emergence, shared textures, and reload disposal passed');
}finally{await browser.close();}
