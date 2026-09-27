import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WARRIORS} from '../src/warriors.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const pilot=Object.entries(motions).filter(([,clip])=>clip.athleticAttack);
test('Athletic attacks keep support targets fixed and lift before foot travel',()=>{
 assert.ok(pilot.length>=6);
 for(const [name,clip]of pilot){
  assert.equal(clip.rootAdvance,0,name);
  for(const side of ['r','l'])for(const [start,end]of clip.footPlants[side]){
   const rows=clip.poses.filter(p=>p.t*clip.duration>=start+1e-7&&p.t*clip.duration<=end-1e-7),key='foot'+side.toUpperCase(),yaw='yaw'+side.toUpperCase();
   if(rows.length<2)continue;
   for(const row of rows){assert.ok(Math.hypot(...row[key].map((v,i)=>v-rows[0][key][i]))<1e-6,`${name}: planted ${side} moved`);assert.ok(Math.abs(row[yaw]-rows[0][yaw])<1e-6,`${name}: planted ${side} twisted`);}
  }
  for(let i=1;i<clip.poses.length;i++){
   const a=clip.poses[i-1],b=clip.poses[i];assert.ok(b.t-a.t>1e-8,`${name}: duplicate phase`);
   for(const key of ['footR','footL'])if(Math.hypot(a[key][0]-b[key][0],a[key][1]-b[key][1])>.00001)assert.ok(Math.min(a[key][2],b[key][2])>.025,`${name}: moving ${key} lacks clearance`);
  }
 }
});
test('Every hero uses a complete distinct family of full-body attacks',()=>{
 const names=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'];
 assert.equal(new Set(WARRIORS.map(w=>w.motionPrefix)).size,WARRIORS.length);
 for(const hero of WARRIORS)for(const name of names){
  const clip=motions[hero.motionPrefix+name];assert.ok(clip?.athleticAttack,hero.model+'/'+name);
  assert.equal(clip.duration,motions[name].duration);
  assert.deepEqual(clip.impacts,motions[name].impacts);
  assert.ok(['footR','footL'].some(key=>Math.max(...clip.poses.map(p=>p[key][2]))>.04),`${hero.model}/${name}: no authored step`);
  for(const hit of clip.impacts)assert.ok(['r','l'].some(side=>clip.footPlants[side].some(([a,b])=>hit>=a&&hit<=b)),`${hero.model}/${name}: unsupported impact`);
 }
});
test('New weapon-ready stances keep each male hero at the attack hand and foot positions',()=>{
 for(const hero of WARRIORS.slice(0,3)){
  const ready=motions[hero.readyClip];assert.ok(ready?.nativeAttackReady,hero.model);
  assert.ok(!ready.athleticAttack,'A ready stance must not activate attack footwork');
  const pose=ready.poses[0];
  for(const name of ['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']){
   for(const endpoint of [motions[hero.motionPrefix+name].poses[0],motions[hero.motionPrefix+name].poses.at(-1)]){
    for(const key of ['grip','tip','offGrip','offTip','footR','footL'])assert.ok(Math.hypot(...pose[key].map((v,i)=>v-endpoint[key][i]))<1e-7,`${hero.model}/${name}: ${key} returns to another stance`);
   }
  }
 }
});
test('Heavy sweeps include two opposed cuts at the gameplay impact times',()=>{
 for(const [name,clip]of pilot.filter(([name])=>name.endsWith('Heavy_Sweep'))){
  assert.deepEqual(clip.impacts,[.28,.53],name);
  const vectors=clip.impacts.map(hit=>{const row=clip.poses.find(p=>Math.abs(p.t*clip.duration-hit)<1e-7);assert.ok(row,name);const v=row.tip.map((x,i)=>x-row.grip[i]),length=Math.hypot(...v);return v.map(x=>x/length);});
  assert.ok(vectors[0].reduce((sum,x,i)=>sum+x*vectors[1][i],0)<.45,`${name}: second hit needs a separate return cut`);
 }
});
