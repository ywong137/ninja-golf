import './style.css';
import * as THREE from 'three';
import { Rendering } from './rendering.js';
import { World } from './world.js';
import { Warrior, Effects, CrowdRenderer, loadWarriorAssets } from './actors.js';
import { cameraRelativeMove, aimDelta, turnToward } from './navigation.js';
import { attackDefinition, strikeContains, interceptTarget, chooseAmbushSites } from './combat.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { COURSES, WARRIORS, CLUBS, heightAt, lieAt, clamp, carryFor, launchShot, scoreName } from './course.js';

const v1=new THREE.Vector3(),v2=new THREE.Vector3(),camTarget=new THREE.Vector3(),camLook=new THREE.Vector3();
const YARD=1.09361, BALL_RADIUS=.13;
class Game {
  constructor(){
    this.audio=new AudioEngine();this.mode='home';this.phase='aim';this.paused=false;this.hole=0;this.scores=[];this.kills=0;this.combo=0;this.bestCombo=0;this.comboTime=0;this.resolve=35;this.health=110;this.quality='balanced';this.time=0;this.playerIndex=0;this.enemies=[];this.power=1;this.charging=false;this.club=0;this.strokes=0;this.enemiesSpawned=0;this.attackTimer=0;this.dodgeTimer=0;this.invincible=0;this.shotOrigin=new THREE.Vector3();this.cameraYaw=0;this.cameraPitch=.35;this.swingTimer=0;this.uiTime=0;this.frameCount=0;this.fpsTime=0;
    this.ui=new UI({selection:()=>this.selectScreen(),home:()=>this.home(),begin:i=>this.begin(i),warrior:i=>this.selectWarrior(i),audio:()=>this.ui.audio(this.audio.toggle()),pause:()=>this.togglePause(),help:()=>{this.ui.help();},resume:()=>this.resume(),swing:()=>{this.audio.start();this.swing();},club:d=>this.changeClub(d),selectClub:i=>this.selectClub(i),skip:()=>{this.fastFlight=true;},restart:()=>{this.paused=false;this.loadHole(this.hole);this.audio.resume();},next:()=>this.nextHole()});
    try{this.renderer=new THREE.WebGLRenderer({canvas:this.ui.canvas,antialias:true,powerPreference:'high-performance'});}catch(e){this.ui.modal('<h2>A little more graphics power.</h2><p>This game needs WebGL 2. Enable hardware acceleration in your browser, then reload the page.</p>');return;}
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.4,6500);
    this.world=new World(this.scene,this.renderer);this.rendering=new Rendering(this.renderer,this.scene,this.camera);this.effects=new Effects(this.scene);this.crowd=new CrowdRenderer(this.scene);this.input=new Input(this.ui.canvas);this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,20,14),new THREE.MeshStandardMaterial({color:'#fffef3',roughness:.38}));this.ball.castShadow=true;this.scene.add(this.ball);
    this.ballGlow=new THREE.Mesh(new THREE.RingGeometry(.33,.42,40),new THREE.MeshBasicMaterial({color:'#f3e3a9',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));this.ballGlow.rotation.x=-Math.PI/2;this.scene.add(this.ballGlow);
    this.ballBeacon=new THREE.Mesh(new THREE.CylinderGeometry(.12,.6,11,12,1,true),new THREE.MeshBasicMaterial({color:'#ecdba6',transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));this.scene.add(this.ballBeacon);
    this.aimMarker=new THREE.Mesh(new THREE.RingGeometry(1.5,1.7,56),new THREE.MeshBasicMaterial({color:'#f7eac1',side:THREE.DoubleSide,transparent:true,opacity:.85}));this.aimMarker.rotation.x=-Math.PI/2;this.scene.add(this.aimMarker);
    this.aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#f4e7b7',dashSize:1.1,gapSize:1.4,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.aimLine);
    this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f8f3db',transparent:true,opacity:.8}));this.scene.add(this.trail);this.trailPoints=[];
    this.selectWarrior(0);this.loadHole(0);this.home();this.ui.showScreen('home');
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.mode==='game'&&!this.paused&&this.phase!=='holed')this.togglePause();});
    this.ui.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.audio.pause();this.ui.modal('<h2>The graphics session stopped.</h2><p>Reload this page to restore the course. Completed holes remain saved.</p><button class="primary" onclick="location.reload()">Reload game</button>');});
    // Read-only diagnostics help verify the real game without bypassing its rules.
    window.ninjaGolf={state:()=>({mode:this.mode,phase:this.phase,aim:this.aim,cameraYaw:this.cameraYaw,facing:this.player.root.rotation.y,hole:this.hole,strokes:this.strokes,lie:this.lie,ball:this.ball.position.toArray(),player:this.player.root.position.toArray(),health:this.health,enemies:this.enemies.filter(e=>!e.dead).length,kills:this.kills,resolve:this.resolve,club:CLUBS[this.club].short,power:this.power,charging:this.charging,scores:[...this.scores],paused:this.paused,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,musicReady:this.audio.music.readyState,musicFailed:this.audio.musicFailed,musicMode:this.audio.mode,combatMusicReady:this.audio.combatMusic.readyState})};
    this.camera.position.set(96,77,-88);this.currentLook.set(-15,10,155);if(import.meta.env.DEV)window.__golfTest=this;this.restoreOffer();this.previousTime=performance.now();this.renderer.setAnimationLoop(()=>this.frame());
  }
  get warrior(){return WARRIORS[this.playerIndex];}
  selectWarrior(i){if(this.player){this.scene.remove(this.player.root);this.player.dispose();}this.playerIndex=i;this.player=new Warrior(i);this.scene.add(this.player.root);if(this.ball&&this.course)this.placePlayer();if(this.mode==='selection'){this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.scale.setScalar(2.0);this.player.root.rotation.y=.25;}this.audio.play('click');}
  selectScreen(){this.mode='selection';this.paused=false;this.audio.start();this.clearEnemies();this.aimLine.visible=false;this.aimMarker.visible=false;this.player.root.visible=true;this.player.root.position.set(1,heightAt(this.course,1,0),0);this.player.root.rotation.y=.25;this.player.root.scale.setScalar(2.0);}
  home(){this.mode='home';this.paused=false;this.clearEnemies();this.player.root.visible=false;this.aimLine.visible=false;this.aimMarker.visible=false;this.trail.visible=false;this.ballBeacon.visible=false;this.ui.closeModal();this.input.clear();this.restoreOffer();}
  begin(i){this.selectWarrior(i);this.scores=[];this.kills=0;this.bestCombo=0;this.resolve=35;this.mode='game';this.paused=false;this.loadHole(0);this.audio.start();this.ui.toast('Q / E selects a club. A / D aims. Press SPACE twice to swing.',6000);this.save();}
  loadHole(index){
    this.hole=index;this.course=COURSES[index];this.world.build(this.course);this.clearEnemies();this.effects.clear();this.strokes=0;this.health=this.warrior.health;this.charging=false;this.power=1;this.club=this.course.par===3?2:0;this.phase='aim';this.combo=0;this.pendingStrike=null;this.attackTimer=0;this.invincible=0;this.dodgeTimer=0;
    this.ball.position.set(0,heightAt(this.course,0,0)+BALL_RADIUS,0);this.shotOrigin.copy(this.ball.position);this.ball.visible=true;this.trail.visible=false;this.lie='Tee';this.player.root.visible=this.mode==='game';this.aimAtPin();this.placePlayer();this.cameraYaw=this.aim;this.camera.position.set(-9,heightAt(this.course,0,0)+8,-14);this.currentLook=this.ball.position.clone().add(new THREE.Vector3(0,2,20));this.refreshAim();
  }
  placePlayer(){const p=this.ball.position,facing=(this.aim||0)+Math.PI/2,x=p.x-Math.sin(facing)*1.04,z=p.z-Math.cos(facing)*1.04;this.player.root.position.set(x,heightAt(this.course,x,z),z);this.player.root.rotation.set(0,facing,0);this.player.root.scale.setScalar(1.1);}
  aimAtPin(){this.aim=Math.atan2(this.course.greenX-this.ball.position.x,this.course.length-this.ball.position.z);}
  changeClub(delta){if(this.phase!=='aim'||this.mode!=='game'||this.paused)return;this.selectClub((this.club+delta+CLUBS.length)%CLUBS.length);}
  selectClub(i){if(this.phase!=='aim'||this.mode!=='game'||this.paused)return;this.club=i;this.charging=false;this.power=1;this.refreshAim();this.audio.play('click');}
  refreshAim(){
    const club=CLUBS[this.club],distance=carryFor(club,this.warrior,this.lie,this.charging?this.power:1);const x=this.ball.position.x+Math.sin(this.aim)*distance,z=this.ball.position.z+Math.cos(this.aim)*distance;
    this.aimMarker.position.set(x,Math.max(heightAt(this.course,x,z)+.1,3.13),z);
    const points=[];const start=this.ball.position;const arc=club.short==='PT'?0:distance*Math.tan(club.loft*Math.PI/180)*.25;
    for(let i=0;i<=40;i++){const t=i/40,px=start.x+(x-start.x)*t,pz=start.z+(z-start.z)*t;points.push(new THREE.Vector3(px,start.y+(this.aimMarker.position.y-start.y)*t+Math.sin(t*Math.PI)*arc,pz));}
    this.aimLine.geometry.dispose();this.aimLine.geometry=new THREE.BufferGeometry().setFromPoints(points);this.aimLine.computeLineDistances();
  }
  swing(){
    if(this.mode!=='game'||this.paused)return;
    if(this.phase==='combat'){this.addressBall();return;}if(this.phase==='flight'){this.fastFlight=true;return;}if(this.phase!=='aim')return;
    if(!this.charging){this.charging=true;this.chargeTime=0;this.power=.08;this.audio.play('click');return;}
    this.charging=false;this.phase='swing';this.swingElapsed=0;this.contactTime=this.club===7?22/30:34/30;this.swingTimer=this.club===7?1.5:2.17;this.aimLine.visible=false;this.aimMarker.visible=false;
  }
  launchBall(){
    this.strokes++;this.phase='flight';this.flightTime=0;this.fastFlight=false;this.rolling=CLUBS[this.club].short==='PT';this.bounces=0;this.shotOrigin.copy(this.ball.position);this.shotStartLie=this.lie;this.trailPoints=[this.ball.position.clone()];this.trail.visible=true;
    const dispersion=this.rolling?0:(Math.random()-.5)*.012*this.power/this.warrior.precision*(this.lie==='Rough'?1.5:1);const shot=launchShot(CLUBS[this.club],this.warrior,this.lie,this.power,this.aim+dispersion);this.velocity=new THREE.Vector3(shot.x,shot.y,shot.z);this.audio.play(this.rolling?'putt':'swing');this.effects.burst(this.ball.position,8,2,1);this.aimLine.visible=false;this.aimMarker.visible=false;this.stillTime=0;
  }
  updateBall(dt){
    const step=1/120;let remaining=dt;
    while(remaining>0&&this.phase==='flight'){
      const h=Math.min(step,remaining);remaining-=h;this.flightTime+=h;const before=this.ball.position.clone();
      if(!this.rolling){this.velocity.y-=9.81*h;this.velocity.x+=this.course.wind[0]*.22*h;this.velocity.z+=this.course.wind[1]*.22*h;}
      this.ball.position.addScaledVector(this.velocity,h);const p=this.ball.position,ground=heightAt(this.course,p.x,p.z)+BALL_RADIUS,lie=lieAt(this.course,p.x,p.z);
      if(lie==='Water'&&p.y<3.3){this.penalty('Water hazard. One penalty stroke.');return;}
      if(lie==='Out of bounds'&&(p.y<ground+2||this.flightTime>12)){this.penalty('Out of bounds. One penalty stroke.');return;}
      if(p.y<=ground){p.y=ground;
        if(!this.rolling){this.audio.play('land');this.effects.burst(p,5,1.5,1);this.bounces++;if(this.velocity.y< -1.7&&this.bounces<3&&lie!=='Bunker'){this.velocity.y=-this.velocity.y*.27;const retention=this.bounces===1?(.3+CLUBS[this.club].roll*.28):.65;this.velocity.x*=retention;this.velocity.z*=retention;}else{this.velocity.y=0;this.rolling=true;this.velocity.x*=lie==='Bunker'?.18:.68;this.velocity.z*=lie==='Bunker'?.18:.68;}}
      }
      if(this.rolling){p.y=ground;this.velocity.y=0;const friction=lie==='Green'?.95:lie==='Fairway'||lie==='Tee'?1.5:lie==='Bunker'?5.5:3.6;
        const speed=Math.hypot(this.velocity.x,this.velocity.z),newSpeed=Math.max(0,speed-friction*h);if(speed>0){this.velocity.x*=newSpeed/speed;this.velocity.z*=newSpeed/speed;}
        if(newSpeed>.2){const dx=(heightAt(this.course,p.x+.3,p.z)-heightAt(this.course,p.x-.3,p.z))/.6,dz=(heightAt(this.course,p.x,p.z+.3)-heightAt(this.course,p.x,p.z-.3))/.6;this.velocity.x-=dx*5*h;this.velocity.z-=dz*5*h;}
        if(newSpeed<.12){this.velocity.set(0,0,0);this.stillTime+=h;}else this.stillTime=0;
      }
      // Swept cup capture prevents a fast frame from skipping the hole.
      if(p.y< this.world.cup.y+.5){const a=new THREE.Vector2(before.x,before.z),b=new THREE.Vector2(p.x,p.z),cup=new THREE.Vector2(this.world.cup.x,this.world.cup.z),ab=b.clone().sub(a);const t=clamp(cup.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),1e-8),0,1);const d=a.addScaledVector(ab,t).distanceTo(cup);if(d<.32&&this.velocity.length()<6){this.holed();return;}}
      if(this.stillTime>.32||this.flightTime>30){this.land();return;}
    }
    this.trailPoints.push(this.ball.position.clone());if(this.trailPoints.length>100)this.trailPoints.shift();this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(this.trailPoints);
  }
  penalty(message){this.audio.play('water');this.strokes++;this.ball.position.copy(this.shotOrigin);this.ui.toast(message);this.velocity.set(0,0,0);this.phase='aim';this.charging=false;this.power=1;this.lie=this.shotStartLie;this.trail.visible=false;this.aimAtPin();this.placePlayer();this.refreshAim();}
  land(){
    this.velocity.set(0,0,0);this.lie=lieAt(this.course,this.ball.position.x,this.ball.position.z);this.phase='combat';this.enemiesSpawned=0;this.combatTime=0;this.spawnTime=2;this.combo=0;this.comboTime=0;this.cameraYaw=this.aim;this.trail.visible=false;this.fastFlight=false;
    const distance=this.player.root.position.distanceTo(this.ball.position);this.enemyBudget=Math.max(12,Math.min(200,Math.round(distance*.65)+this.hole*20));
    if(distance<12||this.shotStartLie==='Green'){this.phase='aim';this.placePlayer();this.selectBestClub();this.aimAtPin();this.refreshAim();this.power=1;this.ui.toast(this.lie==='Green'?'On the green. Read the line and choose your pace.':'A short walk. Your next shot is ready.');return;}
    this.spawnWave(14);this.ui.achievement('BALL LANDS. BLADES RISE.','The walk begins.',`${Math.round(distance)} metres to your ball. Mind the company.`);this.ui.toast('J / click: fast · K: heavy · L: Musou · Hold C / right mouse to strafe',5500);
  }
  selectBestClub(){const d=this.ball.position.distanceTo(this.world.cup);this.club=d<23&&this.lie==='Green'?7:this.lie==='Bunker'?6:CLUBS.findIndex((c,i)=>i<7&&carryFor(c,this.warrior,this.lie)<d*1.05);if(this.club<0)this.club=6;}
  spawnWave(count){
    const p=this.player.root.position,yaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);
    const sites=chooseAmbushSites(this.world.ambushSites,p,yaw,this.time);if(!sites.length)return;
    for(let i=0;i<count&&this.enemies.filter(e=>!e.dead).length<64&&this.enemiesSpawned<this.enemyBudget;i++){
      const site=sites[i%Math.min(5,sites.length)],slot=this.enemiesSpawned,enemy=new Warrior(slot%5,true);
      // Entrances always begin at visible scenery, then land on a verified dry point.
      const dx=p.x-site.x,dz=p.z-site.z,length=Math.hypot(dx,dz)||1;let x=site.x+dx/length*2.5,z=site.z+dz/length*2.5;
      if(site.kind==='water'){const [px,pz,rx,rz]=this.course.pond;const angle=Math.atan2((site.z-pz)/rz,(site.x-px)/rx);x=px+Math.cos(angle)*rx*1.22;z=pz+Math.sin(angle)*rz*1.22;}
      if(lieAt(this.course,x,z)==='Water'||lieAt(this.course,x,z)==='Out of bounds')continue;
      enemy.root.position.set(site.x,site.y,site.z);enemy.root.visible=false;
      enemy.emerging={site,delay:Math.floor(i/5)*.22+Math.random()*.18,time:0,duration:site.kind==='tree'?1.05:.85,landing:new THREE.Vector3(x,heightAt(this.course,x,z),z)};
      enemy.spawnSite=site.id;enemy.role=slot%3;enemy.slot=slot;enemy.hp=slot%9===0?110:55;enemy.cooldown=.8+Math.random();enemy.strike=0;enemy.speed=4.8+Math.random()*.7;enemy.dead=0;enemy.knockback=new THREE.Vector3();enemy.lift=0;enemy.verticalSpeed=0;this.enemies.push(enemy);this.enemiesSpawned++;site.readyAt=this.time+8;
    }
  }
  clearEnemies(){this.pendingStrike=null;this.action=null;this.attackTimer=0;this.attackBuffer=null;this.lightChain=0;this.cinematic=0;document.body.classList.remove('musou-active');this.ui?.$ ('musou-cinema')?.classList.add('hidden');for(const e of this.enemies)this.scene?.remove(e.root);this.enemies=[];}
  nearbyEnemies(){return this.enemies.filter(e=>!e.dead&&e.root.position.distanceTo(this.player.root.position)<8).length;}
  attack(kind='light'){
    if(this.phase!=='combat'||this.paused||this.cinematic>0)return;
    if(this.action){if(kind!=='musou')this.attackBuffer={kind,expires:this.time+.55};return;}
    if(kind==='musou'){
      if(this.resolve<100){this.ui.toast('Build Resolve by defeating enemies.');return;}
      this.resolve=0;this.cinematic=.95;this.invincible=3.3;this.attackYaw=this.player.root.rotation.y;this.ui.musou(this.warrior);this.audio.play('special');return;
    }
    this.startAttack(kind);
  }
  startAttack(kind){
    if(this.time>(this.chainExpires||0))this.lightChain=0;
    const step=kind==='light'?(this.lightChain||0)%4:Math.max(0,(this.lightChain||0)-1),definition=attackDefinition(kind,step);
    this.action={...definition,kind,step,time:0,hitIndex:0,token:(this.actionSerial=(this.actionSerial||0)+1)};
    this.attackTimer=definition.duration;this.attackYaw=this.player.root.rotation.y;this.comboTime=3;this.chainExpires=this.time+definition.duration+.75;
    this.lightChain=kind==='light'?step+1:0;this.player.wasAttack=false;this.audio.play(kind==='musou'?'special':'sword');
  }
  strike(action){
    this.effects.slash(this.player.root.position,this.attackYaw,action.kind!=='light');let hit=false;
    for(const e of this.enemies){if(e.dead||e.emerging)continue;v1.copy(e.root.position).sub(this.player.root.position);
      if(strikeContains(v1.x,v1.z,this.attackYaw,action.reach,action.arc)){e.hp-=action.damage*this.warrior.damage;hit=true;e.knockback.copy(v1).setY(0).normalize().multiplyScalar(action.kind==='light'?7:14);e.verticalSpeed=action.launch||0;e.strike=0;e.cooldown=1.1;this.effects.burst(e.root.position.clone().add(new THREE.Vector3(0,1.2,0)),action.kind==='light'?20:45,action.kind==='light'?6:11,action.kind==='musou'?2:0);
        if(e.hp<=0){e.dead=.001;this.kills++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.resolve=Math.min(100,this.resolve+7);this.health=Math.min(this.warrior.health,this.health+1.6);}}
    }
    if(hit){this.audio.play('hit');this.shake=action.kind==='light'?.10:.22;}
  }
  updateCombat(dt){
    const input=this.input,p=this.player.root.position;
    if(this.cinematic>0){this.cinematic-=dt;this.player.update(this.time,dt*.15,{cinematic:true});if(this.cinematic<=0){this.ui.$('musou-cinema').classList.add('hidden');document.body.classList.remove('musou-active');this.startAttack('musou');}return;}
    this.combatTime+=dt;this.spawnTime-=dt;this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;this.dodgeTimer=Math.max(0,this.dodgeTimer-dt);this.invincible=Math.max(0,this.invincible-dt);
    if(input.tap('KeyF')){this.cameraYaw=Math.atan2(this.ball.position.x-p.x,this.ball.position.z-p.z);if(!this.action)this.player.root.rotation.y=this.cameraYaw;}
    if(input.tap('ShiftLeft','ShiftRight')&&this.dodgeTimer===0&&this.action?.kind!=='musou'){this.dodgeTimer=.45;this.invincible=.55;this.action=null;this.attackTimer=0;this.attackBuffer=null;this.player.oneShot=0;}
    this.cameraYaw-=input.lookX*.003;this.cameraPitch=clamp(this.cameraPitch+input.lookY*.002,.08,.8);
    const m=input.move;this.camera.getWorldDirection(v1);const movementYaw=Math.atan2(v1.x,v1.z);let {x:dx,z:dz}=cameraRelativeMove(m.x,m.y,movementYaw);
    const pd=p.distanceTo(this.ball.position),moving=Math.hypot(dx,dz)>.1,sprinting=input.down('ShiftLeft','ShiftRight')||input.padSprint;
    this.focused=input.focused;const speed=(this.dodgeTimer>.18?11:sprinting?8:this.focused?5.3:5.6)*this.warrior.speed*(this.action?.kind==='musou'?.2:this.action?.45:1);
    const norm=Math.max(1,Math.hypot(dx,dz));dx/=norm;dz/=norm;this.playerVelocity={x:dx*speed,z:dz*speed};
    let mx=dx*speed,mz=dz*speed;
    if(this.action){this.action.time+=dt;this.attackTimer=Math.max(0,this.action.duration-this.action.time);const a=this.action;const lunge=Math.sin(Math.min(1,a.time/a.duration)*Math.PI)*a.lunge;mx+=Math.sin(this.attackYaw)*lunge;mz+=Math.cos(this.attackYaw)*lunge;
      while(a.hitIndex<a.hits.length&&a.time>=a.hits[a.hitIndex]){this.strike(a);a.hitIndex++;}
    }
    const x=clamp(p.x+mx*dt,-230,145),z=clamp(p.z+mz*dt,-80,this.course.length+100);
    if(lieAt(this.course,x,z)!=='Water'){p.x=x;p.z=z;}else if(lieAt(this.course,x,p.z)!=='Water')p.x=x;else if(lieAt(this.course,p.x,z)!=='Water')p.z=z;
    if(this.action)this.player.root.rotation.y=this.attackYaw;
    else if(this.focused)this.player.root.rotation.y=turnToward(this.player.root.rotation.y,this.cameraYaw,dt*20);
    else if(moving)this.player.root.rotation.y=turnToward(this.player.root.rotation.y,Math.atan2(dx,dz),dt*18);
    p.y=heightAt(this.course,p.x,p.z);
    if(moving){this.stepTime=(this.stepTime||0)+dt;if(this.stepTime>(sprinting?.26:.37)){this.audio.play('step');this.stepTime=0;}}
    if(input.tap('KeyJ','Mouse0'))this.attack('light');if(input.tap('KeyK'))this.attack('heavy');if(input.tap('KeyL'))this.attack('musou');
    this.player.update(this.time,dt,{moving,sprinting,dodge:this.dodgeTimer>.1,attack:this.attackTimer,action:this.action,focused:this.focused,moveAngle:Math.atan2(dx,dz)-this.player.root.rotation.y});
    if(this.action){const [hilt,tip]=this.player.weaponPoints();this.effects.trail(hilt,tip,this.action.kind==='musou'?2:0);if(this.attackTimer<=0){this.action=null;const queued=this.attackBuffer;this.attackBuffer=null;if(queued&&queued.expires>=this.time)this.startAttack(queued.kind);}}
    if(this.spawnTime<=0&&pd>11){this.spawnWave(10+this.hole*2);this.spawnTime=3.5;}
    for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];
      if(e.emerging){const a=e.emerging;a.delay-=dt;if(a.delay>0)continue;
        if(a.time===0){e.root.visible=true;this.effects.burst(e.root.position, a.site.kind==='tree'?14:45,6,a.site.kind==='water'?3:a.site.kind==='sand'?4:1);}
        a.time+=dt;const t=clamp(a.time/a.duration,0,1),startY=a.site.y+(a.site.kind==='tree'?a.site.height: a.site.kind==='water'||a.site.kind==='sand'?-.8:.1);
        e.root.position.set(THREE.MathUtils.lerp(a.site.x,a.landing.x,t),THREE.MathUtils.lerp(startY,a.landing.y,t)+Math.sin(t*Math.PI)*(a.site.kind==='tree'?.3:1.8),THREE.MathUtils.lerp(a.site.z,a.landing.z,t));e.root.rotation.y=Math.atan2(p.x-e.root.position.x,p.z-e.root.position.z);e.update(this.time,dt,{emerging:{progress:t}});
        if(t>=1){e.emerging=null;e.oneShot=0;this.effects.burst(e.root.position,12,3,a.site.kind==='sand'?4:1);}continue;
      }
      e.lift=Math.max(0,(e.lift||0)+(e.verticalSpeed||0)*dt);e.verticalSpeed=(e.verticalSpeed||0)-15*dt;if(e.lift===0)e.verticalSpeed=0;
      if(e.knockback.lengthSq()>.1){const nx=e.root.position.x+e.knockback.x*dt,nz=e.root.position.z+e.knockback.z*dt;if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;}e.knockback.multiplyScalar(Math.exp(-7*dt));}
      if(e.dead){e.dead+=dt;e.root.position.y=heightAt(this.course,e.root.position.x,e.root.position.z)+e.lift;e.update(this.time,dt,{});if(e.dead>1.3){this.scene.remove(e.root);this.enemies.splice(i,1);}continue;}
      const distance=Math.hypot(p.x-e.root.position.x,p.z-e.root.position.z);e.cooldown-=dt;
      if(distance>90){this.scene.remove(e.root);this.enemies.splice(i,1);continue;}
      if(distance>1.8&&e.strike<=0&&e.lift<.1){const target=interceptTarget({x:e.root.position.x,z:e.root.position.z,role:e.role,slot:e.slot},p,this.playerVelocity);v1.set(target.x-e.root.position.x,0,target.z-e.root.position.z).normalize();e.moveYaw=Math.atan2(v1.x,v1.z);const speed=e.speed*(distance>9?1.65:1);const nx=e.root.position.x+v1.x*speed*dt,nz=e.root.position.z+v1.z*speed*dt;if(lieAt(this.course,nx,nz)!=='Water'){e.root.position.x=nx;e.root.position.z=nz;}else{const tx=e.root.position.x+v1.z*speed*dt,tz=e.root.position.z-v1.x*speed*dt;if(lieAt(this.course,tx,tz)!=='Water'){e.root.position.x=tx;e.root.position.z=tz;}}}
      for(let j=0;j<i;j++){const other=this.enemies[j];if(other.dead||other.emerging)continue;v2.copy(e.root.position).sub(other.root.position);v2.y=0;const d=v2.length();if(d<1.15&&d>.001){const sx=e.root.position.x+v2.x*(1.15-d)/d*dt*4,sz=e.root.position.z+v2.z*(1.15-d)/d*dt*4;if(lieAt(this.course,sx,sz)!=='Water'){e.root.position.x=sx;e.root.position.z=sz;}}}
      e.root.position.y=heightAt(this.course,e.root.position.x,e.root.position.z)+e.lift;e.root.rotation.y=turnToward(e.root.rotation.y,distance>4&&e.strike<=0?(e.moveYaw??0):Math.atan2(p.x-e.root.position.x,p.z-e.root.position.z),dt*12);
      if(distance<3.3&&e.cooldown<=0&&e.lift<.1){e.strike=.72;e.cooldown=1.6+Math.random();}
      if(e.strike>0){const before=e.strike;e.strike-=dt;if(before>.22&&e.strike<=.22&&distance<3.6&&this.invincible<=0){this.health-=e.slot%9===0?13:7;this.invincible=.32;this.audio.play('hurt');this.shake=.17;this.ui.$('damage-flash').style.opacity='1';setTimeout(()=>this.ui.$('damage-flash').style.opacity='0',170);}}
      e.update(this.time,dt,{moving:distance>2&&e.strike<=0,sprinting:distance>9,attack:e.strike>0?e.strike/.72:0});
    }
    if(this.health<=0){this.health=this.warrior.health;this.strokes++;this.clearEnemies();this.resolve=Math.max(50,this.resolve);this.invincible=3;this.spawnTime=6;this.ui.achievement('A MINOR SETBACK','Rise again.','One penalty stroke. Your honor is mostly intact.');}
    if(input.tap('Space')&&!this.action)this.addressBall();
  }
  addressBall(){if(this.phase!=='combat')return;const distance=this.player.root.position.distanceTo(this.ball.position);if(distance>5){this.ui.toast('Reach your ball before taking the next shot.');return;}if(this.nearbyEnemies()>0){this.ui.toast('Clear the enemies near you before your next shot.');return;}
    this.clearEnemies();this.phase='aim';this.charging=false;this.power=1;this.lie=lieAt(this.course,this.ball.position.x,this.ball.position.z);this.aimAtPin();this.placePlayer();this.selectBestClub();this.refreshAim();this.cameraYaw=this.aim;this.health=Math.min(this.warrior.health,this.health+20);this.ui.toast('A clear lie. A fresh start.');}
  holed(){this.phase='holed';this.ball.position.copy(this.world.cup);this.ball.visible=false;this.trail.visible=false;this.clearEnemies();this.audio.play('cup');this.scores[this.hole]=this.strokes;this.effects.burst(this.world.cup.clone().add(new THREE.Vector3(0,2,0)),50,8,0);this.ui.achievement(`HOLE ${this.hole+1} COMPLETE`,scoreName(this.strokes,this.course.par),`${this.strokes} strokes · Par ${this.course.par}`);this.save();this.scoreTimer=setTimeout(()=>{if(this.phase==='holed'&&this.mode==='game')this.ui.scorecard(this);},2000);}
  nextHole(){if(this.hole>=2){this.scores=[];this.kills=0;this.bestCombo=0;this.resolve=35;this.loadHole(0);}else this.loadHole(this.hole+1);this.paused=false;this.save();this.audio.start();this.ui.toast(this.course.subtitle,4500);}
  togglePause(){if(this.mode!=='game'){this.ui.help();return;}if(this.phase==='holed')return;if(this.paused){this.resume();return;}this.paused=true;this.input.clear();this.audio.pause();this.ui.pause(this);}
  resume(){this.paused=false;this.ui.closeModal();this.input?.clear();this.audio.resume();}
  setQuality(q){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='high'?2:1.5));this.renderer.shadowMap.enabled=q!=='low';this.renderer.setSize(innerWidth,innerHeight);this.rendering.resize();this.ui.toast(`Graphics: ${q==='low'?'performance':q==='high'?'high quality':'balanced'}`);}
  save(){try{localStorage.setItem('ninja-golf-save',JSON.stringify({version:1,scores:this.scores,playerIndex:this.playerIndex,kills:this.kills,bestCombo:this.bestCombo,nextHole:Math.min(3,this.scores.length)}));}catch{/* Storage can be unavailable in private browser contexts. */}}
  restoreOffer(){this.ui.$('continue-round')?.remove();try{const save=JSON.parse(localStorage.getItem('ninja-golf-save'));if(save?.version===1&&Array.isArray(save.scores)&&save.nextHole>0&&save.nextHole<3&&save.scores.length===save.nextHole&&save.scores.every(x=>Number.isInteger(x)&&x>0)&&WARRIORS[save.playerIndex]){
      const btn=document.createElement('button');btn.className='text-button';btn.id='continue-round';btn.textContent=`Continue saved round · Hole ${save.nextHole+1} →`;btn.style.display='block';btn.style.marginTop='12px';this.ui.$('play').after(btn);btn.onclick=()=>{this.selectWarrior(save.playerIndex);this.scores=save.scores;this.kills=save.kills||0;this.bestCombo=save.bestCombo||0;this.mode='game';this.paused=false;this.loadHole(save.nextHole);this.ui.showScreen('game');this.audio.start();};}}catch{/* Ignore an invalid or missing save. */}}
  updateCamera(dt){
    const p=this.player.root.position,b=this.ball.position;let speed=3.5;
    if(this.mode==='home'){const a=this.time*.011;camTarget.set(91+Math.sin(a)*13,75+Math.sin(a*.7)*4,-90+Math.cos(a)*8);camLook.set(-15,10,155);speed=.7;}
    else if(this.mode==='selection'){camTarget.set(p.x+1,p.y+2.4,p.z+9);camLook.set(p.x-2.6,p.y+1.9,p.z);speed=3;}
    else if(this.phase==='flight'){const dir=this.velocity.clone().normalize();const height=this.rolling?4:7;camTarget.copy(b).add(new THREE.Vector3(-Math.sin(this.aim)*13+6,height,-Math.cos(this.aim)*13));camLook.copy(b).addScaledVector(dir,3);speed=this.fastFlight?12:5;}
    else if(this.phase==='combat'&&this.cinematic>0){
      this.player.root.updateMatrixWorld(true);this.player.bones.Head.getWorldPosition(camLook);const yaw=this.attackYaw;const zoom=1.55+this.cinematic*.45;
      camTarget.copy(camLook).add(new THREE.Vector3(Math.sin(yaw)*zoom+Math.cos(yaw)*.30,.02,Math.cos(yaw)*zoom-Math.sin(yaw)*.30));speed=28;
    }
    else if(this.phase==='combat'){const distance=7.7;camTarget.set(p.x-Math.sin(this.cameraYaw)*distance,p.y+2.2+this.cameraPitch*4.5,p.z-Math.cos(this.cameraYaw)*distance);camLook.set(p.x+Math.sin(this.cameraYaw)*4,p.y+1.6,p.z+Math.cos(this.cameraYaw)*4);speed=7;}
    else if(this.phase==='holed'){camTarget.copy(this.world.cup).add(new THREE.Vector3(Math.sin(this.time*.2)*14,8,-13));camLook.copy(this.world.cup).add(new THREE.Vector3(0,1,0));speed=2;}
    else{const d=this.club===7?7.4:12.5;camTarget.set(b.x-Math.sin(this.aim)*d+Math.cos(this.aim)*3,b.y+(this.club===7?4.3:5.0),b.z-Math.cos(this.aim)*d-Math.sin(this.aim)*3);camLook.set(b.x+Math.sin(this.aim)*25,b.y+1,b.z+Math.cos(this.aim)*25);speed=4;}
    camTarget.y=Math.max(camTarget.y,heightAt(this.course,camTarget.x,camTarget.z)+(this.cinematic>0?1.1:1.8));this.camera.position.lerp(camTarget,1-Math.exp(-speed*dt));this.currentLook.lerp(camLook,1-Math.exp(-speed*dt));if(this.shake>0){this.shake-=dt;this.camera.position.x+=(Math.random()-.5)*this.shake*2;this.camera.position.y+=(Math.random()-.5)*this.shake;}
    this.camera.lookAt(this.currentLook);
  }
  frame(){
    const now=performance.now();const realDt=(now-this.previousTime)/1000;const dt=Math.min(realDt,.05);this.previousTime=now;this.input.poll(dt,this.phase==='combat');
    if(this.input.tap('Escape')&&!(this.mode==='game'&&this.phase==='holed')){if(!this.ui.$('modal').classList.contains('hidden')){this.ui.closeModal();if(this.paused)this.resume();}else this.togglePause();}
    this.audio.setMode(this.mode==='game'&&this.phase==='combat'?'combat':'course');
    if(!this.paused){this.time+=dt;this.world.update(this.time,dt,this.mode==='game'?this.player.root.position:null);this.effects.update(dt,this.phase!=='combat');
      if(this.mode==='game'){
        if(this.phase==='aim'){
          const horizontal=(this.input.down('KeyD','ArrowRight')?1:0)-(this.input.down('KeyA','ArrowLeft')?1:0)+(this.input.padX||0);const change=aimDelta(horizontal,dt)-this.input.lookX*.0018;
          if(change){this.aim+=change;this.placePlayer();this.refreshAim();}
          if(this.input.tap('KeyQ'))this.changeClub(-1);if(this.input.tap('KeyE'))this.changeClub(1);
          if(this.input.tap('Space'))this.swing();
          if(this.charging){this.chargeTime+=dt;this.power=.08+.92*(.5-.5*Math.cos(this.chargeTime*2.5));this.refreshAim();}
          this.player.update(this.time,dt,{golf:true});
        }else if(this.phase==='swing'){
          this.swingElapsed+=dt;this.swingTimer=Math.max(0,this.swingTimer-dt);this.player.update(this.time,dt,{golf:true,swing:1,putting:this.club===7});if(this.swingElapsed>=this.contactTime)this.launchBall();
        }else if(this.phase==='flight'){
          if(this.input.tap('Space'))this.fastFlight=true;this.updateBall(dt*(this.fastFlight?3:1));this.swingTimer=Math.max(0,this.swingTimer-dt);this.player.update(this.time,dt,{golf:true,swing:this.swingTimer>0?1:0,putting:this.club===7});
        }else if(this.phase==='combat')this.updateCombat(dt);
        this.uiTime+=dt;if(this.uiTime>.05){this.ui.update(this,this.uiTime);this.uiTime=0;}
      }else if(this.mode==='selection')this.player.update(this.time,dt,{});
      this.updateCamera(dt);
    }
    this.ballGlow.position.copy(this.ball.position);this.ballGlow.position.y=heightAt(this.course,this.ball.position.x,this.ball.position.z)+.07;this.ballGlow.visible=this.mode==='game'&&this.phase!=='flight'&&this.phase!=='holed';this.ballGlow.scale.setScalar(1+Math.sin(this.time*2)*.08);
    this.ballBeacon.position.copy(this.ball.position).add(new THREE.Vector3(0,5.5,0));this.ballBeacon.visible=this.mode==='game'&&this.phase==='combat';this.aimLine.visible=this.aimMarker.visible=this.mode==='game'&&this.phase==='aim';
    this.crowd.update(this.enemies);this.rendering.render(this.quality);this.input.end();this.frameCount++;this.fpsTime+=realDt;if(this.fpsTime>1.2){this.ui.$('performance').textContent=`${Math.round(this.frameCount/this.fpsTime)} FPS`;this.frameCount=0;this.fpsTime=0;}
  }
}
async function boot(){try{document.querySelector('#app').innerHTML='<div class="loading-screen"><div class="brand-mark">忍</div><h2>Preparing the course.</h2><p id="loading-detail">Loading rigged warriors and animations…</p></div>';await loadWarriorAssets((done,total)=>{document.getElementById('loading-detail').textContent=`Preparing warriors · ${done} / ${total}`;});new Game();}catch(error){console.error(error.stack||error);document.querySelector('#app').insertAdjacentHTML('beforeend',`<div style="position:fixed;inset:0;display:grid;place-content:center;background:#19362f;color:#eee;padding:40px;font-family:Arial"><h1 style="font-size:36px;letter-spacing:0">The course could not load.</h1><p>Reload the page. If this continues, try a browser with WebGL 2 enabled.</p><button onclick="location.reload()" style="padding:16px">Try again</button></div>`);}}
boot();
