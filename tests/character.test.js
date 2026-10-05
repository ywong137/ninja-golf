import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {BLADE_PROFILES,bladeGeometry} from '../src/weapons.js';
import {ENEMY_TYPES,enemyTypeForSlot,enemyIntent,guardDamageMultiplier,attackDefinition} from '../src/combat.js';
import {WARRIORS} from '../src/warriors.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {Projectiles} from '../src/projectiles.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
test('Blades have broad flat faces, distinct profiles, and bounded draw groups',()=>{
 for(const [name,p]of Object.entries(BLADE_PROFILES)){const g=bladeGeometry(p),size=g.boundingBox.getSize(new THREE.Vector3());assert.ok(size.x>size.z*7,`${name} must read as a flat blade`);assert.equal(g.groups.length,2);assert.ok(g.getAttribute('position').count<1800,'Blade geometry stays bounded');assert.ok(g.getAttribute('uv'),'Steel finish follows the blade surface');const normals=g.getAttribute('normal');for(let i=0;i<normals.count;i++)assert.ok(Number.isFinite(normals.getX(i)+normals.getY(i)+normals.getZ(i)),`${name}: finite normals`);g.dispose();}
});
test('Authored motion has continuous phase landmarks and a stable lead foot contract',()=>{
 for(const [name,c]of Object.entries(motions)){assert.equal(c.poses[0].t,0,name);assert.equal(c.poses.at(-1).t,1,name);for(let i=1;i<c.poses.length;i++)assert.ok(c.poses[i].t>c.poses[i-1].t,name);for(const p of c.poses){assert.ok(Object.values(p).flat().every(Number.isFinite),name);assert.ok(Math.hypot(...p.tip.map((x,i)=>x-p.grip[i]))>.3,name);}}
 const swing=motions.Golf_Swing;assert.equal(swing.duration,2.4);assert.ok(swing.poses.some(p=>Math.abs(p.hip-p.chest)>.3),'Hips and chest have separate turns');assert.ok(swing.poses.at(-1).heel>.5,'Trail heel rises into finish');
});
test('Enemy silhouettes correspond to different threats and counters',()=>{
 assert.equal(new Set(ENEMY_TYPES.map(e=>e.model)).size,4);assert.equal(new Set(Array.from({length:8},(_,i)=>enemyTypeForSlot(i))).size,4);
 assert.equal(guardDamageMultiplier(1,'light',true,false),.24);for(const args of [[1,'heavy',true,false],[1,'light',false,false],[1,'light',true,true],[0,'light',true,false]])assert.equal(guardDamageMultiplier(...args),1);
 const p={x:0,z:5},v={x:0,z:0};assert.ok(enemyIntent({type:3,x:0,z:0,slot:0},p,v).z<0,'Thrower retreats when approached');assert.deepEqual(enemyIntent({type:1,x:0,z:0,slot:0},p,v),p,'Guard advances');
});
test('Visible projectiles use swept collisions and can be dodged sideways',()=>{
 const scene=new THREE.Scene(),shots=new Projectiles(scene,{burst(){}}),player=new THREE.Vector3(0,0,0);let damage=0;
 shots.spawn(new THREE.Vector3(0,1,-2),new THREE.Vector3(0,1,2),8);shots.update(.3,player,n=>damage+=n);assert.equal(damage,8);assert.equal(shots.items.length,0);
 shots.spawn(new THREE.Vector3(0,1,-2),new THREE.Vector3(0,1,2),8);shots.update(.3,new THREE.Vector3(2,0,0),n=>damage+=n);assert.equal(damage,8);shots.clear();assert.equal(scene.children.length,0);
});
test('Combat choreography keeps the torso coupled and both weapon paths explicit',()=>{
 for(const [name,clip] of Object.entries(motions)){
  if(name.startsWith('Golf'))continue;
  for(const pose of clip.poses){
   // Imported records contain measured Euler headings, not procedural twist controls.
   // Their native joint frames receive the full-body skeleton tests.
   if(!clip.nativeSourceMotion)assert.ok(Math.abs(pose.chest-pose.hip)<.9,`${name}: excessive torso twist`);
   const paths=clip.nativeAttachment?(clip.twoHanded?['secondaryGrip']:[]):['offGrip','offTip'];
   for(const key of [...paths,'elbowR','elbowL','footR','footL'])assert.equal(pose[key].length,3,`${name}: ${key}`);
   // Native clips validate reach against the moving shoulder in their rig audit.
   // A root-origin radius is invalid when the whole body steps and turns.
   if(!clip.nativeAttachment)assert.ok(Math.hypot(pose.grip[0],pose.grip[1])<.85,`${name}: unreachable hand target`);
  }
 }
 for(const name of ['Musou_Flow','Twin_Musou_Flow']){
  const clip=motions[name];assert.equal(clip.duration,3.3);assert.equal(clip.impacts.length,6);assert.equal(clip.headings.length,6);
  assert.ok(clip.poses.length>=25,'Each cut has loading, contact, and follow-through');
  assert.ok(Math.abs(clip.poses.at(-1).hip-Math.PI*2)<1e-6,'A completed turn must not rewind through recovery');
  assert.ok(clip.poses.some(p=>p.footR[2]>.04),'Step clear of the floor during the turn');
 }
});
test('The three single-sword heroes have complete independent animation families',()=>{
 const names=['Ready','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'];
 for(const prefix of ['Fan_','Ring_','Sickle_'])for(const name of names){
  const hero=WARRIORS.find(hero=>hero.motionPrefix===prefix);
  const clip=motions[hero.motionOverrides?.[prefix+name]??prefix+name];assert.ok(clip,`${prefix}${name}`);assert.equal(typeof clip.twoHanded,'boolean');if(clip.twoHanded){assert.ok(clip.gripSpacing>0,'Two-handed attacks declare their handle spacing.');assert.ok(clip.poses.every(p=>p.secondaryGrip?.length===3),'Both hands follow the paired source.');}
  for(const p of clip.poses){
   assert.ok(Number.isFinite(p.roll));
   // Native clips animate the free arm directly; freeHand drives procedural poses.
   if(!clip.nativeAttachment)assert.ok(p.freeHand>0,'The free hand uses a distinct open guard');
  }
  if(name==='Musou_Flow'){
   assert.equal(clip.headings.length,clip.impacts.length,'Each strike has an explicit heading');
   assert.ok(clip.headings.every(Number.isFinite),'Strike headings remain finite');
   // Source clips retain their recorded recovery; their native skeleton tests
   // check body continuity instead of a procedural hip-heading constraint.
   if(!clip.nativeSourceMotion)assert.ok(Math.abs(clip.poses.at(-1).hip-clip.headings.at(-1))<1e-6,'Recovery preserves the final authored heading');
  }
  if(name==='Ready')assert.ok(Math.hypot(...clip.poses[0].grip.map((x,i)=>x-clip.poses.at(-1).grip[i]))<1e-6,'Stance loop closes without a hand jump');
  else {
   const index=names.indexOf(name)-1;
   const definition=withMotionTiming(attackDefinition(index<4?'light':index<8?'heavy':'musou',index%4,hero.combatStyle),clip);
   assert.ok(Math.abs((clip.combatDuration??clip.duration)-definition.duration)<1e-8,`${prefix}${name}: duration must match gameplay`);
   assert.notDeepEqual(clip.poses.map(p=>p.grip),motions[name].poses.map(p=>p.grip),'A new weapon needs its own trajectory');
  }
 }
 const guards=['Fan_','Ring_','Sickle_'].map(prefix=>motions[WARRIORS.find(w=>w.motionPrefix===prefix).readyClip].poses[0]);
 for(let i=0;i<guards.length;i++)for(let j=i+1;j<guards.length;j++)assert.notDeepEqual(guards[i],guards[j],'Each active Ready uses its own measured pose.');
});

