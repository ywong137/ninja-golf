import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin,skinGroups} from './native-skin-helper.mjs';
import {installForearmTwistHelpers,installLimbSkinning} from '../src/forearm-twist.js';
import {golfShoulderSkinWeight,golfShoulderSwingWeight} from '../src/golf-shoulder-skin.js';

const file=new URL('../public/models/kaede.glb',import.meta.url);
function surfaces(g){
 g.scene.updateMatrixWorld(true);const out=[];
 g.scene.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();out.push(Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new T.Vector3())));}});
 return out;
}
function difference(a,b){let max=0;for(let m=0;m<a.length;m++)for(let v=0;v<a[m].length;v++)max=Math.max(max,a[m][v].distanceTo(b[m][v]));return max;}

test('the shoulder correction has smooth, silent boundaries and follows action fading',()=>{
 for(const t of [-1,0,1.26,1.82,2.4,20])assert.equal(golfShoulderSkinWeight(t),0);
 assert.equal(golfShoulderSkinWeight(1.471),1);
 assert.equal(golfShoulderSkinWeight(1.471,.25),.25);
 for(const t of [1.26,1.44,1.55,1.82]){
  const h=.00001,derivative=(golfShoulderSkinWeight(t+h)-golfShoulderSkinWeight(t-h))/(2*h);
  assert.ok(Math.abs(derivative)<1e-5,`Abrupt correction boundary at ${t}`);
 }
 for(const args of [[NaN], [1,NaN], [1,-.1], [1,1.1]])assert.throws(()=>golfShoulderSkinWeight(...args));
});

test('disabled upper-arm skin matches the original surface through every Ace animation',async t=>{
 const before=await loadNativeSkin(file),after=await loadNativeSkin(file);
 const originalGroups=skinGroups(after).triangles;
 const original=installForearmTwistHelpers(before.scene),candidate=installLimbSkinning(after.scene,{upperArms:['r'],overflow:'nearest'});
 // Fitted clothing keeps four GPU weights; a small boundary set uses the nearest twist station.
 assert.ok(candidate.report.quantizedOverflowVertices<100);
 assert.equal(candidate.report.maximumInfluences,4);
 assert.deepEqual(skinGroups(after).triangles,originalGroups,'Collision groups must retain the corrected shoulder skin.');
 let maximumError=0,samples=0;
 for(const clip of before.animations){
  before.mixer.stopAllAction();after.mixer.stopAllAction();
  const a=before.mixer.clipAction(clip).setLoop(T.LoopOnce).play(),b=after.mixer.clipAction(after.animations.find(c=>c.name===clip.name)).setLoop(T.LoopOnce).play();
  a.clampWhenFinished=b.clampWhenFinished=true;
  for(const fraction of [0,.5,1]){
   a.time=b.time=clip.duration*fraction;before.mixer.update(0);after.mixer.update(0);original.update();candidate.update();
   maximumError=Math.max(maximumError,difference(surfaces(before),surfaces(after)));samples++;
  }
 }
 assert.ok(maximumError<1e-6,`Inactive skin moved ${maximumError} metres.`);
 candidate.dispose();original.dispose();t.diagnostic(JSON.stringify({samples,maximumError}));
});

