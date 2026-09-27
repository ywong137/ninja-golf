import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {finishCharacterMaterial} from './character-materials.js';
import { createWeapon } from './weapons.js';
import { motions, sampleMotion, ATTACK_CLIPS } from './motion.js';
import { ENEMY_TYPES } from './combat.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
export { Effects } from './effects.js';
// Refresh revised rigs in browsers that cached the previous release's model URLs.
const MODEL_REVISION='production-art-4';
const templates=[];
const retargeted=new Map();
const motionSources=[];
const materials=new Map();
const geometries=new Map();
const q=new THREE.Quaternion();
const shaftDirection=new THREE.Vector3(),axisY=new THREE.Vector3(0,1,0);
export async function loadWarriorAssets(progress=()=>{}) {
  const loader=new GLTFLoader();let done=0;
  const urls=['ronin','shinobi','monk',...ENEMY_TYPES.map(e=>e.model),'warrior-motion','golf-motion'];
  const results=await Promise.all(urls.map(async name=>{const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb?v=${MODEL_REVISION}`);progress(++done,urls.length);return model;}));
  const clipNames=new Set(results.slice(7).flatMap(model=>model.animations.map(clip=>clip.name)));
  for(const name of ['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Golf_Address','Golf_Swing','Golf_Putt'])if(!clipNames.has(name))throw new Error(`Missing warrior animation: ${name}`);
  templates.push(...results.slice(0,7));motionSources.push(...results.slice(7));
  for(const model of templates)model.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(/eyebrow/i.test(o.name)){mat.color.set('#34241b');mat.map=null;mat.roughness=.9;}finishCharacterMaterial(mat);if(mat.map)mat.map.anisotropy=8;if(mat.normalMap)mat.normalMap.anisotropy=4;mat.envMapIntensity=.6;}}});
}
function mat(color,metal=0){const key=color+metal;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.28:.78,metalness:metal}));return materials.get(key);}
function part(parent,kind,color,x,y,z,sx,sy,sz,metal=0){if(!geometries.has(kind))geometries.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,10));const mesh=new THREE.Mesh(geometries.get(kind),mat(color,metal));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;}
function clipsFor(index){
  if(retargeted.has(index))return retargeted.get(index);
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
    this.type=type;this.enemy=enemy;this.dead=0;this.root=new THREE.Group();const index=enemy?3+type:type;
    this.model=cloneSkeleton(templates[index].scene);this.root.add(this.model);this.root.scale.setScalar(enemy?1.1:1.1);
    this.bones={};this.ownedMaterials=[];this.model.traverse(o=>{if(o.isBone)this.bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(enemy){o.material=o.material.clone();finishCharacterMaterial(o.material);this.ownedMaterials.push(o.material);if(/Woven|Silk|Indigo/.test(o.material.name))o.material.color.set(['#344b58','#6b3128','#7b7450','#574767'][type%4]);if(/brass/i.test(o.material.name))o.material.color.set('#555b51');}}});
    this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map(clipsFor(index).map(c=>[c.name,this.mixer.clipAction(c)]));this.current='';this.oneShot=0;this.wasAttack=false;this.wasSwing=false;
    const hand=this.bones.hand_r;
    this.weapon=createWeapon(enemy?ENEMY_TYPES[type].weapon:['odachi','twin','naginata'][type]);this.weapon.position.set(0,.05,0);this.weapon.rotation.set(Math.PI/2,0,0);hand.add(this.weapon);
    if(type===1&&!enemy||enemy&&type===0){this.offhand=createWeapon(enemy?'scout':'twin');this.offhand.position.set(0,.05,0);this.offhand.rotation.set(Math.PI/2,0,0);this.bones.hand_l.add(this.offhand);}
    this.club=new THREE.Group();this.club.position.set(0,.04,0);this.root.add(this.club);
    part(this.club,'cyl','#252a27',0,.04,0,.018,.20,.018);part(this.club,'cyl','#b7c4c2',0,.60,0,.008,1.0,.008,.85);const head=part(this.club,'cyl','#3c4947',.047,1.12,0,.065,.07,.08,.8);head.rotation.z=-.15;this.club.visible=false;
    // A small bag and real club shafts retain the golf silhouette without obscuring the armor.
    const back=this.bones.spine_03;const bag=new THREE.Group();bag.position.set(.13,.03,-.18);bag.rotation.z=.22;back.add(bag);part(bag,'cyl','#4b4434',0,-.13,0,.083,.49,.083);for(let i=0;i<3;i++){part(bag,'cyl','#a5b1ad',-.045+i*.04,.18,0,.006,.39,.006,.6);part(bag,'box','#9ca9a5',-.025+i*.04,.37,0,.065,.03,.03,.75);}
    if(enemy)bag.visible=false;
    this.overlays=[];this.coreScales=[];this.restModelRotation=this.model.quaternion.clone();this.tip=new THREE.Vector3();this.hilt=new THREE.Vector3();
    this.play('Idle_Loop',0);this.mixer.update(Math.random()*.7);
  }
  play(name,fade=.16,once=false,speed=1){const next=this.actions.get(name);if(!next)return;if(this.current===name&&!once)return;const previous=this.actions.get(this.current);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(speed);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(previous&&previous!==next){previous.fadeOut(fade);next.fadeIn(fade);}this.current=name;this.oneShot=once?next.getClip().duration/speed:0;}
  update(time,dt,{moving=false,sprinting=false,attack=0,golf=false,swing=0,putting=false,dodge=false,action=null,emerging=null,focused=false,moveAngle=0,cinematic=false,enemyAction=null}={}){
    for(const [bone,rotation]of this.overlays)bone.quaternion.multiply(rotation.invert());this.overlays=[];for(const [bone,scale]of this.coreScales)bone.scale.copy(scale);this.coreScales=[];this.model.quaternion.copy(this.restModelRotation);
    this.weapon.visible=!golf&&!cinematic;this.club.visible=golf;if(this.offhand)this.offhand.visible=!golf&&!cinematic;
    if(this.dead>0){this.weapon.visible=false;if(this.offhand)this.offhand.visible=false;if(!this.deathStarted){this.deathStarted=true;this.play('Death01',.08,true,1.6);}this.mixer.update(dt);return;}
    this.oneShot=Math.max(0,this.oneShot-dt);
    if(emerging){this.play(emerging.progress<.68?'Jump_Loop':'Jump_Land',.10,false,1.8);}
    else if(enemyAction&&this.actionToken!==enemyAction.token){this.actionToken=enemyAction.token;const name=ENEMY_TYPES[this.type].clip;this.play(name,.07,true,motions[name].duration/enemyAction.duration);}
    else if(action&&this.actionToken!==action.token){this.actionToken=action.token;const base=ATTACK_CLIPS[action.kind][action.kind==='musou'?0:action.step],name=(this.type===1?'Twin_':'')+base;this.play(name,.07,true,motions[name].duration/action.duration);}
    else if(swing>0&&!this.wasSwing)this.play(putting?'Golf_Putt':'Golf_Swing',.10,true,1);
    else if(!action&&!enemyAction&&attack>0&&!this.wasAttack)this.play('Sword_Attack',.07,true,2.2);
    else if(dodge&&!this.wasDodge)this.play('Roll',.06,true,1.4);
    else if(!action&&!enemyAction&&this.oneShot<=0)this.play(golf?'Golf_Address':moving?(sprinting?'Sprint_Loop':'Jog_Fwd_Loop'):this.enemy?'Sword_Idle':'Idle_Loop',.18,false,moving?(sprinting?1.15:1):1);
    this.wasAttack=attack>0;this.wasSwing=swing>0;this.wasDodge=dodge;
    if(moving&&['Jog_Fwd_Loop','Sprint_Loop'].includes(this.current))this.actions.get(this.current).setEffectiveTimeScale((focused&&Math.cos(moveAngle)<-.5?-1:1)*(sprinting?1.15:1));
    this.mixer.update(dt);
    // Small distributed rotations preserve the source animation and give the core elastic follow-through.
    const overlay=(name,x,y,z)=>{const bone=this.bones[name];if(!bone)return;const r=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));bone.quaternion.multiply(r);this.overlays.push([bone,r]);};
    if(!golf&&!dodge&&!emerging){
      const gait=moving?Math.sin(time*(sprinting?15:11)):Math.sin(time*2)*.12;
      for(const [i,name] of ['spine_01','spine_02','spine_03'].entries())overlay(name,(moving?.025:0)+gait*.018,gait*.035*(i===2?-1:1),gait*.022);
      if(focused&&moving){const twist=Math.sin(moveAngle)*.6;overlay('pelvis',0,twist,0);overlay('spine_01',0,-twist*.4,0);overlay('spine_02',0,-twist*.6,0);}
      if(action){for(const name of ['spine_01','spine_02']){const bone=this.bones[name];this.coreScales.push([bone,bone.scale.clone()]);const squash=1-Math.sin(action.time/action.duration*Math.PI)*.012;bone.scale.multiply(new THREE.Vector3(1/Math.sqrt(squash),squash,1/Math.sqrt(squash)));}}

    }
    this.model.traverse(o=>{if(o.morphTargetDictionary?.Resolve!==undefined)o.morphTargetInfluences[o.morphTargetDictionary.Resolve]=cinematic?1:action?.kind==='musou'?.9:attack?.4:0;});
    const motion=sampleMotion(this.current,this.actions.get(this.current)?.time||0);
    if(motion&&(golf||action||enemyAction)){
      // The same curve drives baked palm IK and the live club/blade transform.
      const held=golf?this.club:this.weapon;this.root.add(held);held.position.set(motion.grip[0],motion.grip[2],-motion.grip[1]);
      shaftDirection.set(motion.tip[0]-motion.grip[0],motion.tip[2]-motion.grip[2],motion.grip[1]-motion.tip[1]);
      if(golf)held.scale.setScalar(shaftDirection.length()/1.12);held.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());
      if(this.offhand&&!golf){this.root.add(this.offhand);const t=(this.actions.get(this.current)?.time||0)/motions[this.current].duration;this.offhand.position.set(-motion.grip[0],1.15+.2*Math.sin(t*Math.PI*2),.43);this.offhand.quaternion.setFromUnitVectors(axisY,shaftDirection.clone().setX(-shaftDirection.x));}
    }else if(!golf){this.bones.hand_r.add(this.weapon);this.weapon.position.set(0,.05,0);this.weapon.rotation.set(Math.PI/2,0,-.25);if(this.offhand){this.bones.hand_l.add(this.offhand);this.offhand.position.set(0,.05,0);this.offhand.rotation.set(Math.PI/2,0,.25);}}
  }

  weaponPoints(){this.root.updateMatrixWorld(true);this.weapon.localToWorld(this.tip.fromArray(this.weapon.userData.tip));this.weapon.getWorldPosition(this.hilt);return [this.hilt,this.tip];}
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const material of this.ownedMaterials)material.dispose();}
}
export class CrowdRenderer {
  constructor(scene){this.scene=scene;this.active=new Set();}
  update(enemies){const present=new Set(enemies);for(const e of this.active)if(!present.has(e)){this.scene.remove(e.root);e.dispose();this.active.delete(e);}for(const e of enemies)if(!this.active.has(e)){this.scene.add(e.root);this.active.add(e);}}
}
