import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {PLAYBACK_POSE_FIELDS,projectPlaybackMotions,splitPlaybackMotions,playbackMotionPlugin} from '../tools/playback-motion.mjs';

const source=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8'));
const projected=projectPlaybackMotions(source);
const select=pose=>Object.fromEntries(Object.entries(pose).filter(([field])=>field in PLAYBACK_POSE_FIELDS));
const loadSampler=async records=>{
  const selection=fs.readFileSync(new URL('../src/selection-data.json',import.meta.url),'utf8');
  const code=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8')
    .replace("import motions from './motion-data.json';",`const motions=${JSON.stringify(records)};`)
    .replace("import selectionMotions from './selection-data.json';",`const selectionMotions=${selection};`);
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};

test('Playback records preserve every knot, retained number, and clip metadata',()=>{
  const before=JSON.stringify(source);
  assert.deepEqual(Object.keys(projected),Object.keys(source));
  for(const [name,clip]of Object.entries(source)){
    const {poses,...metadata}=clip,{poses:playback,...playbackMetadata}=projected[name];
    assert.deepEqual(playbackMetadata,metadata,name);
    assert.equal(playback.length,poses.length,name);
    playback.forEach((pose,i)=>assert.deepEqual(pose,select(poses[i]),`${name}, pose ${i}`));
  }
  assert.equal(JSON.stringify(source),before,'Projection must leave the authoring records intact');
  assert.ok(gzipSync(JSON.stringify(projected)).length<gzipSync(before).length*.55,'The release must remove at least 45% of compressed motion data');
});

test('Every shipped motion interpolates exactly at keys and between keys',async t=>{
  const original=await loadSampler(source),playback=await loadSampler(projected);let samples=0;
  for(const [name,clip]of Object.entries(source)){
    const times=[-1,clip.duration+1];
    for(let i=0;i<clip.poses.length;i++){
      const a=clip.poses[i].t,b=clip.poses[i+1]?.t;
      times.push(a*clip.duration);
      if(b!==undefined)for(const fraction of [.25,.5,.75])times.push((a+(b-a)*fraction)*clip.duration);
    }
    for(const time of times){assert.deepEqual(playback.sampleMotion(name,time),select(original.sampleMotion(name,time)),`${name} at ${time}s`);samples++;}
  }
  assert.equal(playback.sampleMotion('not-a-clip',0),null);
  t.diagnostic(`${Object.keys(source).length} clips; ${samples} exact sampled-pose comparisons`);
});

test('Projection rejects missing channels and invalid interpolation data',()=>{
  const fixture=()=>({Test:{duration:1,poses:[{t:0,grip:[0,0,0],hip:3},{t:1,grip:[1,2,3],hip:4}]}});
  let records=fixture();delete records.Test.poses[1].grip;assert.throws(()=>projectPlaybackMotions(records),/Test, pose 1: grip/);
  records=fixture();records.Test.poses[1].t=0;assert.throws(()=>projectPlaybackMotions(records),/time must increase/);
  records=fixture();records.Test.poses[1].grip[0]=NaN;assert.throws(()=>projectPlaybackMotions(records),/finite number/);
  records=fixture();records.Test.poses[1].tip=[0,1,0];assert.throws(()=>projectPlaybackMotions(records),/tip is missing from the initial pose/);
  records=fixture();records.Test.duration=0;assert.throws(()=>projectPlaybackMotions(records),/positive duration/);
});

test('Only release builds replace the game motion import',async()=>{
  const plugin=playbackMotionPlugin(),root=new URL('..',import.meta.url).pathname.slice(0,-1);
  assert.equal(plugin.apply({}, {command:'serve',mode:'development'}),false);
  assert.equal(plugin.apply({}, {command:'build',mode:'motion-reference'}),false);
  assert.equal(plugin.apply({}, {command:'build',mode:'production'}),true);
  plugin.configResolved({root});
  const id=plugin.resolveId('./motion-data.json',root+'/src/motion.js');assert.ok(id);
  assert.equal(plugin.resolveId('./motion-data.json',root+'/tools/author.js'),undefined);
  assert.equal(plugin.resolveId('./selection-data.json',root+'/src/motion.js'),undefined);
  const watched=[],code=await plugin.load.call({addWatchFile:file=>watched.push(file)},id);
  const actual=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.deepEqual(actual.default,Object.fromEntries(Object.entries(projected).map(([name,{poses,...metadata}])=>[name,metadata])));
  const assets=[],loader=plugin.resolveId('./motion-loading.js',root+'/src/actors.js');
  const loaderCode=await plugin.load.call({addWatchFile:()=>{},emitFile:asset=>{assets.push(asset);return String(assets.length);}},loader);
  assert.match(loaderCode,/createMotionDataLoader/);
  const restored=structuredClone(actual.default);
  for(const asset of assets)for(const [name,poses]of Object.entries(JSON.parse(asset.source)))restored[name].poses=poses;
  assert.deepEqual(restored,projected,'Lazy assets reconstruct every exact playback record');
  assert.equal(watched.length,8);assert.ok(watched.includes(root+'/src/motion-data.json'));
});

 test('Motion assets separate shared poses, character poses, and unused historical poses',()=>{
  const clip=name=>({duration:1,name,poses:[{t:0},{t:1}]}),records={Golf:clip('Golf'),Ronin:clip('Ronin'),Ace:clip('Ace'),Old:clip('Old')};
  const result=splitPlaybackMotions(records,{ronin:['Golf','Ronin'],kaede:['Golf','Ace']});
  assert.deepEqual(result.owners,{Golf:'shared',Ronin:'ronin',Ace:'kaede',Old:'legacy'});
  assert.deepEqual(result.bundles.shared.Golf,records.Golf.poses);
  assert.deepEqual(result.metadata.Ronin,{duration:1,name:'Ronin'});
 });
