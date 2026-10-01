import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {finishCharacterMaterial,awaitCharacterMaterials} from './character-materials.js';
import { WARRIORS } from './warriors.js';
import { createWeapon } from './weapons.js';
import { motions, sampleMotionInto, combatMotionName } from './motion.js';
import {matchesContinuationBoundary} from './attack-continuation.js';
import {headingKnee} from './knee-alignment.js';
import {RunFootwork} from './run-footwork.js';
import {FootPlacement,attackFootContacts,resolveFootSupport} from './foot-placement.js';
import {TravelPose} from './travel-pose.js';
import {AttackLocomotion} from './attack-locomotion.js';
import {FacialPose} from './facial-pose.js';
import {palmWeaponBasis,alignWeaponShaft} from './weapon-frame.js';
import {HandGrip,compatibleNativePair} from './hand-grip.js';
import {matchesAnimationEntry} from './animation-entry.js';
import {ArmMotionContinuation} from './arm-motion-continuation.js';
import {createGolfClub} from './golf-club.js';
import {captureGolfRestPose,calibrateGolfClub} from './golf-club-fit.js';
import {installLimbSkinning} from './forearm-twist.js';
import {golfShoulderSkinWeight} from './golf-shoulder-skin.js';
import {installSkinnedBounds} from './skinned-bounds.js';
import gripData from './grip-data.json';
import locomotion from './locomotion-data.json';
import { ENEMY_TYPES } from './combat.js';
import {enemyStrideRate} from './enemy-locomotion.js';
import {ENEMY_APPEARANCES,resolveEnemyAppearance,applyEnemyAppearance} from './enemy-appearances.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
export { Effects } from './effects.js';
// Refresh revised rigs in browsers that cached the previous release's model URLs.
const MODEL_REVISION='measured-ethan-native-arms-4';
const MODEL_REVISIONS=Object.fromEntries(['ronin','shinobi','monk','kaede','ayame','sora'].map(name=>[name,'golf-backswing-2']));
MODEL_REVISIONS.kaede='golf-shoulder-release-1';
for(const {model}of ENEMY_APPEARANCES)MODEL_REVISIONS[model]='enemy-native-leg-frames-2';
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
  const characterCount=WARRIORS.length+ENEMY_APPEARANCES.length;
  const urls=[...WARRIORS.map(w=>w.model),...ENEMY_APPEARANCES.map(e=>e.model),'warrior-motion','golf-motion'];
  const results=await Promise.all(urls.map(async name=>{const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb?v=${MODEL_REVISIONS[name]??MODEL_REVISION}`);progress(++done,urls.length);return model;}));
  const clipNames=new Set(results.slice(characterCount).flatMap(model=>model.animations.map(clip=>clip.name)));
  for(const name of ['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Golf_Address','Golf_Swing','Golf_Putt'])if(!clipNames.has(name))throw new Error(`Missing warrior animation: ${name}`);
  for(const [i,warrior]of WARRIORS.entries())for(const phase of ['Loop','Impact','Break','Walk_Forward','Walk_Right','Walk_Backward','Walk_Left']){const name=`${GUARD_PREFIX[warrior.combatStyle]}_Guard_${phase}`;if(!results[i].animations.some(clip=>clip.name===name))throw new Error(`Missing native guard animation ${name} in ${warrior.model}.glb`);}
  for(const [i,warrior]of WARRIORS.entries())for(const name of Object.keys(locomotion))if(!results[i].animations.some(clip=>clip.name===name))throw new Error(`Missing native locomotion ${name} in ${warrior.model}.glb`);
  for(const [i,warrior]of WARRIORS.entries())if(!results[i].animations.some(clip=>clip.name===warrior.selectionClip))throw new Error(`Missing selection pose ${warrior.selectionClip} in ${warrior.model}.glb`);
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
  constructor(type=0,enemy=false,appearance={family:type%3,palette:0}){
    this.motionSample={};
    this.appearance=enemy?resolveEnemyAppearance(appearance):null;
    this.type=type;this.enemy=enemy;this.dead=0;this.root=new THREE.Group();const index=enemy?WARRIORS.length+this.appearance.family:type;
    this.model=cloneSkeleton(templates[index].scene);this.root.add(this.model);this.root.scale.setScalar(enemy?1.1:1.1);
    this.rigMetadata={};this.model.traverse(o=>{if(o.userData.nativeMotion)this.rigMetadata=o.userData;});
    this.nativeHuman=!!this.rigMetadata.nativeMotion;
    this.palmGrips={r:new THREE.Vector3().fromArray(this.rigMetadata.palmGripR||PALM_GRIPS.r.toArray()),l:new THREE.Vector3().fromArray(this.rigMetadata.palmGripL||PALM_GRIPS.l.toArray())};
    this.shaftAxes={r:new THREE.Vector3().fromArray(this.rigMetadata.shaftAxisR||[0,0,1]),l:new THREE.Vector3().fromArray(this.rigMetadata.shaftAxisL||[0,0,1])};
    this.bones={};this.ownedMaterials=[];this.model.traverse(o=>{if(o.isBone)this.bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(enemy){o.material=o.material.clone();finishCharacterMaterial(o.material);this.ownedMaterials.push(o.material);if(/Woven|Silk|Indigo/.test(o.material.name))o.material.color.set(['#344b58','#6b3128','#7b7450','#574767'][type%4]);if(/brass/i.test(o.material.name))o.material.color.set('#555b51');}}});
    if(enemy)applyEnemyAppearance(this.model,this.appearance);
    this.root.updateMatrixWorld(true);
    if(this.nativeHuman)for(const side of ['r','l']){const grip=this.model.getObjectByName('PalmGrip_'+side),shaft=this.model.getObjectByName('PalmShaft_'+side),hand=this.bones['hand_'+side];if(grip&&shaft){this.palmGrips[side].copy(hand.worldToLocal(grip.getWorldPosition(new THREE.Vector3())));this.shaftAxes[side].copy(hand.worldToLocal(shaft.getWorldPosition(new THREE.Vector3()))).sub(this.palmGrips[side]).normalize();}}
    this.neutralHandRotations=Object.fromEntries(['r','l'].map(side=>[side,this.bones['hand_'+side].quaternion.clone()]));
    this.forearmTwist=!enemy&&this.nativeHuman?installLimbSkinning(this.model,{upperArms:WARRIORS[type].model==='kaede'?['r']:[]}):null;
    this.golfRestPose=captureGolfRestPose(this.model);this.golfClubFits=new Map();
    this.armContinuation=!enemy&&this.nativeHuman?new ArmMotionContinuation(this.bones,this.golfRestPose):null;
    const chestInverse=this.bones.spine_03.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.selectionArmRest=Object.fromEntries(['r','l'].map(side=>{
      const upperAxis=this.bones['lowerarm_'+side].position.clone().normalize();
      const lower=this.bones['lowerarm_'+side].quaternion.clone();
      const forearmAxis=this.bones['hand_'+side].position.clone().normalize().applyQuaternion(lower);
      return[side,{
        upperInChest:chestInverse.clone().multiply(this.bones['upperarm_'+side].getWorldQuaternion(new THREE.Quaternion())),
        lower,hinge:upperAxis.clone().cross(forearmAxis).normalize(),flexion:upperAxis.angleTo(forearmAxis),
      }];
    }));
    this.footPlacement=!enemy&&this.nativeHuman?new FootPlacement(this.root,this.bones):null;
    this.facialPose=!enemy&&this.nativeHuman?new FacialPose(this.bones,{identity:WARRIORS[type].model}):null;
    if(this.facialPose){this.gazeDirection=new THREE.Vector3();this.eyePosition=new THREE.Vector3();this.eyeRotation=new THREE.Quaternion();}
    this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map(clipsFor(index).map(c=>[c.name,this.mixer.clipAction(c)]));this.current='';this.oneShot=0;this.wasAttack=false;this.wasSwing=false;
    this.footContactMotions=new Map(clipsFor(index).map(c=>[c.name,resolveFootSupport(c,motions[c.name])]));
    this.runFootwork=!enemy&&this.nativeHuman?new RunFootwork(this.root,this.model,this.bones,templates[index].scene,clipsFor(index),this.footPlacement.feet):null;
    this.attackLocomotion=!enemy&&this.nativeHuman?new AttackLocomotion(this.root,this.model,this.bones,clipsFor(index),GUARD_PREFIX[WARRIORS[type].combatStyle],motions):null;
    const hand=this.bones.hand_r;
    this.weapon=createWeapon(enemy?ENEMY_TYPES[type].weapon:WARRIORS[type].weaponKind);this.weapon.position.set(0,.05,0);this.weapon.rotation.set(Math.PI/2,0,0);hand.add(this.weapon);
    if(enemy?ENEMY_TYPES[type].dualWield:WARRIORS[type].dualWield){this.offhand=createWeapon(enemy?ENEMY_TYPES[type].weapon:WARRIORS[type].weaponKind);this.offhand.position.set(0,.05,0);this.offhand.rotation.set(Math.PI/2,0,0);this.bones.hand_l.add(this.offhand);}
    this.golfClub=createGolfClub();this.club=this.golfClub.root;this.club.position.set(0,.04,0);this.root.add(this.club);
    this.clubShaft=this.golfClub.shaft;this.clubHead=this.golfClub.head;this.club.visible=false;
    // A small bag and real club shafts retain the golf silhouette without obscuring the armor.
    const back=this.bones.spine_03;const bag=new THREE.Group();bag.position.set(.13,.03,-.18);bag.rotation.z=.22;back.add(bag);part(bag,'cyl','#4b4434',0,-.13,0,.083,.49,.083);for(let i=0;i<3;i++){part(bag,'cyl','#a5b1ad',-.045+i*.04,.18,0,.006,.39,.006,.6);part(bag,'box','#9ca9a5',-.025+i*.04,.37,0,.065,.03,.03,.75);}
    if(enemy||this.nativeHuman)bag.visible=false;
    this.travelPose=!enemy&&this.nativeHuman?new TravelPose(this,WARRIORS[type].combatStyle):null;this.overlays=[];this.coreScales=[];this.restModelRotation=this.model.quaternion.clone();this.tip=new THREE.Vector3();this.hilt=new THREE.Vector3();
    this.play(this.nativeHuman?'Golf_Address':'Idle_Loop',0);this.mixer.update(this.nativeHuman?0:Math.random()*.7);
    this.closedFingerGroups={r:[],l:[]};for(const bone of Object.values(this.bones))if(/^(index|middle|ring|pinky|thumb)_/.test(bone.name)){const side=bone.name.endsWith('_r')?'r':'l';this.closedFingerGroups[side].push([bone,bone.quaternion.clone()]);}
    const palmFrames={};
    if(this.nativeHuman){
      this.root.updateMatrixWorld(true);
      for(const side of this.offhand?['r','l']:['r']){
        const hand=this.bones['hand_'+side],knuckle=this.bones['middle_01_'+side];
        if(knuckle)palmFrames[side]=palmWeaponBasis(this.shaftAxes[side],hand.worldToLocal(knuckle.getWorldPosition(new THREE.Vector3())));
      }
    }
    if(this.nativeHuman){this.mixer.stopAllAction();this.current='';this.play('Idle_Loop',0);this.mixer.update(0);}
    if(!enemy&&WARRIORS[type].readyClip&&this.actions.has(WARRIORS[type].readyClip)){this.play(WARRIORS[type].readyClip,0);this.mixer.update(0);}this.syncHeldObjects();
    // Preserve the selected weapon's Ready presentation with one fixed grip
    // offset. During animation its face then follows the complete palm frame.
    for(const [side,basis]of Object.entries(palmFrames)){
      const held=side==='r'?this.weapon:this.offhand;
      const handFrame=this.bones['hand_'+side].getWorldQuaternion(new THREE.Quaternion()).premultiply(this.root.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(basis).normalize();
      const shaft=axisY.clone().applyQuaternion(held.quaternion);
      alignWeaponShaft(handFrame,shaft);
      const relative=handFrame.invert().multiply(held.quaternion);
      basis.multiply(new THREE.Quaternion().setFromAxisAngle(axisY,2*Math.atan2(relative.y,relative.w)));
    }
    this.palmWeaponFrames=palmFrames;
    if(!enemy&&gripData[WARRIORS[type].model]){
      this.handGrip=new HandGrip(this,gripData[WARRIORS[type].model]);
      this.handGrip.engage(!!motions[this.current]?.twoHanded);this.syncHeldObjects();
    }
    this.setGolfClub('DR');
  }
  setGolfClub(short='DR'){
    this.golfClub.setClub(short);this.clubShort=short;
    if(!this.enemy&&this.handGrip){
      const putting=short==='PT',clip=this.actions.get(putting?'Golf_Putt':'Golf_Swing')?.getClip();
      if(clip){
        if(!this.golfClubFits.has(short))this.golfClubFits.set(short,calibrateGolfClub({root:this.root,hand:this.bones.hand_r,clip,addressClip:this.actions.get(putting?'Golf_Putt':'Golf_Address').getClip(),restPose:this.golfRestPose,grip:this.handGrip.profiles.golf.r,club:this.golfClub,contactTime:putting?22/30:1.4,actorScale:1.1}));
        this.golfClubFit=this.golfClubFits.get(short);
        if(!this.golfClubFit.addressFit?.accepted)throw new Error(`Cannot place ${short} at address: ${this.golfClubFit.addressFit?.reason??'missing address calibration'}`);
        this.clubHead.quaternion.identity();this.golfClub.setBodyOrientation(this.golfClubFit.bodyQuaternion);
        this.setGolfClubLength(this.golfClubFit.shaftLengthNative);
      }
    }
  }
  setGolfClubLength(length){
    this.clubShaft.scale.y=Math.max(.1,length-.14);this.clubShaft.position.y=.14+this.clubShaft.scale.y*.5;this.clubHead.position.y=length;
  }
  play(name,fade=.16,once=false,speed=1){
    // A compatible native pair already authors both arms. Preserve it through
    // the fade instead of adding a second, independent elbow solve.
    const settledPair=!this.offhand&&!this.running&&!(this.travelPose?.weight>0)
      &&!this.current.startsWith('Golf')&&!name.startsWith('Golf')&&this.handGrip?.secondaryWeight>.999
      &&(!this.heldBlend||this.mixer.time>=this.heldBlend.start+this.heldBlend.duration)
      &&compatibleNativePair(motions[this.current],motions[name],this.weapon.userData.defaultGrip);
    const preservePair=settledPair&&!this.guardWalking;
    if(this.running){for(const run of this.runActions)run.fadeOut(fade);this.running=false;}
    if(this.guardWalking&&!name.includes('_Guard_Walk_')){for(const walk of this.guardWalkActions)walk.fadeOut(fade);this.guardWalking=false;}
    let next=this.actions.get(name);if(!next)return;if(this.current===name&&!once)return;
    const previous=this.actions.get(this.current);
    this.armContinuation?.release(this.mixer.time,fade);
    const continueArms=fade>0&&settledPair&&/_Guard_(Loop|Impact|Break|Walk_\w+)$/.test(this.current)
      &&motions[this.current]?.fixedGripFrame===true&&motions[name]?.fixedGripFrame===true&&motions[name]?.athleticAttack
      &&this.armContinuation?.begin(next,this.mixer.time,fade);
    // Ready, completed attacks, and declared combo boundaries can continue only
    // when every incoming transform matches. Other interruptions retain a fade.
    // GLB key times use float32; the gameplay clock uses float64 seconds.
    const finishedAttack=previous?.loop===THREE.LoopOnce&&previous.time>=previous.getClip().duration-1e-6
      &&motions[this.current]?.athleticAttack;
    const connectedAttack=previous?.loop===THREE.LoopOnce&&motions[this.current]?.athleticAttack
      &&matchesContinuationBoundary(motions[this.current],name,previous.time);
    const directEntry=fade>0&&preservePair&&(this.current===WARRIORS[this.type]?.readyClip||finishedAttack||connectedAttack)&&previous?.enabled&&previous.getEffectiveWeight()===1
      &&![...this.actions.values(),...(this.repeatActions?.values()??[])].some(action=>action!==previous&&action.isScheduled()&&action.enabled)
      &&matchesAnimationEntry(this.bones,previous.getClip(),next.getClip(),{restPose:this.golfRestPose,overriddenTracks:new Set(['r','l'].flatMap(side=>this.handGrip.active[side].fingers.map(([bone])=>bone.name+'.quaternion')))});
    if(directEntry)fade=0;
    if(previous===next&&once&&fade>0){
      // Repeated attacks need two actions to crossfade instead of rewinding live bones.
      this.repeatActions??=new Map();const alternate=this.repeatActions.get(name)||this.mixer.clipAction(next.getClip().clone());
      this.repeatActions.set(name,next);this.actions.set(name,alternate);next=alternate;
    }
    // Blade directions must crossfade with the hands instead of jumping to the new clip.
    this.heldBlend=previous&&previous!==next&&fade>0&&motions[name]&&!name.startsWith('Golf')&&this.weapon.parent===this.root
      ?{start:this.mixer.time,duration:fade,r:this.weapon.quaternion.clone(),l:this.offhand?.quaternion.clone(),station:this.weapon.userData.primaryGrip,preservePair:preservePair||continueArms}:null;
    next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(speed);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();
    if(previous&&previous!==next){if(directEntry)previous.stop();else{previous.fadeOut(fade);next.fadeIn(fade);}}
    this.current=name;this.oneShot=once?next.getClip().duration/speed:0;
    this.handGrip?.engage(!!motions[name]?.twoHanded,fade);
  }
  stepGuard(prefix,angle,speed,dt){
    if(!this.guardWalking)this.armContinuation?.release(this.mixer.time,.1);
    if(this.running){for(const action of this.runActions)action.fadeOut(.1);this.running=false;}
    const names=['Forward','Right','Backward','Left'].map(direction=>`${prefix}_Guard_Walk_${direction}`);
    const direction=[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))];
    // Shorter side steps need proportionally more weight and a faster cadence.
    // This keeps the planted foot opposite the actual travel vector, including diagonals.
    const raw=direction.map((amount,i)=>amount/motions[names[i]].walkSpeed),sum=raw.reduce((a,b)=>a+b,0),weights=raw.map(value=>value/sum);
    const clip=motions[names[0]],rate=speed*sum/this.root.scale.x;
    this.guardWalkPhase=((this.guardWalkPhase||0)+dt*rate/clip.duration)%1;
    if(!this.guardWalking){this.heldBlend={start:this.mixer.time,duration:.1,r:this.weapon.quaternion.clone(),l:this.offhand?.quaternion.clone(),station:this.weapon.userData.primaryGrip};this.actions.get(this.current)?.fadeOut(.1);this.guardWalkActions=names.map(name=>this.actions.get(name));for(const action of this.guardWalkActions){action.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveTimeScale(0).play();}this.guardWalking=true;this.guardWalkBlend=0;}
    this.guardWalkBlend=Math.min(1,this.guardWalkBlend+dt/.1);
    this.guardWalkActions.forEach((action,i)=>{action.time=this.guardWalkPhase*clip.duration;action.setEffectiveWeight(weights[i]*this.guardWalkBlend);});
    this.current=names[weights.indexOf(Math.max(...weights))];this.oneShot=0;
    this.handGrip?.engage(!!motions[this.current]?.twoHanded,.1);
  }
  stepRun(angle,speed,dt,sprint=false){
    const names=sprint?['Sprint_Forward']:['Run_Forward','Run_Right','Run_Backward','Run_Left'];
    const direction=sprint?[1]:[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))];
    const raw=direction.map((amount,i)=>{const spec=locomotion[names[i]];return amount/(2*spec.amplitude/(spec.support*spec.duration));});
    const sum=raw.reduce((a,b)=>a+b,0),weights=raw.map(value=>value/sum),duration=locomotion[names[0]].duration;
    this.runPhase=((this.runPhase||0)+dt*speed*sum/(this.root.scale.x*duration))%1;
    if(!this.running||this.runSprint!==sprint){
      this.runFade=this.runFootwork?.entryBody?.length ? .24 : .12;
      this.armContinuation?.release(this.mixer.time,this.runFade);
      if(this.guardWalking){for(const action of this.guardWalkActions)action.fadeOut(this.runFade);this.guardWalking=false;}
      if(this.running)for(const action of this.runActions)action.fadeOut(this.runFade);else this.actions.get(this.current)?.fadeOut(this.runFade);
      this.runActions=names.map(name=>this.actions.get(name));
      for(const action of this.runActions)action.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveTimeScale(0).play();
      this.running=true;this.runSprint=sprint;this.runBlend=0;
    }
    this.runBlend=Math.min(1,this.runBlend+dt/this.runFade);
    this.runActions.forEach((action,i)=>{action.time=this.runPhase*duration;action.setEffectiveWeight(weights[i]*this.runBlend);});
    this.current=names[weights.indexOf(Math.max(...weights))];this.oneShot=0;
    this.handGrip?.engage(false,.12);
  }
  update(time,dt,{moving=false,sprinting=false,attack=0,golf=false,swing=0,putting=false,dodge=false,action=null,emerging=null,focused=false,moveAngle=0,moveSpeed=null,cinematic=false,expressionDt=dt,enemyAction=null,selection=false,blocking=false,parry=0,guardBreak=0,guardHitToken=0,groundHeight=null,gazeTarget=null,previewPose=null}={}){
    this.handGrip?.restore();this.handGrip?.prepare(golf);
    this.armContinuation?.restore();
    // Capture the moving-attack pose before removing it, but undo terrain first:
    // the terrain layer applies support and shoe tilt again after the run blend.
    this.footPlacement?.restore();
    if(!action&&moving&&!this.running&&(this.attackLocomotion?.weight>0||this.runFootwork?.exitAge!==undefined))this.runFootwork?.captureEntry({includeBody:this.attackLocomotion.pelvisGaitWeight>0||this.runFootwork.exitAge!==undefined});
    this.runFootwork?.restore();this.attackLocomotion?.restore();this.travelPose?.restore();this.facialPose?.restore();
    for(const [bone,rotation]of this.overlays)bone.quaternion.multiply(rotation.invert());this.overlays=[];for(const [bone,scale]of this.coreScales)bone.scale.copy(scale);this.coreScales=[];this.model.quaternion.copy(this.restModelRotation);
    this.weapon.visible=!golf&&!cinematic;this.club.visible=golf;if(this.offhand)this.offhand.visible=!golf&&!cinematic;
    if(this.dead>0){if(this.runFootwork){this.runFootwork.exitPose=null;this.runFootwork.exitAge=undefined;this.runFootwork.resetEntry();this.runFootwork.resetDirection();}this.weapon.visible=false;if(this.offhand)this.offhand.visible=false;if(!this.deathStarted){this.deathStarted=true;this.play('Death01',.08,true,1.6);}this.mixer.update(dt);this.updateSkinDeformation();return;}
    this.oneShot=Math.max(0,this.oneShot-dt);
    const guardPrefix=GUARD_PREFIX[WARRIORS[this.type]?.combatStyle],guardEnabled=!this.enemy&&!golf&&!cinematic;
    const guardImpact=guardEnabled&&!action&&!swing&&!dodge&&(parry>0&&!this.wasParry||blocking&&guardHitToken>0&&guardHitToken!==this.lastGuardHitToken);
    if(previewPose){
      if(this.current!==previewPose.clip)this.play(previewPose.clip,.07,true);
      const previewAction=this.actions.get(previewPose.clip);
      if(!previewAction)throw Error('Missing showcase animation: '+previewPose.clip);
      previewAction.setEffectiveTimeScale(0);previewAction.time=previewPose.time;
    }
    else if(selection){this.oneShot=0;this.play(WARRIORS[this.type].selectionClip,0);}
    else if(dodge&&!this.wasDodge)this.play('Roll',.06,true,1.4);
    else if(guardEnabled&&guardBreak>0&&!this.wasGuardBreak&&!action&&!dodge)this.play(`${guardPrefix}_Guard_Break`,.045,true);
    else if(emerging){this.play(emerging.progress<.68?'Jump_Loop':'Jump_Land',.10,false,1.8);}
    else if(enemyAction&&this.actionToken!==enemyAction.token){this.actionToken=enemyAction.token;const name=ENEMY_TYPES[this.type].clip;this.play(name,.07,true,motions[name].duration/enemyAction.duration);}
    else if(action&&this.actionToken!==action.token){this.actionToken=action.token;const name=action.motionName??combatMotionName(WARRIORS[this.type],action.kind,action.step);this.play(name,.07,true,motions[name].duration/action.duration);}
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
    if(moving&&['Jog_Fwd_Loop','Sprint_Loop'].includes(this.current)){
      // Match the enemy's steps to slower formation movement and collision-limited travel.
      const pace=this.enemy&&moveSpeed!==null?enemyStrideRate(this.current,moveSpeed,this.root.scale.x):sprinting?1.15:1;
      this.actions.get(this.current).setEffectiveTimeScale((focused&&Math.cos(moveAngle)<-.5?-1:1)*pace);
    }
    this.mixer.update(dt);
    // Extracted root travel and the skeleton use the same action clock.
    // An attack started by input this frame still has time zero.
    if((action?.planarRoot||action?.syncMotion)&&!previewPose){const playback=this.actions.get(this.current);playback.time=Math.min(playback.getClip().duration,action.time/action.duration*playback.getClip().duration);this.mixer.update(0);}
    this.armContinuation?.apply(this.mixer.time);
    // Small distributed rotations preserve the source animation and give the core elastic follow-through.
    const overlay=(name,x,y,z)=>{const bone=this.bones[name];if(!bone)return;const r=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));bone.quaternion.multiply(r);this.overlays.push([bone,r]);};
    if(!selection&&!golf&&!dodge&&!emerging&&!motions[this.current]?.athleticAttack&&!motions[this.current]?.nativeAttackReady&&!/_Guard_|^Run_|^Sprint_Forward$/.test(this.current)){
      const gait=moving?Math.sin(time*(sprinting?15:11)):Math.sin(time*2)*.12;
      for(const [i,name] of ['spine_01','spine_02','spine_03'].entries())overlay(name,(moving?.025:0)+gait*.018,gait*.035*(i===2?-1:1),gait*.022);
      if(focused&&moving){const twist=Math.sin(moveAngle)*.6;overlay('pelvis',0,twist,0);overlay('spine_01',0,-twist*.4,0);overlay('spine_02',0,-twist*.6,0);}
      if(action){for(const name of ['spine_01','spine_02']){const bone=this.bones[name];this.coreScales.push([bone,bone.scale.clone()]);const squash=1-Math.sin(action.time/action.duration*Math.PI)*.012;bone.scale.multiply(new THREE.Vector3(1/Math.sqrt(squash),squash,1/Math.sqrt(squash)));}}

    }
    if(this.running)this.runFootwork?.apply(this.runActions,this.runPhase,this.runBlend,{dt});
    else{this.runFootwork?.resetEntry();this.runFootwork?.resetDirection();this.runFootwork?.applyExit(selection||previewPose?0:dt);}
    const motion=sampleMotionInto(this.current,this.actions.get(this.current)?.time||0,this.motionSample);
    let contactWeights=null,stance=null;
    if(this.running||this.guardWalking){
      contactWeights={};stance={};const running=this.running,phase=running?this.runPhase:this.guardWalkPhase,support=running ? .28 : .5;
      for(const [side,offset]of running?[['r',0],['l',.5]]:[['r',.25],['l',.75]]){const p=(phase+offset)%1;stance[side]=p<support;contactWeights[side]=p<support?1:p<support+.10?1-THREE.MathUtils.smoothstep(p,support,support+.10):THREE.MathUtils.smoothstep(p,.90,1);}
    }
    if(this.running&&this.runFootwork.gaitContacts)({contactWeights,stance}=this.runFootwork.gaitContacts);
    const authoredAttack=!!action;
    const authoredFeet=authoredAttack||!!motions[this.current]?.nativeKneeHinges;
    if(authoredFeet&&!this.guardWalking)({contactWeights,stance}=attackFootContacts(this.footContactMotions.get(this.current),this.actions.get(this.current)?.time||0,motion));
    if(golf||dodge||emerging||selection||cinematic||this.running||action?.kind==='musou')this.attackLocomotion?.reset();
    const attackSteps=this.attackLocomotion?.apply(dt,{active:authoredAttack&&!action.planarRoot&&action.kind!=='musou'&&moving,speed:moveSpeed??0,angle:moveAngle,runPhase:this.runPhase??null,kneeSolver:motions[this.current]?.nativeKneeHeading?headingKnee:undefined,pelvisGaitWeight:motions[this.current]?.pelvisGaitWeight??0});
    if(attackSteps){const original=contactWeights||{r:0,l:0};contactWeights={};stance={};for(const side of ['r','l']){contactWeights[side]=THREE.MathUtils.lerp(original[side],attackSteps.contactWeights[side],attackSteps.weight);stance[side]=contactWeights[side]>.95;}}
    this.footPlacement?.apply(dt,groundHeight,{golf,contactWeights,stance,preserveAuthored:this.running||authoredFeet||!!attackSteps,preserveHinge:this.running||!!motions[this.current]?.nativeKneeHinges,enforceClearance:this.running,kneeSolver:this.running||motions[this.current]?.nativeKneeHeading?headingKnee:undefined,enabled:!selection&&!dodge&&!emerging&&!/Roll|Jump_|Death/.test(this.current)&&!(!authoredAttack&&this.current.includes('Musou')&&motion?.footR?.[2]>.06&&motion?.footL?.[2]>.06)});
    if(golf||selection)this.travelPose?.reset();
    this.travelPose?.apply(dt,this.running&&!golf&&!dodge&&!selection&&!action&&!blocking,{motion,nativeAttachment:!!motions[this.current]?.nativeAttachment,exitDuration:blocking?.30:action?.kind==='light'?(motions[this.current]?.carryExitDuration??(motions[this.current]?.athleticAttack?.10:.12)):action?.kind==='heavy'?(motions[this.current]?.carryExitDuration??.22):.16});
    if(this.facialPose){
      if(cinematic){
        const head=this.bones.Head,chin=new THREE.Quaternion().setFromAxisAngle(this.facialPose.right,2*Math.PI/180);
        head.quaternion.multiply(chin);this.overlays.push([head,chin]);
      }
      let gazeYaw=0,gazePitch=0;
      const eye=this.bones.Bip01_REye;
      if(gazeTarget&&eye){
        eye.getWorldPosition(this.eyePosition);eye.getWorldQuaternion(this.eyeRotation).invert();
        this.gazeDirection.copy(gazeTarget).sub(this.eyePosition).applyQuaternion(this.eyeRotation);
        gazeYaw=Math.atan2(this.gazeDirection.z,this.gazeDirection.x);
        gazePitch=Math.atan2(-this.gazeDirection.y,Math.hypot(this.gazeDirection.x,this.gazeDirection.z));
      }
      this.facialPose.apply(expressionDt,{gazeYaw,gazePitch,exertion:cinematic||action?1:moving?(sprinting?.8:.4):0,musou:cinematic||action?.kind==='musou'?1:0,enabled:!golf&&!dodge&&!emerging});
    }
    this.syncHeldObjects(motion,golf);
  }
  syncHeldObjects(motion=sampleMotionInto(this.current,this.actions.get(this.current)?.time||0,this.motionSample),golf=false){
    if(this.handGrip){this.handGrip.apply(motion,golf,motions[this.current]);this.updateSkinDeformation();return;}
    // Anchor the handle to the evaluated palm after every mixer and torso update.
    // Authored directions control the shaft; the live palm also controls blade roll.
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
      if(!golf&&this.palmWeaponFrames?.[side]){
        hand.matrixWorld.decompose(decomposedPosition,handRotation,decomposedScale);
        held.quaternion.copy(handRotation).premultiply(rootRotation).multiply(this.palmWeaponFrames[side]).normalize();
        const travelShaft=this.travelPose?.shaftDirections[side];
        if(travelShaft)alignWeaponShaft(held.quaternion,travelShaft);
        else if(from&&to&&!(this.travelPose?.weight>0)){
          shaftDirection.set(to[0]-from[0],to[2]-from[2],from[1]-to[1]).normalize();
          alignWeaponShaft(held.quaternion,shaftDirection);
          const blend=this.heldBlend;
          if(blend?.[side])held.quaternion.slerp(blend[side],1-THREE.MathUtils.clamp((this.mixer.time-blend.start)/blend.duration,0,1));
        }
        // Native hand animation already contains the authored roll.
        return;
      }
      if(this.travelPose?.shaftDirections[side]){
        held.quaternion.setFromUnitVectors(axisY,this.travelPose.shaftDirections[side]);held.rotateY(roll*(1-this.travelPose.weight));
      }else if(from&&to&&!(this.travelPose?.weight>0)){
        shaftDirection.set(to[0]-from[0],to[2]-from[2],from[1]-to[1]);
        if(golf)held.scale.setScalar(shaftDirection.length()/1.12);
        held.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());held.rotateY(roll);
        const blend=this.heldBlend;
        if(!golf&&blend?.[side])held.quaternion.slerp(blend[side],1-THREE.MathUtils.clamp((this.mixer.time-blend.start)/blend.duration,0,1));
      }else{
        // Across the palm, perpendicular to wrist-to-knuckle direction.
        if(golf&&from&&to)held.scale.setScalar(Math.hypot(...to.map((v,i)=>v-from[i]))/1.12);
        hand.matrixWorld.decompose(decomposedPosition,handRotation,decomposedScale);
        shaftDirection.copy(this.shaftAxes[side]).applyQuaternion(handRotation).applyQuaternion(rootRotation);
        held.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());
      }
    };
    attach(golf?this.club:this.weapon,'r',motion?.grip,motion?.tip,motion?.roll||0);
    if(this.offhand&&!golf)attach(this.offhand,'l',motion?.offGrip,motion?.offTip,motion?.offRoll||0);
    this.updateSkinDeformation();

  }

  weaponPoints(offhand=false){const held=offhand&&this.offhand?this.offhand:this.weapon;this.root.updateMatrixWorld(true);held.localToWorld(this.tip.fromArray(held.userData.tip));held.getWorldPosition(this.hilt);return [this.hilt,this.tip];}
  updateSkinDeformation(){
    if(!this.forearmTwist)return;
    let weight=0;
    if(this.forearmTwist.upperArmHelpers.r)for(const golf of [this.actions.get('Golf_Swing'),this.repeatActions?.get('Golf_Swing')])
      if(golf?.isScheduled())weight+=golfShoulderSkinWeight(golf.time,THREE.MathUtils.clamp(golf.getEffectiveWeight(),0,1));
    weight=Math.min(1,weight);
    this.forearmTwist.update({refreshMatrices:false,upperArmWeight:weight});
  }
  dispose(){this.skinBounds?.dispose();this.facialPose?.restore();this.attackLocomotion?.dispose();this.forearmTwist?.dispose();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const material of this.ownedMaterials)material.dispose();}
}
export class CrowdRenderer {
  constructor(scene){
    this.scene=scene;this.active=new Set();const before=scene.onBeforeRender;
    // Three updates all world matrices before this callback, then tests camera
    // and shadow visibility. This also covers late root movement and reflections.
    scene.onBeforeRender=(renderer,renderScene,camera,target)=>{
      before.call(renderScene,renderer,renderScene,camera,target);
      for(const actor of this.active)if(actor.root.visible)actor.skinBounds?.update();
    };
  }
  update(enemies){const present=new Set(enemies);for(const e of this.active)if(!present.has(e)){this.scene.remove(e.root);e.dispose();this.active.delete(e);}for(const e of enemies)if(!this.active.has(e)){if(e.enemy)e.skinBounds=installSkinnedBounds(e.model);this.scene.add(e.root);this.active.add(e);}}
}