test('the active shoulder skin preserves all joints, survives seeks and restores native weights',async t=>{
 const g=await loadNativeSkin(file),source=[];g.scene.traverse(m=>{if(m.isSkinnedMesh)source.push([m,m.geometry,m.skeleton]);});
 const helper=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'}),a=g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Swing')).setLoop(T.LoopOnce).play();
 a.clampWhenFinished=true;let maxCorrection=0,maxStep=0,previous;
 for(let frame=0;frame<=1152;frame++){
  const time=frame/480;a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const joints=[];g.scene.traverse(b=>{if(b.isBone&&!b.name.includes('_skin_'))joints.push([b,b.matrixWorld.clone()]);});
  helper.update({upperArmWeight:golfShoulderSkinWeight(time)});
  for(const [b,m]of joints)assert.deepEqual(b.matrixWorld.elements,m.elements,`${b.name} moved at ${time}`);
  const current=helper.upperArmHelpers.r.base.quaternion.clone();if(previous)maxStep=Math.max(maxStep,current.angleTo(previous));previous=current;
  if(frame===706){const corrected=surfaces(g);helper.update();maxCorrection=difference(corrected,surfaces(g));}
 }
 assert.ok(maxCorrection>.001,'The correction did not reach the shoulder surface.');
 assert.ok(maxStep<.2,'The shoulder correction jumps or crosses a twist branch.');
 const pose=time=>{a.time=time;g.mixer.update(0);helper.update({upperArmWeight:golfShoulderSkinWeight(time)});return surfaces(g);};
 const expected=pose(1.471);pose(2.3);pose(.1);assert.ok(difference(expected,pose(1.471))<1e-6,'Seeking changes the shoulder surface.');
 helper.dispose();helper.dispose();for(const [mesh,geometry,skeleton]of source){assert.equal(mesh.geometry,geometry);assert.equal(mesh.skeleton,skeleton);}
 assert.equal(g.scene.getObjectByName('upperarm_skin_base_r'),undefined);
 t.diagnostic(JSON.stringify({samples:1153,maxCorrection,maxStepDegrees:maxStep*180/Math.PI}));
});

test('the optional shoulder correction falls back before a twist branch or singular swing',async()=>{
 const g=await loadNativeSkin(file),upper=g.scene.getObjectByName('upperarm_r'),lower=g.scene.getObjectByName('lowerarm_r');
 const rest=upper.quaternion.clone(),axis=lower.position.clone().normalize().applyQuaternion(rest);
 const helper=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'});let previous,maxStep=0;
 for(let degrees=155;degrees<=205;degrees+=.25){
  upper.quaternion.setFromAxisAngle(axis,degrees*Math.PI/180).multiply(rest);helper.update({upperArmWeight:1});
  const q=helper.upperArmHelpers.r.base.quaternion;
  if(previous)maxStep=Math.max(maxStep,q.angleTo(previous));previous=q.clone();
  if(degrees>=175&&degrees<=185)assert.ok(q.angleTo(upper.quaternion)<1e-7,'Twist branch must use the native skin.');
 }
 assert.ok(maxStep<3*Math.PI/180,'The optional skin correction flips across the principal-angle branch.');
 const perpendicular=axis.clone().cross(new T.Vector3(1,0,0)).normalize();
 upper.quaternion.setFromAxisAngle(perpendicular,Math.PI).multiply(rest);
 assert.doesNotThrow(()=>helper.update({upperArmWeight:1}));
 assert.ok(helper.upperArmHelpers.r.base.quaternion.angleTo(upper.quaternion)<1e-7);
 helper.dispose();
});

for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(hero+': shoulder cap preserves the complete golf skeleton and remains continuous',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+hero+'.glb',import.meta.url));
 const bones=[];g.scene.traverse(b=>{if(b.isBone)bones.push(b);});
 const helper=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'});
 const action=g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Swing')).play();let previous,maxStep=0;
 for(let frame=0;frame<=288;frame++){
  const time=frame/120;action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const before=bones.map(b=>b.matrixWorld.elements.slice());
  helper.update({upperArmWeight:golfShoulderSkinWeight(time),upperArmSwingWeight:golfShoulderSwingWeight(time)});
  for(let i=0;i<bones.length;i++)assert.deepEqual(bones[i].matrixWorld.elements,before[i]);
  const q=helper.upperArmHelpers.r.base.quaternion.clone();if(previous)maxStep=Math.max(maxStep,q.angleTo(previous));previous=q;
 }
 assert.ok(maxStep<.4,hero+': shoulder skin jumps between adjacent frames');
 action.time=.4;g.mixer.update(0);helper.update({upperArmSwingWeight:1});const pose=helper.upperArmHelpers.r.base.quaternion.clone();
 action.time=1.1;g.mixer.update(0);helper.update({upperArmSwingWeight:1});action.time=.4;g.mixer.update(0);helper.update({upperArmSwingWeight:1});
 assert.ok(pose.angleTo(helper.upperArmHelpers.r.base.quaternion)<1e-6,'Scrubbing changes the same shoulder pose');
 assert.equal(golfShoulderSwingWeight(0),1);assert.equal(golfShoulderSwingWeight(1.3),0);helper.dispose();
});
