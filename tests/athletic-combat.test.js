import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WARRIORS} from '../src/warriors.js';
import {attackDefinition} from '../src/combat.js';
import {samplePlanarRoot} from '../src/attack-root-motion.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const pilot=Object.entries(motions).filter(([,clip])=>clip.athleticAttack);
test('Athletic attacks keep support targets fixed and lift before foot travel',()=>{
 assert.ok(pilot.length>=6);
 for(const [name,clip]of pilot){
  assert.equal(clip.rootAdvance,0,name);
  for(const side of ['r','l'])for(const [start,end]of clip.footPlants[side]){
   const rows=clip.poses.filter(p=>p.t*clip.duration>=start+1e-7&&p.t*clip.duration<=end-1e-7),key='foot'+side.toUpperCase(),yaw='yaw'+side.toUpperCase();
   if(rows.length<2)continue;
   // Solved native skeletons retain submillimeter floating-point residuals.
   // Their separate geometry checks enforce the same one-millimeter bound.
   const positionTolerance=clip.nativeAttachment?.001:1e-6;
   // Extracting yaw from solved, scaled bones adds up to 0.0024 degrees of
   // round-off. Keep the bound below 0.006 degrees; native support tests also
   // check the actual foot quaternion and planted toe, not only this record.
   const yawTolerance=clip.nativeAttachment?1e-4:1e-6;
   const worldFoot=row=>{const root=clip.planarRoot?samplePlanarRoot(clip.planarRoot,row.t*clip.duration):{x:0,z:0};return[row[key][0]+root.x,row[key][1]-root.z,row[key][2]];};
   const anchor=worldFoot(rows[0]);
   for(const row of rows){assert.ok(Math.hypot(...worldFoot(row).map((v,i)=>v-anchor[i]))<positionTolerance,`${name}: planted ${side} moved`);assert.ok(Math.abs(row[yaw]-rows[0][yaw])<yawTolerance,`${name}: planted ${side} twisted`);}
  }
  // Native records retain ankle rotations and heel/toe roll. Their actual
  // sole contacts receive separate native and runtime geometry checks.
  if(clip.nativeStanceFeet)continue;
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
  const clip=motions[hero.motionOverrides?.[hero.motionPrefix+name]??hero.motionPrefix+name];assert.ok(clip?.athleticAttack,hero.model+'/'+name);
  const index=names.indexOf(name),kind=index<4?'light':index<8?'heavy':'musou',definition=attackDefinition(kind,index%4,hero.combatStyle);
  assert.ok(Math.abs(clip.duration-definition.duration)<1e-8,hero.model+'/'+name);
  assert.equal(clip.impacts.length,definition.hits.length,hero.model+'/'+name);
  clip.impacts.forEach((hit,i)=>assert.ok(Math.abs(hit-definition.hits[i])<1e-8,hero.model+'/'+name));
  assert.ok(['footR','footL'].some(key=>Math.max(...clip.poses.map(p=>p[key][2]))>.04),`${hero.model}/${name}: no authored step`);
  for(const hit of clip.impacts)assert.ok(['r','l'].some(side=>clip.footPlants[side].some(([a,b])=>hit>=a&&hit<=b)),`${hero.model}/${name}: unsupported impact`);
 }
});
test('New weapon-ready stances keep each male hero at the attack hand and foot positions',()=>{
 for(const hero of WARRIORS.slice(0,3)){
  const ready=motions[hero.readyClip];assert.ok(ready?.nativeAttackReady,hero.model);
  assert.ok(!ready.athleticAttack,'A ready stance must not activate attack footwork');
  const legacyReady=motions[hero.motionPrefix+'Ready'];
  for(const name of ['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']){
   const clip=motions[hero.motionOverrides?.[hero.motionPrefix+name]??hero.motionPrefix+name];
   const pose=(clip.nativeAttachment?ready:legacyReady).poses[0];
   for(const endpoint of [clip.poses[0],clip.poses.at(-1)]){
    // Native transforms retain micrometre-scale solve/decomposition error.
    const endpointTolerance=clip.nativeAttachment?5e-6:1e-6;
    for(const key of ['grip','tip','footR','footL',...(hero.dualWield?['offGrip','offTip']:[])])assert.ok(Math.hypot(...pose[key].map((v,i)=>v-endpoint[key][i]))<endpointTolerance,`${hero.model}/${name}: ${key} returns to another stance`);
   }
  }
 }
});
test('Heavy sweeps include two distinct cuts at the gameplay impact times',()=>{
 const at=(clip,time)=>{const t=time/clip.duration;let i=0;while(i<clip.poses.length-2&&t>clip.poses[i+1].t)i++;const a=clip.poses[i],b=clip.poses[i+1],u=(t-a.t)/(b.t-a.t);return a.tip.map((v,k)=>v+(b.tip[k]-v)*u);};
 for(const [name,clip]of pilot.filter(([name])=>name.endsWith('Heavy_Sweep'))){
  assert.equal(clip.impacts.length,2,name);
  if(clip.pairedGrip){
   // A returning blade can cross the same contact point in the opposite
   // direction. Its velocity, not its shaft heading, distinguishes the hits.
   const vectors=clip.impacts.map(hit=>{const before=at(clip,hit-.002),after=at(clip,hit+.002),v=after.map((x,i)=>x-before[i]),length=Math.hypot(...v);assert.ok(length/.004>5,`${name}: impact lacks blade speed`);return v.map(x=>x/length);});
   assert.ok(vectors[0].reduce((sum,x,i)=>sum+x*vectors[1][i],0)<-.5,`${name}: return hit must reverse blade velocity`);
  }else if(clip.nativeAttachment){
   const velocity=time=>{const a=at(clip,time-.002),b=at(clip,time+.002);return b.map((x,k)=>(x-a[k])/.004);};
   const first=velocity(clip.impacts[0]),firstSpeed=Math.hypot(...first);
   for(const hit of clip.impacts)assert.ok(Math.hypot(...velocity(hit))>5,`${name}: impact lacks blade speed`);
   // The dao uses two downward cuts; the other swords alternate down/up.
   // All must reverse between hits, rather than count one stroke twice.
   const recovery=Array.from({length:89},(_,i)=>{
    const v=velocity(clip.impacts[0]+(clip.impacts[1]-clip.impacts[0])*(i+5)/100);
    return v.reduce((sum,x,k)=>sum+x*first[k],0)/firstSpeed;
   });
   assert.ok(Math.min(...recovery)<-2,`${name}: second hit lacks a separate recovery or return cut`);
  }else{
   assert.deepEqual(clip.impacts,[.28,.53],name);
   const vectors=clip.impacts.map(hit=>{const row=clip.poses.find(p=>Math.abs(p.t*clip.duration-hit)<1e-7);assert.ok(row,name);const v=row.tip.map((x,i)=>x-row.grip[i]),length=Math.hypot(...v);return v.map(x=>x/length);});
   assert.ok(vectors[0].reduce((sum,x,i)=>sum+x*vectors[1][i],0)<.45,`${name}: second hit needs a separate return cut`);
  }
 }
});
