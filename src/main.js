import {buildMusouSequence,combatSequenceFrame} from './musou-sequence.js';
import {buildShadowSequence,crossedShadowEvents} from './shadow-sequence.js';
import {shadowBurst,shadowWave} from './shadow-effects.js';
import enemyMotions from './enemy-motion.json';
import {enemyEmergenceFrame} from './enemy-emergence.js';
import {findWaterEmergence,waterEmergencePosition} from './water-emergence.js';
import './style.css';
import './selection.css';
import * as THREE from 'three';
import { Rendering } from './rendering.js';
import { loadNature, isNatureReady } from './nature.js';
import {PuttingGuide,previewShot} from './golf-guide.js';
import {SHOT_HEIGHTS,shotHeightProfile} from './shot-height.js';
import {BALL_STEP,BALL_RADIUS,ballSurface,ballHazard,applyRollingResistance,capturesCup,rollingFinished} from './golf-roll.js';
import { World } from './world.js';
import {moveOnLand} from './land-movement.js';
import {resolveBuildingBall,obstructionRelief} from './building-ball.js';
import {createCourseSurfaceSampler} from './terrain.js';
import { Warrior, Effects, CrowdRenderer, loadInitialWarriorAssets, loadWarrior, isWarriorReady } from './actors.js';
import { cameraRelativeMove, aimDelta, turnToward } from './navigation.js';
import { attackDefinition, strikeContains, chooseAmbushSites, ENEMY_TYPES, enemyTypeForSlot, engagementTarget, guardDamageMultiplier, enemyReadyToAttack, MUSOU_CINEMATIC_DURATION, createPlayerGuard, updatePlayerGuard, exitPlayerGuard, resolvePlayerGuard, guardAttackRecovering, escapeGuardBreak } from './combat.js';
import {attackRootDelta} from './attack-root-motion.js';
import {attackContinuation} from './attack-continuation.js';
import {musouCameraFrame,musouReadyPose,MUSOU_WIPES} from './musou-cinematic.js';
import {ATTACK_BUFFER_SECONDS,attackControlWindow,movementRedirected,steerAttack,swingSoundTimes} from './combat-control.js';
import {withMotionTiming} from './attack-timing.js';
import {attackEntryVelocity} from './attack-braking.js';
import {createSurvey,moveSurvey,surveyPosition} from './survey.js';
import {readRoundSave} from './round.js';
import { Projectiles } from './projectiles.js';
import {musouHeadings,combatMotionName,motions} from './motion.js';
import { Input } from './input.js';
import {controlHints} from './control-bindings.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import {CharacterShowcase} from './character-showcase.js';
import {frameSelection} from './selection-camera.js';
import {activeBladeTrailHands} from './effects.js';
import {enemyAppearanceForSlot} from './enemy-appearances.js';
import { COURSE_SETS, COURSE_BOUNDS, WARRIORS, CLUBS, heightAt, ellipse, lieAt, clamp, carryFor, launchShot, scoreName } from './course.js';

