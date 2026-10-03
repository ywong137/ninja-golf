import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FootPlacement,attackFootContacts} from '../src/foot-placement.js';
import {WARRIORS} from '../src/warriors.js';
import {SourceTerrainFrame} from '../src/source-terrain-frame.js';
import {headingKnee} from '../src/knee-alignment.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
async function nativeRig(hero){
 const raw=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 // The CPU test needs native joint transforms, not texture decoding or a browser.
 delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const binary=raw.subarray(28+size);doc.buffers=[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}];
 globalThis.ProgressEvent??=class{};const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const root=new THREE.Group();root.scale.setScalar(1.1);root.add(gltf.scene);const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 return {root,model:gltf.scene,bones,clips:gltf.animations,mixer:new THREE.AnimationMixer(gltf.scene),placement:new FootPlacement(root,bones)};
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
 const pivot={...clip,toePlants:{r:[[.2,.5]],l:[]}};
 assert.equal(attackFootContacts(pivot,.3,null).contactWeights.r,1,'A fixed toe supports a raised heel.');
 assert.equal(attackFootContacts(pivot,.21,null).contactWeights.r,1,'Continuous toe support must not fade during the handover.');
});
test('A heel-to-toe pivot keeps support through touching and overlapping contact intervals',()=>{
 const clip={duration:1,footPlants:{r:[[.7,1],[0,.2]],l:[[0,.3],[.6,1]]},toePlants:{r:[[.2,.7]],l:[[.2,.60000001]]}};
 const original=JSON.stringify(clip);
 for(const time of [0,.18,.199999,.2,.200001,.3,.59,.6,.600001,.699999,.7,.700001,1]){
  const contacts=attackFootContacts(clip,time,null);
  assert.deepEqual(contacts.contactWeights,{r:1,l:1},'Support dips at '+time);
  assert.deepEqual(contacts.stance,{r:true,l:true});
 }
 assert.equal(JSON.stringify(clip),original,'Contact evaluation changed the motion record.');
 const gap={duration:1,footPlants:{r:[[0,.2],[.202,1]],l:[[0,1]]}};
 assert.equal(attackFootContacts(gap,.201,null).contactWeights.r,0,'A real airborne interval remains free.');
});
test('Clamped animation endpoints retain support without dividing by zero',()=>{
 const clip={duration:.4,footPlants:{r:[[0,.4]],l:[[0,.4]]}};
 assert.deepEqual(attackFootContacts(clip,.4000000000000004,null).contactWeights,{r:1,l:1});
 const endpoint={duration:.6,footPlants:{r:[[0,0],[.6,.6]],l:[[0,.6]]}};
 for(const time of [0,.6,.6000000000000001])assert.deepEqual(attackFootContacts(endpoint,time,null).contactWeights,{r:1,l:1});
 for(const time of [.001,.3,.599])assert.deepEqual(attackFootContacts(endpoint,time,null).contactWeights,{r:0,l:1});
});
test('Every native Kaede attack preserves flat-ground foot lifts, pivots and joint poses exactly',async()=>{
 const {root,bones,clips,mixer,placement}=await nativeRig('kaede');
 for(const clip of clips.filter(c=>/^(Fan|Ace)_(Cut_|Heavy_|Musou)/.test(c.name))){
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
 for(const [hero,prefix]of [['ronin',''],['shinobi','Twin_'],['monk','Naginata_'],['kaede','Fan_'],['ayame','Ring_'],['sora','Sickle_']]){
  const warrior=WARRIORS.find(w=>w.model===hero),name=warrior.motionOverrides?.[prefix+'Heavy_Cleave']??prefix+'Heavy_Cleave';
  const {root,model,bones,clips,mixer,placement}=await nativeRig(hero),clip=clips.find(c=>c.name===name);
  // Match the runtime's broad-slope transport for captured performances.
  const terrain=new SourceTerrainFrame(root,model,bones);
  let maxReach=0,maxExtraGap=0,maxGripChange=0;
  for(let theme=0;theme<4;theme++){
   placement.restore();placement.reset();mixer.stopAllAction();mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();
   const c=COURSE_SETS[theme].holes[0],[x,z]=spots[theme],ground=(x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse);terrain.reset();root.position.set(x,heightAt(c,x,z),z);
   for(let frame=0;frame<90;frame++){
    terrain.restore();placement.restore();const time=frame/90*clip.duration;mixer.setTime(time);root.updateMatrixWorld(true);
    const span=position(bones.hand_l).sub(position(bones.hand_r));
    const data=motions[clip.name],rows=data.poses,t=time/data.duration;let nearest=rows[0];for(const row of rows)if(Math.abs(row.t-t)<Math.abs(nearest.t-t))nearest=row;
    const referencePlane=terrain.apply(1/60,ground,{active:!!data.nativeSourceMotion});
    placement.apply(1/60,ground,{preserveAuthored:true,referencePlane,preserveHinge:!!data.nativeKneeHinges,kneeSolver:data.nativeKneeHeading?headingKnee:undefined,...attackFootContacts(data,time,nearest)});
    maxGripChange=Math.max(maxGripChange,Math.abs(position(bones.hand_l).distanceTo(position(bones.hand_r))-span.length()));
    const gaps=soleGaps({bones,placement},ground);
    for(const [i,foot]of placement.report.feet.entries())if(foot.stance){
     maxReach=Math.max(maxReach,foot.reachError);const extra=Math.abs(gaps[i]-foot.sourceSoleGap);
     // Contact fades before a step. Its remaining downhill gap follows that fade.
     const blendedGap=Math.abs(foot.offset)*(1-foot.weight)/foot.weight;
     assert.ok(extra<blendedGap+.003,`${hero}: gap exceeds its contact blend ${JSON.stringify({theme,frame,side:foot.side,extra,blendedGap,foot})}`);
     if(foot.weight>.999)maxExtraGap=Math.max(maxExtraGap,extra);
    }
   }
  }
  assert.ok(maxExtraGap<.003,`${hero}: added terrain gap ${maxExtraGap}`);
  assert.ok(maxReach<.003,`${hero}: unreachable support ${maxReach}`);
  assert.ok(maxGripChange<1e-6,`${hero}: shared grip changed ${maxGripChange}`);
 }
});

test('Repeated attack contact resets do not introduce a terrain pelvis jump',async()=>{
 const {COURSE_SETS,heightAt,ellipse}=await import('../src/course.js');
 const {courseSurfaceHeight}=await import('../src/terrain.js');
 const spots=[[29.3656,176.9803],[2.3435,208.6719],[13.6653,219.8109],[-47.1833,207.1993]];
 for(const [hero,prefix]of [['ronin',''],['kaede','Fan_']]){
  const warrior=WARRIORS.find(w=>w.model===hero),name=warrior.motionOverrides?.[prefix+'Heavy_Cleave']??prefix+'Heavy_Cleave';
  const {root,bones,clips,mixer,placement}=await nativeRig(hero),clip=clips.find(c=>c.name===name),data=motions[name];
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

test('Authored support seeds procedural idle without a zero-time foot jump',async()=>{
 for(const warrior of WARRIORS){
  const rig=await nativeRig(warrior.model),{root,bones,clips,mixer,placement}=rig;
  const clip=clips.find(c=>c.name===warrior.readyClip);assert.ok(clip,warrior.model+' ready clip');
  mixer.clipAction(clip).play();
  for(const [gx,gz]of [[0,0],[.12,.10],[-.12,.10],[.22,-.16]])for(const heading of [0,Math.PI/2]){
   placement.restore();placement.reset();root.rotation.y=heading;mixer.setTime(0);root.updateMatrixWorld(true);
   const ground=(x,z)=>gx*x+gz*z;
   for(let i=0;i<60;i++){
    placement.restore();root.updateMatrixWorld(true);
    placement.apply(1/120,ground,{preserveAuthored:true,contactWeights:{r:1,l:1},stance:{r:true,l:true}});
   }
   const names=['foot_r','foot_l','ball_r','ball_l'],before=names.map(n=>position(bones[n]));
   placement.restore();root.updateMatrixWorld(true);placement.apply(0,ground);
   const jump=Math.max(...names.map((n,i)=>position(bones[n]).distanceTo(before[i])));
   assert.ok(jump<.001,`${warrior.model}/${gx},${gz}/${heading}: zero-time jump ${jump}`);
  }
 }
});
