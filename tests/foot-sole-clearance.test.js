import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,LoopOnce} from 'three';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';
import {FootPlacement} from '../src/foot-placement.js';
import {captureFootSoles,sampleFootSole} from '../src/foot-sole.js';
import {headingKnee} from '../src/knee-alignment.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {createSourceGaitRetarget} from '../tools/source-gait-retarget.mjs';
import {loadNativeSkin} from './native-skin-helper.mjs';

const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
for(const character of [...WARRIORS,...ENEMY_APPEARANCES])test(`${character.model}: actual sole clears a local terrain bump without reversing a knee or changing the paired grip`,async()=>{
 const source=await loadNativeSkin(new URL('./fixtures/source-gaits.glb',import.meta.url));
 const target=await loadNativeSkin(new URL('../public/models/'+character.model+'.glb',import.meta.url));
 const retarget=createSourceGaitRetarget(source.scene,target.scene),bones=retarget.bones;
 target.scene.scale.setScalar(1.1);target.scene.updateMatrixWorld(true);
 const placement=new FootPlacement(target.scene,bones),soles=captureFootSoles(target.scene);
 for(const side of ['r','l']){
  const ankle=point(bones['foot_'+side]),shoe=rotation(bones['foot_'+side]);
  const forward=point(bones['ball_'+side]).sub(ankle).setY(0).normalize(),axis=new Vector3(0,1,0).cross(forward);
  for(const degrees of [-65,-30,0,30,65]){
   const pitch=new Quaternion().setFromAxisAngle(axis,degrees*Math.PI/180);
   const anchors=placement.feet[side].contacts.map(p=>p.clone().applyQuaternion(shoe).applyQuaternion(pitch));
   const surface=soles[side].map(v=>v.bind.clone().sub(ankle).applyQuaternion(pitch));
   assert.ok(Math.min(...anchors.map(p=>p.y))<=Math.min(...surface.map(p=>p.y))+.000001,'Toe/heel support must not sit inside a pitching shoe.');
  }
 }
 const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>bones[n+'_'+s]))]));
 const clip=source.animations.find(c=>c.name==='Jog_Fwd_Loop');
 const action=source.mixer.clipAction(clip).setLoop(LoopOnce).play();action.clampWhenFinished=true;
 for(const phase of [.02,.18,.52,.68])for(const hz of [40,120]){
  placement.restore();placement.reset();target.scene.position.set(0,0,0);
  action.time=phase*clip.duration;source.mixer.update(0);retarget.apply();target.scene.updateMatrixWorld(true);
  let surface=['r','l'].flatMap(s=>sampleFootSole(soles[s]));
  target.scene.position.y-=Math.min(...surface.map(p=>p.y));target.scene.updateMatrixWorld(true);
  surface=['r','l'].flatMap(s=>sampleFootSole(soles[s]));
  const witness=surface.reduce((a,b)=>a.y<b.y?a:b);
  const ground=(x,z)=>.024*Math.exp(-((x-witness.x)**2+(z-witness.z)**2)/.0016);
  assert.ok(Math.min(...surface.map(p=>p.y-ground(p.x,p.z)))<-.023,'The fixture must intersect the visible sole.');
  const handSpan=point(bones.hand_l).sub(point(bones.hand_r));
  const handRotations=['r','l'].map(s=>rotation(bones['hand_'+s]));
  const lengths=Object.fromEntries(['r','l'].map(s=>{const [a,b,c]=['thigh','calf','foot'].map(n=>point(bones[n+'_'+s]));return[s,[a.distanceTo(b),b.distanceTo(c)]];}));
  placement.apply(1/hz,ground,{preserveAuthored:true,preserveHinge:true,enforceClearance:true,
   referencePlane:{normal:new Vector3(0,1,0),height:()=>0},kneeSolver:headingKnee,contactWeights:{r:0,l:0}});
  target.scene.updateMatrixWorld(true);
  for(const [i,side]of ['r','l'].entries()){
   const gap=Math.min(...sampleFootSole(soles[side]).map(p=>p.y-ground(p.x,p.z)));
   assert.ok(gap>-.0001,`Visible sole penetrated by ${-gap} m at ${phase}/${hz}/${side}`);
   const leg=['thigh','calf','foot'].map(n=>bones[n+'_'+side]),positions=leg.map(point);
   for(let j=0;j<2;j++)assert.ok(Math.abs(positions[j].distanceTo(positions[j+1])-lengths[side][j])<.00003,'The correction stretched a leg.');
   const measure=measureLegAnatomy(anatomy[side],...leg);
   assert.ok(measure.kneeFlexion>=-.001&&measure.kneeDeviation<.01,'The correction reversed or twisted the knee.');
   assert.ok(rotation(bones['hand_'+side]).angleTo(handRotations[i])<.00001,'Foot correction rotated a hand.');
  }
  assert.ok(point(bones.hand_l).sub(point(bones.hand_r)).distanceTo(handSpan)<.000001,'Foot correction opened the grip.');
 }
});
