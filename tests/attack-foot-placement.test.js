import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FootPlacement,attackFootContacts} from '../src/foot-placement.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
async function nativeRig(hero){
 const raw=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 // The CPU test needs native joint transforms, not texture decoding or a browser.
 delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const binary=raw.subarray(28+size);doc.buffers=[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}];
 globalThis.ProgressEvent??=class{};const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');gltf.scene.scale.setScalar(1.1);const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 return {root:gltf.scene,bones,clips:gltf.animations,mixer:new THREE.AnimationMixer(gltf.scene),placement:new FootPlacement(gltf.scene,bones)};
}
const position=bone=>bone.getWorldPosition(new THREE.Vector3());
function soleGaps(rig,ground){return ['r','l'].map(side=>{const foot=rig.bones['foot_'+side],q=foot.getWorldQuaternion(new THREE.Quaternion()),ankle=position(foot);return Math.min(...rig.placement.feet[side].contacts.map(local=>{const p=local.clone().applyQuaternion(q).add(ankle);return p.y-ground(p.x,p.z)}));});}

test('Authored contact intervals free the swing foot and blend support boundaries',()=>{
 const clip={duration:1,footPlants:{r:[[0,.2],[.5,1]],l:[[0,1]]}};
 assert.equal(attackFootContacts(clip,.3,null).contactWeights.r,0);
 assert.equal(attackFootContacts(clip,.6,null).contactWeights.r,1);
 assert.ok(attackFootContacts(clip,.51,null).contactWeights.r<1);
 assert.equal(attackFootContacts({},0,{footR:[0,0,.04],footL:[0,0,0]}).contactWeights.r,0);
 assert.equal(attackFootContacts({},0,null).contactWeights.r,0);
});
test('Every native Kaede attack preserves flat-ground foot lifts, pivots and joint poses exactly',async()=>{
 const {root,bones,clips,mixer,placement}=await nativeRig('kaede');
 for(const clip of clips.filter(c=>/^Fan_(Cut_|Heavy_|Musou)/.test(c.name))){
  placement.restore();mixer.stopAllAction();mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();
  for(let frame=0;frame<50;frame++){
   placement.restore();const time=frame/50*clip.duration;mixer.setTime(time);root.updateMatrixWorld(true);
   const before=Object.values(bones).map(b=>[b,b.position.clone(),b.quaternion.clone()]);
   placement.apply(1/60,()=>0,{preserveAuthored:true,...attackFootContacts(motions[clip.name],time,null)});
   for(const [bone,p,q]of before){assert.ok(bone.position.distanceTo(p)<1e-9,clip.name);assert.ok(bone.quaternion.equals(q),clip.name+' '+bone.name);}
  }
 }
});
test('Native attack swing gets upward terrain clearance without flattening its authored sole',async()=>{
 const {root,bones,clips,mixer,placement}=await nativeRig('kaede');
 const clip=clips.find(c=>c.name==='Fan_Cut_Return');mixer.clipAction(clip).play();
 const ground=(x,z)=>.10+.08*x+.04*z;
 mixer.setTime(clip.duration*.35);root.updateMatrixWorld(true);
 const rotations=['r','l'].map(s=>bones['foot_'+s].getWorldQuaternion(new THREE.Quaternion()));
 placement.apply(1/60,ground,{preserveAuthored:true,contactWeights:{r:0,l:0}});
 // Imported nonuniform bone scales introduce less than .06 degree decomposition error.
 for(const [i,side]of ['r','l'].entries())assert.ok(bones['foot_'+side].getWorldQuaternion(new THREE.Quaternion()).normalize().angleTo(rotations[i].clone().normalize())<1e-3);
 for(const gap of soleGaps({bones,placement},ground))assert.ok(gap>-.012,`sole clearance ${gap}`);
 placement.restore();mixer.setTime(clip.duration*.35);
 placement.apply(1/60,(x,z)=>.08*x+.04*z,{preserveAuthored:true,contactWeights:{r:1,l:1}});
 for(const gap of soleGaps({bones,placement},(x,z)=>.08*x+.04*z))assert.ok(gap>-.025,`support clearance ${gap}`);
});

