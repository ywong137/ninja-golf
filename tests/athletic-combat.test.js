import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
   if(Math.hypot(a.footR[0]-b.footR[0],a.footR[1]-b.footR[1])>.00001)assert.ok(Math.min(a.footR[2],b.footR[2])>.025,`${name}: moving foot lacks clearance`);
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
