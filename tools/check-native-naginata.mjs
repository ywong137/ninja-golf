#!/usr/bin/env node
// CPU-only checks of the actual native skeleton and complete blade geometry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {createWeapon} from '../src/weapons.js';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../tests/native-skin-helper.mjs';

export const NATIVE_NAGINATA_CLIPS = [
  'Ethan_Naginata_Ready',
  ...['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep',
    'Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow']
    .map(name => 'Ethan_Naginata_' + name),
  'Naginata_Guard_Loop','Naginata_Guard_Impact','Naginata_Guard_Break',
];

const UP = new T.Vector3(0,1,0), RIGHT = new T.Vector3(1,0,0);
const DEGREES = 180 / Math.PI;
const json = file => JSON.parse(fs.readFileSync(file));
const snapshot = bones => Object.fromEntries(Object.entries(bones).map(([name,bone]) => [name,{
  position:bone.position.clone(), rotation:bone.quaternion.clone().normalize(), scale:bone.scale.clone(),
}]));

export async function validateNativeNaginata({
  model = new URL('../public/models/monk.glb',import.meta.url),
  record = new URL('../src/motion-data.json',import.meta.url),
  includeFrames = false,
  includeSkin = false,
} = {}) {
  const rig = await loadNativeSkin(model), records = json(record);
  // Classify the actual mesh in its bind pose before playing any animation.
  const skin = includeSkin ? skinGroups(rig) : null;
  const frames = json(new URL('./native-naginata-frames.json',import.meta.url));
  const grips = json(new URL('../src/grip-data.json',import.meta.url)).monk.sword;
  const bones = {};
  rig.scene.traverse(bone => { if (bone.isBone) bones[bone.name] = bone; });
  rig.scene.updateMatrixWorld(true);
  const point = name => bones[name].getWorldPosition(new T.Vector3());
  const rotation = name => bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
  const neutral = Object.fromEntries(['r','l'].map(side => [side,bones['hand_'+side].quaternion.clone().normalize()]));
  const ankleHeight = Object.fromEntries(['r','l'].map(side => [side,point('foot_'+side).y]));
  const clips = new Map(rig.animations.map(clip => [clip.name,clip]));
  const weapon = createWeapon('naginata'), blade = weapon.getObjectByName('Flat steel blade');
  assert.ok(blade?.isMesh, 'Missing the actual naginata blade mesh.');
  const positions = blade.geometry.getAttribute('position');
  assert.ok(positions.count > 100, 'Validate the complete curved blade, not a tip proxy.');
  const vertices = Array.from({length:positions.count},(_,i) => new T.Vector3().fromBufferAttribute(positions,i));
  const weaponFrame = new T.Quaternion().fromArray(frames.r.frame).normalize();
  const endpoints = {}, result = {};

  for (const name of NATIVE_NAGINATA_CLIPS) {
    const clip = clips.get(name), spec = records[name];
    assert.ok(clip, `Missing animation ${name}.`);
    assert.ok(spec, `Missing motion record ${name}.`);
    assert.equal(spec.nativeAttachment, true, `${name}: native wrist attachment is required.`);
    assert.equal(spec.pairedGrip, true, `${name}: paired palm attachment is required.`);
    assert.equal(spec.nativeStanceFeet, true, `${name}: preserve the authored feet.`);
    assert.equal(spec.primaryGrip, -.36, `${name}: primary station changed.`);
    assert.equal(spec.gripSpacing, .40, `${name}: paired station spacing changed.`);
    assert.ok(Math.abs(clip.duration-spec.duration) < 1e-6, `${name}: model and record durations differ.`);
    for (const side of ['r','l']) {
      assert.ok(spec.footPlants?.[side]?.length, `${name}: missing ${side} support intervals.`);
    }
    for (const hit of spec.impacts) {
      assert.ok(['r','l'].some(side => spec.footPlants[side].some(([a,b]) => hit >= a && hit <= b)),
        `${name}/${hit}: no planted foot at contact.`);
    }

    rig.mixer.stopAllAction();
    const action = rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();
    action.clampWhenFinished = true;
    const measured = {samples:0,wrist:0,mcp:0,palmGap:0,frameJump:0,minTipY:Infinity,
      maxMedial:0,maxPlantDrift:0,maxPlantTurn:0,minBladeY:Infinity,maxLift:0};
    if (includeSkin) Object.assign(measured,{skinSamples:0,maxElbowFold:0,maxForearmTorsoPairs:0});
    if (includeFrames) measured.frames = [];
    const plants = new Map();
    let previous = null;
    // 480 Hz includes the midpoints between the 240 Hz animation keys.
    // Exact impacts and endpoints also run through the same checks.
    const times = new Set([0,spec.duration,...spec.impacts]);
    for (let i=0;i<=Math.floor(spec.duration*480);i++) times.add(i/480);
    for (const time of [...times].sort((a,b) => a-b)) {
      action.time = Math.min(time,clip.duration);
      rig.mixer.update(0); rig.scene.updateMatrixWorld(true); measured.samples++;
      if (time === 0) endpoints[name+'/start'] = snapshot(bones);
      const palms = {}, arms = {};
      for (const side of ['r','l']) {
        if (includeSkin) {
          const deformed = measureArmSkin(rig,skin,side);
          const fold = deformed['fold_'+side].maxRadialPenetration;
          const pairs = deformed['forearmTorso_'+side].pairs;
          measured.skinSamples++;
          measured.maxElbowFold = Math.max(measured.maxElbowFold,fold);
          measured.maxForearmTorsoPairs = Math.max(measured.maxForearmTorsoPairs,pairs);
          assert.ok(fold <= .003,
            `${name}/${time.toFixed(6)}/${side}: actual forearm skin penetrates the upper sleeve by ${(fold*1000).toFixed(3)} mm.`);
          assert.equal(pairs,0,
            `${name}/${time.toFixed(6)}/${side}: actual forearm skin intersects the torso in ${pairs} triangle pairs.`);
        }
        const hand = 'hand_'+side, lower = 'lowerarm_'+side;
        palms[side] = bones[hand].localToWorld(new T.Vector3().fromArray(grips[side].center));
        measured.wrist = Math.max(measured.wrist,bones[hand].quaternion.clone().normalize().angleTo(neutral[side])*DEGREES);
        measured.mcp = Math.max(measured.mcp,point('middle_01_'+side).sub(point(hand))
          .angleTo(point(hand).sub(point(lower)))*DEGREES);
        for (const part of ['upperarm','lowerarm']) {
          const bone = part+'_'+side;
          arms[bone+'/world'] = rotation(bone);
          arms[bone+'/local'] = bones[bone].quaternion.clone().normalize();
        }
        const ankle = point('foot_'+side), footRotation = rotation('foot_'+side);
        measured.maxLift = Math.max(measured.maxLift,ankle.y-ankleHeight[side]);
        const index = spec.footPlants[side].findIndex(([a,b]) => time >= a-1e-6 && time <= b+1e-6);
        if (index >= 0) {
          const key = side+':'+index;
          if (!plants.has(key)) plants.set(key,{position:ankle.clone(),rotation:footRotation.clone()});
          const support = plants.get(key);
          measured.maxPlantDrift = Math.max(measured.maxPlantDrift,ankle.distanceTo(support.position));
          measured.maxPlantTurn = Math.max(measured.maxPlantTurn,footRotation.angleTo(support.rotation));
          const forward = point('ball_'+side).sub(ankle).setY(0).normalize();
          const outward = UP.clone().cross(forward).multiplyScalar(side === 'l' ? 1 : -1);
          measured.maxMedial = Math.max(measured.maxMedial,-point('calf_'+side).sub(ankle).dot(outward));
        }
      }
      const weaponRotation = rotation('hand_r').multiply(weaponFrame);
      const shaft = UP.clone().applyQuaternion(weaponRotation);
      if (name === 'Ethan_Naginata_Ready' && time === 0) {
        const pose = spec.poses[0];
        const direction = new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
        const calibrated = new T.Quaternion().setFromUnitVectors(UP,direction)
          .multiply(new T.Quaternion().setFromAxisAngle(UP,pose.roll??0));
        assert.ok(calibrated.angleTo(weaponRotation) < .001, 'Ready metadata changes the fitted weapon frame.');
      }
      measured.palmGap = Math.max(measured.palmGap,palms.l.distanceTo(palms.r.clone().addScaledVector(shaft,-spec.gripSpacing)));
      weapon.quaternion.copy(weaponRotation);
      weapon.position.copy(palms.r).addScaledVector(shaft,-spec.primaryGrip);
      weapon.updateMatrixWorld(true);
      const tip = weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip));
      measured.minTipY = Math.min(measured.minTipY,tip.y);
      const e = blade.matrixWorld.elements;
      for (const vertex of vertices) {
        const height = e[1]*vertex.x + e[5]*vertex.y + e[9]*vertex.z + e[13];
        measured.minBladeY = Math.min(measured.minBladeY,height);
      }
      if (previous && time-previous.time > 1e-6) {
        for (const [bone,quaternion] of Object.entries(arms)) {
          const jump = quaternion.angleTo(previous.arms[bone])*DEGREES/(120*(time-previous.time));
          if (jump > measured.frameJump) {
            measured.frameJump = jump; measured.worstJump = {time,bone};
          }
        }
      }
      previous = {time,arms};
      if (includeFrames) measured.frames.push({time,tip:tip.toArray(),
        edge:RIGHT.clone().applyQuaternion(weaponRotation).toArray(),
        palms:{r:palms.r.toArray(),l:palms.l.toArray()}});
    }
    endpoints[name+'/end'] = snapshot(bones);
    assert.ok(measured.wrist < 24.01, `${name}: wrist departs ${measured.wrist.toFixed(2)}° from neutral.`);
    assert.ok(measured.mcp < 30, `${name}: hand folds ${measured.mcp.toFixed(2)}° across the forearm.`);
    assert.ok(measured.palmGap < .0025, `${name}: paired palm gap is ${(measured.palmGap*1000).toFixed(3)} mm.`);
    assert.ok(measured.frameJump < 23, `${name}: arm frame jumps ${measured.frameJump.toFixed(2)}° per 120 Hz interval: ${JSON.stringify(measured.worstJump)}.`);
    assert.ok(measured.minBladeY > .10, `${name}: the actual blade approaches the ground.`);
    assert.ok(measured.maxMedial < .02, `${name}: a loaded knee falls inside its shoe plane.`);
    assert.ok(measured.maxPlantTurn < .005, `${name}: a planted shoe rotates.`);
    assert.ok(measured.maxPlantDrift < .001, `${name}: planted foot drift is ${(measured.maxPlantDrift*1000).toFixed(3)} mm.`);
    if (spec.athleticAttack) assert.ok(measured.maxLift > .04, `${name}: no authored foot lift.`);
    result[name] = measured;
  }
  const ready = endpoints['Ethan_Naginata_Ready/start'];
  for (const [endpoint,pose] of Object.entries(endpoints)) {
    for (const [name,bone] of Object.entries(pose)) {
      assert.ok(bone.position.distanceTo(ready[name].position) < 1e-5, `${endpoint}/${name}: position differs from Ready.`);
      assert.ok(bone.rotation.angleTo(ready[name].rotation) < 1e-5, `${endpoint}/${name}: rotation differs from Ready.`);
      assert.ok(bone.scale.distanceTo(ready[name].scale) < 1e-6, `${endpoint}/${name}: scale differs from Ready.`);
    }
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options:{model:{type:'string'},record:{type:'string'},
    output:{type:'string'},'include-frames':{type:'boolean'},skin:{type:'boolean'},help:{type:'boolean'}}});
  if (values.help) {
    console.log('node tools/check-native-naginata.mjs [--model MODEL.glb] [--record RECORDS.json] [--output REPORT.json] [--include-frames] [--skin]\nChecks native wrist, paired grip, knees, support, blade clearance, and arm continuity.\n--skin also checks actual elbow-fold penetration and forearm/torso intersections at 480 Hz.\nDefaults to the installed Monk model and motion records. Runs without a browser or GPU.');
  } else {
    if (Boolean(values.model) !== Boolean(values.record)) throw new Error('Supply --model and --record together, or omit both for installed assets.');
    const report = await validateNativeNaginata({model:values.model,record:values.record,includeFrames:values['include-frames'],includeSkin:values.skin});
    if (values.output) fs.writeFileSync(values.output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([name,metrics]) => [name,{...metrics,frames:undefined}])),null,2));
  }
}
