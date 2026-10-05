import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NATIVE_NAGINATA_CLIPS,validateNativeNaginata} from '../tools/check-native-naginata.mjs';

test('Ethan native polearm clips preserve grip, anatomy, support, blade clearance, continuous arms, and actual skin clearance',async t => {
  const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
  for(const name of NATIVE_NAGINATA_CLIPS){
    assert.equal(motions[name].nativeKneeHinges,true,name);
    assert.equal(motions[name].nativeKneeHeading,true,name);
    if(motions[name].athleticAttack&&!name.endsWith('Musou_Flow'))assert.equal(motions[name].pelvisGaitWeight,.55,name);
  }
  const report = await validateNativeNaginata({includeSkin:true,includeReady:false});
  assert.deepEqual(Object.keys(report),NATIVE_NAGINATA_CLIPS.filter(n=>!n.endsWith('_Ready')));
  assert.ok(Object.values(report).every(clip => clip.samples > 100),'Sample between the authored frames.');
  assert.ok(Object.values(report).every(clip => clip.skinSamples === clip.samples*2),
    'Check both deformed arms at every frame, including anticipation, recovery, and guard reactions.');
  const maximum = key => Math.max(...Object.values(report).map(clip => clip[key]));
  t.diagnostic(JSON.stringify({clips:Object.keys(report).length,wrist:maximum('wrist'),
    palmGap:maximum('palmGap'),armStep120Hz:maximum('frameJump'),plantedDrift:maximum('maxPlantDrift'),
    elbowFold:maximum('maxElbowFold'),forearmTorsoPairs:maximum('maxForearmTorsoPairs'),
    hipTwist:maximum('hipTwist'),ankleTwist:maximum('ankleTwist'),kneeDeviation:maximum('kneeDeviation')}));
});
