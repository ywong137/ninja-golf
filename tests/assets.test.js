import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  for(const w of WARRIORS){assert.ok(['odachi','twin','naginata','fan','ring','sickle'].includes(w.weaponKind));assert.equal(w.dualWield,w.weaponKind==='twin');}
  const {BLADE_PROFILES}=await import('../src/weapons.js');
  for(const kind of ['scout','guard','lancer','skirmisher'])assert.ok(BLADE_PROFILES[kind].width<BLADE_PROFILES.twin.width*.4);
});

test('The three women have separate weapon silhouettes and motion families',async()=>{
  const {WARRIORS}=await import('../src/warriors.js'),{createWeapon}=await import('../src/weapons.js');
  assert.deepEqual(WARRIORS.slice(3).map(w=>w.combatStyle),['fan','ring','sickle']);
  for(const w of WARRIORS.slice(3)){const held=createWeapon(w.weaponKind);assert.equal(held.userData.kind,w.weaponKind);assert.ok(held.getObjectByName('Wrapped hand grip'));assert.equal(w.dualWield,false);assert.ok(w.readyClip.startsWith(w.motionPrefix));}
});
