import {findWaterEmergence,waterEmergencePosition} from './water-emergence.js';
import './style.css';
import * as THREE from 'three';
import { Rendering } from './rendering.js';
import { loadNature } from './nature.js';
import {PuttingGuide,previewShot} from './golf-guide.js';
import {BALL_STEP,BALL_RADIUS,ballSurface,ballHazard,applyRollingResistance,capturesCup,rollingFinished} from './golf-roll.js';
import { World } from './world.js';
import {moveOnLand} from './land-movement.js';
import {resolveBuildingBall,buildingRelief} from './building-ball.js';
import {courseSurfaceHeight} from './terrain.js';
import { Warrior, Effects, CrowdRenderer, loadWarriorAssets } from './actors.js';
import { cameraRelativeMove, aimDelta, turnToward } from './navigation.js';
import { attackDefinition, strikeContains, chooseAmbushSites, ENEMY_TYPES, enemyTypeForSlot, engagementTarget, guardDamageMultiplier, enemyReadyToAttack, MUSOU_CINEMATIC_DURATION, createPlayerGuard, updatePlayerGuard, exitPlayerGuard, resolvePlayerGuard, guardAttackRecovering, escapeGuardBreak } from './combat.js';
import {createSurvey,moveSurvey,surveyPosition} from './survey.js';
import {readRoundSave} from './round.js';
import { Projectiles } from './projectiles.js';
import {musouHeadings,combatMotionName,motions} from './motion.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import {CharacterShowcase} from './character-showcase.js';
import {activeBladeTrailHands} from './effects.js';
import {enemyAppearanceForSlot} from './enemy-appearances.js';
import { COURSE_SETS, COURSE_BOUNDS, WARRIORS, CLUBS, heightAt, ellipse, lieAt, clamp, carryFor, launchShot, scoreName } from './course.js';

