import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {WARRIORS} from '../src/warriors.js';
function glb(name){const buffer=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url));assert.equal(buffer.readUInt32LE(0),0x46546c67);const bytes=buffer.readUInt32LE(12);return JSON.parse(buffer.subarray(20,20+bytes).toString());}
test('Each warrior contains a complete human skeleton and weighted mesh',()=>{
  for(const name of ['ronin','shinobi','monk','kaede','ayame','sora','ninja','enemy-guard','enemy-lancer','enemy-skirmisher']){const g=glb(name);const bones=new Set(g.nodes.map(n=>n.name));for(const bone of ['pelvis','spine_03','Head','hand_l','hand_r','foot_l','foot_r'])assert.ok(bones.has(bone),`${name}: ${bone}`);assert.ok(g.skins.some(s=>s.joints.length>=60));assert.ok(g.meshes.some(m=>m.primitives.some(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)));for(const node of g.nodes.filter(n=>['SuperHero_Male','Eyes','Eyebrows','SamuraiCostume'].includes(n.name)))assert.notEqual(node.skin,undefined,`${name}: ${node.name} must remain skinned`);assert.ok(g.images.every(image=>image.bufferView!==undefined),'Textures must ship inside the model');}
});
test('Exported motion retains every required gameplay clip',()=>{
  const golf=glb('golf-motion'),combat=glb('warrior-motion');
  const names=new Set([...golf.animations,...combat.animations].map(a=>a.name));
  for(const name of ['Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Jump_Start','Jump_Loop','Jump_Land','Golf_Address','Golf_Swing','Golf_Putt','Cut_Diagonal','Cut_Return','Cut_Rising','Heavy_Cleave','Heavy_Sweep','Musou_Flow','Enemy_Thrust','Enemy_Throw','Twin_Cut_Diagonal','Fan_Ready','Ring_Ready','Sickle_Ready','Fan_Cut_Diagonal','Ring_Cut_Diagonal','Sickle_Cut_Diagonal','Fan_Musou_Flow','Ring_Musou_Flow','Sickle_Musou_Flow'])assert.ok(names.has(name),name);
  for(const [name,contact]of [['Golf_Swing',1.4],['Golf_Putt',22/30]]){const animation=golf.animations.find(a=>a.name===name);const duration=Math.max(...animation.samplers.map(s=>golf.accessors[s.input].max[0]));assert.ok(duration>contact+.25,`${name} must retain a follow-through after contact`);}
});

test('Six unique warrior models use explicit weapon metadata',async()=>{
  const {WARRIORS}=await import('../src/warriors.js');
  assert.equal(WARRIORS.length,6);assert.equal(new Set(WARRIORS.map(w=>w.model)).size,6);
  for(const w of WARRIORS){assert.ok(['odachi','twin','naginata','jian','dao','wakizashi'].includes(w.weaponKind));assert.equal(w.dualWield,w.weaponKind==='twin');}
  const {BLADE_PROFILES}=await import('../src/weapons.js');
  for(const kind of ['scout','guard','lancer','skirmisher'])assert.ok(BLADE_PROFILES[kind].width<BLADE_PROFILES.odachi.width*.5);
});

test('The three women have separate weapon silhouettes and motion families',async()=>{
  const {WARRIORS}=await import('../src/warriors.js'),{createWeapon}=await import('../src/weapons.js');
  assert.deepEqual(WARRIORS.slice(3).map(w=>w.combatStyle),['fan','ring','sickle']);
  assert.deepEqual(WARRIORS.slice(3).map(w=>w.weaponKind),['jian','dao','wakizashi']);
  for(const w of WARRIORS.slice(3)){const held=createWeapon(w.weaponKind);assert.equal(held.userData.kind,w.weaponKind);assert.ok(held.getObjectByName('Wrapped hand grip'));assert.equal(w.dualWield,false);assert.ok(glb(w.model).animations.some(a=>a.name===w.readyClip));}
});

test('Playable heroes retain licensed textured human meshes and native motion',()=>{
  const identities=['Male_Adult_10','Male_Adult_09','Male_Adult_05','Female_Adult_03','Female_Adult_08','Female_Adult_12'];
  for(const [index,name]of ['ronin','shinobi','monk','kaede','ayame','sora'].entries()){
    const g=glb(name),rig=g.nodes.find(n=>n.extras?.nativeMotion);
    assert.ok(rig,`${name}: native anatomical rig`);assert.equal(rig.extras.sourceAvatar,identities[index]);assert.equal(rig.extras.license,'MIT');
    for(const side of ['R','L']){assert.equal(rig.extras['palmGrip'+side].length,3);assert.equal(rig.extras['shaftAxis'+side].length,3);assert.ok(Object.keys(rig.extras['closedFingers'+side]).length>=15);}
    const clips=new Set(g.animations.map(a=>a.name));for(const clip of ['Idle_Loop','Golf_Swing','Golf_Putt','Jog_Fwd_Loop',(WARRIORS[index].motionOverrides?.[WARRIORS[index].motionPrefix+'Musou_Flow']??WARRIORS[index].motionPrefix+'Musou_Flow'),WARRIORS[index].readyClip,...Object.values(WARRIORS[index].motionOverrides??{})])assert.ok(clips.has(clip),`${name}: ${clip}`);
    assert.deepEqual([...clips].filter(clip=>clip.endsWith('_Selection_Idle')),[WARRIORS[index].selectionClip],`${name}: one separate selection pose`);
    assert.ok(clips.size<=(name==='sora'?44:['ronin','monk'].includes(name)?40:name==='ayame'?39:38),`${name}: own weapon family, guard steps, native locomotion, and selection pose only`);
    const eyewear=['Vice President graphite glasses','Vice President brushed silver temples'];
    const sourceMaterials=g.materials.filter(m=>!eyewear.includes(m.name));
    assert.ok(sourceMaterials.length>=3&&sourceMaterials.every(m=>m.pbrMetallicRoughness?.baseColorTexture),`${name}: source diffuse textures`);
    if(name==='monk')for(const material of eyewear){
      const m=g.materials.find(m=>m.name===material);
      assert.equal(m?.pbrMetallicRoughness?.baseColorFactor?.length,4,`${name}: solid eyewear material ${material}`);
    }
    assert.ok(g.materials.some(m=>m.normalTexture),`${name}: source surface normals`);
    assert.ok(!g.nodes.some(n=>n.name==='SamuraiCostume'),`${name}: preserve original clothing anatomy`);
  }
});

test('Enemy bodies use native human clips and distinct source identities',()=>{
  const names=['ninja','enemy-guard','enemy-lancer','enemy-skirmisher'],sources=['Male_Adult_18','Male_Adult_04','Male_Adult_11','Female_Adult_13'],attacks=['Enemy_Scout_Cut','Heavy_Cleave','Enemy_Thrust','Enemy_Throw'];
  for(const [i,name]of names.entries()){
    const g=glb(name),rig=g.nodes.find(n=>n.extras?.nativeMotion);assert.equal(rig?.extras.sourceAvatar,sources[i]);assert.equal(rig.extras.license,'MIT');
    const clips=new Set(g.animations.map(a=>a.name));for(const clip of ['Golf_Address','Sword_Idle','Jump_Loop','Jump_Land','Death01','Hit_Chest',attacks[i]])assert.ok(clips.has(clip),`${name}: ${clip}`);assert.ok(clips.size<=14,`${name}: keep only crowd clips`);
    assert.ok(g.materials.every(m=>m.pbrMetallicRoughness?.baseColorTexture));
  }
});
