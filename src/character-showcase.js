import {ShowcaseClock,showcaseStages} from './showcase-clock.js';
import {attackDefinition} from './combat.js';
import {withMotionTiming} from './attack-timing.js';
import {combatMotionName,motions} from './motion.js';
import {WARRIORS} from './warriors.js';

export class CharacterShowcase{
 constructor(actor,{speed=1,paused=false}={}){
  this.actor=actor;this.warrior=WARRIORS[actor.type];
  for(const kind of ['light','heavy'])this[kind]=withMotionTiming(attackDefinition(kind,0,this.warrior.combatStyle),motions[combatMotionName(this.warrior,kind,0)]);
  this.swingDuration=actor.actions.get('Golf_Swing').getClip().duration;
  this.clock=new ShowcaseClock(showcaseStages(this.swingDuration,this.light.duration,this.heavy.duration));this.clock.setSpeed(speed);
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
  this.actor.mixer.stopAllAction();this.actor.current='';this.actor.oneShot=0;
  return this.render(0);
 }
 render(step){
  const stage=this.clock.stage,elapsed=this.clock.elapsed,golf=!!stage.golf;
  let clip=golf?'Golf_Address':this.warrior.readyClip,time=elapsed,action=null;
  if(['swing','follow','golf-out'].includes(stage.id)){clip='Golf_Swing';time=stage.id==='swing'?elapsed:this.swingDuration-1e-5;}
  if(stage.id==='light'||stage.id==='heavy'){
   const definition=stage.id==='light'?this.light:this.heavy;clip=combatMotionName(this.warrior,stage.id,0);
   time=elapsed/definition.duration*motions[clip].duration;
   action={...definition,kind:stage.id,step:0,time:elapsed,token:this.clock.cycle*2+(stage.id==='light'?1:2)};
  }
  const duration=this.actor.actions.get(clip).getClip().duration;
  this.actor.update(this.clock.time,step,{golf,action,previewPose:{clip,time:Math.min(time,duration-1e-5)}});
  for(const [original,material]of this.materials)material.opacity=original.opacity*this.clock.opacity;
  return this.state;
 }
 get state(){return{label:this.clock.stage.label,stage:this.clock.stage.id,time:this.clock.elapsed,duration:this.clock.stage.duration,speed:this.clock.speed,paused:this.clock.paused};}
 dispose(){for(const [mesh,material]of this.originalMaterials)mesh.material=material;for(const material of this.materials.values())material.dispose();this.originalMaterials=[];this.materials.clear();}
}