test('Authored downhill support stays reachable across six native bodies and four course slopes',async()=>{
 const {COURSE_SETS,heightAt,ellipse}=await import('../src/course.js');
 const {courseSurfaceHeight}=await import('../src/terrain.js');
 const spots=[[29.3656,176.9803],[2.3435,208.6719],[13.6653,219.8109],[-47.1833,207.1993]];
 for(const [hero,prefix]of [['ronin',''],['shinobi','Twin_'],['monk',''],['kaede','Fan_'],['ayame','Ring_'],['sora','Sickle_']]){
  const {root,bones,clips,mixer,placement}=await nativeRig(hero),clip=clips.find(c=>c.name===prefix+'Heavy_Cleave');
  let maxReach=0,maxExtraGap=0,maxGripChange=0;
  for(let theme=0;theme<4;theme++){
   placement.restore();placement.reset();mixer.stopAllAction();mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();
   const c=COURSE_SETS[theme].holes[0],[x,z]=spots[theme],ground=(x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse);root.position.set(x,heightAt(c,x,z),z);
   for(let frame=0;frame<90;frame++){
    placement.restore();const time=frame/90*clip.duration;mixer.setTime(time);root.updateMatrixWorld(true);
    const span=position(bones.hand_l).sub(position(bones.hand_r));
    const data=motions[clip.name],rows=data.poses,t=time/data.duration;let nearest=rows[0];for(const row of rows)if(Math.abs(row.t-t)<Math.abs(nearest.t-t))nearest=row;
    placement.apply(1/60,ground,{preserveAuthored:true,...attackFootContacts(data,time,nearest)});
    maxGripChange=Math.max(maxGripChange,position(bones.hand_l).sub(position(bones.hand_r)).distanceTo(span));
    const gaps=soleGaps({bones,placement},ground);
    for(const [i,foot]of placement.report.feet.entries())if(foot.stance){maxReach=Math.max(maxReach,foot.reachError);maxExtraGap=Math.max(maxExtraGap,Math.abs(gaps[i]-foot.sourceSoleGap));}
   }
  }
  assert.ok(maxExtraGap<.003,`${hero}: added terrain gap ${maxExtraGap}`);
  assert.ok(maxReach<.003,`${hero}: unreachable support ${maxReach}`);
  assert.ok(maxGripChange<1e-8,`${hero}: shared grip changed ${maxGripChange}`);
 }
});

test('Repeated attack contact resets do not introduce a terrain pelvis jump',async()=>{
 const {COURSE_SETS,heightAt,ellipse}=await import('../src/course.js');
 const {courseSurfaceHeight}=await import('../src/terrain.js');
 const spots=[[29.3656,176.9803],[2.3435,208.6719],[13.6653,219.8109],[-47.1833,207.1993]];
 for(const [hero,prefix]of [['ronin',''],['kaede','Fan_']]){
  const {root,bones,clips,mixer,placement}=await nativeRig(hero),name=prefix+'Heavy_Cleave',clip=clips.find(c=>c.name===name),data=motions[name];
  for(let theme=0;theme<4;theme++){
   placement.restore();placement.reset();mixer.stopAllAction();const c=COURSE_SETS[theme].holes[0],[x,z]=spots[theme],ground=(x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse);root.position.set(x,heightAt(c,x,z),z);
   let action=null,previous=null;
   for(let frame=0;frame<90;frame++){
    placement.restore();
    if(frame%60===0){const next=mixer.clipAction(clip.clone()).reset().setEffectiveWeight(1).setLoop(THREE.LoopOnce,1).play();next.clampWhenFinished=true;if(action){action.fadeOut(.07);next.fadeIn(.07);}action=next;}
    mixer.update(1/60);root.updateMatrixWorld(true);const sourceY=position(bones.pelvis).y;
    let nearest=data.poses[0];for(const row of data.poses)if(Math.abs(row.t-action.time/data.duration)<Math.abs(nearest.t-action.time/data.duration))nearest=row;
    placement.apply(1/60,ground,{preserveAuthored:true,...attackFootContacts(data,action.time,nearest)});
    const worldY=position(bones.pelvis).y,offset=placement.report.pelvisOffset;
    if(previous&&frame>30){
     assert.ok(Math.abs(offset-previous.offset)<.036,`${hero}/${theme}/${frame}: terrain offset jump`);
     assert.ok(Math.abs((worldY-previous.worldY)-(sourceY-previous.sourceY))<.036,`${hero}/${theme}/${frame}: added world pelvis jump`);
    }
    previous={worldY,sourceY,offset};
   }
  }
 }
});
