import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function glb(name){const buffer=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url));assert.equal(buffer.readUInt32LE(0),0x46546c67);const bytes=buffer.readUInt32LE(12);return JSON.parse(buffer.subarray(20,20+bytes).toString());}
test('Each warrior contains a complete human skeleton and weighted mesh',()=>{
  for(const name of ['ronin','shinobi','monk']){const g=glb(name);const bones=new Set(g.nodes.map(n=>n.name));for(const bone of ['pelvis','spine_03','Head','hand_l','hand_r','foot_l','foot_r'])assert.ok(bones.has(bone),`${name}: ${bone}`);assert.ok(g.skins.some(s=>s.joints.length>=60));assert.ok(g.meshes.some(m=>m.primitives.some(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)));assert.ok(g.images.every(image=>image.bufferView!==undefined),'Textures must ship inside the model');}
});
test('Exported motion retains every required gameplay clip',()=>{
  const golf=glb('golf-motion'),combat=glb('warrior-motion');
  const names=new Set([...golf.animations,...combat.animations].map(a=>a.name));
  for(const name of ['Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Golf_Address','Golf_Swing','Golf_Putt'])assert.ok(names.has(name),name);
  for(const [name,contact]of [['Golf_Swing',34/30],['Golf_Putt',22/30]]){const animation=golf.animations.find(a=>a.name===name);const duration=Math.max(...animation.samplers.map(s=>golf.accessors[s.input].max[0]));assert.ok(duration>contact+.25,`${name} must retain a follow-through after contact`);}
});
