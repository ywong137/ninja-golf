import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_NAGINATA_CLIPS,validateNativeNaginata} from '../tools/check-native-naginata.mjs';

test('Ethan native polearm clips preserve the paired grip, anatomy, support, blade clearance, and continuous arms',async t => {
  const report = await validateNativeNaginata();
  assert.deepEqual(Object.keys(report),NATIVE_NAGINATA_CLIPS);
  assert.ok(Object.values(report).every(clip => clip.samples > 100),'Sample between the authored frames.');
  const maximum = key => Math.max(...Object.values(report).map(clip => clip[key]));
  t.diagnostic(JSON.stringify({clips:Object.keys(report).length,wrist:maximum('wrist'),
    palmGap:maximum('palmGap'),armStep120Hz:maximum('frameJump'),plantedDrift:maximum('maxPlantDrift')}));
});