test('Native human golf clips start at zero and preserve authored contact timing',()=>{
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const bytes=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67,`${hero}: GLB header`);
  const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const binaryStart=20+jsonLength+8;
  assert.ok(gltf.nodes.some(node=>node.extras?.nativeMotion),`${hero}: missing native motion rig`);
  for(const name of ['Golf_Swing','Golf_Putt']){
   const clip=gltf.animations.find(animation=>animation.name===name);assert.ok(clip,`${hero}: ${name}`);
   let clipEnd=0;
   for(const sampler of clip.samplers){
    const accessor=gltf.accessors[sampler.input],view=gltf.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType,5126,`${hero}/${name}: floating point times`);
    const start=binaryStart+(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||4;
    assert.equal(bytes.readFloatLE(start),0,`${hero}/${name}: a frame offset changes impact timing`);
    clipEnd=Math.max(clipEnd,bytes.readFloatLE(start+(accessor.count-1)*stride));
   }
   assert.ok(Math.abs(clipEnd-motions[name].duration)<1e-5,`${hero}/${name}: clip duration changed`);
  }
 }
});

test('Each native hero has a distinct braced guard and whole-body recoil clips',()=>{
 const styles={ronin:'Odachi',shinobi:'Twin',monk:'Naginata',kaede:'Fan',ayame:'Ring',sora:'Sickle'};
 for(const [hero,style]of Object.entries(styles)){
  const bytes=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size));
  const guards=gltf.animations.filter(clip=>clip.name.includes('_Guard_'));
  assert.deepEqual(guards.map(clip=>clip.name).sort(),['Break','Impact','Loop','Walk_Backward','Walk_Forward','Walk_Left','Walk_Right'].map(kind=>`${style}_Guard_${kind}`));
  const loop=motions[`${style}_Guard_Loop`],impact=motions[`${style}_Guard_Impact`],broken=motions[`${style}_Guard_Break`];
  // Native quaternion sampling leaves submicrometre endpoint residuals.
  assert.ok(Math.hypot(...loop.poses[0].grip.map((x,i)=>x-loop.poses.at(-1).grip[i]))<1e-6,'Held guard loops smoothly');
  assert.ok(Math.min(...impact.poses.map(p=>p.shift[2]))<loop.poses[0].shift[2]-.03,'Impact absorbs force through bent legs');
  assert.ok(Math.max(...broken.poses.map(p=>p.chest))>loop.poses[0].chest+.35,'Guard break moves the chest and pelvis');
  for(const clip of guards)for(const group of [['pelvis'],['spine_01','spine_02','spine_03'],['hand_r'],['foot_r']])assert.ok(clip.channels.some(channel=>group.includes(gltf.nodes[channel.target.node].name)),`${hero}/${clip.name}: missing whole-body channel ${group.join('/')}`);
 }
 assert.equal(motions.Naginata_Guard_Loop.gripSpacing,.40,'Polearm guard uses a wider two-handed grip');
});
