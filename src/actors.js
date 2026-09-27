import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {finishCharacterMaterial,awaitCharacterMaterials} from './character-materials.js';
import { WARRIORS } from './warriors.js';
import { createWeapon } from './weapons.js';
import { motions, sampleMotion, combatMotionName } from './motion.js';
import locomotion from './locomotion-data.json';
import { ENEMY_TYPES } from './combat.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
export { Effects } from './effects.js';
// Refresh revised rigs in browsers that cached the previous release's model URLs.
const MODEL_REVISION='human-running-1';
const GUARD_PREFIX={odachi:'Odachi',twin:'Twin',naginata:'Naginata',fan:'Fan',ring:'Ring',sickle:'Sickle'};
const templates=[];
const retargeted=new Map();
const motionSources=[];
const materials=new Map();
const geometries=new Map();
const q=new THREE.Quaternion();
const shaftDirection=new THREE.Vector3(),axisY=new THREE.Vector3(0,1,0);
export const PALM_GRIP=new THREE.Vector3(-.028,.096,0);
export const PALM_GRIPS={r:PALM_GRIP,l:new THREE.Vector3(.028,.096,0)};
const handRotation=new THREE.Quaternion(),rootRotation=new THREE.Quaternion(),gripPosition=new THREE.Vector3();
const rootInverse=new THREE.Matrix4(),decomposedPosition=new THREE.Vector3(),decomposedScale=new THREE.Vector3();
export async function loadWarriorAssets(progress=()=>{}) {
  const loader=new GLTFLoader();let done=0;
  const characterCount=WARRIORS.length+ENEMY_TYPES.length;
  const urls=[...WARRIORS.map(w=>w.model),...ENEMY_TYPES.map(e=>e.model),'warrior-motion','golf-motion'];
  const results=await Promise.all(urls.map(async name=>{const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb?v=${MODEL_REVISION}`);progress(++done,urls.length);return model;}));
  const clipNames=new Set(results.slice(characterCount).flatMap(model=>model.animations.map(clip=>clip.name)));
  for(const name of ['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Golf_Address','Golf_Swing','Golf_Putt'])if(!clipNames.has(name))throw new Error(`Missing warrior animation: ${name}`);
  for(const [i,warrior]of WARRIORS.entries())for(const phase of ['Loop','Impact','Break','Walk_Forward','Walk_Right','Walk_Backward','Walk_Left']){const name=`${GUARD_PREFIX[warrior.weaponKind]}_Guard_${phase}`;if(!results[i].animations.some(clip=>clip.name===name))throw new Error(`Missing native guard animation ${name} in ${warrior.model}.glb`);}
  for(const [i,warrior]of WARRIORS.entries())for(const name of Object.keys(locomotion))if(!results[i].animations.some(clip=>clip.name===name))throw new Error(`Missing native locomotion ${name} in ${warrior.model}.glb`);
  templates.push(...results.slice(0,characterCount));motionSources.push(...results.slice(characterCount));
  for(const model of templates)model.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(/eyebrow/i.test(o.name)){mat.color.set('#34241b');mat.map=null;mat.roughness=.9;}finishCharacterMaterial(mat);if(mat.map)mat.map.anisotropy=8;if(mat.normalMap)mat.normalMap.anisotropy=4;mat.envMapIntensity=.6;}}});
  await awaitCharacterMaterials();
}
function mat(color,metal=0){const key=color+metal;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.28:.78,metalness:metal}));return materials.get(key);}
function part(parent,kind,color,x,y,z,sx,sy,sz,metal=0){if(!geometries.has(kind))geometries.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,10));const mesh=new THREE.Mesh(geometries.get(kind),mat(color,metal));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;}
function clipsFor(index){
  if(retargeted.has(index))return retargeted.get(index);
  // Native human clips retain each model's actual limb lengths and joint axes.
  if(templates[index].animations.length){retargeted.set(index,templates[index].animations);return templates[index].animations;}
  const target=templates[index].scene,clips=[];target.updateMatrixWorld(true);
  for(const source of motionSources){source.scene.updateMatrixWorld(true);
    for(const original of source.animations){const clip=original.clone();const tracks=[];
      for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),prop=track.name.slice(dot+1);const dst=target.getObjectByName(name),src=source.scene.getObjectByName(name);if(!dst||!src)continue;
        if(prop==='quaternion'){
          // Express source motion relative to its bind pose, then apply the target bind pose.
          const correction=dst.quaternion.clone().multiply(src.quaternion.clone().invert());
          for(let i=0;i<track.values.length;i+=4){q.fromArray(track.values,i).premultiply(correction).normalize().toArray(track.values,i);}tracks.push(track);
        }else if(prop==='scale'){tracks.push(track);
        }else if(prop==='position'&&(name==='pelvis'||name==='root')){
          const ratio=name==='pelvis'?dst.position.length()/Math.max(.001,src.position.length()):1;
          for(let i=0;i<track.values.length;i+=3){track.values[i]=dst.position.x+(track.values[i]-src.position.x)*ratio;track.values[i+1]=dst.position.y+(track.values[i+1]-src.position.y)*ratio;track.values[i+2]=dst.position.z+(track.values[i+2]-src.position.z)*ratio;}tracks.push(track);
        }
      }
      clip.tracks=tracks;clips.push(clip);
    }
  }
  retargeted.set(index,clips);return clips;
}
export class Warrior {
  constructor(type=0,enemy=false){
    this.type=type;this.enemy=enemy;this.dead=0;this.root=new THREE.Group();const index=enemy?WARRIORS.length+type:type;
    this.model=cloneSkeleton(templates[index].scene);this.root.add(this.model);this.root.scale.setScalar(enemy?1.1:1.1);
    this.rigMetadata={};this.model.traverse(o=>{if(o.userData.nativeMotion)this.rigMetadata=o.userData;});
    this.nativeHuman=!!this.rigMetadata.nativeMotion;
    this.palmGrips={r:new THREE.Vector3().fromArray(this.rigMetadata.palmGripR||PALM_GRIPS.r.toArray()),l:new THREE.Vector3().fromArray(this.rigMetadata.palmGripL||PALM_GRIPS.l.toArray())};
    this.shaftAxes={r:new THREE.Vector3().fromArray(this.rigMetadata.shaftAxisR||[0,0,1]),l:new THREE.Vector3().fromArray(this.rigMetadata.shaftAxisL||[0,0,1])};
    this.bones={};this.ownedMaterials=[];this.resolveTargets=[];this.model.traverse(o=>{if(o.morphTargetDictionary?.Resolve!==undefined)this.resolveTargets.push([o,o.morphTargetDictionary.Resolve]);if(o.isBone)this.bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(enemy){o.material=o.material.clone();finishCharacterMaterial(o.material);this.ownedMaterials.push(o.material);if(/Woven|Silk|Indigo/.test(o.material.name))o.material.color.set(['#344b58','#6b3128','#7b7450','#574767'][type%4]);if(/brass/i.test(o.material.name))o.material.color.set('#555b51');}}});
    this.root.updateMatrixWorld(true);
    if(this.nativeHuman)for(const side of ['r','l']){const grip=this.model.getObjectByName('PalmGrip_'+side),shaft=this.model.getObjectByName('PalmShaft_'+side),hand=this.bones['hand_'+side];if(grip&&shaft){this.palmGrips[side].copy(hand.worldToLocal(grip.getWorldPosition(new THREE.Vector3())));this.shaftAxes[side].copy(hand.worldToLocal(shaft.getWorldPosition(new THREE.Vector3()))).sub(this.palmGrips[side]).normalize();}}
    this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map(clipsFor(index).map(c=>[c.name,this.mixer.clipAction(c)]));this.current='';this.oneShot=0;this.wasAttack=false;this.wasSwing=false;
    const hand=this.bones.hand_r;
    this.weapon=createWeapon(enemy?ENEMY_TYPES[type].weapon:WARRIORS[type].weaponKind);this.weapon.position.set(0,.05,0);this.weapon.rotation.set(Math.PI/2,0,0);hand.add(this.weapon);
    if(!enemy&&WARRIORS[type].dualWield||enemy&&type===0){this.offhand=createWeapon(enemy?'scout':'twin');this.offhand.position.set(0,.05,0);this.offhand.rotation.set(Math.PI/2,0,0);this.bones.hand_l.add(this.offhand);}
    this.club=new THREE.Group();this.club.position.set(0,.04,0);this.root.add(this.club);
    part(this.club,'cyl','#252a27',0,.04,0,.018,.20,.018);part(this.club,'cyl','#b7c4c2',0,.60,0,.008,1.0,.008,.85);const head=part(this.club,'cyl','#3c4947',.047,1.12,0,.065,.07,.08,.8);head.rotation.z=-.15;this.club.visible=false;
    // A small bag and real club shafts retain the golf silhouette without obscuring the armor.
    const back=this.bones.spine_03;const bag=new THREE.Group();bag.position.set(.13,.03,-.18);bag.rotation.z=.22;back.add(bag);part(bag,'cyl','#4b4434',0,-.13,0,.083,.49,.083);for(let i=0;i<3;i++){part(bag,'cyl','#a5b1ad',-.045+i*.04,.18,0,.006,.39,.006,.6);part(bag,'box','#9ca9a5',-.025+i*.04,.37,0,.065,.03,.03,.75);}
    if(enemy||this.nativeHuman)bag.visible=false;
    this.overlays=[];this.coreScales=[];this.restModelRotation=this.model.quaternion.clone();this.tip=new THREE.Vector3();this.hilt=new THREE.Vector3();
    this.play(this.nativeHuman?'Golf_Address':'Idle_Loop',0);this.mixer.update(this.nativeHuman?0:Math.random()*.7);
    this.closedFingerGroups={r:[],l:[]};for(const bone of Object.values(this.bones))if(/^(index|middle|ring|pinky|thumb)_/.test(bone.name)){const side=bone.name.endsWith('_r')?'r':'l';this.closedFingerGroups[side].push([bone,bone.quaternion.clone()]);}
    if(this.nativeHuman){this.mixer.stopAllAction();this.current='';this.play('Idle_Loop',0);this.mixer.update(0);}
    if(!enemy&&WARRIORS[type].readyClip&&this.actions.has(WARRIORS[type].readyClip)){this.play(WARRIORS[type].readyClip,0);this.mixer.update(0);}this.syncHeldObjects();
  }
  play(name,fade=.16,once=false,speed=1){if(this.running){for(const run of this.runActions)run.fadeOut(fade);this.running=false;}if(this.guardWalking&&!name.includes('_Guard_Walk_')){for(const walk of this.guardWalkActions)walk.fadeOut(fade);this.guardWalking=false;}const next=this.actions.get(name);if(!next)return;if(this.current===name&&!once)return;const previous=this.actions.get(this.current);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(speed);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(previous&&previous!==next){previous.fadeOut(fade);next.fadeIn(fade);}this.current=name;this.oneShot=once?next.getClip().duration/speed:0;}
  stepGuard(prefix,angle,speed,dt){
    if(this.running){for(const action of this.runActions)action.fadeOut(.1);this.running=false;}
    const names=['Forward','Right','Backward','Left'].map(direction=>`${prefix}_Guard_Walk_${direction}`);
    const direction=[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))];
    // Shorter side steps need proportionally more weight and a faster cadence.
    // This keeps the planted foot opposite the actual travel vector, including diagonals.
    const raw=direction.map((amount,i)=>amount/motions[names[i]].walkSpeed),sum=raw.reduce((a,b)=>a+b,0),weights=raw.map(value=>value/sum);
    const clip=motions[names[0]],rate=speed*sum/this.root.scale.x;
    this.guardWalkPhase=((this.guardWalkPhase||0)+dt*rate/clip.duration)%1;
    if(!this.guardWalking){this.actions.get(this.current)?.fadeOut(.1);this.guardWalkActions=names.map(name=>this.actions.get(name));for(const action of this.guardWalkActions){action.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveTimeScale(0).play();}this.guardWalking=true;this.guardWalkBlend=0;}
    this.guardWalkBlend=Math.min(1,this.guardWalkBlend+dt/.1);
    this.guardWalkActions.forEach((action,i)=>{action.time=this.guardWalkPhase*clip.duration;action.setEffectiveWeight(weights[i]*this.guardWalkBlend);});
    this.current=names[weights.indexOf(Math.max(...weights))];this.oneShot=0;
  }
  stepRun(angle,speed,dt,sprint=false){
    const names=sprint?['Sprint_Forward']:['Run_Forward','Run_Right','Run_Backward','Run_Left'];
    const direction=sprint?[1]:[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))];
    const raw=direction.map((amount,i)=>{const spec=locomotion[names[i]];return amount/(2*spec.amplitude/(spec.support*spec.duration));});
    const sum=raw.reduce((a,b)=>a+b,0),weights=raw.map(value=>value/sum),duration=locomotion[names[0]].duration;
    this.runPhase=((this.runPhase||0)+dt*speed*sum/(this.root.scale.x*duration))%1;
    if(!this.running||this.runSprint!==sprint){
      if(this.guardWalking){for(const action of this.guardWalkActions)action.fadeOut(.12);this.guardWalking=false;}
      if(this.running)for(const action of this.runActions)action.fadeOut(.12);else this.actions.get(this.current)?.fadeOut(.12);
      this.runActions=names.map(name=>this.actions.get(name));
      for(const action of this.runActions)action.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveTimeScale(0).play();
      this.running=true;this.runSprint=sprint;this.runBlend=0;
    }
    this.runBlend=Math.min(1,this.runBlend+dt/.12);
    this.runActions.forEach((action,i)=>{action.time=this.runPhase*duration;action.setEffectiveWeight(weights[i]*this.runBlend);});
    this.current=names[weights.indexOf(Math.max(...weights))];this.oneShot=0;
  }
  update(time,dt,{moving=false,sprinting=false,attack=0,golf=false,swing=0,putting=false,dodge=false,action=null,emerging=null,focused=false,moveAngle=0,moveSpeed=null,cinematic=false,enemyAction=null,selection=false,blocking=false,parry=0,guardBreak=0,guardHitToken=0}={}){
    for(const [bone,rotation]of this.overlays)bone.quaternion.multiply(rotation.invert());this.overlays=[];for(const [bone,scale]of this.coreScales)bone.scale.copy(scale);this.coreScales=[];this.model.quaternion.copy(this.restModelRotation);
    this.weapon.visible=!golf&&!cinematic;this.club.visible=golf;if(this.offhand)this.offhand.visible=!golf&&!cinematic;
    if(this.dead>0){this.weapon.visible=false;if(this.offhand)this.offhand.visible=false;if(!this.deathStarted){this.deathStarted=true;this.play('Death01',.08,true,1.6);}this.mixer.update(dt);return;}
    this.oneShot=Math.max(0,this.oneShot-dt);
    const guardPrefix=GUARD_PREFIX[WARRIORS[this.type]?.weaponKind],guardEnabled=!this.enemy&&!golf&&!cinematic;
    const guardImpact=guardEnabled&&!action&&!swing&&!dodge&&(parry>0&&!this.wasParry||blocking&&guardHitToken>0&&guardHitToken!==this.lastGuardHitToken);
    if(dodge&&!this.wasDodge)this.play('Roll',.06,true,1.4);
    else if(guardEnabled&&guardBreak>0&&!this.wasGuardBreak&&!action&&!dodge)this.play(`${guardPrefix}_Guard_Break`,.045,true);
    else if(emerging){this.play(emerging.progress<.68?'Jump_Loop':'Jump_Land',.10,false,1.8);}
    else if(enemyAction&&this.actionToken!==enemyAction.token){this.actionToken=enemyAction.token;const name=ENEMY_TYPES[this.type].clip;this.play(name,.07,true,motions[name].duration/enemyAction.duration);}
    else if(action&&this.actionToken!==action.token){this.actionToken=action.token;const name=combatMotionName(WARRIORS[this.type],action.kind,action.step);this.play(name,.07,true,motions[name].duration/action.duration);}
    else if(guardImpact&&guardBreak<=0)this.play(`${guardPrefix}_Guard_Impact`,.035,true,parry>0?1.15:1);
    else if(swing>0&&!this.wasSwing)this.play(putting?'Golf_Putt':'Golf_Swing',.10,true,1);
    else if(!action&&!enemyAction&&attack>0&&!this.wasAttack)this.play('Sword_Attack',.07,true,2.2);
    else if(guardEnabled&&blocking&&!action&&!swing&&!dodge&&guardBreak<=0&&(!/_Guard_(Impact|Break)$/.test(this.current)||this.oneShot<=0)){
      const speed=moveSpeed??(moving?2.3*WARRIORS[this.type].speed:0);
      if(moving&&speed>.05)this.stepGuard(guardPrefix,moveAngle,speed,dt);else this.play(`${guardPrefix}_Guard_Loop`,.12);
    }
    else if(!action&&!enemyAction&&this.oneShot<=0&&!golf&&!this.enemy&&moving&&(moveSpeed??1)>.05)this.stepRun(moveAngle,moveSpeed??(sprinting?8:5.6)*WARRIORS[this.type].speed,dt,sprinting&&!focused&&Math.cos(moveAngle)>.85);
    else if(!action&&!enemyAction&&this.oneShot<=0)this.play(golf?'Golf_Address':moving&&(moveSpeed??1)>.05?(sprinting?'Sprint_Loop':'Jog_Fwd_Loop'):this.enemy?'Sword_Idle':WARRIORS[this.type].readyClip||'Idle_Loop',.18,false,moving?(sprinting?1.15:1):1);
    this.wasAttack=attack>0;this.wasSwing=swing>0;this.wasDodge=dodge;this.wasParry=parry>0;this.wasGuardBreak=guardBreak>0;this.lastGuardHitToken=guardHitToken;
    if(moving&&['Jog_Fwd_Loop','Sprint_Loop'].includes(this.current))this.actions.get(this.current).setEffectiveTimeScale((focused&&Math.cos(moveAngle)<-.5?-1:1)*(sprinting?1.15:1));
    this.mixer.update(dt);
    // Small distributed rotations preserve the source animation and give the core elastic follow-through.
    const overlay=(name,x,y,z)=>{const bone=this.bones[name];if(!bone)return;const r=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));bone.quaternion.multiply(r);this.overlays.push([bone,r]);};
    if(!golf&&!dodge&&!emerging&&!/_Guard_|^Run_|^Sprint_Forward$/.test(this.current)){
      const gait=moving?Math.sin(time*(sprinting?15:11)):Math.sin(time*2)*.12;
      for(const [i,name] of ['spine_01','spine_02','spine_03'].entries())overlay(name,(moving?.025:0)+gait*.018,gait*.035*(i===2?-1:1),gait*.022);
      if(focused&&moving){const twist=Math.sin(moveAngle)*.6;overlay('pelvis',0,twist,0);overlay('spine_01',0,-twist*.4,0);overlay('spine_02',0,-twist*.6,0);}
      if(action){for(const name of ['spine_01','spine_02']){const bone=this.bones[name];this.coreScales.push([bone,bone.scale.clone()]);const squash=1-Math.sin(action.time/action.duration*Math.PI)*.012;bone.scale.multiply(new THREE.Vector3(1/Math.sqrt(squash),squash,1/Math.sqrt(squash)));}}

    }
    if(selection&&!WARRIORS[this.type]?.readyClip){
      this.root.updateMatrixWorld(true);
      for(const side of this.offhand?['r','l']:['r']){
        const bone=this.bones['hand_'+side],before=bone.quaternion.clone();
        const world=bone.getWorldQuaternion(new THREE.Quaternion());
        const currentAxis=this.shaftAxes[side].clone().applyQuaternion(world);
        const desiredAxis=new THREE.Vector3(side==='r'?-.85:.85,.42,.18).normalize().applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
        world.premultiply(new THREE.Quaternion().setFromUnitVectors(currentAxis,desiredAxis));
        const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion());
        bone.quaternion.copy(parentWorld.invert().multiply(world));
        this.overlays.push([bone,before.invert().multiply(bone.quaternion)]);
      }
    }
    const resolve=cinematic?1:action?.kind==='musou'?.9:attack?.4:0;for(const [mesh,index]of this.resolveTargets)mesh.morphTargetInfluences[index]=resolve;
    const motion=sampleMotion(this.current,this.actions.get(this.current)?.time||0);
    this.syncHeldObjects(motion,golf);
  }
  syncHeldObjects(motion=sampleMotion(this.current,this.actions.get(this.current)?.time||0),golf=false){
    // Anchor the handle to the evaluated palm after every mixer and torso update.
    // Authored directions control the blade, while live bones control its position.
    // Keep the measured closed grip when a source idle clip opens its free hand.
    for(const [bone,rotation]of this.closedFingerGroups.r)bone.quaternion.copy(rotation);
    if(this.offhand||golf||motions[this.current]?.twoHanded)for(const [bone,rotation]of this.closedFingerGroups.l)bone.quaternion.copy(rotation);
    // Only the hand ancestor chains are needed here. Rendering updates the other bones.
    this.bones.hand_r.updateWorldMatrix(true,false);
    if(this.offhand&&!golf)this.bones.hand_l.updateWorldMatrix(true,false);
    rootInverse.copy(this.root.matrixWorld).invert();
    this.root.matrixWorld.decompose(decomposedPosition,rootRotation,decomposedScale);rootRotation.invert();
    const attach=(held,side,from,to,roll=0)=>{
      const hand=this.bones['hand_'+side];
      if(held.parent!==this.root)this.root.add(held);
      held.position.copy(gripPosition.copy(this.palmGrips[side]).applyMatrix4(hand.matrixWorld).applyMatrix4(rootInverse));
      if(from&&to){
        shaftDirection.set(to[0]-from[0],to[2]-from[2],from[1]-to[1]);
        if(golf)held.scale.setScalar(shaftDirection.length()/1.12);
        held.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());held.rotateY(roll);
      }else{
        // Across the palm, perpendicular to wrist-to-knuckle direction.
        hand.matrixWorld.decompose(decomposedPosition,handRotation,decomposedScale);
        shaftDirection.copy(this.shaftAxes[side]).applyQuaternion(handRotation).applyQuaternion(rootRotation);
        held.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());
      }
    };
    attach(golf?this.club:this.weapon,'r',motion?.grip,motion?.tip,motion?.roll||0);
    if(this.offhand&&!golf)attach(this.offhand,'l',motion?.offGrip,motion?.offTip,motion?.offRoll||0);

  }

  weaponPoints(offhand=false){const held=offhand&&this.offhand?this.offhand:this.weapon;this.root.updateMatrixWorld(true);held.localToWorld(this.tip.fromArray(held.userData.tip));held.getWorldPosition(this.hilt);return [this.hilt,this.tip];}
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const material of this.ownedMaterials)material.dispose();}
}
export class CrowdRenderer {
  constructor(scene){this.scene=scene;this.active=new Set();}
  update(enemies){const present=new Set(enemies);for(const e of this.active)if(!present.has(e)){this.scene.remove(e.root);e.dispose();this.active.delete(e);}for(const e of enemies)if(!this.active.has(e)){this.scene.add(e.root);this.active.add(e);}}
}