const v1=new THREE.Vector3(),v2=new THREE.Vector3(),camTarget=new THREE.Vector3(),camLook=new THREE.Vector3();
const YARD=1.09361;
class Game {
  constructor(){
    this.courseIndex=0;this.roundCourse=COURSE_SETS[0];this.holes=this.roundCourse.holes;this.penalties=0;this.scorePenalties=[];this.audio=new AudioEngine();this.mode='home';this.phase='aim';this.paused=false;this.hole=0;this.scores=[];this.kills=0;this.combo=0;this.bestCombo=0;this.comboTime=0;this.resolve=35;this.guard=createPlayerGuard();this.health=110;this.quality='balanced';this.time=0;this.playerIndex=0;this.enemies=[];this.power=1;this.charging=false;this.club=0;this.strokes=0;this.enemiesSpawned=0;this.attackTimer=0;this.dodgeTimer=0;this.invincible=0;this.shotOrigin=new THREE.Vector3();this.cameraYaw=0;this.cameraPitch=.35;this.swingTimer=0;this.uiTime=0;this.frameCount=0;this.fpsTime=0;
    this.groundHeight=(x,z)=>courseSurfaceHeight(this.course,x,z,heightAt,ellipse);
    this.ui=new UI({selection:()=>this.selectScreen(),home:()=>this.home(),begin:(i,c)=>this.begin(i,c),courseSelection:()=>this.selectCourseScreen(),course:i=>this.previewCourse(i),warrior:i=>this.selectWarrior(i),audio:()=>this.ui.audio(this.audio.toggle()),pause:()=>this.togglePause(),help:()=>{this.ui.help();},resume:()=>this.resume(),swing:()=>{this.audio.start();this.swing();},club:d=>this.changeClub(d),selectClub:i=>this.selectClub(i),skip:()=>{this.fastFlight=true;},restart:()=>{this.paused=false;this.loadHole(this.hole);this.audio.resume();},next:()=>this.nextHole(),survey:()=>this.toggleSurvey(),showcaseSpeed:speed=>{this.showcase?.clock.setSpeed(speed);this.updateShowcaseUI();},showcasePause:()=>{if(this.showcase)this.showcase.clock.paused=!this.showcase.clock.paused;this.updateShowcaseUI();}});
    try{this.renderer=new THREE.WebGLRenderer({canvas:this.ui.canvas,antialias:true,powerPreference:'high-performance'});}catch(e){this.ui.modal('<h2>A little more graphics power.</h2><p>This game needs WebGL 2. Enable hardware acceleration in your browser, then reload the page.</p>');return;}
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.4,6500);
    this.portraitLights=new THREE.Group();this.portraitLights.visible=false;
    const portraitKey=new THREE.PointLight('#fff0df',48,16,2),portraitFill=new THREE.PointLight('#e2eeff',24,14,2);
    portraitKey.position.set(-2,5,4);portraitFill.position.set(4,3,3);this.portraitLights.add(portraitKey,portraitFill);this.scene.add(this.portraitLights);
    this.world=new World(this.scene,this.renderer);this.rendering=new Rendering(this.renderer,this.scene,this.camera);this.effects=new Effects(this.scene,(x,z)=>heightAt(this.course,x,z));this.puttingGuide=new PuttingGuide(this.scene);this.projectiles=new Projectiles(this.scene,this.effects);this.enemyActionSerial=0;this.crowd=new CrowdRenderer(this.scene);this.input=new Input(this.ui.canvas);this.input.onUnlock=()=>{if(this.mode==='game'&&!this.paused)this.togglePause();};this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,20,14),new THREE.MeshStandardMaterial({color:'#fffef3',roughness:.38}));this.ball.castShadow=true;this.scene.add(this.ball);
    this.ballGlow=new THREE.Mesh(new THREE.RingGeometry(.33,.42,40),new THREE.MeshBasicMaterial({color:'#f3e3a9',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));this.ballGlow.rotation.x=-Math.PI/2;this.scene.add(this.ballGlow);
    this.ballBeacon=new THREE.Mesh(new THREE.CylinderGeometry(.12,.6,11,12,1,true),new THREE.MeshBasicMaterial({color:'#ecdba6',transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));this.scene.add(this.ballBeacon);
    this.aimMarker=new THREE.Mesh(new THREE.RingGeometry(1.5,1.7,56),new THREE.MeshBasicMaterial({color:'#f7eac1',side:THREE.DoubleSide,transparent:true,opacity:.85}));this.aimMarker.rotation.x=-Math.PI/2;this.scene.add(this.aimMarker);
    this.aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#f4e7b7',dashSize:1.1,gapSize:1.4,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.aimLine);
    this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f8f3db',transparent:true,opacity:.8}));this.scene.add(this.trail);this.trailPoints=[];
    this.selectWarrior(0);this.home();this.ui.showScreen('home');
    const curtain=document.createElement('div');curtain.className='loading-screen';curtain.id='asset-curtain';curtain.innerHTML='<div class="brand-mark">忍</div><h2>Preparing the course.</h2><p>Finishing the light, water, and landscape…</p>';document.body.append(curtain);
    this.world.waitForAssets().then(()=>this.renderer.compileAsync(this.scene,this.camera)).finally(()=>{curtain.classList.add('loaded');setTimeout(()=>curtain.remove(),300);});
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.mode==='game'&&!this.paused&&this.phase!=='holed')this.togglePause();});
    this.ui.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.audio.pause();this.ui.modal('<h2>The graphics session stopped.</h2><p>Reload this page to restore the course. Completed holes remain saved.</p><button class="primary" onclick="location.reload()">Reload game</button>');});
    // Read-only diagnostics help verify the real game without bypassing its rules.
    window.ninjaGolf={state:()=>({mode:this.mode,phase:this.phase,aim:this.aim,cameraYaw:this.cameraYaw,facing:this.player.root.rotation.y,hole:this.hole,courseId:this.roundCourse.id,holes:this.holes.length,playerIndex:this.playerIndex,survey:!!this.survey,penalties:this.penalties,strokes:this.strokes,lie:this.lie,ball:this.ball.position.toArray(),player:this.player.root.position.toArray(),health:this.health,enemies:this.enemies.filter(e=>!e.dead).length,kills:this.kills,resolve:this.resolve,club:CLUBS[this.club].short,power:this.power,charging:this.charging,scores:[...this.scores],paused:this.paused,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,showcase:this.showcase?.state??null,musicReady:this.audio.music.readyState,musicFailed:this.audio.musicFailed,musicMode:this.audio.mode,combatMusicReady:this.audio.combatMusic.readyState})};
    this.camera.position.set(96,77,-88);this.currentLook.set(-15,10,155);if(import.meta.env.DEV)window.__golfTest=this;this.restoreOffer();this.previousTime=performance.now();this.renderer.setAnimationLoop(()=>this.frame());
  }
  get warrior(){return WARRIORS[this.playerIndex];}
  stopShowcase(){if(!this.showcase)return;this.showcaseSettings={speed:this.showcase.clock.speed,paused:this.showcase.clock.paused};this.showcase.dispose();this.showcase=null;}
  startShowcase(){this.stopShowcase();this.showcase=new CharacterShowcase(this.player,this.showcaseSettings);this.updateShowcaseUI();}
  updateShowcaseUI(){if(this.showcase)this.ui.showcaseState(this.showcase.state);}
  selectWarrior(i){this.stopShowcase();if(this.player){this.scene.remove(this.player.root);this.player.dispose();}this.playerIndex=i;this.ui.warriorDetails(i);this.player=new Warrior(i);this.scene.add(this.player.root);if(this.ball&&this.course)this.placePlayer();if(this.mode==='selection'){this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.scale.setScalar(2.0);this.player.root.rotation.y=.25;this.startShowcase();}this.audio.play('click');}
  selectScreen(){this.mode='selection';this.paused=false;this.audio.start();this.clearEnemies();this.aimLine.visible=false;this.aimMarker.visible=false;this.player.root.visible=true;this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.rotation.y=.25;this.player.root.scale.setScalar(2.0);this.ball.visible=false;this.startShowcase();this.updateCamera(0,{immediate:true});}
  setCourse(index){this.courseIndex=index;this.roundCourse=COURSE_SETS[index];this.holes=this.roundCourse.holes;this.audio.setCourse(this.roundCourse.id);}
  home(){this.stopShowcase();this.mode='home';this.paused=false;this.setCourse(Math.floor(Math.random()*COURSE_SETS.length));this.loadHole(this.roundCourse.preview?.hole||0);this.player.root.visible=false;this.aimLine.visible=false;this.aimMarker.visible=false;this.trail.visible=false;this.ballBeacon.visible=false;this.ui.closeModal();this.input.clear();this.ui.homeCourse(this.roundCourse);this.restoreOffer();}
  selectCourseScreen(){this.stopShowcase();this.mode='courses';this.paused=false;this.clearEnemies();this.previewCourse(this.ui.selectedCourse||0);}
  previewCourse(index){this.setCourse(index);this.loadHole(this.roundCourse.preview?.hole||0);this.player.root.visible=false;this.ball.visible=false;this.aimLine.visible=false;this.aimMarker.visible=false;this.ui.courseDetails(this.roundCourse);}
  toggleSurvey(){if(this.mode!=='game'||this.phase!=='aim')return;this.survey=!this.survey;if(this.survey)this.surveyView=createSurvey(this.ball.position,this.aimMarker.position,this.camera.fov,this.camera.aspect);this.input.clear();}

  begin(i=this.playerIndex,courseIndex=0){this.stopShowcase();this.mode='game';this.setCourse(courseIndex);this.selectWarrior(i);this.scores=[];this.scorePenalties=[];this.kills=0;this.bestCombo=0;this.resolve=35;this.mode='game';this.paused=false;this.loadHole(0);this.audio.start();this.ui.toast('Q / E selects a club. A / D aims. Press SPACE twice to swing.',6000);this.save();}
  loadHole(index){
    this.hole=index;this.course=this.holes[index];this.scene.userData.courseTheme=this.course.theme;this.world.build(this.course);this.puttingGuide.build(this.course);this.survey=false;this.clearEnemies();this.effects.clear();this.strokes=0;this.penalties=0;this.health=this.warrior.health;this.guard=createPlayerGuard();this.charging=false;this.power=1;this.club=this.course.par===3?2:0;this.phase='aim';this.combo=0;this.pendingStrike=null;this.attackTimer=0;this.invincible=0;this.dodgeTimer=0;
    this.ball.position.set(0,heightAt(this.course,0,0)+BALL_RADIUS,0);this.shotOrigin.copy(this.ball.position);this.ball.visible=true;this.trail.visible=false;this.lie='Tee';this.player.root.visible=this.mode==='game';this.aimAtPin();this.placePlayer();this.cameraYaw=this.aim;this.camera.position.set(-9,heightAt(this.course,0,0)+8,-14);this.currentLook=this.ball.position.clone().add(new THREE.Vector3(0,2,20));this.refreshAim();
  }
  placePlayer(){const p=this.ball.position,facing=(this.aim||0)+Math.PI/2,x=p.x-Math.sin(facing)*1.04,z=p.z-Math.cos(facing)*1.04;this.player.root.position.set(x,heightAt(this.course,x,z),z);this.player.root.rotation.set(0,facing,0);this.player.root.scale.setScalar(1.1);}
  aimAtPin(){this.aim=Math.atan2(this.course.greenX-this.ball.position.x,this.course.length-this.ball.position.z);}
  changeClub(delta){if(this.phase!=='aim'||this.mode!=='game'||this.paused)return;this.selectClub((this.club+delta+CLUBS.length)%CLUBS.length);}
  selectClub(i){if(this.phase!=='aim'||this.mode!=='game'||this.paused)return;this.club=i;this.charging=false;this.power=1;this.refreshAim();this.audio.play('click');}
  refreshAim(){
    const club=CLUBS[this.club],preview=previewShot(this.course,club,this.warrior,this.lie,this.charging?this.power:1,this.aim,this.ball.position,this.world.collision);this.shotPreview=preview;
    this.aimMarker.position.set(preview.landing.x,preview.landing.y+.03,preview.landing.z);
    const points=preview.points.map(p=>new THREE.Vector3(p.x,p.y,p.z));
    this.aimLine.geometry.dispose();this.aimLine.geometry=new THREE.BufferGeometry().setFromPoints(points);this.aimLine.computeLineDistances();
  }

  swing(){
    if(this.mode!=='game'||this.paused)return;
    if(this.phase==='combat'){this.addressBall();return;}if(this.phase==='flight'){this.fastFlight=true;return;}if(this.phase!=='aim')return;
    if(!this.charging){this.charging=true;this.chargeTime=0;this.power=.08;this.audio.play('click');return;}
    this.charging=false;this.survey=false;this.phase='swing';this.swingElapsed=0;this.contactTime=this.club===7?22/30:1.4;this.swingTimer=this.club===7?1.5:2.4;this.aimLine.visible=false;this.aimMarker.visible=false;
  }
  launchBall(){
    this.strokes++;this.phase='flight';this.flightTime=0;this.fastFlight=false;this.rolling=CLUBS[this.club].short==='PT';this.bounces=0;this.shotOrigin.copy(this.ball.position);this.shotStartLie=this.lie;this.trailPoints=[this.ball.position.clone()];this.trail.visible=true;
    const dispersion=this.rolling?0:(Math.random()-.5)*.012*this.power/this.warrior.precision*(this.lie==='Rough'?1.5:1);const shot=launchShot(CLUBS[this.club],this.warrior,this.lie,this.power,this.aim+dispersion);this.velocity=new THREE.Vector3(shot.x,shot.y,shot.z);this.audio.play(this.rolling?'putt':'swing');this.effects.burst(this.ball.position,8,2,1);this.aimLine.visible=false;this.aimMarker.visible=false;this.stillTime=0;
  }
  updateBall(dt){
    const step=BALL_STEP;let remaining=dt;
    while(remaining>1e-10&&this.phase==='flight'){
      const h=Math.min(step,remaining);remaining-=h;this.flightTime+=h;const before=this.ball.position.clone();
      if(!this.rolling){this.velocity.y-=9.81*h;this.velocity.x+=this.course.wind[0]*.22*h;this.velocity.z+=this.course.wind[1]*.22*h;}
      this.ball.position.addScaledVector(this.velocity,h);
      const buildingHit=resolveBuildingBall(this.world.collision,before,this.ball.position,this.velocity);
      if(buildingHit?.unplayableRoof){this.penalty('Unplayable roof. One penalty stroke.');return;}
      if(buildingHit){this.audio.play('land');this.effects.burst(this.ball.position,5,1.5,0);}
      const p=this.ball.position,surface=ballSurface(this.course,p),{ground,lie}=surface;
      const hazard=ballHazard(p,surface,this.flightTime);
      if(hazard){this.penalty(hazard==='Water'?'Water hazard. One penalty stroke.':'Out of bounds. One penalty stroke.');return;}
      if(p.y<=ground){p.y=ground;
        if(!this.rolling){this.audio.play('land');this.effects.burst(p,5,1.5,1);this.bounces++;if(this.velocity.y< -1.7&&this.bounces<3&&lie!=='Bunker'){this.velocity.y=-this.velocity.y*.27;const retention=this.bounces===1?(.3+CLUBS[this.club].roll*.28):.65;this.velocity.x*=retention;this.velocity.z*=retention;}else{this.velocity.y=0;this.rolling=true;this.velocity.x*=lie==='Bunker'?.18:.68;this.velocity.z*=lie==='Bunker'?.18:.68;}}
      }
      if(this.rolling)this.stillTime=applyRollingResistance(this.course,p,this.velocity,surface,h,this.stillTime);
      if(capturesCup(before,p,this.velocity,this.world.cup)){this.holed();return;}
      if(rollingFinished(this.stillTime,this.flightTime)){this.land();return;}
    }
    this.trailPoints.push(this.ball.position.clone());if(this.trailPoints.length>100)this.trailPoints.shift();this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(this.trailPoints);
  }
  penalty(message){this.audio.play(message.startsWith('Water')?'water':'land');this.strokes++;this.penalties++;this.ball.position.copy(this.shotOrigin);this.ui.toast(message);this.velocity.set(0,0,0);this.phase='aim';this.charging=false;this.power=1;this.lie=this.shotStartLie;this.trail.visible=false;this.aimAtPin();this.placePlayer();this.refreshAim();}
  land(){
    const shotDistance=Math.hypot(this.ball.position.x-this.shotOrigin.x,this.ball.position.z-this.shotOrigin.z)*YARD;
    const relief=buildingRelief(this.course,this.world.collision,this.ball.position);
    if(relief.status==='unplayable'){this.penalty('Unplayable building lie. One penalty stroke.');return;}
    if(relief.status==='relief')this.ball.position.copy(relief.position);
    const reliefNotice=relief.status==='relief'?'Free drop from the building. No penalty. ':'';
    this.velocity.set(0,0,0);this.lie=lieAt(this.course,this.ball.position.x,this.ball.position.z);this.phase='combat';this.enemiesSpawned=0;this.combatTime=0;this.spawnTime=2;this.combo=0;this.comboTime=0;this.cameraYaw=this.aim;this.trail.visible=false;this.fastFlight=false;
    const distance=this.player.root.position.distanceTo(this.ball.position);this.lastShot={distance:shotDistance,lie:this.lie,pin:this.ball.position.distanceTo(this.world.cup)*YARD,relief:!!reliefNotice};this.ui.shotResult(this.lastShot);this.enemyBudget=Math.max(12,Math.min(200,Math.round(distance*.65)+this.hole*20));
    if(distance<12||this.shotStartLie==='Green'){this.phase='aim';this.aimAtPin();this.placePlayer();this.selectBestClub();this.refreshAim();this.power=1;this.ui.toast(reliefNotice+(this.lie==='Green'?'On the green. Read the line and choose your pace.':'A short walk. Your next shot is ready.'));return;}
    this.spawnWave(14);this.ui.achievement('BALL LANDS. BLADES RISE.','The walk begins.',`${Math.round(distance)} metres to your ball. Mind the company.`);this.ui.toast(reliefNotice||'Click to capture mouse · Left / right click: fast / heavy · F: Musou · C: focused stance',5500);
  }
  selectBestClub(){const d=this.ball.position.distanceTo(this.world.cup);this.club=d<23&&this.lie==='Green'?7:this.lie==='Bunker'?6:CLUBS.findIndex((c,i)=>i<7&&carryFor(c,this.warrior,this.lie)<d*1.05);if(this.club<0)this.club=6;}
  slideOnLand(position,from,radius=.38,lift=0){moveOnLand(position,from,this.course,this.world.collision,radius,lift);}
  spawnWave(count){
    const p=this.player.root.position,yaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);
    const sites=chooseAmbushSites(this.world.ambushSites,p,yaw,this.time);if(!sites.length)return;const waterEntries=new Map();
    for(let i=0;i<count&&this.enemies.filter(e=>!e.dead).length<64&&this.enemiesSpawned<this.enemyBudget;i++){
      const site=sites[i%Math.min(5,sites.length)],slot=this.enemiesSpawned,enemy=new Warrior(enemyTypeForSlot(slot),true,enemyAppearanceForSlot(slot));
      // Entrances always begin at visible scenery, then land on a verified dry point.
      const dx=p.x-site.x,dz=p.z-site.z,length=Math.hypot(dx,dz)||1;let x=site.x+dx/length*2.5,z=site.z+dz/length*2.5;
      let landing=null,waterEntry=null;
      if(site.kind==='water'){if(!waterEntries.has(site))waterEntries.set(site,findWaterEmergence(this.course,site,p,this.world.collision));waterEntry=waterEntries.get(site);if(waterEntry)landing=new THREE.Vector3().copy(waterEntry.landing);}
      searchLanding:for(const radius of (site.kind==='water'?[]:[0,1.2,2.4]))for(let angle=0;angle<(radius?8:1);angle++){
        const lx=x+Math.cos(angle*Math.PI/4)*radius,lz=z+Math.sin(angle*Math.PI/4)*radius,candidate=new THREE.Vector3(lx,heightAt(this.course,lx,lz),lz);
        if(!['Water','Out of bounds'].includes(lieAt(this.course,lx,lz))&&!this.world.collision.blocked(candidate,.31,2)&&this.world.collision.segmentClear({x:site.x,y:site.y,z:site.z},candidate,.3,2,true)){landing=candidate;break searchLanding;}
      }
      if(!landing){enemy.dispose();continue;}
      enemy.root.position.set(site.x,site.y,site.z);enemy.root.visible=false;
      enemy.emerging={site,delay:Math.floor(i/5)*.22+Math.random()*.18,time:0,duration:waterEntry?.duration??(site.kind==='tree'?1.05:.85),arcHeight:waterEntry?.arcHeight,startY:waterEntry?.startY,landing};
      enemy.spawnSite=site.id;enemy.role=ENEMY_TYPES[enemy.type].role;enemy.slot=slot;enemy.hp=ENEMY_TYPES[enemy.type].hp;enemy.cooldown=1.4+Math.random()*1.8;enemy.readyAt=this.time+(Math.random()<.65?2+Math.random()*3:0);enemy.strike=0;enemy.speed=ENEMY_TYPES[enemy.type].speed;enemy.dead=0;enemy.knockback=new THREE.Vector3();enemy.lift=0;enemy.verticalSpeed=0;this.enemies.push(enemy);this.enemiesSpawned++;site.readyAt=this.time+8;
    }
  }
  clearEnemies(){this.projectiles?.clear();this.pendingStrike=null;this.guardBufferedAttack=null;this.action=null;this.attackTimer=0;this.attackBuffer=null;this.lightChain=0;this.cinematic=0;document.body.classList.remove('musou-active');this.ui?.$ ('musou-cinema')?.classList.add('hidden');for(const e of this.enemies)this.scene?.remove(e.root);this.enemies=[];}
  nearbyEnemies(){return this.enemies.filter(e=>!e.dead&&e.root.position.distanceTo(this.player.root.position)<8).length;}
  attack(kind='light'){
    if(this.phase!=='combat'||this.paused||this.cinematic>0)return;
    if(guardAttackRecovering(this.guard,this.time)){this.guardBufferedAttack={kind,expires:this.time+.55};return;}
    if(this.action){if(kind!=='musou')this.attackBuffer={kind,expires:this.time+.55};return;}
    if(kind==='musou'){
      if(this.resolve<100){this.ui.toast('Build Resolve by defeating enemies.');return;}
      exitPlayerGuard(this.guard);this.resolve=0;this.cinematic=MUSOU_CINEMATIC_DURATION;this.invincible=3.7;this.attackYaw=this.player.root.rotation.y;this.ui.musou(this.warrior);this.audio.play('special');return;
    }
    this.startAttack(kind);
  }
  startAttack(kind){
    exitPlayerGuard(this.guard);
    if(this.time>(this.chainExpires||0))this.lightChain=0;
    const step=kind==='light'?(this.lightChain||0)%4:Math.max(0,(this.lightChain||0)-1),definition=attackDefinition(kind,step,this.warrior.combatStyle);
    const motion=motions[combatMotionName(this.warrior,kind,step)];
    this.action={...definition,impactHands:motion.impactHands,rootAdvance:motion.rootAdvance??0,kind,step,headings:kind==='musou'?musouHeadings(this.warrior):null,time:0,hitIndex:0,token:(this.actionSerial=(this.actionSerial||0)+1)};
    if(kind==='musou')this.invincible=Math.max(this.invincible,definition.duration);
    this.attackTimer=definition.duration;this.attackYaw=this.player.root.rotation.y;this.comboTime=3;this.chainExpires=this.time+definition.duration+.75;
    this.lightChain=kind==='light'?step+1:0;this.player.wasAttack=false;this.audio.play(kind==='musou'?'special':'sword');
  }
  strike(action){
    const strikeFacing=this.attackYaw+(action.headings?.[action.hitIndex]||0),strikeArc=action.kind==='musou'&&action.hitIndex<5?1.1:action.arc;
    this.effects.slash(this.player.root.position,strikeFacing,action.kind!=='light',{style:action.style,reach:action.reach,arc:strikeArc,color:this.warrior.color});if(action.kind==='musou')this.effects.flourish(this.player.root.position,action.hitIndex,this.warrior.color,action.style);let hit=false;
    for(const e of this.enemies){if(e.dead||e.emerging)continue;v1.copy(e.root.position).sub(this.player.root.position);
      if(strikeContains(v1.x,v1.z,strikeFacing,action.reach,strikeArc)&&this.world.collision.segmentClear({x:this.player.root.position.x,y:this.player.root.position.y+1,z:this.player.root.position.z},{x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},0,0,true)){const front=Math.cos(Math.atan2(-v1.x,-v1.z)-e.root.rotation.y)>.35,multiplier=guardDamageMultiplier(e.type,action.kind,front,e.stun>0);e.hp-=action.damage*this.warrior.damage*multiplier;hit=true;if(multiplier<1)this.effects.burst(e.root.position.clone().add(new THREE.Vector3(0,1.4,0)),15,4,0);if(multiplier===1){if(action.kind!=='light'){e.stun=ENEMY_TYPES[e.type].armor?1.3:.6;if(ENEMY_TYPES[e.type].armor)this.ui.combatCue('GUARD BROKEN');}e.enemyAction=null;e.oneShot=0;e.knockback.copy(v1).setY(0).normalize().multiplyScalar(action.pull?-Math.min(10,Math.max(0,v1.length()-2)*4):action.knockback||(action.kind==='light'?7:14));e.verticalSpeed=action.launch||0;e.strike=0;e.cooldown=1.1;}this.effects.burst(e.root.position.clone().add(new THREE.Vector3(0,1.2,0)),action.kind==='light'?20:45,action.kind==='light'?6:11,action.kind==='musou'?2:0);
        if(e.hp<=0){e.dead=.001;e.dramaticDeath=action.kind==='musou';e.deathYaw=e.root.rotation.y;e.tumble=(e.slot%2?1:-1)*(2.6+(e.slot%3)*.6);e.verticalSpeed=e.dramaticDeath?9+(e.slot%4)*1.3:action.kind==='heavy'?5:2;e.knockback.copy(v1).setY(0).normalize().multiplyScalar(e.dramaticDeath?18+(e.slot%3)*3:9);if(e.dramaticDeath)this.effects.explosion(e.root.position,0.75);this.kills++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.resolve=Math.min(100,this.resolve+7);this.health=Math.min(this.warrior.health,this.health+1.6);}}
    }
    if(hit){this.audio.play('hit');this.hitStop=action.kind==='light'?.045:action.kind==='musou'?.065:.085;this.shake=action.kind==='light'?.075:.16;}
  }
  updateCombat(dt){
    const input=this.input,p=this.player.root.position;
    if(this.cinematic>0){this.cinematic-=dt;this.player.update(this.time,dt*.15,{cinematic:true,expressionDt:dt,gazeTarget:this.camera.position});if(this.cinematic<=0){this.ui.$('musou-cinema').classList.add('hidden');document.body.classList.remove('musou-active');this.startAttack('musou');}return;}
    this.combatTime+=dt;this.spawnTime-=dt;this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;this.dodgeTimer=Math.max(0,this.dodgeTimer-dt);this.invincible=Math.max(0,this.invincible-dt);
    if(input.tap('Waypoint')){this.cameraYaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);if(!this.action)this.player.root.rotation.y=this.cameraYaw;}
    if(input.tap('Dodge')&&this.dodgeTimer===0&&this.action?.kind!=='musou'){escapeGuardBreak(this.guard,this.time);this.guardBufferedAttack=null;this.dodgeTimer=.45;this.invincible=.55;this.action=null;this.attackTimer=0;this.attackBuffer=null;this.player.oneShot=0;}
    this.cameraYaw-=input.lookX*.003*input.sensitivity;this.cameraPitch=clamp(this.cameraPitch+input.lookY*.002*input.sensitivity*(input.invertY?-1:1),.08,.8);
    const m=input.move;this.camera.getWorldDirection(v1);const movementYaw=Math.atan2(v1.x,v1.z);let {x:dx,z:dz}=cameraRelativeMove(m.x,m.y,movementYaw);
    const pd=p.distanceTo(this.ball.position),moving=Math.hypot(dx,dz)>.1,sprinting=input.down('ShiftLeft','ShiftRight')||input.padSprint;
    updatePlayerGuard(this.guard,{time:this.time,dt,held:input.guarding,allowed:!this.action&&this.dodgeTimer===0});
    this.focused=input.focused||this.guard.active;const speed=(this.dodgeTimer>.18?11:this.time<this.guard.breakPoseUntil?2:this.guard.active?2.3:sprinting?8:this.focused?5.3:5.6)*this.warrior.speed*(this.action?.kind==='musou'?0:this.action?.45:1);
    const norm=Math.max(1,Math.hypot(dx,dz));dx/=norm;dz/=norm;this.playerVelocity={x:dx*speed,z:dz*speed};
    let mx=dx*speed,mz=dz*speed;
    if(this.action){this.action.time+=dt;this.attackTimer=Math.max(0,this.action.duration-this.action.time);const a=this.action;const lunge=Math.sin(Math.min(1,a.time/a.duration)*Math.PI)*a.rootAdvance*Math.PI/(2*a.duration);mx+=Math.sin(this.attackYaw)*lunge;mz+=Math.cos(this.attackYaw)*lunge;
      while(a.hitIndex<a.hits.length&&a.time>=a.hits[a.hitIndex]){this.strike(a);a.hitIndex++;}
    }
    const movementStartX=p.x,movementStartZ=p.z,movementStart={x:p.x,y:p.y,z:p.z};
    const x=clamp(p.x+mx*dt,COURSE_BOUNDS.minX,COURSE_BOUNDS.maxX),z=clamp(p.z+mz*dt,COURSE_BOUNDS.minZ,this.course.length+COURSE_BOUNDS.endMargin);
    p.set(x,heightAt(this.course,x,z),z);
    if(this.action)this.player.root.rotation.y=this.attackYaw;
    else if(this.guard.active)this.player.root.rotation.y=this.cameraYaw;
    else if(this.focused)this.player.root.rotation.y=turnToward(this.player.root.rotation.y,this.cameraYaw,dt*20);
    else if(moving)this.player.root.rotation.y=turnToward(this.player.root.rotation.y,Math.atan2(dx,dz),dt*18);
    this.slideOnLand(p,movementStart);
    if(moving){this.stepTime=(this.stepTime||0)+dt;if(this.stepTime>(sprinting?.26:.37)){this.audio.play('step',lieAt(this.course,p.x,p.z));this.stepTime=0;}}
    if(input.tap('LightAttack'))this.attack('light');if(input.tap('HeavyAttack'))this.attack('heavy');if(input.tap('Musou'))this.attack('musou');
    if(this.guardBufferedAttack&&!guardAttackRecovering(this.guard,this.time)){const queued=this.guardBufferedAttack;this.guardBufferedAttack=null;if(queued.expires>=this.time)this.attack(queued.kind);}
    this.player.update(this.time,dt,{groundHeight:this.groundHeight,moving,sprinting,dodge:this.dodgeTimer>.1,attack:this.attackTimer,action:this.action,focused:this.focused,moveSpeed:Math.hypot(p.x-movementStartX,p.z-movementStartZ)/Math.max(dt,.0001),blocking:this.guard.active,parry:Math.max(0,this.guard.parryPoseUntil-this.time),guardBreak:Math.max(0,this.guard.breakPoseUntil-this.time),guardHitToken:this.guard.hitToken,moveAngle:Math.atan2(p.x-movementStartX,p.z-movementStartZ)-this.player.root.rotation.y});
    if(this.action){
      for(const side of activeBladeTrailHands(this.action,Boolean(this.player.offhand))){
        const offhand=side==='l',[hilt,tip]=this.player.weaponPoints(offhand);
        this.effects.trail(hilt,tip,this.action.kind==='musou'?2:0,this.action.token,offhand?1:0);
      }
      if(this.attackTimer<=0){this.action=null;const queued=this.attackBuffer;this.attackBuffer=null;if(queued&&queued.expires>=this.time)this.startAttack(queued.kind);}
    }
    if(this.spawnTime<=0&&pd>11){this.spawnWave(10+this.hole*2);this.spawnTime=3.5;}
    const ready=this.enemies.filter(e=>!e.dead&&!e.emerging&&!(e.stun>0)).sort((a,b)=>a.root.position.distanceToSquared(p)-b.root.position.distanceToSquared(p));
    const melee=ready.filter(e=>!ENEMY_TYPES[e.type].ranged),ranged=ready.filter(e=>ENEMY_TYPES[e.type].ranged);
    const engaged=new Set([...melee.filter(e=>e.enemyAction),...ranged.filter(e=>e.enemyAction)]);
    for(const pool of [melee,ranged]){let count=pool.filter(e=>engaged.has(e)).length;for(const e of pool){if(count>=(pool===melee?3:1))break;if(!engaged.has(e)&&enemyReadyToAttack(e,this.time)){engaged.add(e);count++;}}}
    for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];
      if(e.emerging){const a=e.emerging;a.delay-=dt;if(a.delay>0)continue;
        if(a.time===0){e.root.visible=true;this.effects.burst(e.root.position, a.site.kind==='tree'?14:45,6,a.site.kind==='water'?3:a.site.kind==='sand'?4:1);}
        a.time+=dt;const t=clamp(a.time/a.duration,0,1),startY=a.site.y+(a.site.kind==='tree'?a.site.height: a.site.kind==='water'||a.site.kind==='sand'?-.8:.1);
        if(a.site.kind==='water')e.root.position.copy(waterEmergencePosition(a.site,a.landing,a.arcHeight,t,a.startY));else e.root.position.set(THREE.MathUtils.lerp(a.site.x,a.landing.x,t),THREE.MathUtils.lerp(startY,a.landing.y,t)+Math.sin(t*Math.PI)*(a.site.kind==='tree'?.3:1.8),THREE.MathUtils.lerp(a.site.z,a.landing.z,t));e.root.rotation.y=Math.atan2(p.x-e.root.position.x,p.z-e.root.position.z);e.update(this.time,dt,{emerging:{progress:t}});
        if(t>=1){e.emerging=null;e.oneShot=0;this.effects.burst(e.root.position,12,3,a.site.kind==='sand'?4:1);}continue;
      }
      const enemyStart={x:e.root.position.x,y:e.root.position.y,z:e.root.position.z};
      e.lift=Math.max(0,(e.lift||0)+(e.verticalSpeed||0)*dt);e.verticalSpeed=(e.verticalSpeed||0)-15*dt;if(e.lift===0)e.verticalSpeed=0;
      if(e.knockback.lengthSq()>.1){const nx=e.root.position.x+e.knockback.x*dt,nz=e.root.position.z+e.knockback.z*dt;if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;}e.knockback.multiplyScalar(Math.exp(-(e.dead&&e.dramaticDeath?1.3:7)*dt));}
      if(e.dead){this.slideOnLand(e.root.position,enemyStart,.3,e.lift);e.dead+=dt;e.root.position.y=heightAt(this.course,e.root.position.x,e.root.position.z)+e.lift;e.update(this.time,dt,{});const lifetime=e.dramaticDeath?2.7:1.5;if(e.dramaticDeath){e.root.rotation.set(Math.sin(e.dead*2)*.8,e.deathYaw+e.dead*e.tumble,Math.sin(e.dead*3)*.6);if(e.lift===0&&!e.landedDead){e.landedDead=true;this.effects.explosion(e.root.position,.45);}}if(e.dead>lifetime-.35)e.root.scale.setScalar(1.1*Math.max(.01,(lifetime-e.dead)/.35));if(e.dead>lifetime){this.effects.burst(e.root.position,12,3,1);this.scene.remove(e.root);this.enemies.splice(i,1);}continue;}
      const distance=Math.hypot(p.x-e.root.position.x,p.z-e.root.position.z),definition=ENEMY_TYPES[e.type];e.cooldown-=dt;e.stun=Math.max(0,(e.stun||0)-dt);
      if(distance>90){this.scene.remove(e.root);this.enemies.splice(i,1);continue;}
      let enemyMoving=false;
      if(e.stun<=0&&distance>1.8&&!e.enemyAction&&e.lift<.1&&(engaged.has(e)||distance>9||this.playerVelocity.x**2+this.playerVelocity.z**2>9)){
        const engagement=engagementTarget({x:e.root.position.x,z:e.root.position.z,type:e.type,slot:e.slot},p,this.playerVelocity,engaged.has(e));engagement.y=heightAt(this.course,engagement.x,engagement.z);if(this.world.collision.blocked(engagement,.34,2,true)){engagement.x=p.x;engagement.y=p.y;engagement.z=p.z;}const target=this.world.buildingNavigation.waypoint(e.root.position,engagement,e,this.time);v1.set(target.x-e.root.position.x,0,target.z-e.root.position.z).normalize();e.moveYaw=Math.atan2(v1.x,v1.z);
        const remaining=Math.hypot(target.x-e.root.position.x,target.z-e.root.position.z);const speed=Math.min(remaining/dt,e.speed*(distance>10?1.4:definition.ranged&&distance<13?.7:1)),nx=e.root.position.x+v1.x*speed*dt,nz=e.root.position.z+v1.z*speed*dt;
        if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;enemyMoving=speed>.4;}else{const tx=e.root.position.x+v1.z*speed*dt,tz=e.root.position.z-v1.x*speed*dt;if(lieAt(this.course,tx,tz)!=='Water'){e.root.position.x=tx;e.root.position.z=tz;enemyMoving=speed>.4;}}
      }
      for(let j=0;j<i;j++){const other=this.enemies[j];if(other.dead||other.emerging)continue;v2.copy(e.root.position).sub(other.root.position);v2.y=0;const d=v2.length();if(d<1.15&&d>.001){const sx=e.root.position.x+v2.x*(1.15-d)/d*dt*4,sz=e.root.position.z+v2.z*(1.15-d)/d*dt*4;if(lieAt(this.course,sx,sz)!=='Water'){e.root.position.x=sx;e.root.position.z=sz;}}}
      this.slideOnLand(e.root.position,enemyStart,.3,e.lift);enemyMoving=enemyMoving&&Math.hypot(e.root.position.x-enemyStart.x,e.root.position.z-enemyStart.z)>dt*.2;
      const toward=Math.atan2(p.x-e.root.position.x,p.z-e.root.position.z);e.root.rotation.y=turnToward(e.root.rotation.y,e.enemyAction?e.enemyAction.yaw:enemyMoving&&!definition.ranged?(e.moveYaw??toward):toward,dt*12);
      if(engaged.has(e)&&distance<definition.reach&&this.world.collision.segmentClear({x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},{x:p.x,y:p.y+1,z:p.z},0,0,true)&&e.cooldown<=0&&e.lift<.1&&e.stun<=0&&!e.enemyAction){
        e.enemyAction={token:`enemy-${++this.enemyActionSerial}`,duration:definition.duration,time:0,hitIndex:0,yaw:toward,target:p.clone().add(new THREE.Vector3(this.playerVelocity.x*.22,1,this.playerVelocity.z*.22))};e.cooldown=definition.duration+definition.recovery+Math.random()*.6;e.readyAt=this.time+e.cooldown+(Math.random()<.65?1.6+Math.random()*2.6:0);
        this.effects.telegraph(e.root.position,toward,definition.reach,definition.hits[0],e.type===2?'thrust':definition.ranged?'ranged':'sweep');
      }
      if(e.enemyAction){const a=e.enemyAction;a.time+=dt;e.strike=Math.max(0,a.duration-a.time);
        while(a.hitIndex<definition.hits.length&&a.time>=definition.hits[a.hitIndex]){
          if(definition.ranged){this.projectiles.spawn(e.root.position.clone().add(new THREE.Vector3(0,1.35,0)),a.target,definition.damage,e);this.audio.play('sword');}
          else if(this.world.collision.segmentClear({x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},{x:p.x,y:p.y+1,z:p.z},0,0,true)&&strikeContains(p.x-e.root.position.x,p.z-e.root.position.z,a.yaw,definition.reach+.3,e.type===2?.48:1.15))this.hurt(definition.damage,e.root.position,e);
          a.hitIndex++;if(!e.enemyAction)break;
        }
      }else e.strike=0;
      e.update(this.time,dt,{moving:enemyMoving,sprinting:distance>10,attack:e.strike,enemyAction:e.enemyAction,focused:definition.ranged,moveAngle:(e.moveYaw||0)-e.root.rotation.y});
      if(e.enemyAction?.time>=definition.duration)e.enemyAction=null;
    }
    this.projectiles.update(dt,p,(damage,source,attacker)=>this.hurt(damage,source,attacker),this.world.collision);
    if(this.health<=0){this.health=this.warrior.health;this.strokes++;this.penalties++;this.clearEnemies();this.guard=createPlayerGuard();this.resolve=Math.max(50,this.resolve);this.invincible=3;this.spawnTime=6;this.ui.achievement('A MINOR SETBACK','Rise again.','One penalty stroke. Your honor is mostly intact.');}
    if(input.tap('Interact')&&!this.action)this.addressBall();
  }
  hurt(damage,source=null,attacker=null){
    if(this.invincible>0){if(this.dodgeTimer>0&&this.time>(this.lastDodgeCue||0)+1){this.lastDodgeCue=this.time;this.resolve=Math.min(100,this.resolve+8);this.ui.combatCue('PERFECT DODGE · +8 RESOLVE');}return;}
    const p=this.player.root.position,result=resolvePlayerGuard(this.guard,{time:this.time,damage,dx:source?source.x-p.x:NaN,dz:source?source.z-p.z:NaN,facing:this.player.root.rotation.y});
    if(result.kind!=='hit'){
      this.effects.burst(p.clone().add(new THREE.Vector3(0,1.35,0)),result.kind==='parry'?25:10,3,0);this.audio.play('hit');
      if(result.kind==='parry'){this.resolve=Math.min(100,this.resolve+result.resolve);if(attacker&&!attacker.dead){attacker.stun=result.stagger;attacker.enemyAction=null;attacker.strike=0;attacker.oneShot=0;attacker.cooldown=Math.max(attacker.cooldown,result.stagger);}this.ui.combatCue('PARRY · +10 RESOLVE');}
      else if(result.kind==='break'){this.invincible=.25;this.ui.combatCue('GUARD BROKEN · DODGE TO ESCAPE');}
      else this.ui.combatCue('BLOCK');
      return;
    }
    this.health-=damage;this.invincible=.32;this.audio.play('hurt');this.shake=.17;this.ui.$('damage-flash').style.opacity='1';setTimeout(()=>this.ui.$('damage-flash').style.opacity='0',170);
  }
  addressBall(){if(this.phase!=='combat')return;const distance=this.player.root.position.distanceTo(this.ball.position);if(distance>5){this.ui.toast('Reach your ball before taking the next shot.');return;}if(this.nearbyEnemies()>0){this.ui.toast('Clear the enemies near you before your next shot.');return;}
    this.clearEnemies();this.phase='aim';this.charging=false;this.power=1;this.lie=lieAt(this.course,this.ball.position.x,this.ball.position.z);this.aimAtPin();this.placePlayer();this.selectBestClub();this.refreshAim();this.cameraYaw=this.aim;this.health=Math.min(this.warrior.health,this.health+20);this.ui.toast('A clear lie. A fresh start.');}
  holed(){this.phase='holed';this.ball.position.copy(this.world.cup);this.ball.visible=false;this.trail.visible=false;this.clearEnemies();this.audio.play('cup');this.scores[this.hole]=this.strokes;this.scorePenalties[this.hole]=this.penalties;this.effects.burst(this.world.cup.clone().add(new THREE.Vector3(0,2,0)),50,8,0);this.ui.achievement(`HOLE ${this.hole+1} COMPLETE`,scoreName(this.strokes,this.course.par),`${this.strokes} strokes · Par ${this.course.par}`);this.save();this.scoreTimer=setTimeout(()=>{if(this.phase==='holed'&&this.mode==='game')this.ui.scorecard(this);},2000);}
  nextHole(){if(this.hole>=this.holes.length-1){this.scores=[];this.scorePenalties=[];this.kills=0;this.bestCombo=0;this.resolve=35;this.loadHole(0);}else this.loadHole(this.hole+1);this.paused=false;this.save();this.audio.start();this.ui.toast(this.course.subtitle,4500);}
  togglePause(){if(this.mode!=='game'){this.ui.help();return;}if(this.phase==='holed')return;if(this.paused){this.resume();return;}this.paused=true;this.input.setContext('menu');this.input.clear();this.audio.pause();this.ui.pause(this);}
  resume(){this.paused=false;this.ui.closeModal();this.input?.clear();this.audio.resume();}
  setQuality(q){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='high'?2:1.5));this.renderer.shadowMap.enabled=q!=='low';this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();this.ui.toast(`Graphics: ${q==='low'?'performance':q==='high'?'high quality':'balanced'}`);}
  save(){try{localStorage.setItem('ninja-golf-save',JSON.stringify({version:2,courseId:this.roundCourse.id,scores:this.scores,penalties:this.scorePenalties,playerIndex:this.playerIndex,kills:this.kills,bestCombo:this.bestCombo,nextHole:Math.min(this.holes.length,this.scores.length)}));}catch{/* Storage can be unavailable in private browser contexts. */}}
  restoreOffer(){this.ui.$('continue-round')?.remove();let raw;try{raw=localStorage.getItem('ninja-golf-save');}catch{return;}const save=readRoundSave(raw,COURSE_SETS,WARRIORS);if(!save)return;
    const btn=document.createElement('button');btn.className='text-button';btn.id='continue-round';btn.textContent=`Continue ${COURSE_SETS[save.courseIndex].name} · Hole ${save.nextHole+1} →`;btn.style.display='block';btn.style.marginTop='12px';this.ui.$('play').after(btn);btn.onclick=()=>{this.setCourse(save.courseIndex);this.selectWarrior(save.playerIndex);this.scores=save.scores;this.scorePenalties=save.penalties;this.kills=save.kills||0;this.bestCombo=save.bestCombo||0;this.mode='game';this.paused=false;this.loadHole(save.nextHole);this.ui.showScreen('game');this.audio.start();};}
  updateCamera(dt,{immediate=false}={}){
    const p=this.player.root.position,b=this.ball.position;let speed=3.5;
    if(this.mode==='home'||this.mode==='courses'){const a=this.time*.014,c=this.course;camTarget.set(85+Math.sin(a)*18,Math.max(72,c.length*.19),c.length*.19-100+Math.cos(a)*12);camLook.set(c.greenX*.3,8,c.length*.57);speed=this.mode==='courses'?2:.7;}
    else if(this.mode==='selection'){camTarget.set(p.x+1,p.y+2.4,p.z+9);camLook.set(p.x-2.35*this.camera.aspect,p.y+1.9,p.z);speed=3;}
    else if(this.phase==='aim'&&this.survey){camLook.copy(this.surveyView.target);camTarget.copy(surveyPosition(this.surveyView));speed=7;}
    else if(this.phase==='flight'){const dir=this.velocity.clone().normalize();const height=this.rolling?4:7;camTarget.copy(b).add(new THREE.Vector3(-Math.sin(this.aim)*13+6,height,-Math.cos(this.aim)*13));camLook.copy(b).addScaledVector(dir,3);speed=this.fastFlight?12:5;}
    else if(this.phase==='combat'&&this.cinematic>0){
      this.player.root.updateMatrixWorld(true);this.player.bones.Bip01_REye.getWorldPosition(camLook);this.player.bones.Bip01_LEye.getWorldPosition(v1);camLook.add(v1).multiplyScalar(.5);camLook.y-=.015;const yaw=this.attackYaw,progress=1-this.cinematic/MUSOU_CINEMATIC_DURATION;const zoom=THREE.MathUtils.lerp(2.9,.62,THREE.MathUtils.smoothstep(progress,.12,.72));
      camTarget.copy(camLook).add(new THREE.Vector3(Math.sin(yaw)*zoom+Math.cos(yaw)*.10,-.005,Math.cos(yaw)*zoom-Math.sin(yaw)*.10));speed=28;
    }
    else if(this.phase==='combat'){const distance=7.7;camTarget.set(p.x-Math.sin(this.cameraYaw)*distance,p.y+2.2+this.cameraPitch*4.5,p.z-Math.cos(this.cameraYaw)*distance);camLook.set(p.x+Math.sin(this.cameraYaw)*4,p.y+1.6,p.z+Math.cos(this.cameraYaw)*4);speed=7;}
    else if(this.phase==='holed'){camTarget.copy(this.world.cup).add(new THREE.Vector3(Math.sin(this.time*.2)*14,8,-13));camLook.copy(this.world.cup).add(new THREE.Vector3(0,1,0));speed=2;}
    else{const d=this.club===7?9.0:9.5;camTarget.set(b.x-Math.sin(this.aim)*d+Math.cos(this.aim)*3,b.y+4.2,b.z-Math.cos(this.aim)*d-Math.sin(this.aim)*3);camLook.set(b.x+Math.sin(this.aim)*16,b.y+.65,b.z+Math.cos(this.aim)*16);speed=4;}
    if(this.mode==='game'&&this.phase==='combat'&&!(this.cinematic>0))this.world.collision.camera(v1.copy(p).add(new THREE.Vector3(0,1.7,0)),camTarget);
    camTarget.y=Math.max(camTarget.y,heightAt(this.course,camTarget.x,camTarget.z)+(this.cinematic>0?1.1:1.8));const cameraBlend=immediate?1:1-Math.exp(-speed*dt);this.camera.position.lerp(camTarget,cameraBlend);this.currentLook.lerp(camLook,cameraBlend);if(this.shake>0&&!this.input.reducedMotion){this.shake-=dt;this.camera.position.x+=(Math.random()-.5)*this.shake*2;this.camera.position.y+=(Math.random()-.5)*this.shake;}
    if(this.mode==='game'&&this.phase==='combat'&&!(this.cinematic>0))this.world.collision.camera(v1.copy(p).add(new THREE.Vector3(0,1.7,0)),this.camera.position);
    this.camera.lookAt(this.currentLook);
  }
  frame(){
    const now=performance.now();const realDt=(now-this.previousTime)/1000;let dt=Math.min(realDt,.05);this.previousTime=now;if(this.hitStop>0){this.hitStop-=realDt;dt*=.12;}this.input.setContext(this.mode==='game'&&!this.paused?(this.survey?'survey':this.phase):'menu');this.input.poll(dt,this.mode==='game'&&this.phase==='combat');
    if(this.mode==='selection'&&this.input.tap('KeyC'))this.ui.toggleShowcaseConsole();
    if(this.input.tap('Escape')&&!(this.mode==='game'&&this.phase==='holed')){if(!this.ui.$('modal').classList.contains('hidden')){this.ui.closeModal();if(this.paused)this.resume();}else this.togglePause();}
    this.audio.setMode(this.mode==='game'&&this.phase==='combat'?'combat':'course');this.audio.update(dt,this.mode==='game'&&this.phase==='combat',this.player.root.position,this.course.coastal!==false);
    if(!this.paused){this.time+=dt;this.world.update(this.time,dt,this.mode==='game'?this.player.root.position:null,this.camera.position);this.effects.update(dt,this.phase!=='combat');
      if(this.mode==='game'){
        if(this.phase==='aim'){
          if(this.survey)moveSurvey(this.surveyView,this.input,dt,this.course);
          const horizontal=this.survey?0:(this.input.down('KeyD','ArrowRight')?1:0)-(this.input.down('KeyA','ArrowLeft')?1:0)+(this.input.padX||0);const change=this.survey?0:aimDelta(horizontal,dt)-this.input.lookX*.0018;
          if(change){this.aim+=change;this.placePlayer();this.refreshAim();}
          if(this.input.tap('KeyQ'))this.changeClub(-1);if(this.input.tap('KeyE'))this.changeClub(1);
          if(this.input.tap('Space'))this.swing();if(this.input.tap('KeyR'))this.toggleSurvey();
          if(this.charging){this.chargeTime+=dt;this.power=.08+.92*(.5-.5*Math.cos(this.chargeTime*2.5));this.refreshAim();}
          this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true});
        }else if(this.phase==='swing'){
          this.swingElapsed+=dt;this.swingTimer=Math.max(0,this.swingTimer-dt);this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true,swing:1,putting:this.club===7});if(this.swingElapsed>=this.contactTime)this.launchBall();
        }else if(this.phase==='flight'){
          if(this.input.tap('Space'))this.fastFlight=true;this.updateBall(dt*(this.fastFlight?3:1));this.swingTimer=Math.max(0,this.swingTimer-dt);this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true,swing:this.swingTimer>0?1:0,putting:this.club===7});
        }else if(this.phase==='combat')this.updateCombat(dt);
        this.uiTime+=dt;if(this.uiTime>.05){this.ui.update(this,this.uiTime);this.uiTime=0;}
      }else if(this.mode==='selection'){this.showcase.update(dt);this.updateShowcaseUI();}
      this.updateCamera(Math.min(realDt,.05));
    }
    this.portraitLights.visible=this.mode==='selection'||this.cinematic>0;if(this.portraitLights.visible)this.portraitLights.position.copy(this.player.root.position);
    this.puttingGuide.update(this.time,this.mode==='game'&&this.phase==='aim'&&this.lie==='Green');
    this.ballGlow.position.copy(this.ball.position);this.ballGlow.position.y=heightAt(this.course,this.ball.position.x,this.ball.position.z)+.07;this.ballGlow.visible=this.mode==='game'&&this.phase!=='flight'&&this.phase!=='holed';this.ballGlow.scale.setScalar(1+Math.sin(this.time*2)*.08);
    this.ballBeacon.position.copy(this.ball.position).add(new THREE.Vector3(0,5.5,0));this.ballBeacon.visible=this.mode==='game'&&this.phase==='combat';this.aimLine.visible=this.aimMarker.visible=this.mode==='game'&&this.phase==='aim';
    this.crowd.update(this.enemies);this.scene.userData.crowdCount=this.enemies.length;this.scene.userData.musou=this.action?.kind==='musou'&&!this.input.reducedMotion;this.rendering.render(this.quality);this.input.end();this.frameCount++;this.fpsTime+=realDt;if(this.fpsTime>1.2){const fps=this.frameCount/this.fpsTime;this.ui.$('performance').textContent=`${Math.round(fps)} FPS`;if(this.quality==='balanced'&&!this.paused&&this.time>(this.resolutionChangedAt||0)+3){const current=this.renderer.getPixelRatio(),ceiling=Math.min(devicePixelRatio,1.5);const next=fps<42?Math.max(.75,current-.15):fps>58&&this.time>(this.resolutionChangedAt||0)+10?Math.min(ceiling,current+.1):current;if(Math.abs(next-current)>.01){this.renderer.setPixelRatio(next);this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();this.resolutionChangedAt=this.time;}}this.frameCount=0;this.fpsTime=0;}
  }
}
async function boot(){try{document.querySelector('#app').innerHTML='<div class="loading-screen"><div class="brand-mark">忍</div><h2>Preparing the course.</h2><p id="loading-detail">Loading rigged warriors and animations…</p></div>';await Promise.all([loadNature(),loadWarriorAssets((done,total)=>{document.getElementById('loading-detail').textContent=`Preparing warriors · ${done} / ${total}`;})]);new Game();}catch(error){console.error(error.stack||error);document.querySelector('#app').insertAdjacentHTML('beforeend',`<div style="position:fixed;inset:0;display:grid;place-content:center;background:#19362f;color:#eee;padding:40px;font-family:Arial"><h1 style="font-size:36px;letter-spacing:0">The course could not load.</h1><p>Reload the page. If this continues, try a browser with WebGL 2 enabled.</p><button onclick="location.reload()" style="padding:16px">Try again</button></div>`);}}
boot();
