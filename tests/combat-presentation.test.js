import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GarmentCollision,projectGarmentPoint} from '../src/garment-collision.js';
import {ImpactParticles} from '../src/impact-particles.js';
import {ENEMY_TYPES} from '../src/combat.js';
import {validatePlanarRoot,attackRootDelta} from '../src/attack-root-motion.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

test('garment collision stays outside a raised thigh and preserves separated fabric layers',()=>{
 for(const angle of [0,.6,1.3,2.1]){
  const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle);
  const a=new T.Vector3(),b=new T.Vector3(0,-.5,0).applyQuaternion(q),outward=new T.Vector3(0,0,1).applyQuaternion(q);
  const original=new T.Vector3(.04,-.2,-.06).applyQuaternion(q);
  const lining=original.clone(),outer=original.clone();
  projectGarmentPoint(lining,a,b,.13,.10,outward,.010);
  projectGarmentPoint(outer,a,b,.13,.10,outward,.016);
  const axis=b.clone().normalize(),t=outer.dot(axis),radial=outer.clone().addScaledVector(axis,-t);
  assert.ok(radial.dot(outward)>0,'panel crossed to the back of the thigh');
  assert.ok(radial.length()>=T.MathUtils.lerp(.13,.10,t/.5)+.016-1e-10);
  assert.ok(outer.clone().sub(lining).dot(outward)>.0059,'fabric layers collapsed together');
  const prior=outer.clone();assert.ok(projectGarmentPoint(outer,a,b,.13,.10,outward,.016)<1e-9);assert.ok(outer.distanceTo(prior)<1e-9);
  const clear=new T.Vector3(.4,-.2,.2).applyQuaternion(q),before=clear.clone();
  assert.equal(projectGarmentPoint(clear,a,b,.13,.10,outward,.016),0);assert.deepEqual(clear,before);
 }
});

test('impact effects have bounded pools, distinguish guards, and clear when returning to golf',()=>{
 const scene=new T.Scene(),effects=new ImpactParticles(scene),p=new T.Vector3(),direction=new T.Vector3(0,0,1);
 effects.emit(p,direction,{guarded:true});assert.equal(effects.pools[1].particles.filter(p=>p.life>0).length,0);
 effects.emit(p,direction,{heavy:true});assert.equal(effects.pools[1].particles.filter(p=>p.life>0).length,66);
 for(let i=0;i<100;i++)effects.emit(p,direction,{special:true});
 assert.equal(scene.children.length,2);assert.deepEqual(effects.pools.map(p=>p.particles.length),[4096,768]);
 effects.update(.03);assert.ok(effects.pools[0].attributes.opacity.array.some(v=>v>0));
 effects.update(1,true);assert.ok(effects.pools.every(p=>p.attributes.opacity.array.every(v=>v===0)));
 effects.emit(p,direction);effects.update(.01);effects.clear();
 assert.ok(effects.pools.every(p=>p.particles.every(v=>v.life===0)&&p.attributes.opacity.array.every(v=>v===0)));
});

test('all ninja attacks preserve knee hinges and move their root consistently at different frame rates',async()=>{
 const records=JSON.parse(fs.readFileSync(new URL('../src/enemy-motion.json',import.meta.url)));
 const g=await loadNativeSkin(new URL('../public/models/enemy-cloth-ninja.glb',import.meta.url));
 const bones=side=>['thigh_','calf_','foot_'].map(n=>g.scene.getObjectByName(n+side));
 const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(...bones(s))]));
 for(const role of ENEMY_TYPES){
  const record=records[role.clip];assert.ok(record.nativeSourceMotion);validatePlanarRoot(record.planarRoot);
  const clip=g.animations.find(c=>c.name===role.clip);assert.ok(clip);
  for(const hz of [30,60,120]){
   let time=0;const position={x:0,z:0};
   while(time<role.duration){const next=Math.min(role.duration,time+1/hz),d=attackRootDelta(record.planarRoot,time,next,role.duration,.6,1.1);position.x+=d.x;position.z+=d.z;time=next;}
   const expected=attackRootDelta(record.planarRoot,0,role.duration,role.duration,.6,1.1);
   assert.ok(Math.hypot(position.x-expected.x,position.z-expected.z)<1e-10);
  }
  g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  for(let i=0;i<=120;i++){
   action.time=clip.duration*i/120;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){const m=measureLegAnatomy(calibration[side],...bones(side));
    assert.ok(m.kneeFlexion>=-.1&&m.kneeFlexion<140,`${role.name}: reversed or folded ${side} knee ${m.kneeFlexion}`);
    assert.ok(m.kneeDeviation<.05,`${role.name}: sideways ${side} knee ${m.kneeDeviation}`);
   }
  }
 }
});

test('the Closer merged tunic receives collision correction through her attacks and golf swing',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/sora.glb',import.meta.url),{materialNames:true}),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const cloth=new GarmentCollision(g.scene,bones,{clearance:.028,surfaceQuantile:.99});
 assert.ok(cloth.report.vertices>1000,'The merged tunic was silently excluded from cloth correction');
 const body=cloth.plans.find(p=>/body fabric/i.test(p.mesh.material.name));assert.ok(body,'Missing body-fabric tunic');
 const knee=Math.max(...['r','l'].map(s=>bones['calf_'+s].getWorldPosition(new T.Vector3()).y));
 for(const entry of body.entries){const p=body.mesh.getVertexPosition(entry.id,new T.Vector3()).applyMatrix4(body.mesh.matrixWorld);assert.ok(p.y>knee+.025,'Trousers must not become hanging cloth');}
 let corrected=0,examined=0;
 for(const name of ['Sickle_Ready','Closer_Combo_Opening','Closer_Combo_Return','Closer_Combo_Finish','Closer_Power_Finish','Golf_Swing']){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,name);g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  for(let sample=0;sample<=30;sample++){
   action.time=clip.duration*sample/30;g.mixer.update(0);cloth.update();corrected+=cloth.report.corrected;
   for(const {mesh,entries}of cloth.plans)for(const entry of entries){
    if(entry.weight<.9999)continue;
    const p=mesh.getVertexPosition(entry.id,new T.Vector3()).add(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.garmentOffset,entry.id)).applyMatrix4(mesh.matrixWorld);
    const proxy=cloth.proxies[entry.side==='r'?0:1],direction=entry.outward.clone().applyQuaternion(proxy.q);
    const remaining=projectGarmentPoint(p,proxy.a,proxy.b,proxy.r0,proxy.r1,direction,entry.clearance*cloth.baseScale);
    assert.ok(remaining<1e-4,`${name} ${sample}: panel remains ${remaining} units inside thigh`);examined++;
   }
  }
 }
 assert.ok(corrected>0);assert.ok(examined>100000);cloth.dispose();
});
