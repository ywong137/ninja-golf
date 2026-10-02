import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Quaternion,Vector3} from 'three';
import {RunTurnBalance} from '../src/run-turn-balance.js';
import {FootPlacement} from '../src/foot-placement.js';
import {headingKnee} from '../src/knee-alignment.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
const scaleDistortion=bone=>{
 let ratio=1;for(let parent=bone.parent;parent;parent=parent.parent){const s=parent.scale.toArray().map(Math.abs);ratio*=Math.max(...s)/Math.min(...s);}
 return ratio-1;
};

for(const character of [...WARRIORS,...ENEMY_APPEARANCES])test(`${character.model}: turn balance preserves hand relationships and native leg hinges at both frame rates`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+character.model+'.glb',import.meta.url)),root=new Group(),bones={};
 root.add(g.scene);root.scale.setScalar(1.1);g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});root.updateMatrixWorld(true);
 const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>bones[n+'_'+s]))]));
 const balance=new RunTurnBalance(root,bones,anatomy),placement=new FootPlacement(root,bones);
 const clip=g.animations.find(c=>c.name==='Run_Forward')??g.animations.find(c=>c.name==='Jog_Fwd_Loop');
 const action=g.mixer.clipAction(clip).setEffectiveTimeScale(0).play();
 for(const hz of [40,120])for(const sign of [-1,1])for(const yaw of [0,1.1])for(const support of ['both','r','l']){
  placement.restore();balance.reset();placement.reset();root.rotation.y=yaw;
  balance.observe({x:4*Math.sin(yaw),z:4*Math.cos(yaw)});
  for(let i=1;i<=hz*.5;i++){
   placement.restore();balance.restore();action.time=clip.duration*.12;g.mixer.update(0);root.updateMatrixWorld(true);
   const original={p:bones.pelvis.position.clone(),q:bones.pelvis.quaternion.clone()};
   const right=rotation(bones.hand_r),left=rotation(bones.hand_l),relative=right.clone().invert().multiply(left);
   const handOffset=point(bones.hand_l).sub(point(bones.hand_r)).applyQuaternion(right.clone().invert());
   const lengths=Object.fromEntries(['r','l'].map(s=>[s,[point(bones['thigh_'+s]).distanceTo(point(bones['calf_'+s])),point(bones['calf_'+s]).distanceTo(point(bones['foot_'+s]))]]));
   const links=Object.fromEntries(['r','l'].map(s=>[s,['calf','foot'].map(n=>{
    const bone=bones[n+'_'+s];return{bone,p:bone.position.clone(),scale:bone.scale.clone(),distortion:scaleDistortion(bone)};
   })]));
   const heading=yaw+sign*i/hz*2.4,velocity={x:4*Math.sin(heading),z:4*Math.cos(heading)};
   const weights={r:Number(support!=='l'),l:Number(support!=='r')};
   const targets=balance.apply(1/hz,{velocity,active:true,groundHeight:()=>0,contactWeights:weights});
   assert.ok(balance.report.angle>0&&balance.report.angle<=22*Math.PI/180+1e-9);
   const handR=rotation(bones.hand_r),handL=rotation(bones.hand_l);
   assert.ok(handR.clone().invert().multiply(handL).angleTo(relative)<1e-5,'Turn opened the paired hand orientation');
   assert.ok(point(bones.hand_l).sub(point(bones.hand_r)).applyQuaternion(handR.invert()).distanceTo(handOffset)<1e-5,'Turn opened the paired hand spacing');
   placement.apply(1/hz,()=>0,{preserveAuthored:true,preserveHinge:true,worldFootTargets:targets,contactWeights:weights,kneeSolver:headingKnee});
   for(const s of ['r','l']){
    const hip=point(bones['thigh_'+s]),knee=point(bones['calf_'+s]),foot=point(bones['foot_'+s]);
    const lengthError=[Math.abs(hip.distanceTo(knee)-lengths[s][0]),Math.abs(knee.distanceTo(foot)-lengths[s][1])];
    // Imported female thighs retain about 26 ppm of unequal bind scale.
    // Rotation can expose that measured distortion; local links must not stretch.
    for(const [j,link]of links[s].entries()){
     assert.deepEqual(link.bone.position.toArray(),link.p.toArray());
     assert.deepEqual(link.bone.scale.toArray(),link.scale.toArray());
     assert.ok(lengthError[j]<=lengths[s][j]*link.distortion+1e-6,'Turn exceeded the native scale bound: '+JSON.stringify({hz,sign,yaw,support,frame:i,side:s,lengthError,distortion:link.distortion}));
    }
    const measured=measureLegAnatomy(anatomy[s],...['thigh','calf','foot'].map(n=>bones[n+'_'+s]));
    assert.ok(measured.kneeFlexion>=0&&measured.kneeDeviation<.1,'Turn reversed or twisted a knee');
    if(weights[s])assert.ok(foot.distanceTo(targets[s].p)<.005,'Turn lost a supporting foot target');
   }
   placement.restore();balance.restore();
   assert.deepEqual(bones.pelvis.position.toArray(),original.p.toArray());
   assert.deepEqual(bones.pelvis.quaternion.toArray(),original.q.toArray());
  }
 }
});

test('straight speed changes do not add turn lean or alter the captured pose',()=>{
 const balance=new RunTurnBalance(new Group(),{},{});
 for(const hz of [40,120]){
  balance.reset();balance.observe({x:0,z:1});
  for(let i=1;i<=hz;i++)assert.equal(balance.apply(1/hz,{velocity:{x:0,z:1+i/hz*4},active:true,groundHeight:()=>0}),null);
  assert.equal(balance.report.angle,0);
 }
 assert.throws(()=>balance.apply(Infinity,{velocity:{x:0,z:1},active:true,groundHeight:()=>0}),/finite/);
});
