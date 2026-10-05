import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoopOnce} from 'three';
import {WARRIORS} from '../src/warriors.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {samplePlanarRoot,validatePlanarRoot} from '../src/attack-root-motion.js';
const records=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
for(const hero of WARRIORS)test(hero.name+': every light and heavy branch uses a complete source performance',async()=>{
 const rig=await loadNativeSkin(new URL('../public/models/'+hero.model+'.glb',import.meta.url));
 const clips=new Map(rig.animations.map(c=>[c.name,c]));
 for(const suffix of ['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']){
  const key=hero.motionPrefix+suffix,name=hero.motionOverrides?.[key]??key,m=records[name];
  assert.equal(m?.nativeSourceMotion,true,hero.name+'/'+suffix+' fell back to procedural motion');
  assert.ok(clips.has(name),'Source clip missing: '+name);
  assert.ok(Math.abs(clips.get(name).duration-m.duration)<1e-5,name);
  assert.ok(m.impacts.length>0&&m.impacts.every(t=>t>0&&t<m.duration),name);
 }
});
const rig=await loadNativeSkin(new URL('../public/models/monk.glb',import.meta.url)),bones={};rig.scene.traverse(n=>{if(n.isBone)bones[n.name]=n;});
function snapshot(name,t){rig.mixer.stopAllAction();const a=rig.mixer.clipAction(rig.animations.find(c=>c.name===name)).reset().setLoop(LoopOnce).play();a.clampWhenFinished=true;a.time=t;rig.mixer.update(0);return Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}]));}
for(const name of ['Ethan_GDH_Return_Cuts','Ethan_GDH_Leaping_Finish'])test(name+': retains the purchased body motion, recovery, contacts, and relative travel',()=>{
 const m=records[name],w=m.sourceWindow,source=records[w.clip];validatePlanarRoot(m.planarRoot);
 assert.equal(w.end,source.duration);assert.ok(m.slidingGrip);assert.equal(m.weaponGripRoll,source.weaponGripRoll);
 const hits=source.impacts.filter(t=>t>w.start);assert.deepEqual(m.impacts,hits.map(t=>t-w.start));
 const origin=samplePlanarRoot(source.planarRoot,w.start);
 for(let i=0;i<=120;i++){
  const t=m.duration*i/120,a=snapshot(name,t),b=snapshot(w.clip,w.start+(w.end-w.start)*i/120);
  for(const key of Object.keys(a)){
   assert.ok(a[key].q.angleTo(b[key].q)<.001,name+'/'+key+' rotation changed');
   assert.ok(a[key].p.distanceTo(b[key].p)<1e-5,name+'/'+key+' position changed');
   assert.ok(a[key].s.distanceTo(b[key].s)<1e-5,name+'/'+key+' scale changed');
  }
  const travel=samplePlanarRoot(m.planarRoot,t),expected=samplePlanarRoot(source.planarRoot,w.start+(w.end-w.start)*i/120);
  assert.ok(Math.hypot(travel.x-expected.x+origin.x,travel.z-expected.z+origin.z)<1e-6);
 }
});
