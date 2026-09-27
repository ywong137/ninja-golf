import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as THREE from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';

const file=process.env.NINJA_SORA_MODEL_DIR
 ?path.join(process.env.NINJA_SORA_MODEL_DIR,'sora.glb')
 :new URL('../public/models/sora.glb',import.meta.url);
const loaded=loadNativeSkin(file).then(g=>({g,metadata:skinGroups(g)}));
const names=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'];
function play(g,name){
 g.mixer.stopAllAction();
 const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`Missing native ${name}`);
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 return{clip,action};
}
function sample(g,action,seconds){action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);}
const point=(g,name)=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());

test('Sora attacks return to the same body and palm pose as her Ready animation',async()=>{
 const {g}=await loaded,{action:ready}=play(g,'Sickle_Ready');sample(g,ready,0);
 const bones=['pelvis','spine_03','lowerarm_r','hand_r','lowerarm_l','hand_l','foot_r','foot_l'];
 const rotation=name=>g.scene.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion()).normalize();
 const reference=Object.fromEntries(bones.map(name=>[name,{position:point(g,name),rotation:rotation(name)}]));
 for(const suffix of names){
  const {clip,action}=play(g,'Sickle_'+suffix);
  for(const seconds of [0,clip.duration]){
   sample(g,action,seconds);
   for(const name of bones){
    const rest=reference[name];
    assert.ok(point(g,name).distanceTo(rest.position)<.001,`${suffix} ${seconds}s: ${name} does not meet Ready`);
    assert.ok(rotation(name).angleTo(rest.rotation)<THREE.MathUtils.degToRad(.25),`${suffix} ${seconds}s: ${name} turns away from Ready`);
   }
  }
 }
});

for(const suffix of names)test(`Sora ${suffix}: both arms stay clear through entry, cut, and recovery`,async t=>{
 const {g,metadata}=await loaded;
 const {clip,action}=play(g,'Sickle_'+suffix),previous={},worst={inset:0,forearmTorso:0,rightSpeed:0,leftSpeed:0};
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const seconds=Math.min(frame/240,clip.duration);sample(g,action,seconds);
  for(const side of ['r','l']){
   const elbow=point(g,'lowerarm_'+side).sub(point(g,'upperarm_'+side)),old=previous[side],dt=old?seconds-old.seconds:0;
   const skin=measureArmSkin(g,metadata,side),speed=dt>1e-7?elbow.distanceTo(old.elbow)/dt:0;
   worst.inset=Math.max(worst.inset,skin['fold_'+side].maxRadialPenetration);
   worst.forearmTorso=Math.max(worst.forearmTorso,skin['forearmTorso_'+side].pairs);
   const key=side==='r'?'rightSpeed':'leftSpeed';worst[key]=Math.max(worst[key],speed);
   previous[side]={seconds,elbow};
  }
 }
 t.diagnostic(JSON.stringify(worst));
 assert.ok(worst.inset<=.003,'A forearm folds into the middle upper arm');
 assert.equal(worst.forearmTorso,0,'A forearm passes through the torso');
 assert.ok(worst.rightSpeed<15,'The weapon elbow reverses its bend plane');
 assert.ok(worst.leftSpeed<8,'The free elbow jumps during its guard transition');
});

test('Sora descending heavies retain a low stance and transfer onto the receiving leg',async t=>{
 const {g}=await loaded,reports=[];
 for(const [suffix,hit,side]of [['Heavy_Cleave',.36,'r'],['Heavy_Slam',.47,'l']]){
  const {action}=play(g,'Sickle_'+suffix);sample(g,action,0);const readyHeight=point(g,'pelvis').y;
  const rows=[];
  for(let frame=0;frame<=Math.ceil((hit+.07)*240);frame++){
   const seconds=frame/240;sample(g,action,seconds);
   const hips=point(g,'thigh_l').add(point(g,'thigh_r')).multiplyScalar(.5);
   const torso=point(g,'upperarm_l').add(point(g,'upperarm_r')).multiplyScalar(.5).sub(hips);
   const lateral=point(g,'thigh_l').sub(point(g,'thigh_r')).setY(0).normalize();
   const forward=lateral.cross(new THREE.Vector3(0,1,0)).normalize();
   const rear=point(g,'foot_'+(side==='r'?'l':'r')),line=point(g,'foot_'+side).sub(rear).setY(0);
   rows.push({seconds,height:point(g,'pelvis').y,lean:Math.atan2(torso.dot(forward),torso.y)*180/Math.PI,lead:hips.sub(rear).dot(line)/line.lengthSq()});
  }
  const mean=(from,to,key)=>{const samples=rows.filter(r=>r.seconds>=from&&r.seconds<=to);assert.ok(samples.length>=9);return samples.reduce((sum,r)=>sum+r[key],0)/samples.length;};
  const loaded=mean(hit*.30,hit*.50,'height'),impact=mean(hit,hit+.045,'height');
  const report={suffix,drop:readyHeight-impact,impactLean:mean(hit,hit+.045,'lean'),transfer:mean(hit+.03,hit+.07,'lead')-mean(hit*.30,hit*.50,'lead'),riseAtContact:impact-loaded};
  reports.push(report);
  assert.ok(report.drop>.10,'The receiving stance stays almost as upright as Ready');
  assert.ok(report.impactLean>18,'The torso does not follow the descending blade');
  assert.ok(report.transfer>.20,'The body does not transfer across the support base');
  assert.ok(report.riseAtContact<.005,'The body rises while the blade cuts downward');
 }
 t.diagnostic(JSON.stringify(reports));
});
