import {ShowcaseClock,showcaseStages} from './showcase-clock.js';
import {combatMotionName,motions} from './motion.js';
import {WARRIORS} from './warriors.js';
import {buildShowcaseAttacks,showcaseAttackFrame,showcaseAttackTravel} from './showcase-attacks.js';

export class CharacterShowcase{
 constructor(actor,{speed=1,paused=false,groundHeight=null}={}){
  this.groundHeight=groundHeight;this.actor=actor;this.warrior=WARRIORS[actor.type];this.origin=actor.root.position.clone();this.baseYaw=actor.root.rotation.y;
  const attacks=buildShowcaseAttacks(this.warrior,motions,combatMotionName);this.performances=attacks.performances;
  this.swingDuration=actor.actions.get('Golf_Swing').getClip().duration;
  this.clock=new ShowcaseClock(showcaseStages(this.swingDuration,this.performances.light.duration,this.performances.heavy.duration),attacks.inspection);
  this.choices=[...this.clock.stages.filter(s=>['address','swing','ready','light','heavy'].includes(s.id)),...attacks.inspection].map(({id,label})=>({id,label}));this.clock.setSpeed(speed);
  this.originalMaterials=[];this.materials=new Map();
  // Preview fades own their materials. Shared gameplay materials stay intact.
  actor.root.traverse(mesh=>{if(!mesh.isMesh)return;const original=mesh.material;this.originalMaterials.push([mesh,original]);const clone=material=>{if(!this.materials.has(material)){const copy=material.clone();copy.onBeforeCompile=material.onBeforeCompile;copy.customProgramCacheKey=material.customProgramCacheKey;copy.alphaHash=true;this.materials.set(material,copy);}return this.materials.get(material);};mesh.material=Array.isArray(original)?original.map(clone):clone(original);});
  actor.handGrip?.restore();actor.travelPose?.reset();actor.mixer.stopAllAction();actor.current='';actor.oneShot=0;
  this.update(0);this.clock.paused=paused;
 }
 update(dt){
  if(this.clock.paused)return this.state;
  return this.render(this.clock.advance(dt));
 }
 seek(stageId,seconds=0){
  this.clock.seek(stageId,seconds);
  // A scrub is an exact pose request. Do not leave an outgoing clip fading in.
  this.actor.mixer.stopAllAction();this.actor.current='';this.actor.oneShot=0;this.actor.actionToken=null;
  return this.render(0);
 }
 togglePause(){
  if(this.clock.paused&&this.clock.inspection&&this.clock.elapsed>=this.clock.stage.duration)this.seek(this.clock.stage.id,0);
  this.clock.paused=!this.clock.paused;return this.state;
 }
 render(step){
  const stage=this.clock.stage,elapsed=this.clock.elapsed,golf=!!stage.golf;
  this.actor.root.rotation.y=this.baseYaw;this.actor.root.visible=true;
  let clip=golf?'Golf_Address':this.warrior.readyClip,time=elapsed,action=null;
  if(['swing','follow','golf-out'].includes(stage.id)){clip='Golf_Swing';time=stage.id==='swing'?elapsed:this.swingDuration-1e-5;}
  const performance=this.performances[stage.id];let frame=null;
  if(performance){
   frame=showcaseAttackFrame(performance,elapsed,`showcase:${this.clock.cycle}:${stage.id}`);action=frame.action;clip=action.motionName;
   time=action.time/action.duration*motions[clip].duration;this.actor.root.rotation.y=this.baseYaw+frame.heading;
  }
  this.actor.root.position.copy(this.origin);
  // Automatic playback retains completed travel until its golf fade. A direct
  // inspection starts from the same origin, independently of the prior motion.
  for(const kind of this.clock.inspection?[stage.id]:['light','heavy']){
   const index=this.clock.stages.findIndex(s=>s.id===kind),record=this.performances[kind];
   if(!golf&&(this.clock.inspection||this.clock.index>=index)){
    const t=this.clock.inspection||this.clock.index===index?elapsed:record.duration;
    const delta=showcaseAttackTravel(record,t,this.baseYaw,this.actor.root.scale.x);
    this.actor.root.position.x+=delta.x;this.actor.root.position.z+=delta.z;
   }
  }
  if(this.groundHeight)this.actor.root.position.y=this.groundHeight(this.actor.root.position.x,this.actor.root.position.z);
  const duration=this.actor.actions.get(clip).getClip().duration;
  this.actor.update(this.clock.time,step,{golf,action,groundHeight:this.groundHeight,...(!action||step===0?{previewPose:{clip,time:Math.min(time,duration-1e-5)}}:{})});
  this.actor.root.visible=!frame?.hidden;
  for(const [original,material]of this.materials)material.opacity=original.opacity*this.clock.opacity;
  return this.state;
 }
 get state(){return{label:this.clock.stage.label,stage:this.clock.stage.id,time:this.clock.elapsed,duration:this.clock.stage.duration,speed:this.clock.speed,paused:this.clock.paused,choices:this.choices};}
 dispose(){this.actor.root.rotation.y=this.baseYaw;this.actor.root.visible=true;this.actor.root.position.copy(this.origin);for(const [mesh,material]of this.originalMaterials)mesh.material=material;for(const material of this.materials.values())material.dispose();this.originalMaterials=[];this.materials.clear();}
}
