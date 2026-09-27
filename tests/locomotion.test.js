import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const specs=JSON.parse(readFileSync(new URL('../src/locomotion-data.json',import.meta.url)));
test('Directional running shares phase and support windows for blended contacts',()=>{
 const running=Object.entries(specs).filter(([name])=>name.startsWith('Run_'));
 assert.equal(running.length,4);
 for(const [,clip]of running){assert.equal(clip.duration,specs.Run_Forward.duration);assert.equal(clip.support,specs.Run_Forward.support);assert.ok(clip.support<.5,'Running includes an aerial phase');assert.ok(clip.lift>.1);}
 assert.ok(specs.Sprint_Forward.amplitude>specs.Run_Forward.amplitude);
});
test('Every native hero exports complete zero-origin locomotion at 60 Hz',()=>{
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const bytes=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url));const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const [name,spec]of Object.entries(specs)){
   const clip=g.animations.find(a=>a.name===name);assert.ok(clip,`${hero}: ${name}`);
   const times=g.accessors[clip.samplers[0].input];assert.equal(times.min[0],0);assert.ok(Math.abs(times.max[0]-spec.duration)<1e-5);assert.ok(times.count>=spec.duration*60);
   const joints=new Set(clip.channels.map(c=>g.nodes[c.target.node].name));for(const bone of ['pelvis','spine_03','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'])assert.ok(joints.has(bone),`${name}: ${bone}`);
  }
 }
});
