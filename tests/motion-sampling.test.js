import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectPlaybackMotions} from '../tools/playback-motion.mjs';
import {sampleReference} from './fixtures/motion-sampler-before.js';

const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const selection=JSON.parse(fs.readFileSync(new URL('../src/selection-data.json',import.meta.url)));
const load=async records=>{
  const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8')
    .replace("import motions from './motion-data.json';",`const motions=${JSON.stringify(records)};`)
    .replace("import selectionMotions from './selection-data.json';",`const selectionMotions=${JSON.stringify(selection)};`);
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};

for(const [label,records]of [['authoring',motions],['production',projectPlaybackMotions(motions)]]){
  test(`${label}: reused samples match the previous sampler at every key and three intermediate times`,async t=>{
    const {sampleMotion,sampleMotionInto}=await load(records),output={};let count=0;
    for(const [name,clip]of Object.entries({...selection,...records})){
      const times=[-1,clip.duration+1];
      for(let i=0;i<clip.poses.length;i++){
        const a=clip.poses[i].t,b=clip.poses[i+1]?.t;
        times.push(a*clip.duration);
        if(b!==undefined)for(const fraction of [.25,.5,.75])times.push((a+(b-a)*fraction)*clip.duration);
      }
      // Reverse traversal also covers seeking and backpedaling.
      for(const seconds of times.reverse()){
        const expected=sampleReference(clip,seconds,name),actual=sampleMotionInto(name,seconds,output);
        assert.equal(actual,output);
        assert.deepEqual(actual,expected,`${name} at ${seconds}s`);count++;
      }
      assert.deepEqual(sampleMotion(name,clip.duration*.37),sampleReference(clip,clip.duration*.37,name));
    }
    assert.equal(sampleMotionInto('missing-clip',0,output),null);
    t.diagnostic(`${count} exact comparisons, including clip changes and endpoint clamps`);
  });
}

test('Repeated sampling reuses arrays, while independent callers retain independent results',async()=>{
  const {sampleMotion,sampleMotionInto}=await load(projectPlaybackMotions(motions)),output={};
  for(const name of ['Golf_Swing','Twin_Cut_Diagonal','Golf_Putt']){
    sampleMotionInto(name,0,output);
    const arrays=Object.entries(output).filter(([,value])=>Array.isArray(value));
    for(let frame=1;frame<120;frame++){
      sampleMotionInto(name,frame/120,output);
      for(const [key,array]of arrays)assert.equal(output[key],array,`${name}/${key}`);
    }
  }
  const a=sampleMotion('Golf_Swing',.7),snapshot=structuredClone(a),b=sampleMotion('Golf_Swing',1.4);
  assert.notEqual(a,b);assert.notEqual(a.grip,b.grip);assert.deepEqual(a,snapshot);
  const other={};sampleMotionInto('Golf_Swing',1.4,other);assert.notEqual(other.grip,output.grip);
  const paired=Object.keys(motions).find(name=>motions[name].poses[0].offGrip);
  sampleMotionInto(paired,0,output);assert.ok(output.offGrip);
  sampleMotionInto('Golf_Putt',0,output);assert.equal(Object.hasOwn(output,'offGrip'),false);
});