const v1=new THREE.Vector3(),v2=new THREE.Vector3(),camTarget=new THREE.Vector3(),camLook=new THREE.Vector3();
const YARD=1.09361;
class Game {
  constructor(initialCourse=0){
    this.courseRequest=0;this.characterRequest=0;this.courseIndex=0;this.roundCourse=COURSE_SETS[0];this.holes=this.roundCourse.holes;this.penalties=0;this.scorePenalties=[];this.audio=new AudioEngine();this.mode='home';this.phase='aim';this.paused=false;this.hole=0;this.scores=[];this.kills=0;this.combo=0;this.bestCombo=0;this.comboTime=0;this.resolve=35;this.guard=createPlayerGuard();this.health=110;this.quality='balanced';this.time=0;this.playerIndex=0;this.enemies=[];this.power=1;this.charging=false;this.club=0;this.shotHeight=0;this.strokes=0;this.enemiesSpawned=0;this.attackTimer=0;this.dodgeTimer=0;this.invincible=0;this.shotOrigin=new THREE.Vector3();this.cameraYaw=0;this.cameraPitch=.35;this.swingTimer=0;this.uiTime=0;this.frameCount=0;this.fpsTime=0;
    this.ui=new UI({selection:()=>this.selectScreen(),home:()=>this.home(),begin:(i,c)=>this.begin(i,c),courseSelection:()=>this.selectCourseScreen(),course:i=>this.previewCourse(i),warrior:i=>this.requestWarrior(i),audio:()=>this.ui.audio(this.audio.toggle()),pause:()=>this.togglePause(),help:()=>{this.ui.help();},resume:()=>this.resume(),swing:()=>{this.audio.start();this.swing();},club:d=>this.changeClub(d),selectClub:i=>this.selectClub(i),shotHeight:value=>this.selectShotHeight(value),skip:()=>{this.fastFlight=true;},restart:()=>{this.paused=false;this.loadHole(this.hole);this.audio.resume();},next:()=>this.nextHole(),survey:()=>this.toggleSurvey(),showcaseSeek:(stage,seconds)=>{if(this.showcase)this.showcase.seek(stage??this.showcase.state.stage,seconds);this.updateShowcaseUI();},showcaseStep:direction=>{if(this.showcase){const s=this.showcase.state;this.showcase.seek(s.stage,clamp(s.time+direction/60,0,s.duration));}this.updateShowcaseUI();},showcaseSpeed:speed=>{this.showcase?.clock.setSpeed(speed);this.updateShowcaseUI();},showcasePause:()=>{if(this.showcase)this.showcase.clock.paused=!this.showcase.clock.paused;this.updateShowcaseUI();}});
    this.ui.audio(this.audio.enabled);
    try{this.renderer=new THREE.WebGLRenderer({canvas:this.ui.canvas,antialias:true,powerPreference:'high-performance'});}catch(e){this.ui.modal('<h2>A little more graphics power.</h2><p>This game needs WebGL 2. Enable hardware acceleration in your browser, then reload the page.</p>');return;}
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.4,6500);
    this.portraitLights=new THREE.Group();this.portraitLights.userData.portraitLighting=true;this.portraitLights.visible=false;
    const portraitKey=new THREE.PointLight('#fff0df',48,16,2),portraitFill=new THREE.PointLight('#e2eeff',24,14,2);
    portraitKey.position.set(-2,5,4);portraitFill.position.set(4,3,3);this.portraitKey=portraitKey;this.portraitFill=portraitFill;this.portraitRim=new THREE.PointLight('#92baff',32,12,2);this.portraitRim.position.set(2.5,3.8,-2);this.portraitRim.visible=false;this.portraitLights.add(portraitKey,portraitFill,this.portraitRim);this.scene.add(this.portraitLights);
    this.world=new World(this.scene,this.renderer);this.rendering=new Rendering(this.renderer,this.scene,this.camera);this.effects=new Effects(this.scene,(x,z)=>heightAt(this.course,x,z));this.puttingGuide=new PuttingGuide(this.scene);this.projectiles=new Projectiles(this.scene,this.effects);this.enemyActionSerial=0;this.crowd=new CrowdRenderer(this.scene);this.input=new Input(this.ui.canvas);this.input.onUnlock=()=>{if(this.mode==='game'&&!this.paused)this.togglePause();};this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,20,14),new THREE.MeshStandardMaterial({color:'#fffef3',roughness:.38}));this.ball.castShadow=true;this.scene.add(this.ball);
    this.ballGlow=new THREE.Mesh(new THREE.RingGeometry(.33,.42,40),new THREE.MeshBasicMaterial({color:'#f3e3a9',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));this.ballGlow.rotation.x=-Math.PI/2;this.scene.add(this.ballGlow);
    this.ballBeacon=new THREE.Mesh(new THREE.CylinderGeometry(.12,.6,11,12,1,true),new THREE.MeshBasicMaterial({color:'#ecdba6',transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));this.scene.add(this.ballBeacon);
    this.aimMarker=new THREE.Mesh(new THREE.RingGeometry(1.5,1.7,56),new THREE.MeshBasicMaterial({color:'#f7eac1',side:THREE.DoubleSide,transparent:true,opacity:.85}));this.aimMarker.rotation.x=-Math.PI/2;this.scene.add(this.aimMarker);
    this.aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#f4e7b7',dashSize:1.1,gapSize:1.4,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.aimLine);
    this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f8f3db',transparent:true,opacity:.8}));this.scene.add(this.trail);this.trailPoints=[];
    this.selectWarrior(0);this.home(initialCourse);this.ui.showScreen('home');
    const curtain=document.createElement('div');curtain.className='loading-screen';curtain.id='asset-curtain';curtain.innerHTML='<div class="brand-mark">忍</div><h2>Preparing the course.</h2><p>Finishing the light, water, and landscape…</p>';document.body.append(curtain);
    this.world.waitForAssets().then(()=>this.renderer.compileAsync(this.scene,this.camera)).finally(()=>{curtain.classList.add('loaded');setTimeout(()=>curtain.remove(),300);});
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();this.ui.previewRect=null;if(this.mode==='selection')this.updateCamera(0,{immediate:true});});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.mode==='game'&&!this.paused&&this.phase!=='holed')this.togglePause();});
    this.ui.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.audio.pause();this.ui.modal('<h2>The graphics session stopped.</h2><p>Reload this page to restore the course. Completed holes remain saved.</p><button class="primary" onclick="location.reload()">Reload game</button>');});
    // Read-only diagnostics help verify the real game without bypassing its rules.
    window.ninjaGolf={state:()=>({mode:this.mode,phase:this.phase,aim:this.aim,cameraYaw:this.cameraYaw,facing:this.player.root.rotation.y,hole:this.hole,courseId:this.roundCourse.id,holes:this.holes.length,playerIndex:this.playerIndex,attack:this.action?{kind:this.action.kind,step:this.action.step,motion:this.action.motionName,time:this.action.time,duration:this.action.duration,contacts:this.action.hitIndex,totalContacts:this.action.hits.length}:null,survey:!!this.survey,penalties:this.penalties,strokes:this.strokes,lie:this.lie,ball:this.ball.position.toArray(),player:this.player.root.position.toArray(),health:this.health,enemies:this.enemies.filter(e=>!e.dead).length,recoilingEnemies:this.enemies.filter(e=>!e.dead&&e.current==='Hit_Chest').length,kills:this.kills,resolve:this.resolve,club:CLUBS[this.club].short,shotHeight:shotHeightProfile(this.shotHeight).id,power:this.power,charging:this.charging,scores:[...this.scores],paused:this.paused,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,showcase:this.showcase?.state??null,musicReady:this.audio.music.readyState,musicFailed:this.audio.musicFailed,musicMode:this.audio.mode,combatMusicReady:this.audio.combatMusic.readyState})};
    this.camera.position.set(96,77,-88);this.currentLook.set(-15,10,155);if(import.meta.env.DEV)window.__golfTest=this;this.restoreOffer();this.previousTime=performance.now();this.renderer.setAnimationLoop(()=>this.frame());
  }
  get warrior(){return WARRIORS[this.playerIndex];}
  stopShowcase(){if(!this.showcase)return;this.showcaseSettings={speed:this.showcase.clock.speed,paused:this.showcase.clock.paused};this.showcase.dispose();this.showcase=null;}
  startShowcase(){this.stopShowcase();this.player.setGolfClub('DR');this.showcase=new CharacterShowcase(this.player,this.showcaseSettings);this.updateShowcaseUI();}
  updateShowcaseUI(){if(this.showcase)this.ui.showcaseState(this.showcase.state);}
  selectWarrior(i){const player=new Warrior(i);this.stopShowcase();if(this.player){this.scene.remove(this.player.root);this.player.dispose();}this.playerIndex=i;this.ui.warriorDetails(i);this.player=player;this.updateClubModel();this.scene.add(this.player.root);if(this.ball&&this.course)this.placePlayer();if(this.mode==='selection'){this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.scale.setScalar(2.0);this.player.root.rotation.y=.25;this.startShowcase();this.updateCamera(0,{immediate:true});}this.audio.play('click');}
  cancelCharacterLoad(){this.characterRequest++;this.ui.characterLoading(null);this.ui.warriorDetails(this.playerIndex);}
  async prepareWarrior(index,apply){
    const request=++this.characterRequest;
    const retry=()=>this.prepareWarrior(index,apply);
    const cancel=()=>{this.cancelCharacterLoad();if(this.mode==='selection')this.selectScreen();};
    try{
      if(!isWarriorReady(index)){
        this.stopShowcase();this.player.root.visible=false;
        this.ui.characterLoading(WARRIORS[index].name,{cancel});
        await loadWarrior(index);
      }
      if(this.characterRequest!==request)return false;
      apply();this.ui.characterLoading(null);return true;
    }catch(error){
      if(this.characterRequest!==request)return false;
      console.warn('Character preparation failed.',error);
      this.ui.characterLoading(WARRIORS[index].name,{error:true,retry,cancel});return false;
    }
  }
  requestWarrior(index){this.ui.warriorDetails(index);return this.prepareWarrior(index,()=>this.selectWarrior(index));}
  selectScreen(){this.cancelCourseLoad();this.cancelCharacterLoad();this.mode='selection';this.paused=false;this.audio.start();this.clearEnemies();this.aimLine.visible=false;this.aimMarker.visible=false;this.player.root.visible=true;this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.rotation.y=.25;this.player.root.scale.setScalar(2.0);this.ball.visible=false;this.startShowcase();this.updateCamera(0,{immediate:true});}
  setCourse(index){this.courseIndex=index;this.roundCourse=COURSE_SETS[index];this.holes=this.roundCourse.holes;this.audio.setCourse(this.roundCourse.id);}
  cancelCourseLoad(){this.courseRequest++;this.ui.courseLoading(null);this.ui.courseSelection(this.courseIndex);}
  async prepareCourse(index,apply){
    const request=++this.courseRequest,course=COURSE_SETS[index];
    if(!course)throw new Error(`Unknown course index: ${index}`);
    const cancel=()=>{this.cancelCourseLoad();if(this.mode==='courses')this.ui.courseDetails(this.roundCourse);};
    try{
      if(!isNatureReady(course.theme)){
        this.ui.courseLoading(course.name,{cancel});await loadNature(course.theme);
      }
      if(request!==this.courseRequest)return false;
      this.ui.courseLoading(null);apply();return true;
    }catch(error){
      if(request!==this.courseRequest)return false;
      console.warn('Course preparation failed.',error);
      this.ui.courseLoading(course.name,{error:true,retry:()=>this.prepareCourse(index,apply),cancel});return false;
    }
  }
  home(index=Math.floor(Math.random()*COURSE_SETS.length)){
    this.cancelCourseLoad();this.cancelCharacterLoad();this.stopShowcase();this.clearEnemies();this.mode='home';this.paused=false;this.ui.homeCourse(this.roundCourse);
    this.player.root.visible=false;this.aimLine.visible=false;this.aimMarker.visible=false;this.trail.visible=false;this.ballBeacon.visible=false;this.ui.closeModal();this.input.clear();
    return this.prepareCourse(index,()=>{this.setCourse(index);this.loadHole(this.roundCourse.preview?.hole||0);this.player.root.visible=false;this.ui.homeCourse(this.roundCourse);this.restoreOffer();});
  }
  selectCourseScreen(){this.cancelCharacterLoad();this.stopShowcase();this.mode='courses';this.paused=false;this.clearEnemies();this.player.root.visible=false;this.ball.visible=false;this.previewCourse(this.ui.selectedCourse||0);}
  previewCourse(index){return this.prepareCourse(index,()=>{this.setCourse(index);this.loadHole(this.roundCourse.preview?.hole||0);this.player.root.visible=false;this.ball.visible=false;this.aimLine.visible=false;this.aimMarker.visible=false;this.ui.courseSelection(index);this.ui.courseDetails(this.roundCourse);});}
  toggleSurvey(){if(this.mode!=='game'||this.phase!=='aim')return;this.survey=!this.survey;if(this.survey)this.surveyView=createSurvey(this.ball.position,this.aimMarker.position,this.camera.fov,this.camera.aspect);this.input.clear();}

  begin(i=this.playerIndex,courseIndex=0){if(!isNatureReady(COURSE_SETS[courseIndex].theme))return this.prepareCourse(courseIndex,()=>this.begin(i,courseIndex));this.cancelCourseLoad();this.stopShowcase();this.mode='game';this.setCourse(courseIndex);this.selectWarrior(i);this.scores=[];this.scorePenalties=[];this.kills=0;this.bestCombo=0;this.resolve=35;this.mode='game';this.paused=false;this.loadHole(0);this.audio.start();this.ui.toast('Choose a club and aim. Start the power meter, then strike.',6000,'aim');this.save();}
  loadHole(index){
    this.hole=index;this.course=this.holes[index];this.groundHeight=createCourseSurfaceSampler(this.course,heightAt,ellipse);this.scene.userData.courseTheme=this.course.theme;this.world.build(this.course);this.puttingGuide.build(this.course);this.survey=false;this.clearEnemies();this.effects.clear();this.strokes=0;this.penalties=0;this.health=this.warrior.health;this.guard=createPlayerGuard();this.charging=false;this.power=1;this.shotHeight=0;this.club=this.course.par===3?2:0;this.updateClubModel();this.phase='aim';this.combo=0;this.pendingStrike=null;this.attackTimer=0;this.invincible=0;this.dodgeTimer=0;
    this.ball.position.set(0,heightAt(this.course,0,0)+BALL_RADIUS,0);this.shotOrigin.copy(this.ball.position);this.ball.visible=true;this.trail.visible=false;this.lie='Tee';this.player.root.visible=this.mode==='game';this.aimAtPin();this.placePlayer();this.cameraYaw=this.aim;this.camera.position.set(-9,heightAt(this.course,0,0)+8,-14);this.currentLook=this.ball.position.clone().add(new THREE.Vector3(0,2,20));this.refreshAim();this.preparePortrait();
  }
  preparePortrait(){
    const request={};this.portraitPreparation=request;
    this.portraitReady=this.world.waitForAssets().then(()=>{
      if(this.portraitPreparation!==request)return;
      return this.rendering.preparePortrait([this.world.root,...this.enemies.map(enemy=>enemy.root)],this.portraitLights);
    }).catch(error=>console.warn('Portrait shader preparation failed; the renderer will compile on demand.',error));
  }
  placePlayer(addressWeight=1){
    const p=this.ball.position,facing=(this.aim||0)+Math.PI/2,fit=this.player.golfClubFit;
    const offset=fit.ballOffsetNative,ready=fit.addressOffsetNative;
    const ox=offset.x-(ready?.x??0)*addressWeight,oz=offset.z-(ready?.z??0)*addressWeight;
    const x=p.x-1.1*(Math.cos(facing)*ox+Math.sin(facing)*oz),z=p.z-1.1*(-Math.sin(facing)*ox+Math.cos(facing)*oz);
    // Anchor the strike to the ball's lie. Foot placement handles the nearby slope.
    this.player.root.position.set(x,p.y-BALL_RADIUS+1.1*(ready?.y??0)*addressWeight,z);this.player.root.rotation.set(0,facing,0);this.player.root.scale.setScalar(1.1);
  }
  aimAtPin(){this.aim=Math.atan2(this.course.greenX-this.ball.position.x,this.course.length-this.ball.position.z);}
  changeClub(delta){if(this.phase!=='aim'||this.mode!=='game'||this.paused)return;this.selectClub((this.club+delta+CLUBS.length)%CLUBS.length);}
  updateClubModel(){this.player.setGolfClub(CLUBS[this.club].short);if(this.mode==='game'&&this.ball&&this.course)this.placePlayer();}
  selectClub(i){if(this.phase!=='aim'||this.mode!=='game'||this.paused||!Number.isInteger(i)||!CLUBS[i])return;this.club=i;if(CLUBS[i].short==='PT')this.shotHeight=0;this.updateClubModel();this.charging=false;this.power=1;this.refreshAim();this.audio.play('click');}
  selectShotHeight(value){
    if(this.mode!=='game'||this.phase!=='aim'||this.paused||CLUBS[this.club].short==='PT'||!SHOT_HEIGHTS.some(p=>p.value===value)||value===this.shotHeight)return;
    this.shotHeight=value;this.charging=false;this.power=1;this.refreshAim();this.audio.play('click');
  }
  refreshAim(){
    const club=CLUBS[this.club],preview=previewShot(this.course,club,this.warrior,this.lie,this.charging?this.power:1,this.aim,this.ball.position,this.world.collision,this.shotHeight);this.shotPreview=preview;
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
    const dispersion=this.rolling?0:(Math.random()-.5)*.012*this.power/this.warrior.precision*(this.lie==='Rough'?1.5:1);const shot=launchShot(CLUBS[this.club],this.warrior,this.lie,this.power,this.aim+dispersion,this.shotHeight);this.velocity=new THREE.Vector3(shot.x,shot.y,shot.z);this.audio.play(this.rolling?'putt':'swing');this.effects.burst(this.ball.position,8,2,1);this.aimLine.visible=false;this.aimMarker.visible=false;this.stillTime=0;
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
        if(!this.rolling){this.audio.play('land');this.effects.burst(p,5,1.5,1);this.bounces++;if(this.velocity.y< -1.7&&this.bounces<3&&lie!=='Bunker'){this.velocity.y=-this.velocity.y*.27;const retention=this.bounces===1?(.3+CLUBS[this.club].roll*.28)*shotHeightProfile(this.shotHeight).rollScale:.65;this.velocity.x*=retention;this.velocity.z*=retention;}else{this.velocity.y=0;this.rolling=true;const retention=(lie==='Bunker'?.18:.68)*(this.bounces===1&&lie!=='Bunker'?shotHeightProfile(this.shotHeight).rollScale:1);this.velocity.x*=retention;this.velocity.z*=retention;}}
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
    const relief=obstructionRelief(this.course,this.world.collision,this.ball.position);
    if(relief.status==='unplayable'){this.penalty('Unplayable obstructed lie. One penalty stroke.');return;}
    if(relief.status==='relief')this.ball.position.copy(relief.position);
    const reliefNotice=relief.status==='relief'?'Free drop from the obstruction. No penalty. ':'';
    this.velocity.set(0,0,0);this.lie=lieAt(this.course,this.ball.position.x,this.ball.position.z);this.phase='combat';this.enemiesSpawned=0;this.combatTime=0;this.spawnTime=2;this.combo=0;this.comboTime=0;this.cameraYaw=this.aim;this.trail.visible=false;this.fastFlight=false;
    const distance=this.player.root.position.distanceTo(this.ball.position);this.lastShot={distance:shotDistance,lie:this.lie,pin:this.ball.position.distanceTo(this.world.cup)*YARD,relief:!!reliefNotice};this.ui.shotResult(this.lastShot);this.enemyBudget=Math.max(12,Math.min(200,Math.round(distance*.65)+this.hole*20));
    if(distance<12||this.shotStartLie==='Green'){this.phase='aim';this.aimAtPin();this.placePlayer();this.selectBestClub();this.refreshAim();this.power=1;this.ui.toast(reliefNotice+(this.lie==='Green'?'On the green. Read the line and choose your pace.':'A short walk. Your next shot is ready.'));return;}
    this.spawnWave(14);this.preparePortrait();this.ui.toast(reliefNotice||controlHints(this.input.device).combatEntry,5500,'combat');
  }
  selectBestClub(){this.shotHeight=0;const d=this.ball.position.distanceTo(this.world.cup);this.club=d<23&&this.lie==='Green'?7:this.lie==='Bunker'?6:CLUBS.findIndex((c,i)=>i<7&&carryFor(c,this.warrior,this.lie)<d*1.05);if(this.club<0)this.club=6;this.updateClubModel();}
  slideOnLand(position,from,radius=.38,lift=0){moveOnLand(position,from,this.course,this.world.collision,radius,lift);}
  spawnWave(count){
    const p=this.player.root.position,yaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);
    const sites=chooseAmbushSites(this.world.ambushSites,p,yaw,this.time);if(!sites.length)return;const waterEntries=new Map();
    for(let i=0;i<count&&this.enemies.filter(e=>!e.dead).length<64&&this.enemiesSpawned<this.enemyBudget;i++){
      const site=sites[i%Math.min(5,sites.length)],slot=this.enemiesSpawned,enemy=new Warrior(enemyTypeForSlot(slot),true,enemyAppearanceForSlot(slot,this.course.theme));
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
  clearEnemies(){this.effects?.musouAura.clear();if(this.player)this.player.root.visible=true;this.projectiles?.clear();this.pendingStrike=null;this.guardBufferedAttack=null;this.action=null;this.runAcceleration=null;this.attackTimer=0;this.attackBuffer=null;this.lightChain=0;this.cinematic=0;this.rendering?.setPortrait(null);document.body.classList.remove('musou-active');this.ui?.$ ('musou-cinema')?.classList.add('hidden');for(const e of this.enemies)this.scene?.remove(e.root);this.enemies=[];}
  nearbyEnemies(){return this.enemies.filter(e=>!e.dead&&e.root.position.distanceTo(this.player.root.position)<8).length;}
  attack(kind='light'){
    if(this.phase!=='combat'||this.paused||this.cinematic>0)return;
    // A charged ultimate has priority over the normal contact commitment.
    if(kind==='musou'){
      if(this.action?.kind==='musou')return;
      if(this.resolve<100){this.ui.toast('Build Resolve by defeating enemies.');return;}
      this.cancelAttackForControl();exitPlayerGuard(this.guard);escapeGuardBreak(this.guard,this.time);
      this.guard.breakPoseUntil=this.guard.parryPoseUntil=this.guard.attackReadyAt=0;
      this.guardBufferedAttack=null;this.pendingStrike=null;this.dodgeTimer=0;this.hitStop=0;this.shake=0;
      this.cinematicShot=null;this.resolve=0;this.cinematic=MUSOU_CINEMATIC_DURATION;this.musouWipeIndex=1;
      this.invincible=MUSOU_CINEMATIC_DURATION+.5;this.attackYaw=this.player.root.rotation.y;
      this.ui.musou(this.warrior);this.ui.updateMusou(0);this.audio.play('musou-wipe');return;
    }
    if(guardAttackRecovering(this.guard,this.time)){this.guardBufferedAttack={kind,expires:this.time+.55};return;}
    if(this.action){
      this.attackBuffer={kind,expires:this.time+ATTACK_BUFFER_SECONDS,wallExpires:(this.controlTime??this.time)+ATTACK_BUFFER_SECONDS};
      return;
    }
    this.startAttack(kind);
  }
  startAttack(kind,continuation=null){
    const brakingEntry=this.runAcceleration?.brake||this.player.runAttackStep?.state?.reorientation?{...(this.playerVelocity??{x:0,z:0})}:null;
    if(brakingEntry)this.player.runAttackStep?.restartBraking(brakingEntry);
    this.runAcceleration=null;
    exitPlayerGuard(this.guard);
    if(this.time>(this.chainExpires||0))this.lightChain=0;
    const step=continuation?.step??(kind==='light'?(this.lightChain||0)%(this.warrior.lightComboLength??4):Math.max(0,(this.lightChain||0)-1));
    const motionName=continuation?.clip??combatMotionName(this.warrior,kind,step),motion=motions[motionName];
    let definition=withMotionTiming(attackDefinition(kind,step,this.warrior.combatStyle),motion);
    const sequence=kind==='musou'?(this.warrior.musouChain?buildMusouSequence(motions,this.warrior.musouChain):this.warrior.musouSequence?buildShadowSequence(motions,this.warrior.musouSequence,{gap:.075,continuous:true,minDuration:7}):null):kind==='heavy'&&this.warrior.heavySequence?buildShadowSequence(motions,this.warrior.heavySequence,{gap:.075,continuous:true}):null;
    if(sequence)definition={...definition,duration:sequence.duration,hits:sequence.hits,headings:sequence.headings,damage:definition.damage*definition.hits.length/sequence.hits.length};
    this.action={...definition,motionName,syncMotion:!!(continuation||motion.continuations),impactHands:motion.impactHands,rootAdvance:motion.rootAdvance??0,planarRoot:motion.planarRoot,movementScale:motion.movementScale??.45,kind,step,sequence,headings:definition.headings??(kind==='musou'?musouHeadings(this.warrior):null),time:0,hitIndex:0,token:(this.actionSerial=(this.actionSerial||0)+1)};
    if(sequence){this.action.planarRoot=sequence.planarRoot;this.action.impactHands=sequence.impactHands;this.action.movementScale=0;}
    const movingEntry=this.player.running||this.player.startingRun||this.player.turningRun||this.player.recordedStopping;
    const entry=brakingEntry??(movingEntry?(this.player.runAttackStep?.previous?.rootVelocity??this.playerVelocity):null);
    if(entry&&!motion.planarRoot&&kind!=='musou')this.action.entryVelocity={x:entry.x,z:entry.z};
    if(kind==='musou')this.invincible=Math.max(this.invincible,definition.duration);
    const intent=this.input.move;
    this.action.initialMove=cameraRelativeMove(intent.x,intent.y,this.cameraYaw);
    this.action.swingTimes=swingSoundTimes(this.action);this.action.swingIndex=0;
    this.attackTimer=definition.duration;this.attackYaw=this.player.root.rotation.y;this.comboTime=3;this.chainExpires=this.time+definition.duration+.75;
    this.lightChain=kind==='light'?step+1:0;this.player.wasAttack=false;if(kind==='musou')this.audio.play('special');
  }
  cancelAttackForControl(){
    this.action=null;this.attackTimer=0;this.attackBuffer=null;this.runAcceleration=null;
    this.player.root.visible=true;this.player.interruptAttack();
    this.playerVelocity={x:0,z:0};
  }
  strike(action){
    const strikeFacing=this.attackYaw+(action.headings?.[action.hitIndex]||0),strikeArc=action.kind==='musou'&&action.hitIndex<action.hits.length-1?1.1:action.arc;
    if(action.sequence&&action.sequence.kind!=='performance')shadowWave(this.effects,this.player.root.position,strikeFacing,action.reach,strikeArc,this.warrior.color);
    this.effects.slash(this.player.root.position,strikeFacing,action.kind!=='light',{style:action.style,reach:action.reach,arc:strikeArc,color:this.warrior.color});if(action.kind==='musou')this.effects.flourish(this.player.root.position,action.hitIndex,action.style,{final:action.hitIndex===action.hits.length-1});let hit=false,guardedHit=false,cleanHit=false,metalHit=false;
    for(const e of this.enemies){if(e.dead||e.emerging)continue;v1.copy(e.root.position).sub(this.player.root.position);
      if(strikeContains(v1.x,v1.z,strikeFacing,action.reach,strikeArc)&&this.world.collision.segmentClear({x:this.player.root.position.x,y:this.player.root.position.y+1,z:this.player.root.position.z},{x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},0,0,true)){const front=Math.cos(Math.atan2(-v1.x,-v1.z)-e.root.rotation.y)>.35,multiplier=guardDamageMultiplier(e.type,action.kind,front,e.stun>0);metalHit ||= !ENEMY_TYPES[e.type].ranged&&(!!e.enemyAction||front&&!(e.stun>0));e.hp-=(action.kind==='musou'?(action.hitIndex===action.hits.length-1?220:16):action.damage)*this.warrior.damage*multiplier;hit=true;guardedHit ||= multiplier<1;cleanHit ||= multiplier===1;if(multiplier===1){if(action.kind!=='light'){e.stun=ENEMY_TYPES[e.type].armor?1.3:.6;if(ENEMY_TYPES[e.type].armor)this.ui.combatCue('GUARD BROKEN');}e.enemyAction=null;e.oneShot=0;e.knockback.copy(v1).setY(0).normalize().multiplyScalar(action.kind==='musou'&&action.hitIndex<action.hits.length-1?2.8:action.pull?-Math.min(10,Math.max(0,v1.length()-2)*4):action.knockback||(action.kind==='light'?7:14));e.verticalSpeed=action.kind==='musou'&&action.hitIndex<action.hits.length-1?1.4:action.launch||0;e.strike=0;e.cooldown=1.1;if(e.hp>0)e.recoil();}e.root.updateMatrixWorld(true);const impactDirection=v1.clone().setY(0).normalize(),impactPosition=e.bones.spine_02.getWorldPosition(new THREE.Vector3()).addScaledVector(impactDirection,-.24);this.effects.hit(impactPosition,impactDirection,{heavy:action.kind!=='light',special:action.kind==='musou',guarded:multiplier<1});
        if(e.hp<=0){e.dead=.001;e.dramaticDeath=action.kind==='musou';e.deathYaw=e.root.rotation.y;e.tumble=(e.slot%2?1:-1)*(2.6+(e.slot%3)*.6);e.verticalSpeed=e.dramaticDeath?9+(e.slot%4)*1.3:action.kind==='heavy'?5:2;e.knockback.copy(v1).setY(0).normalize().multiplyScalar(e.dramaticDeath?18+(e.slot%3)*3:9);if(e.dramaticDeath)this.effects.explosion(e.root.position,0.75);this.kills++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.resolve=Math.min(100,this.resolve+7);this.health=Math.min(this.warrior.health,this.health+1.6);}}
    }
    if(hit){if(cleanHit)this.audio.play(action.kind!=='light'?'heavy-hit':'hit');if(guardedHit||metalHit)this.audio.play('clash');this.hitStop=action.kind==='light'?.045:action.kind==='musou'?.065:.085;this.shake=action.kind==='light'?.075:.16;}
  }
  updateCombat(dt,inputDt=dt){
    this.controlTime=(this.controlTime??this.time)+inputDt;
    if(this.attackBuffer&&((this.attackBuffer.wallExpires??Infinity)<this.controlTime||this.attackBuffer.expires<this.time))this.attackBuffer=null;
    const input=this.input,p=this.player.root.position;
    if(input.tap('Musou'))this.attack('musou');
    this.effects.setMusou(p,this.action?.kind==='musou',this.input.reducedMotion);
    if(this.cinematic>0){this.cinematic-=inputDt;this.ui.updateMusou(MUSOU_CINEMATIC_DURATION-this.cinematic);while(this.musouWipeIndex<MUSOU_WIPES.length&&MUSOU_CINEMATIC_DURATION-this.cinematic>=MUSOU_WIPES[this.musouWipeIndex].time){this.audio.play('musou-wipe');this.musouWipeIndex++;}const progress=1-this.cinematic/MUSOU_CINEMATIC_DURATION,clip=combatMotionName(this.warrior,['shinobi','ayame','sora'].includes(this.warrior.model)?'light':'heavy');this.player.update(this.time,dt,{cinematic:true,expressionDt:dt,gazeTarget:this.camera.position,previewPose:musouReadyPose(motions,clip,progress)});if(this.cinematic<=0){this.ui.$('musou-cinema').classList.add('hidden');document.body.classList.remove('musou-active');this.startAttack('musou');}return;}
    this.combatTime+=dt;this.spawnTime-=dt;this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;this.dodgeTimer=Math.max(0,this.dodgeTimer-dt);this.invincible=Math.max(0,this.invincible-dt);
    if(input.tap('Waypoint')){this.cameraYaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);if(!this.action)this.player.root.rotation.y=this.cameraYaw;}
    if(input.tap('Dodge')&&this.dodgeTimer===0&&this.action?.kind!=='musou'){escapeGuardBreak(this.guard,this.time);this.guardBufferedAttack=null;this.dodgeTimer=.45;this.invincible=.55;this.cancelAttackForControl();}
    this.cameraYaw-=input.lookX*.003*input.sensitivity;this.cameraPitch=clamp(this.cameraPitch+input.lookY*.002*input.sensitivity*(input.invertY?-1:1),.08,.8);
    const m=input.move;let {x:dx,z:dz}=cameraRelativeMove(m.x,m.y,this.cameraYaw);
    const pd=p.distanceTo(this.ball.position),moving=Math.hypot(dx,dz)>.1,sprinting=input.down('ShiftLeft','ShiftRight')||input.padSprint;
    if(this.action&&this.action.kind!=='musou'){
      const a=this.action,window=attackControlWindow(a),redirect=movementRedirected(a.initialMove??{x:0,z:0},{x:dx,z:dz});
      // A changed direction remains pending only while that direction is held.
      // The short contact interval commits the cut, not its entire recovery.
      const newAttack=input.tap('LightAttack','HeavyAttack');
      if(redirect)this.attackBuffer=null;
      if(window.cancel&&(input.guarding||redirect||window.recovery&&moving&&!newAttack&&!this.attackBuffer))this.cancelAttackForControl();
      else if(window.steer&&(moving||input.focused))this.attackYaw=steerAttack(this.attackYaw,input.focused?this.cameraYaw:Math.atan2(dx,dz),inputDt);
    }
    updatePlayerGuard(this.guard,{time:this.time,dt,held:input.guarding,allowed:!this.action&&this.dodgeTimer===0});
    // The captured braking step and root deceleration must start together.
    // Starting the attack after movement inserts a stopped frame when the
    // player releases W, then restores stale running velocity on the next.
    const attackFromRun=!this.action&&this.dodgeTimer===0&&(this.player.running||this.player.startingRun||this.player.turningRun||this.player.recordedStopping||this.runAcceleration?.brake||this.player.runAttackStep?.state?.reorientation)&&!!this.player.runAttackStep;
    if(attackFromRun){if(input.tap('LightAttack'))this.attack('light');if(input.tap('HeavyAttack'))this.attack('heavy');}
    this.focused=input.focused||this.guard.active;const speed=(this.dodgeTimer>.18?11:this.time<this.guard.breakPoseUntil?2:this.guard.active?2.3:sprinting?8:this.focused?5.3:5.6)*this.warrior.speed*(this.action?.kind==='musou'?0:this.action?(this.action.movementScale??.45):1);
    const previousVelocity={...(this.playerVelocity??{x:0,z:0})};
    const norm=Math.max(1,Math.hypot(dx,dz));dx/=norm;dz/=norm;
    const requestedVelocity={x:dx*speed,z:dz*speed};
    const steadySourceRun=this.player.running&&this.player.sourceRun&&this.player.runAttackStep?.previous;
    const reversing=this.focused&&moving&&steadySourceRun&&Math.hypot(previousVelocity.x,previousVelocity.z)>.5
      &&previousVelocity.x*requestedVelocity.x+previousVelocity.z*requestedVelocity.z<-.25*Math.hypot(previousVelocity.x,previousVelocity.z)*Math.hypot(requestedVelocity.x,requestedVelocity.z);
    const stopDecision=this.player.prepareRunStop(dt,{currentVelocity:previousVelocity,resumeVelocity:moving&&!this.action&&!this.guard.active&&this.dodgeTimer===0?requestedVelocity:null,enabled:!moving&&!this.action&&!this.guard.active&&this.dodgeTimer===0&&!this.runAcceleration});
    const runStop=stopDecision?.frame??null;
    if(stopDecision?.resume)this.runAcceleration={velocity:previousVelocity,age:0,pending:false};
    const stopping=!stopDecision&&!moving&&(steadySourceRun||this.player.recordedStart?.active&&this.player.startingRun||this.player.recordedTurn?.active&&this.player.turningRun);
    if(!this.action&&this.dodgeTimer===0&&!this.runAcceleration?.brake&&(!this.guard.active&&(stopping||reversing)||stopDecision?.brake)){
      // Carry the outgoing contact into a braking step before reversing travel.
      // Focus keeps the torso facing the camera heading while the feet load.
      this.player.runAttackStep.begin({duration:.2,contactDriven:true});this.player.stoppingRun=true;
      this.runAcceleration={velocity:previousVelocity,age:0,pending:false,brake:true};
    }
    if(moving&&!this.runAcceleration?.brake)this.player.stoppingRun=false;
    if(!this.action&&moving&&this.dodgeTimer===0&&!this.guard.active&&(this.player.runAttackStep?.state||this.player.lastWalkingHandoff)&&!this.runAcceleration)this.runAcceleration={velocity:{...(this.playerVelocity??{x:0,z:0})},age:0,pending:true};
    const outgoingStartVelocity=(this.player.recordedStart?.active&&this.player.startingRun||this.player.recordedTurn?.active&&this.player.turningRun)?{...previousVelocity}:null;
    this.playerVelocity={...requestedVelocity};let runPrediction=null,startAfterTurn=null;
    if(this.action?.entryVelocity){this.action.requestedVelocity={...this.playerVelocity};this.playerVelocity=attackEntryVelocity(this.action.entryVelocity,this.playerVelocity,this.action.time,dt);}
    if(!this.action&&this.dodgeTimer===0&&this.runAcceleration){
      const entry=this.runAcceleration;
      const collecting=this.player.runFootwork?.turnPlanner?.collecting;
      const brakeContact=entry.brake&&this.player.runAttackStep?.brakingComplete&&this.player.runAttackStep?.state?.reorientation?.complete
        ?this.player.runAttackStep.handoffToRun(this.focused?{travel:requestedVelocity}:{}):null;
      if(brakeContact){
        if(moving&&!this.focused&&!this.guard.active&&this.player.recordedStart)startAfterTurn=this.player.runAttackStep.handoffToStart();
        entry.brake=false;entry.age=0;entry.velocity={x:0,z:0};this.player.stoppingRun=false;
        if(!moving)this.player.runAttackStep.finishStop();
      }
      if(entry.pending&&(this.player.running&&!collecting||!moving||Math.hypot(entry.velocity.x,entry.velocity.z)<=.05)){
        entry.pending=false;entry.age=0;entry.velocity=entry.lastVelocity??entry.velocity;
      }
      if(entry.brake){
        const braking=this.player.runAttackStep.advanceBraking(dt,this.groundHeight);
        this.playerVelocity=braking.velocity;entry.age+=dt;
        runPrediction={source:braking.endVelocity,wanted:braking.endVelocity,time:0,duration:.2};
      }else if(entry.pending){
        // Collect the trailing foot before accelerating into a longer stride.
        // The gait owns this landing, even after the attack clock ends.
        const requested=Math.hypot(this.playerVelocity.x,this.playerVelocity.z),limit=Math.hypot(entry.velocity.x,entry.velocity.z);
        if(requested>limit){this.playerVelocity.x*=limit/requested;this.playerVelocity.z*=limit/requested;}
        entry.lastVelocity={...this.playerVelocity};
        runPrediction={source:entry.lastVelocity,wanted:requestedVelocity,time:0,duration:.2,pending:true};
      }else{
        // A held key can change before this acceleration finishes. Restart
        // from the current velocity instead of reusing an obsolete endpoint.
        if(entry.wanted&&Math.hypot(entry.wanted.x-requestedVelocity.x,entry.wanted.z-requestedVelocity.z)>1e-6){
          entry.velocity={...previousVelocity};entry.age=0;
        }
        entry.wanted={...requestedVelocity};
        this.playerVelocity=attackEntryVelocity(entry.velocity,this.playerVelocity,entry.age,dt,.2);entry.age+=dt;
        runPrediction={source:entry.velocity,wanted:requestedVelocity,time:entry.age,duration:.2};
        if(entry.age>=.2)this.runAcceleration=null;
      }
    }else if(this.action||this.dodgeTimer>0)this.runAcceleration=null;
    runPrediction??={source:this.playerVelocity,wanted:this.playerVelocity,time:0,duration:.2};
    const startDecision=this.player.prepareRunStart(dt,{velocity:requestedVelocity,sprinting,handoff:startAfterTurn,facingYaw:this.focused?this.cameraYaw:null,enabled:!stopDecision&&moving&&!this.action&&!this.guard.active&&this.dodgeTimer===0&&(!this.runAcceleration||!!startAfterTurn)&&!input.tap('LightAttack')&&!input.tap('HeavyAttack')&&!input.tap('Musou')});
    const runStart=startDecision?.frame??null;
    if(runStart&&startAfterTurn)this.runAcceleration=null;
    const turnDecision=this.player.prepareRunTurn(dt,{velocity:requestedVelocity,currentVelocity:previousVelocity,enabled:!stopDecision&&!startDecision&&moving&&!this.action&&!this.focused&&!this.guard.active&&this.dodgeTimer===0&&!this.runAcceleration&&!input.tap('LightAttack')&&!input.tap('HeavyAttack')&&!input.tap('Musou')});
    const runTurn=turnDecision?.frame??null;
    if(turnDecision?.waiting||stopDecision?.waiting){this.playerVelocity=(turnDecision??stopDecision).waiting.velocity;runPrediction={source:this.playerVelocity,wanted:this.playerVelocity,time:0,duration:.2};}
    if(startDecision?.brake||turnDecision?.brake){
      this.player.runAttackStep.begin({duration:.2,contactDriven:true});this.player.stoppingRun=true;
      const braking=this.player.runAttackStep.advanceBraking(dt,this.groundHeight);
      this.playerVelocity=braking.velocity;
      this.runAcceleration={velocity:previousVelocity,age:dt,pending:false,brake:true};
      runPrediction={source:braking.endVelocity,wanted:braking.endVelocity,time:0,duration:.2};
    }
    const recordedFrame=runStart??runTurn??runStop;
    if(recordedFrame){this.playerVelocity={x:recordedFrame.delta.x/dt,z:recordedFrame.delta.z/dt};runPrediction={source:this.playerVelocity,wanted:this.playerVelocity,time:0,duration:.2};}
    else if(outgoingStartVelocity&&moving&&!this.action&&this.dodgeTimer===0&&!this.runAcceleration){
      // Releasing the captured clock must not replace a slow preparation step
      // with full-speed sideways travel in one frame.
      this.playerVelocity=attackEntryVelocity(outgoingStartVelocity,requestedVelocity,0,dt,.2);
      this.runAcceleration={velocity:outgoingStartVelocity,age:dt,pending:false};
      runPrediction={source:outgoingStartVelocity,wanted:requestedVelocity,time:dt,duration:.2};
    }
    if(runTurn?.done)this.runAcceleration={velocity:runTurn.exitVelocity,age:0,pending:false};
    let mx=this.playerVelocity.x,mz=this.playerVelocity.z;
    let rootX=0,rootZ=0,shadowEvents=[];
    const pendingKind=input.tap('HeavyAttack')?'heavy':input.tap('LightAttack')?'light':null;
    const continuation=attackContinuation(this.action,pendingKind?{kind:pendingKind,expires:this.time}:this.attackBuffer,this.time,dt,motions);
    if(this.action){const a=this.action,previousTime=a.time;a.time=continuation?continuation.at:a.time+dt;this.attackTimer=Math.max(0,a.duration-a.time);
      shadowEvents=crossedShadowEvents(a.sequence,previousTime,a.time);
      if(a.planarRoot){const delta=attackRootDelta(a.planarRoot,previousTime,a.time,a.duration,this.attackYaw,this.player.root.scale.x);rootX=delta.x;rootZ=delta.z;}
      else{const lunge=Math.sin(Math.min(1,a.time/a.duration)*Math.PI)*a.rootAdvance*Math.PI/(2*a.duration);mx+=Math.sin(this.attackYaw)*lunge;mz+=Math.cos(this.attackYaw)*lunge;}
    }
    let movementStartX=p.x,movementStartZ=p.z,movementStart={x:p.x,y:p.y,z:p.z},movementDt=dt,animationRecorded=recordedFrame;
    if(recordedFrame?.remainingDt>1e-9){
      // Evaluate the outgoing contacts at their exact world position before
      // advancing the running cycle through the remainder of this frame.
      const x=clamp(p.x+recordedFrame.delta.x,COURSE_BOUNDS.minX,COURSE_BOUNDS.maxX),z=clamp(p.z+recordedFrame.delta.z,COURSE_BOUNDS.minZ,this.course.length+COURSE_BOUNDS.endMargin);
      p.set(x,heightAt(this.course,x,z),z);this.player.root.rotation.y=recordedFrame.yaw;this.slideOnLand(p,movementStart);
      this.player.update(this.time-recordedFrame.remainingDt,recordedFrame.duration,{groundHeight:this.groundHeight,moving:true,sprinting,focused:this.focused,runStart,runTurn,runStop});
      movementDt=recordedFrame.remainingDt;animationRecorded=null;
      if(runStop){this.runAcceleration={velocity:runStop.exitVelocity,age:0,pending:false,brake:true};this.player.stoppingRun=true;}
      this.playerVelocity=runStop?this.player.runAttackStep.advanceBraking(movementDt,this.groundHeight).velocity:runTurn?attackEntryVelocity(runTurn.exitVelocity,requestedVelocity,0,movementDt,.2):{...requestedVelocity};
      if(runTurn)this.runAcceleration.age=movementDt;
      mx=this.playerVelocity.x;mz=this.playerVelocity.z;
      runPrediction={source:this.playerVelocity,wanted:this.playerVelocity,time:0,duration:.2};
      movementStartX=p.x;movementStartZ=p.z;movementStart={x:p.x,y:p.y,z:p.z};
    }
    const x=clamp(p.x+mx*movementDt+rootX,COURSE_BOUNDS.minX,COURSE_BOUNDS.maxX),z=clamp(p.z+mz*movementDt+rootZ,COURSE_BOUNDS.minZ,this.course.length+COURSE_BOUNDS.endMargin);
    p.set(x,heightAt(this.course,x,z),z);
    if(recordedFrame)this.player.root.rotation.y=recordedFrame.yaw;
    else if(this.runAcceleration?.brake)this.player.root.rotation.y=this.player.runAttackStep.reorient(movementDt,this.focused?this.cameraYaw:moving?Math.atan2(dx,dz):this.player.root.rotation.y,this.groundHeight);
    else if(this.action)this.player.root.rotation.y=this.attackYaw+(combatSequenceFrame(this.action)?.heading??0);
    else if(this.guard.active)this.player.root.rotation.y=this.cameraYaw;
    else if(this.focused)this.player.root.rotation.y=turnToward(this.player.root.rotation.y,this.cameraYaw,dt*20);
    else if(moving){
      const travelling=this.player.sourceRun||outgoingStartVelocity;
      const yaw=travelling&&Math.hypot(mx,mz)>.1?Math.atan2(mx,mz):Math.atan2(dx,dz);
      this.player.root.rotation.y=turnToward(this.player.root.rotation.y,yaw,dt*18,dt*3*Math.PI);
    }
    this.slideOnLand(p,movementStart);
    for(const event of shadowEvents)shadowBurst(this.effects,p,this.warrior.color,{appear:event.kind==='appear'});
    // Resolve impacts from the collision-corrected position for this frame.
    if(this.action){const a=this.action;while(a.swingIndex<a.swingTimes.length&&a.time>=a.swingTimes[a.swingIndex]){this.audio.play(a.kind==='light'?'whoosh':'heavy-whoosh');a.swingIndex++;}while(a.hitIndex<a.hits.length&&a.time>=a.hits[a.hitIndex]){this.strike(a);a.hitIndex++;}}
    if(moving){this.stepTime=(this.stepTime||0)+dt;if(this.stepTime>(sprinting?.26:.37)){this.audio.play('step',lieAt(this.course,p.x,p.z));this.stepTime=0;}}
    if(!attackFromRun){if(input.tap('LightAttack'))this.attack('light');if(input.tap('HeavyAttack'))this.attack('heavy');}
    if(this.guardBufferedAttack&&!guardAttackRecovering(this.guard,this.time)){const queued=this.guardBufferedAttack;this.guardBufferedAttack=null;if(queued.expires>=this.time)this.attack(queued.kind);}
    const actualMoveSpeed=Math.hypot(p.x-movementStartX,p.z-movementStartZ)/Math.max(movementDt,1e-9);
    const coasting=!!this.player.runFootwork&&!this.player.stoppingRun&&!this.action&&this.dodgeTimer===0&&actualMoveSpeed>.05;
    const shadowFrame=combatSequenceFrame(this.action);this.player.root.visible=!shadowFrame?.hidden;
    this.player.update(this.time,movementDt,{groundHeight:this.groundHeight,moving:(moving||coasting||!!stopDecision?.waiting)&&!this.runAcceleration?.brake,sprinting,dodge:this.dodgeTimer>.1,attack:this.attackTimer,action:shadowFrame?.action??this.action,focused:this.focused,moveSpeed:actualMoveSpeed,runPrediction,runStart:runStart?animationRecorded:null,runTurn:runTurn?animationRecorded:null,runStop:runStop?animationRecorded:null,blocking:this.guard.active,parry:Math.max(0,this.guard.parryPoseUntil-this.time),guardBreak:Math.max(0,this.guard.breakPoseUntil-this.time),guardHitToken:this.guard.hitToken,moveAngle:Math.atan2(p.x-movementStartX,p.z-movementStartZ)-this.player.root.rotation.y});
    if(runStop?.done&&animationRecorded){this.runAcceleration={velocity:runStop.exitVelocity,age:0,pending:false,brake:true};this.player.stoppingRun=true;}
    if(this.action){
      for(const side of shadowFrame?.hidden?[]:activeBladeTrailHands(this.action,Boolean(this.player.offhand))){
        const offhand=side==='l',[hilt,tip]=this.player.weaponPoints(offhand);
        this.effects.trail(hilt,tip,this.action.kind==='musou'?2:0,this.action.token,offhand?1:0);
      }
      if(continuation&&this.attackBuffer?.kind===continuation.kind&&this.attackBuffer.expires>=this.time){this.attackBuffer=null;this.startAttack(continuation.kind,continuation);}
      else if(this.action.kind!=='musou'&&this.attackBuffer&&attackControlWindow(this.action).recovery&&this.attackBuffer.expires>=this.time){
        const queued=this.attackBuffer;this.attackBuffer=null;this.startAttack(queued.kind);
      }
      else if(this.attackTimer<=0){
        if(this.player.runFootwork)this.runAcceleration={velocity:{...this.playerVelocity},age:0,pending:!!this.player.attackLocomotion?.contactTransfer||!!this.player.lastWalkingHandoff};
        this.player.root.visible=true;this.action=null;const queued=this.attackBuffer;this.attackBuffer=null;if(queued&&queued.expires>=this.time)this.startAttack(queued.kind);
      }
    }
    if(this.spawnTime<=0&&pd>11){this.spawnWave(10+this.hole*2);this.spawnTime=3.5;}
    const ready=this.enemies.filter(e=>!e.dead&&!e.emerging&&!(e.stun>0)).sort((a,b)=>a.root.position.distanceToSquared(p)-b.root.position.distanceToSquared(p));
    const melee=ready.filter(e=>!ENEMY_TYPES[e.type].ranged),ranged=ready.filter(e=>ENEMY_TYPES[e.type].ranged);
    const engaged=new Set([...melee.filter(e=>e.enemyAction),...ranged.filter(e=>e.enemyAction)]);
    for(const pool of [melee,ranged]){let count=pool.filter(e=>engaged.has(e)).length;for(const e of pool){if(count>=(pool===melee?3:1))break;if(!engaged.has(e)&&enemyReadyToAttack(e,this.time)){engaged.add(e);count++;}}}
    for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];
      if(e.emerging){
        const a=e.emerging,waiting=Math.max(0,a.delay),step=Math.max(0,dt-waiting);a.delay=Math.max(0,a.delay-dt);if(!step)continue;
        if(a.time===0){
          e.root.visible=true;a.yaw=Math.atan2(a.landing.x-a.site.x,a.landing.z-a.site.z);
          this.effects.burst(e.root.position,a.site.kind==='tree'?14:45,6,a.site.kind==='water'?3:a.site.kind==='sand'?4:1);
        }
        a.time+=step;const motion=enemyEmergenceFrame(a.time,{duration:a.duration,kind:a.site.kind}),t=motion.progress;
        const startY=a.site.y+(a.site.kind==='tree'?a.site.height:a.site.kind==='sand'?-.8:.1);
        if(a.site.kind==='water')e.root.position.copy(waterEmergencePosition(a.site,a.landing,a.arcHeight,t,a.startY));
        else e.root.position.set(THREE.MathUtils.lerp(a.site.x,a.landing.x,t),THREE.MathUtils.lerp(startY,a.landing.y,t)+Math.sin(t*Math.PI)*(a.site.kind==='tree'?.3:1.8),THREE.MathUtils.lerp(a.site.z,a.landing.z,t));
        e.root.rotation.y=a.yaw;e.update(this.time,step,{emerging:motion});
        if(motion.landed&&!a.landed){a.landed=true;this.effects.burst(e.root.position,12,3,a.site.kind==='sand'?4:1);}
        if(motion.done){e.emerging=null;e.oneShot=0;}continue;
      }
      const enemyStart={x:e.root.position.x,y:e.root.position.y,z:e.root.position.z};
      e.lift=Math.max(0,(e.lift||0)+(e.verticalSpeed||0)*dt);e.verticalSpeed=(e.verticalSpeed||0)-15*dt;if(e.lift===0)e.verticalSpeed=0;
      if(e.knockback.lengthSq()>.1){const nx=e.root.position.x+e.knockback.x*dt,nz=e.root.position.z+e.knockback.z*dt;if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;}e.knockback.multiplyScalar(Math.exp(-(e.dead&&e.dramaticDeath?1.3:7)*dt));}
      if(e.dead){this.slideOnLand(e.root.position,enemyStart,.3,e.lift);e.dead+=dt;e.root.position.y=heightAt(this.course,e.root.position.x,e.root.position.z)+e.lift;e.update(this.time,dt,{});const lifetime=e.dramaticDeath?2.7:1.5;if(e.dramaticDeath){e.root.rotation.set(Math.sin(e.dead*2)*.8,e.deathYaw+e.dead*e.tumble,Math.sin(e.dead*3)*.6);if(e.lift===0&&!e.landedDead){e.landedDead=true;this.effects.explosion(e.root.position,.45);}}const dissolve=THREE.MathUtils.smoothstep(e.dead,e.dramaticDeath?.55:.2,lifetime);e.setDeathFade(1-dissolve);e.smokeTime=(e.smokeTime??0)+dt;if(e.smokeTime>=.12&&dissolve>0){e.smokeTime=0;this.effects.clouds.dissolve(e.root.position);}if(e.dead>lifetime){this.scene.remove(e.root);this.enemies.splice(i,1);}continue;}
      const distance=Math.hypot(p.x-e.root.position.x,p.z-e.root.position.z),definition=ENEMY_TYPES[e.type];e.cooldown-=dt;e.stun=Math.max(0,(e.stun||0)-dt);
      if(distance>90){this.scene.remove(e.root);this.enemies.splice(i,1);continue;}
      let enemyMoving=false;
      const waiting=!engaged.has(e)&&!definition.ranged&&distance<=11&&Math.hypot(this.playerVelocity.x,this.playerVelocity.z)<=3;
      if(e.stun<=0&&!e.enemyAction&&e.lift<.1&&(distance>1.8||waiting||definition.ranged)){
        const engagement=engagementTarget({x:e.root.position.x,z:e.root.position.z,type:e.type,slot:e.slot},p,this.playerVelocity,engaged.has(e));
        engagement.y=heightAt(this.course,engagement.x,engagement.z);
        if(this.world.collision.blocked(engagement,.34,2,true)){
          // A blocked waiting position must not send another grunt into the attack space.
          Object.assign(engagement,waiting?e.root.position:p);
        }
        const target=this.world.buildingNavigation.waypoint(e.root.position,engagement,e,this.time);
        const remaining=Math.hypot(target.x-e.root.position.x,target.z-e.root.position.z);
        // Different start/stop distances prevent perpetual tiny steps near a waiting position.
        const approaching=!waiting||remaining>(e.repositioning?.25:.75);
        e.repositioning=waiting&&approaching;
        if(approaching){
          v1.set(target.x-e.root.position.x,0,target.z-e.root.position.z).normalize();e.moveYaw=Math.atan2(v1.x,v1.z);
          const speed=Math.min(remaining/Math.max(dt,.0001),e.speed*(waiting?.55:distance>10?1.4:definition.ranged&&distance<13?.7:1));
          const nx=e.root.position.x+v1.x*speed*dt,nz=e.root.position.z+v1.z*speed*dt;
          if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;enemyMoving=speed>.4;}else{const tx=e.root.position.x+v1.z*speed*dt,tz=e.root.position.z-v1.x*speed*dt;if(lieAt(this.course,tx,tz)!=='Water'){e.root.position.x=tx;e.root.position.z=tz;enemyMoving=speed>.4;}}
        }
      }else e.repositioning=false;
      for(let j=0;j<i;j++){const other=this.enemies[j];if(other.dead||other.emerging)continue;v2.copy(e.root.position).sub(other.root.position);v2.y=0;const d=v2.length();if(d<1.15&&d>.001){const sx=e.root.position.x+v2.x*(1.15-d)/d*dt*4,sz=e.root.position.z+v2.z*(1.15-d)/d*dt*4;if(lieAt(this.course,sx,sz)!=='Water'){e.root.position.x=sx;e.root.position.z=sz;}}}
      this.slideOnLand(e.root.position,enemyStart,.3,e.lift);
      const enemyMoveSpeed=Math.hypot(e.root.position.x-enemyStart.x,e.root.position.z-enemyStart.z)/Math.max(dt,.0001);
      enemyMoving=enemyMoving&&enemyMoveSpeed>.2;
      const toward=Math.atan2(p.x-e.root.position.x,p.z-e.root.position.z);e.root.rotation.y=turnToward(e.root.rotation.y,e.enemyAction?e.enemyAction.yaw:enemyMoving?Math.atan2(e.root.position.x-enemyStart.x,e.root.position.z-enemyStart.z):toward,dt*12);
      if(engaged.has(e)&&distance<definition.reach&&this.world.collision.segmentClear({x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},{x:p.x,y:p.y+1,z:p.z},0,0,true)&&e.cooldown<=0&&e.lift<.1&&e.stun<=0&&!e.enemyAction){
        e.enemyAction={token:`enemy-${++this.enemyActionSerial}`,duration:definition.duration,time:0,hitIndex:0,yaw:toward,target:p.clone().add(new THREE.Vector3(this.playerVelocity.x*.22,1,this.playerVelocity.z*.22))};e.cooldown=definition.duration+definition.recovery+Math.random()*.6;e.readyAt=this.time+e.cooldown+(Math.random()<.65?1.6+Math.random()*2.6:0);
        this.effects.telegraph(e.root.position,toward,definition.reach,definition.hits[0],definition.ranged?'ranged':'sweep');
      }
      if(e.enemyAction){const a=e.enemyAction,previousTime=a.time;a.time+=dt;
        const path=enemyMotions[definition.clip]?.planarRoot;
        if(path){const delta=attackRootDelta(path,previousTime,a.time,a.duration,a.yaw,e.root.scale.x),before=e.root.position.clone();e.root.position.x+=delta.x;e.root.position.z+=delta.z;this.slideOnLand(e.root.position,before,.31,0);e.root.position.y=heightAt(this.course,e.root.position.x,e.root.position.z);}
        e.strike=Math.max(0,a.duration-a.time);
        if(!definition.ranged){a.swingIndex??=0;while(a.swingIndex<definition.hits.length&&a.time>=Math.max(0,definition.hits[a.swingIndex]-.13)){this.audio.play('whoosh');a.swingIndex++;}}
        while(a.hitIndex<definition.hits.length&&a.time>=definition.hits[a.hitIndex]){
          if(definition.ranged){this.projectiles.spawn(e.bones.hand_r.getWorldPosition(new THREE.Vector3()),a.target,definition.damage,e);this.audio.play('whoosh');}
          else if(this.world.collision.segmentClear({x:e.root.position.x,y:e.root.position.y+1,z:e.root.position.z},{x:p.x,y:p.y+1,z:p.z},0,0,true)&&strikeContains(p.x-e.root.position.x,p.z-e.root.position.z,a.yaw,definition.reach+.3,1.15))this.hurt(definition.damage,e.root.position,e);
          a.hitIndex++;if(!e.enemyAction)break;
        }
      }else e.strike=0;
      e.update(this.time,dt,{moving:enemyMoving,sprinting:!waiting&&distance>10,moveSpeed:enemyMoveSpeed,attack:e.strike,enemyAction:e.enemyAction,focused:definition.ranged,moveAngle:(e.moveYaw||0)-e.root.rotation.y});
      if(e.enemyAction?.time>=definition.duration)e.enemyAction=null;
    }
    this.effects.setMusou(p,this.action?.kind==='musou',this.input.reducedMotion);
    this.projectiles.update(dt,p,(damage,source,attacker)=>this.hurt(damage,source,attacker),this.world.collision);
    if(this.health<=0){this.health=this.warrior.health;this.strokes++;this.penalties++;this.clearEnemies();this.guard=createPlayerGuard();this.resolve=Math.max(50,this.resolve);this.invincible=3;this.spawnTime=6;this.ui.achievement('A MINOR SETBACK','Rise again.','One penalty stroke. Your honor is mostly intact.');}
    if(input.tap('Interact')&&!this.action)this.addressBall();
  }
  hurt(damage,source=null,attacker=null){
    if(this.invincible>0){if(this.dodgeTimer>0&&this.time>(this.lastDodgeCue||0)+1){this.lastDodgeCue=this.time;this.resolve=Math.min(100,this.resolve+8);this.ui.combatCue('PERFECT DODGE · +8 RESOLVE');}return;}
    const p=this.player.root.position,result=resolvePlayerGuard(this.guard,{time:this.time,damage,dx:source?source.x-p.x:NaN,dz:source?source.z-p.z:NaN,facing:this.player.root.rotation.y});
    if(result.kind!=='hit'){
      this.effects.hit(p.clone().add(new THREE.Vector3(0,1.35,0)),new THREE.Vector3(Math.sin(this.player.root.rotation.y),.1,Math.cos(this.player.root.rotation.y)),{heavy:result.kind==='parry',guarded:true});this.audio.play('clash');
      if(result.kind==='parry'){this.resolve=Math.min(100,this.resolve+result.resolve);if(attacker&&!attacker.dead){attacker.stun=result.stagger;attacker.enemyAction=null;attacker.strike=0;attacker.oneShot=0;attacker.recoil();attacker.cooldown=Math.max(attacker.cooldown,result.stagger);}this.ui.combatCue('PARRY · +10 RESOLVE');}
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
    const btn=document.createElement('button');btn.className='text-button';btn.id='continue-round';btn.textContent=`Continue ${COURSE_SETS[save.courseIndex].name} · Hole ${save.nextHole+1} →`;btn.style.display='block';btn.style.marginTop='12px';this.ui.$('play').after(btn);btn.onclick=()=>this.prepareWarrior(save.playerIndex,()=>this.prepareCourse(save.courseIndex,()=>{this.setCourse(save.courseIndex);this.selectWarrior(save.playerIndex);this.scores=save.scores;this.scorePenalties=save.penalties;this.kills=save.kills||0;this.bestCombo=save.bestCombo||0;this.mode='game';this.paused=false;this.loadHole(save.nextHole);this.ui.showScreen('game');this.audio.start();}));}
  updateCamera(dt,{immediate=false}={}){
    const p=this.player.root.position,b=this.ball.position;let speed=3.5;
    if(this.mode!=='selection'&&this.camera.view?.enabled)this.camera.clearViewOffset();
    if(this.mode==='home'||this.mode==='courses'){const a=this.time*.014,c=this.course;camTarget.set(85+Math.sin(a)*18,Math.max(72,c.length*.19),c.length*.19-100+Math.cos(a)*12);camLook.set(c.greenX*.3,8,c.length*.57);speed=this.mode==='courses'?2:.7;}
    else if(this.mode==='selection'){const rect=this.ui.selectionViewport();frameSelection(this.camera,this.player.root,this.warrior.model,rect,innerWidth,innerHeight,camTarget,camLook);speed=3;}
    else if(this.phase==='aim'&&this.survey){camLook.copy(this.surveyView.target);camTarget.copy(surveyPosition(this.surveyView));speed=7;}
    else if(this.phase==='flight'){const dir=this.velocity.clone().normalize();const height=this.rolling?4:7;camTarget.copy(b).add(new THREE.Vector3(-Math.sin(this.aim)*13+6,height,-Math.cos(this.aim)*13));camLook.copy(b).addScaledVector(dir,3);speed=this.fastFlight?12:5;}
    else if(this.phase==='combat'&&this.cinematic>0){
      this.player.root.updateMatrixWorld(true);this.player.bones.Bip01_REye.getWorldPosition(camLook);this.player.bones.Bip01_LEye.getWorldPosition(v1);camLook.add(v1).multiplyScalar(.5);
      const shot=musouCameraFrame(1-this.cinematic/MUSOU_CINEMATIC_DURATION,{reducedMotion:this.input.reducedMotion}),yaw=this.attackYaw+shot.yaw;
      camLook.y-=shot.lookBelowEyes;
      camTarget.copy(camLook).add(new THREE.Vector3(Math.sin(yaw)*shot.distance,shot.height,Math.cos(yaw)*shot.distance));
      if(this.cinematicShot!==shot.shot){immediate=true;this.cinematicShot=shot.shot;}speed=32;

    }
    else if(this.phase==='combat'){const ultimate=this.action?.kind==='musou',distance=ultimate?9.8:7.7,lookAhead=ultimate?1.2:4;camTarget.set(p.x-Math.sin(this.cameraYaw)*distance,p.y+(ultimate?4.5:2.2+this.cameraPitch*4.5),p.z-Math.cos(this.cameraYaw)*distance);camLook.set(p.x+Math.sin(this.cameraYaw)*lookAhead,p.y+1.6,p.z+Math.cos(this.cameraYaw)*lookAhead);speed=ultimate?10:7;if(ultimate&&this.cinematicShot!==null){immediate=true;this.cinematicShot=null;}}
    else if(this.phase==='holed'){camTarget.copy(this.world.cup).add(new THREE.Vector3(Math.sin(this.time*.2)*14,8,-13));camLook.copy(this.world.cup).add(new THREE.Vector3(0,1,0));speed=2;}
    else{const d=this.club===7?9.0:9.5;camTarget.set(b.x-Math.sin(this.aim)*d+Math.cos(this.aim)*3,b.y+4.2,b.z-Math.cos(this.aim)*d-Math.sin(this.aim)*3);camLook.set(b.x+Math.sin(this.aim)*16,b.y+.65,b.z+Math.cos(this.aim)*16);speed=4;}
    if(this.mode==='game'&&this.phase==='combat'&&!(this.cinematic>0))this.world.collision.camera(v1.copy(p).add(new THREE.Vector3(0,1.7,0)),camTarget,2.4);
    camTarget.y=Math.max(camTarget.y,heightAt(this.course,camTarget.x,camTarget.z)+(this.cinematic>0?1.1:1.8));const cameraBlend=immediate?1:1-Math.exp(-speed*dt);this.camera.position.lerp(camTarget,cameraBlend);this.currentLook.lerp(camLook,cameraBlend);if(this.shake>0&&!this.input.reducedMotion){this.shake-=dt;this.camera.position.x+=(Math.random()-.5)*this.shake*2;this.camera.position.y+=(Math.random()-.5)*this.shake;}
    if(this.mode==='game'&&this.phase==='combat'&&!(this.cinematic>0))this.world.collision.camera(v1.copy(p).add(new THREE.Vector3(0,1.7,0)),this.camera.position,2.4);
    this.camera.lookAt(this.currentLook);
    if(this.cinematic>0)this.camera.rotateZ(musouCameraFrame(1-this.cinematic/MUSOU_CINEMATIC_DURATION,{reducedMotion:this.input.reducedMotion}).roll);
    const portrait=this.mode==='game'&&this.phase==='combat'&&this.cinematic>0;
    const near=portrait?.05:.4;if(this.camera.near!==near){this.camera.near=near;this.camera.updateProjectionMatrix();}
    this.rendering.setPortrait(portrait?camLook:null,portrait?[this.world.root,...this.enemies.map(enemy=>enemy.root)]:null);
  }
  updatePortraitLighting(){
    const cinematic=this.cinematic>0;
    this.portraitLights.visible=this.mode==='selection'||cinematic;
    if(!this.portraitLights.visible)return;
    this.portraitLights.position.copy(this.player.root.position);
    this.portraitLights.rotation.y=cinematic?Math.atan2(this.camera.position.x-this.player.root.position.x,this.camera.position.z-this.player.root.position.z):0;
    this.portraitKey.color.set(cinematic?'#ffe0bc':'#fff0df');this.portraitKey.intensity=cinematic?60:48;
    this.portraitKey.position.set(-2,cinematic?3.8:5,4);
    this.portraitFill.color.set(cinematic?'#bed5ff':'#e2eeff');this.portraitFill.intensity=cinematic?16:24;
    this.portraitRim.visible=cinematic;
  }
  frame(){
    const now=performance.now();const realDt=(now-this.previousTime)/1000;let dt=Math.min(realDt,.05);this.previousTime=now;if(this.hitStop>0){this.hitStop-=realDt;dt*=.12;}this.input.setContext(this.mode==='game'&&!this.paused?(this.survey?'survey':this.phase):'menu');this.input.poll(Math.min(realDt,.05),this.mode==='game'&&this.phase==='combat');
    if(this.mode==='selection'&&this.input.tap('KeyC'))this.ui.toggleShowcaseConsole();
    if(this.input.tap('Escape')&&!(this.mode==='game'&&this.phase==='holed')){if(!this.ui.$('modal').classList.contains('hidden')){this.ui.closeModal();if(this.paused)this.resume();}else this.togglePause();}
    this.audio.setMode(this.mode==='game'&&this.phase==='combat'?'combat':'course');this.audio.update(dt,this.mode==='game'&&this.phase==='combat',this.player.root.position,this.course.coastal!==false);
    if(!this.paused){this.time+=dt;this.world.update(this.time,dt,this.mode==='game'||this.mode==='selection'?this.player.root.position:null,this.camera.position);this.effects.update(dt,this.phase!=='combat');
      if(this.mode==='game'){
        if(this.phase==='aim'){
          if(this.survey)moveSurvey(this.surveyView,this.input,dt,this.course);
          const horizontal=this.survey?0:(this.input.down('KeyD','ArrowRight')?1:0)-(this.input.down('KeyA','ArrowLeft')?1:0)+(this.input.padX||0);const change=this.survey?0:aimDelta(horizontal,dt)-this.input.lookX*.0018;
          if(change){this.aim+=change;this.placePlayer();this.refreshAim();}
          if(this.input.tap('KeyQ'))this.changeClub(-1);if(this.input.tap('KeyE'))this.changeClub(1);
          if(this.input.tap('KeyZ'))this.selectShotHeight(clamp(this.shotHeight-1,-1,1));if(this.input.tap('KeyX'))this.selectShotHeight(clamp(this.shotHeight+1,-1,1));
          if(this.input.tap('Space'))this.swing();if(this.input.tap('KeyR'))this.toggleSurvey();
          if(this.charging){this.chargeTime+=dt;this.power=.08+.92*(.5-.5*Math.cos(this.chargeTime*2.5));this.refreshAim();}
          this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true,putting:this.club===7,previewPose:this.club===7?{clip:'Golf_Putt',time:0}:null});
        }else if(this.phase==='swing'){
          this.swingElapsed+=dt;this.swingTimer=Math.max(0,this.swingTimer-dt);this.placePlayer(1-THREE.MathUtils.smoothstep(this.swingElapsed,0,Math.min(.35,this.contactTime*.6)));this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true,swing:1,putting:this.club===7});if(this.swingElapsed>=this.contactTime)this.launchBall();
        }else if(this.phase==='flight'){
          if(this.input.tap('Space'))this.fastFlight=true;this.updateBall(dt*(this.fastFlight?3:1));this.swingTimer=Math.max(0,this.swingTimer-dt);this.player.update(this.time,dt,{groundHeight:this.groundHeight,golf:true,swing:this.swingTimer>0?1:0,putting:this.club===7});
        }else if(this.phase==='combat')this.updateCombat(dt,Math.min(realDt,.05));
        this.uiTime+=dt;if(this.uiTime>.05){this.ui.update(this,this.uiTime);this.uiTime=0;}
      }else if(this.mode==='selection'){this.showcase?.update(dt);this.updateShowcaseUI();}
      this.updateCamera(Math.min(realDt,.05));
    }
    this.updatePortraitLighting();
    this.puttingGuide.update(this.time,this.mode==='game'&&this.phase==='aim'&&this.lie==='Green');
    this.ballGlow.position.copy(this.ball.position);this.ballGlow.position.y=heightAt(this.course,this.ball.position.x,this.ball.position.z)+.07;this.ballGlow.visible=this.mode==='game'&&this.phase!=='flight'&&this.phase!=='holed';this.ballGlow.scale.setScalar(1+Math.sin(this.time*2)*.08);
    this.ballBeacon.position.copy(this.ball.position).add(new THREE.Vector3(0,5.5,0));this.ballBeacon.visible=this.mode==='game'&&this.phase==='combat';this.aimLine.visible=this.aimMarker.visible=this.mode==='game'&&this.phase==='aim';
    this.crowd.update(this.enemies);this.scene.userData.crowdCount=this.enemies.length;this.scene.userData.musou=this.action?.kind==='musou'&&!this.input.reducedMotion;this.frameCount++;this.fpsTime+=realDt;if(this.fpsTime>1.2){const fps=this.frameCount/this.fpsTime;this.ui.$('performance').textContent=`${Math.round(fps)} FPS`;if(this.quality==='balanced'&&!this.paused&&this.time>(this.resolutionChangedAt||0)+3){const current=this.renderer.getPixelRatio(),ceiling=Math.min(devicePixelRatio,1.5);const next=fps<42?Math.max(.75,current-.15):fps>58&&this.time>(this.resolutionChangedAt||0)+10?Math.min(ceiling,current+.1):current;if(Math.abs(next-current)>.01){this.renderer.setPixelRatio(next);this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();this.resolutionChangedAt=this.time;}}this.frameCount=0;this.fpsTime=0;}
    // Resizing clears the drawing buffer. Apply adaptive resolution before
    // the final draw, so this frame never presents an empty canvas.
    this.rendering.render(this.quality);this.input.end();
  }
}
async function boot(){try{document.querySelector('#app').innerHTML='<div class="loading-screen"><div class="brand-mark">忍</div><h2>Preparing the course.</h2><p id="loading-detail">Loading the course and your first warrior…</p></div>';const initialCourse=Math.floor(Math.random()*COURSE_SETS.length);await Promise.all([loadNature(import.meta.env.DEV?undefined:COURSE_SETS[initialCourse].theme),loadInitialWarriorAssets((done,total)=>{document.getElementById('loading-detail').textContent=`Preparing warriors · ${done} / ${total}`;})]);new Game(initialCourse);}catch(error){console.error(error.stack||error);document.querySelector('#app').insertAdjacentHTML('beforeend',`<div style="position:fixed;inset:0;display:grid;place-content:center;background:#19362f;color:#eee;padding:40px;font-family:Arial"><h1 style="font-size:36px;letter-spacing:0">The course could not load.</h1><p>Reload the page. If this continues, try a browser with WebGL 2 enabled.</p><button onclick="location.reload()" style="padding:16px">Try again</button></div>`);}}
boot();
