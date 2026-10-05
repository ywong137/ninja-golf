import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.GAME_URL||'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.evaluate(async()=>{
  const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{heightAt,lieAt}=await import('/src/course.js');g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();g.input.setContext('combat');
  const position=(x,z)=>new T.Vector3(x,heightAt(g.course,x,z),z);
  const dry=p=>!['Water','Out of bounds'].includes(lieAt(g.course,p.x,p.z));
  // Independent circle-to-authored-primitive check; it does not call the collision resolver.
  const overlaps=(p,r=.38,h=2)=>g.world.root.userData.buildingObstacles.filter(o=>{
   if(p.y+h<=o.minY+1e-5||p.y>=o.maxY-1e-5)return false;const a=o.yaw||0,dx=p.x-o.x,dz=p.z-o.z,x=Math.cos(a)*dx-Math.sin(a)*dz,z=Math.sin(a)*dx+Math.cos(a)*dz;
   if(o.kind==='cylinder')return Math.hypot(x,z)<o.radius+r-.002;
   return Math.hypot(Math.max(0,Math.abs(x)-o.halfWidth),Math.max(0,Math.abs(z)-o.halfDepth))<r-.002;
  }).map(o=>o.id);
  const reset=()=>{g.clearEnemies();g.crowd.update([]);g.input.clear();g.mode='game';g.ui.showScreen('game');g.phase='combat';g.survey=false;g.spawnTime=1e6;g.enemyBudget=0;g.dodgeTimer=0;g.action=null;g.cinematic=0;g.health=g.warrior.health;g.invincible=1e6;};
  const face=(dx,dz)=>{const p=g.player.root.position;g.camera.position.copy(p).add(new T.Vector3(-dx*8,3,-dz*8));g.camera.lookAt(p.clone().add(new T.Vector3(dx*10,1.5,dz*10)));g.camera.updateMatrixWorld(true);g.cameraYaw=Math.atan2(dx,dz);};
  const step=()=>{g.time+=1/60;g.updateCombat(1/60);g.input.end();g.crowd.update(g.enemies);};
  const walk=(start,dx,dz,frames,dodge=false)=>{
   reset();g.player.root.position.copy(start);face(dx,dz);g.input.keys.add('KeyW');if(dodge)g.input.pressed.add('Dodge');let maxPenetration=0,firstBad=null,maxTravel=0;
   for(let i=0;i<frames;i++){step();const bad=overlaps(g.player.root.position);if(bad.length){maxPenetration++;firstBad??={frame:i,obstacles:bad,position:g.player.root.position.toArray()};}maxTravel=Math.max(maxTravel,start.distanceTo(g.player.root.position));}
   g.input.clear();return {start:start.toArray(),end:g.player.root.position.toArray(),maxPenetration,firstBad,maxTravel,attached:g.player.root.parent===g.scene};
  };
  window.buildingTest={g,T,position,dry,overlaps,reset,face,step,walk,ballRadius:g.ball.geometry.parameters.radius*g.ball.scale.x};
 });
 const themes=process.env.BUILDING_THEMES?process.env.BUILDING_THEMES.split(',').map(Number):[0,1,2,3];assert.ok(themes.length&&themes.every(t=>Number.isInteger(t)&&t>=0&&t<4),'BUILDING_THEMES must contain comma-separated indices 0–3');
 const reports=[];let previousRecords=null;
 for(const theme of themes){
  const records=await page.evaluate(async theme=>{const {g,reset}=window.buildingTest;reset();g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.mode='game';g.phase='combat';g.paused=true;g.audio.pause();g.spawnTime=1e6;const records=g.world.root.userData.buildingObstacles;if(!Array.isArray(records)||!records.length)throw Error(`Theme ${theme} has no building records`);if(g.world.collision.buildings.map(o=>o.id).sort().join('|')!==records.map(o=>o.id).sort().join('|'))throw Error('Collision records do not match the current visible structures');window.buildingTest.records=records;return records;},theme);
  if(previousRecords){const stale=new Set(previousRecords.map(o=>o.id));assert.ok(records.every(o=>!stale.has(o.id)),'Course reload retained old building records');}
  previousRecords=records;
  const result=await page.evaluate(theme=>{
   const b=window.buildingTest,{g,T,position,dry,overlaps,walk}=b,records=b.records;
   const patterns=[/^jp-pagoda-foundation$/, /^highlands-\d+-tower-left$/, /^desert-\d+-body$/, /^cyberpunk-\d+-podium$/];
   const body=records.find(o=>patterns[theme].test(o.id));if(!body)throw Error(`Missing solid for theme ${theme}: ${records.map(o=>o.id)}`);b.body=body;
   // Choose a dry approach from a real exposed face, rather than an assumed anchor.
   let approach;for(const [dx,dz,extent]of [[0,1,body.halfDepth],[0,-1,body.halfDepth],[1,0,body.halfWidth],[-1,0,body.halfWidth]]){
    const start=position(body.x-dx*(extent+2),body.z-dz*(extent+2)),near=position(body.x-dx*(extent+.6),body.z-dz*(extent+.6));
    if(dry(start)&&dry(near)&&!overlaps(start).length&&g.world.collision.segmentClear(start,near,.38,2)){approach={start,dx,dz,extent};break;}
   }if(!approach)throw Error(`No dry exposed approach for ${body.id}`);
   const ordinary=walk(approach.start,approach.dx,approach.dz,100),dodge=walk(approach.start,approach.dx,approach.dz,50,true);
   return {theme,body,ordinary,dodge,records:records.length};
  },theme);
  for(const state of [result.ordinary,result.dodge]){assert.equal(state.maxPenetration,0,JSON.stringify({theme,...state}));assert.ok(state.maxTravel>.5&&state.maxTravel<2.1,JSON.stringify({theme,...state}));assert.equal(state.attached,true);}
  // Opening tests also use real movement through the same combat update path.
  if(theme<3){result.opening=await page.evaluate(theme=>{
   const {g,records,position,walk}=window.buildingTest;let center,dx=0,dz=1,start,end;
   if(theme===0){const a=records.find(o=>o.id==='jp-gate-post-left'),b=records.find(o=>o.id==='jp-gate-post-right');center={x:(a.x+b.x)/2,z:(a.z+b.z)/2};start=position(center.x,center.z-4);end=position(center.x,center.z+4);}
   if(theme===1){const lintel=records.find(o=>/^highlands-\d+-lintel$/.test(o.id));center=lintel;start=position(center.x,center.z-4);end=position(center.x,center.z+4);}
   if(theme===2){const roof=records.find(o=>/^desert-\d+-porch-roof$/.test(o.id));center={x:roof.x,z:roof.z-6.7};dx=1;dz=0;start=position(center.x-6,center.z);end=position(center.x+6,center.z);}
   const distance=start.distanceTo(end),report=walk(start,dx,dz,Math.ceil(distance/(5.6*g.warrior.speed)*60));window.buildingTest.openingAnchor=center;
   return {...report,target:end.toArray(),error:g.player.root.position.distanceTo(end),center};
  },theme);assert.equal(result.opening.maxPenetration,0,JSON.stringify(result.opening));assert.ok(result.opening.error<.25,JSON.stringify(result.opening));
   result.opening.camera=await page.evaluate(theme=>{const {g,T}=window.buildingTest;g.cameraYaw=theme===2?Math.PI/2:0;g.cameraPitch=.08;g.camera.position.copy(g.player.root.position).add({x:0,y:2,z:-2});for(let i=0;i<90;i++)g.updateCamera(1/60);const origin=g.player.root.position.clone().add(new T.Vector3(0,1.7,0));return {distance:origin.distanceTo(g.camera.position),clear:g.world.collision.segmentClear(origin,g.camera.position,.25,0,true)};},theme);
   assert.ok(result.opening.camera.distance>6,JSON.stringify(result.opening.camera));assert.equal(result.opening.camera.clear,true);
   await page.evaluate(()=>{const {g,openingAnchor:a}=window.buildingTest,y=g.player.root.position.y;g.camera.position.set(a.x+14,y+5,a.z-20);g.camera.lookAt(a.x,y+2,a.z);g.world.update(g.time,0,g.player.root.position,g.camera.position);for(const e of document.querySelectorAll('.screen,#hud,#toast,#hole-banner'))e.style.visibility='hidden';g.rendering.render('high');});
   await page.screenshot({path:`/tmp/ninja-buildings-${theme}-opening.png`});
  }
  result.camera=await page.evaluate(()=>{
   const {g,records,position,reset,overlaps,dry}=window.buildingTest;reset();
   // Use an exposed wall face. Entrance stairs can occupy the former front fixture.
   let setup;for(const solid of records.filter(o=>o.kind==='box'&&o.maxY-o.minY>2&&o.minY<position(o.x,o.z).y+2.3).sort((a,b)=>b.halfWidth-a.halfWidth)){
    for(const [dx,dz,extent]of [[0,1,solid.halfDepth],[0,-1,solid.halfDepth],[1,0,solid.halfWidth],[-1,0,solid.halfWidth]]){
     const p=position(solid.x-dx*(extent+1),solid.z-dz*(extent+1)),origin=p.clone().add({x:0,y:1.7,z:0}),target=origin.clone().add({x:dx*7.7,y:.7,z:dz*7.7});
     if(dry(p)&&!overlaps(p).length&&g.world.collision.sweepSphere(origin,target,.25,false)){setup={solid,p,dx,dz};break;}
    }if(setup)break;
   }if(!setup)throw Error('No dry exposed tall wall for camera test');
   const {solid,p,dx,dz}=setup;g.player.root.position.copy(p);g.cameraYaw=Math.atan2(-dx,-dz);g.cameraPitch=.08;g.camera.position.copy(p).add({x:-dx*2,y:2,z:-dz*2});g.currentLook.copy(p);for(let i=0;i<90;i++)g.updateCamera(1/60);
   const origin=p.clone().add({x:0,y:1.7,z:0}),clear=g.world.collision.segmentClear(origin,g.camera.position,.25,0,true),shortened=origin.distanceTo(g.camera.position)<6;
   return {wall:solid.id,clear,shortened,camera:g.camera.position.toArray(),origin:origin.toArray(),sphereHit:g.world.collision.sweepSphere(origin,g.camera.position,.2,false),clearanceHit:g.world.collision.sweepSphere(origin,g.camera.position,.25,true)};
  });assert.equal(result.camera.clear,true,JSON.stringify(result.camera));assert.equal(result.camera.shortened,true,JSON.stringify(result.camera));
  if(theme===1){result.overhead=await page.evaluate(()=>{
   const {g,records,position}=window.buildingTest,walls=records.filter(o=>/^highlands-\d+-rear-wall-.*-2$/.test(o.id));let setup;
   for(const wall of walls){for(const [dx,dz,extent]of [[1,0,wall.halfWidth],[-1,0,wall.halfWidth],[0,1,wall.halfDepth],[0,-1,wall.halfDepth]]){const p=position(wall.x-dx*(extent+3),wall.z-dz*(extent+3)),origin=p.clone().add({x:0,y:1.7,z:0}),target=p.clone().add({x:dx*7.7,y:5.8,z:dz*7.7});if(!g.world.collision.blocked(p,.38,2)&&!g.world.collision.sweepSphere(origin,target,.45,false)){setup={wall,p,dx,dz};break;}}if(setup)break;}
   if(!setup)throw Error('No unobstructed above-wall camera fixture');const {wall,p,dx,dz}=setup;g.player.root.position.copy(p);g.cameraYaw=Math.atan2(-dx,-dz);g.cameraPitch=.8;g.camera.position.copy(p).add({x:0,y:2,z:-2});for(let i=0;i<90;i++)g.updateCamera(1/60);const origin=p.clone().add({x:0,y:1.7,z:0});return {wall:wall.id,distance:origin.distanceTo(g.camera.position),clear:g.world.collision.segmentClear(origin,g.camera.position,.25,0,true)};
  });assert.ok(result.overhead.distance>6,JSON.stringify(result.overhead));assert.equal(result.overhead.clear,true);}

  // Actual spawned enemy, attached through CrowdRenderer, pursues across a building.
  result.pursuit=await page.evaluate(()=>{
   const b=window.buildingTest,{g,T,body,position,reset,overlaps,step,dry}=b;reset();
   let start,target,axis,detourExtent;for(const offset of [2,4,6,8,10,12,14]){for(const a of ['x','z']){const extent=(a==='x'?body.halfWidth:body.halfDepth)+offset;start=position(body.x-(a==='x'?extent:0),body.z-(a==='z'?extent:0));target=position(body.x+(a==='x'?extent:0),body.z+(a==='z'?extent:0));if(dry(start)&&dry(target)&&!overlaps(start,.3).length&&!overlaps(target).length&&!g.world.collision.segmentClear(start,target,.3,2,true)){axis=a;detourExtent=a==='x'?body.halfDepth:body.halfWidth;break;}}if(axis)break;}if(!axis)throw Error(`Pursuit setup blocked for ${body.id}`);
   g.player.root.position.copy(target);g.enemyBudget=64;g.enemiesSpawned=0;g.ball.position.copy(target).add({x:0,y:0,z:40});for(const site of g.world.ambushSites)site.readyAt=0;g.spawnWave(8);const enemy=g.enemies.find(e=>e.type!==3);if(!enemy)throw Error('No native melee enemy spawned');
   for(const other of g.enemies)if(other!==enemy)other.dispose();g.enemies=[enemy];enemy.emerging=null;enemy.root.visible=true;enemy.root.position.copy(start);enemy.cooldown=0;enemy.readyAt=0;enemy.speed=4;enemy.enemyAction=null;enemy.knockback=new T.Vector3();g.enemyBudget=0;g.crowd.update(g.enemies);
   let blocked=0,firstBad=null,maxSide=0;const path=[];for(let frame=0;frame<1200;frame++){step();const bad=overlaps(enemy.root.position,.3);if(bad.length){blocked++;firstBad??=bad;}maxSide=Math.max(maxSide,Math.abs(axis==='x'?enemy.root.position.z-body.z:enemy.root.position.x-body.x));if(frame%30===0)path.push(enemy.root.position.toArray());if(enemy.root.position.distanceTo(g.player.root.position)<3)break;}
   b.enemy=enemy;return {blocked,firstBad,maxSide,detourExtent,axis,path,initialDistance:start.distanceTo(target),finalDistance:enemy.root.position.distanceTo(g.player.root.position),attached:enemy.root.parent===g.scene,visible:enemy.root.visible,heroAttached:g.player.root.parent===g.scene,heroVisible:g.player.root.visible,moveYaw:enemy.moveYaw,blockedNavigation:g.world.collision.blocked(enemy.root.position,.34,2,true),blockedBuildings:g.world.collision.blocked(enemy.root.position,.3,2,true),blockedAll:g.world.collision.blocked(enemy.root.position,.3,2,false),replanned:g.world.buildingNavigation.route(enemy.root.position,g.player.root.position),navigation:enemy.buildingPath,routeAt:enemy.buildingRouteAt,time:g.time,nearby:g.world.collision.nearby(enemy.root.position.x,enemy.root.position.z).filter(o=>Math.hypot(o.x-enemy.root.position.x,o.z-enemy.root.position.z)<4)};
  });
  // Capture both attached actors with the actual collision-tested structure.
  for(const view of ['travel','aerial']){
   await page.evaluate(({view})=>{const {g,body,openingAnchor}=window.buildingTest,anchor=view==='opening'?openingAnchor:body;g.crowd.update(g.enemies);const y=g.player.root.position.y;g.camera.fov=48;g.camera.updateProjectionMatrix();if(view==='aerial'){g.camera.position.set(anchor.x+3,Math.max(y+65,...window.buildingTest.records.map(o=>o.maxY+25)),anchor.z);g.camera.lookAt(anchor.x,y+6,anchor.z);}else{const p=g.player.root.position,dx=p.x-anchor.x,dz=p.z-anchor.z,length=Math.hypot(dx,dz)||1;g.camera.position.set(p.x+dx/length*8+dz/length*3,y+3.2,p.z+dz/length*8-dx/length*3);g.camera.lookAt(p.x-dx/length*3,y+1.7,p.z-dz/length*3);}g.world.update(g.time,0,g.player.root.position,g.camera.position);for(const e of document.querySelectorAll('.screen,#hud,#toast,#hole-banner'))e.style.visibility='hidden';g.rendering.render('high');},{view});
   await page.screenshot({path:`/tmp/ninja-buildings-${theme}-${view}.png`});
  }
  console.log(JSON.stringify({theme,pursuit:result.pursuit},null,2));
  assert.equal(result.pursuit.blocked,0,JSON.stringify(result.pursuit));assert.ok(result.pursuit.finalDistance<5,JSON.stringify(result.pursuit));assert.ok(result.pursuit.maxSide>result.pursuit.detourExtent,JSON.stringify(result.pursuit));assert.equal(result.pursuit.attached,true);assert.equal(result.pursuit.visible,true);assert.equal(result.pursuit.heroAttached,true);assert.equal(result.pursuit.heroVisible,true);
  if(theme===0){await page.evaluate(()=>{const {g,body}=window.buildingTest,p=g.player.root.position;g.camera.position.set(body.x+16,body.maxY+7,body.z-26);g.camera.lookAt(body.x,body.maxY+2,body.z-7);g.world.update(g.time,0,p,g.camera.position);g.rendering.render('high');});await page.screenshot({path:'/tmp/ninja-buildings-0-stairs.png'});}
  result.emergence=await page.evaluate(async()=>{
   const {g,body,position,reset,overlaps,step}=window.buildingTest,{enemyEmergenceFrame}=await import('/src/enemy-emergence.js');reset();g.player.root.position.copy(position(body.x+body.halfWidth+5,body.z));g.ball.position.copy(g.player.root.position).add({x:0,y:0,z:40});g.enemyBudget=64;g.enemiesSpawned=0;for(const site of g.world.ambushSites)site.readyAt=0;g.spawnWave(12);g.enemyBudget=0;
   const initial=g.enemies.filter(e=>e.emerging).map(e=>({site:e.spawnSite,landing:e.emerging.landing.toArray(),blocked:overlaps(e.emerging.landing,.3)}));const finishSeconds=Math.max(...g.enemies.filter(e=>e.emerging).map(e=>e.emerging.delay+enemyEmergenceFrame(0,{duration:e.emerging.duration,kind:e.emerging.site.kind}).duration))+.1;for(let frame=0;frame<Math.ceil(finishSeconds*60);frame++)step();return {initial,finishSeconds,remaining:g.enemies.filter(e=>e.emerging).length,attached:g.enemies.every(e=>e.root.parent===g.scene),landedBlocked:g.enemies.flatMap(e=>overlaps(e.root.position,.3))};
  });assert.ok(result.emergence.initial.length>0);assert.ok(result.emergence.initial.every(e=>e.blocked.length===0),JSON.stringify(result.emergence));assert.equal(result.emergence.remaining,0);assert.equal(result.emergence.attached,true);assert.deepEqual(result.emergence.landedBlocked,[]);
  result.ball=await page.evaluate(()=>{
   const {g,records,body,position,reset,overlaps,ballRadius}=window.buildingTest;reset();const wall=records.find(o=>o.id==='jp-pagoda-body-0')||body;
   const origin=position(wall.x,wall.z-wall.halfDepth-3);origin.y+=ballRadius;g.ball.position.copy(origin);g.lie='Rough';g.club=0;g.aim=0;g.power=.3;g.launchBall();g.ball.position.set(wall.x,(wall.minY+wall.maxY)/2,wall.z-wall.halfDepth-2);g.velocity.set(0,0,14);let reflected=false,penetrations=0;
   for(let i=0;i<40&&g.phase==='flight';i++){g.updateBall(1/60);if(overlaps(g.ball.position,ballRadius,0).length)penetrations++;if(g.velocity.z<0){reflected=true;break;}}
   const roof=records.filter(o=>o.kind==='box').sort((a,b)=>b.maxY-a.maxY)[0];g.ball.position.copy(origin);g.launchBall();const strokes=g.strokes,penalties=g.penalties,relief=g.shotOrigin.clone();g.ball.position.set(roof.x,roof.maxY+ballRadius+.01,roof.z);g.velocity.set(0,-.25,0);for(let i=0;i<30;i++)g.updateBall(1/60);
   return {wall:wall.id,reflected,penetrations,roof:roof.id,reliefError:g.ball.position.distanceTo(relief),penaltyDelta:g.penalties-penalties,strokeDelta:g.strokes-strokes,phase:g.phase};
  });assert.equal(result.ball.reflected,true,JSON.stringify(result.ball));assert.equal(result.ball.penetrations,0,JSON.stringify(result.ball));assert.equal(result.ball.penaltyDelta,1);assert.equal(result.ball.strokeDelta,1);assert.equal(result.ball.phase,'aim');assert.ok(result.ball.reliefError<1e-8);
  result.freeDrop=await page.evaluate(()=>{
   const {g,body,position,reset,overlaps,dry,ballRadius}=window.buildingTest;reset();let start;
   for(const [dx,dz,extent]of [[1,0,body.halfWidth],[-1,0,body.halfWidth],[0,1,body.halfDepth],[0,-1,body.halfDepth]]){const p=position(body.x+dx*(extent+.35),body.z+dz*(extent+.35));if(dry(p)&&!overlaps(p,ballRadius,0).length&&g.world.collision.blocked(p,1.5,2.2,true)){start=p;break;}}
   if(!start)throw Error(`No real near-wall free-drop fixture for ${body.id}`);
   g.ball.position.copy(start).add({x:0,y:ballRadius,z:0});g.player.root.position.copy(start);g.shotOrigin.copy(position(0,0)).add({x:0,y:ballRadius,z:0});g.shotStartLie='Rough';g.phase='flight';const strokes=g.strokes,penalties=g.penalties,pinBefore=Math.hypot(g.ball.position.x-g.course.greenX,g.ball.position.z-g.course.length);g.land();
   const drop=g.ball.position.clone(),stances=[],selectedHero=g.playerIndex,selectedClub=g.club;
   for(let hero=0;hero<6;hero++){
    g.selectWarrior(hero);
    for(let club=0;club<8;club++){
     g.selectClub(club);
     for(let i=0;i<16;i++){g.aim=i*Math.PI/8;g.placePlayer();g.player.update(g.time,0,{golf:true,groundHeight:g.groundHeight});stances.push({hero,club,aim:g.aim,position:g.player.root.position.toArray(),blocked:overlaps(g.player.root.position,.38,2.2),attached:g.player.root.parent===g.scene,visible:g.player.root.visible});}
    }
   }
   g.selectWarrior(selectedHero);g.selectClub(selectedClub);
   return {start:start.toArray(),drop:drop.toArray(),distance:Math.hypot(drop.x-start.x,drop.z-start.z),strokeDelta:g.strokes-strokes,penaltyDelta:g.penalties-penalties,pinBefore,pinAfter:Math.hypot(drop.x-g.course.greenX,drop.z-g.course.length),phase:g.phase,notice:g.lastShot.relief,shotYards:g.lastShot.distance,expectedShotYards:Math.hypot(start.x-g.shotOrigin.x,start.z-g.shotOrigin.z)*1.09361,noticeText:document.querySelector('#shot-result').textContent,stances};
  });assert.ok(result.freeDrop.distance>.01&&result.freeDrop.distance<=12,JSON.stringify(result.freeDrop));assert.equal(result.freeDrop.strokeDelta,0);assert.equal(result.freeDrop.penaltyDelta,0);assert.ok(result.freeDrop.pinAfter>=result.freeDrop.pinBefore-1e-6);assert.equal(result.freeDrop.notice,true);assert.ok(Math.abs(result.freeDrop.shotYards-result.freeDrop.expectedShotYards)<1e-8);assert.match(result.freeDrop.noticeText,/Free drop from building.*No penalty/);assert.equal(result.freeDrop.phase,'aim');for(const stance of result.freeDrop.stances){assert.deepEqual(stance.blocked,[],JSON.stringify(stance));assert.equal(stance.attached,true);assert.equal(stance.visible,true);}
  result.unplayableDrop=await page.evaluate(async()=>{
   const {g,body,position,reset,ballRadius}=window.buildingTest,{obstructionRelief}=await import('/src/building-ball.js');reset();
   // Defensive restored-state case: a ball inside an existing solid has no clear drop path.
   const origin=position(0,0).add({x:0,y:ballRadius,z:0});g.shotOrigin.copy(origin);g.shotStartLie='Tee';g.ball.position.copy(position(body.x,body.z)).add({x:0,y:ballRadius,z:0});g.phase='flight';const status=obstructionRelief(g.course,g.world.collision,g.ball.position).status,strokes=g.strokes,penalties=g.penalties;g.land();
   return {fixture:'restored ball inside solid',status,strokeDelta:g.strokes-strokes,penaltyDelta:g.penalties-penalties,originError:g.ball.position.distanceTo(origin),phase:g.phase};
  });assert.equal(result.unplayableDrop.status,'unplayable',JSON.stringify(result.unplayableDrop));assert.equal(result.unplayableDrop.strokeDelta,1);assert.equal(result.unplayableDrop.penaltyDelta,1);assert.ok(result.unplayableDrop.originError<1e-8);assert.equal(result.unplayableDrop.phase,'aim');
  result.projectile=await page.evaluate(()=>{
   const {g,body,position,reset,step}=window.buildingTest;reset();const p=position(body.x+body.halfWidth+2,body.z);g.player.root.position.copy(p);g.invincible=0;const target=p.clone().add({x:0,y:1,z:0}),origin=position(body.x-body.halfWidth-2,body.z).add({x:0,y:1,z:0});
   g.projectiles.spawn(origin,target,7);const attached=g.projectiles.items[0]?.mesh.parent===g.scene,health=g.health;let steps=0;while(g.projectiles.items.length&&steps++<150)step();const blockedDamage=health-g.health,removed=g.projectiles.items.length===0;
   g.invincible=0;g.projectiles.spawn(target.clone().add({x:0,y:0,z:-3}),target,7);const controlHealth=g.health;steps=0;while(g.projectiles.items.length&&steps++<60)step();return {attached,removed,blockedDamage,controlDamage:controlHealth-g.health};
  });assert.equal(result.projectile.attached,true);assert.equal(result.projectile.removed,true);assert.equal(result.projectile.blockedDamage,0,JSON.stringify(result.projectile));assert.equal(result.projectile.controlDamage,7,JSON.stringify(result.projectile));
  reports.push(result);
 }
 assert.deepEqual(errors,[]);
 const summary=reports.map(report=>({...report,freeDrop:{...report.freeDrop,stances:{tested:report.freeDrop.stances.length,blocked:report.freeDrop.stances.filter(stance=>stance.blocked.length).length}}}));
 console.log(JSON.stringify(summary,null,2));console.log('Actual player, dodge, enemy pursuit, emergence, camera, openings, and course reload building checks passed.');
}finally{await browser.close();}
