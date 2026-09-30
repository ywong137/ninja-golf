import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {projectPlaybackMotions} from './playback-motion.mjs';
import {disableHmr} from './disable-hmr.mjs';

if(process.argv.includes('--help')){
  console.log('Usage: node tools/benchmark-motion-sampling.mjs [output.json]\nRequires Vite on localhost:5173. Compares production pose sampling in muted Chrome.');
  process.exit(0);
}
const output=process.argv[2]||'/tmp/ninja-sampling/benchmark.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
const records=projectPlaybackMotions(JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
  const page=await browser.newPage();await disableHmr(page);
  await page.route('**/src/motion-data.json*',route=>route.fulfill({contentType:'application/javascript',body:`export default ${JSON.stringify(records)};`}));
  await page.goto('http://localhost:5173/tests/rig-stage.html');
  const result=await page.evaluate(async()=>{
    const {motions,selectionMotions,sampleMotionInto}=await import('/src/motion.js');
    const {sampleReference}=await import('/tests/fixtures/motion-sampler-before.js');
    const clips=Object.entries({...selectionMotions,...motions});
    const buffers=clips.map(()=>({}));
    const samples=200000,rounds=[];
    const run=optimized=>{
      let checksum=0;const start=performance.now();
      for(let i=0;i<samples;i++){
        const index=i%clips.length,[name,clip]=clips[index],time=((i*17)%1009)/1008*clip.duration;
        const pose=optimized?sampleMotionInto(name,time,buffers[index]):sampleReference(clip,time,name);
        checksum+=(pose.grip?.[0]??0)+(pose.footR?.[2]??0);
      }
      return{milliseconds:performance.now()-start,checksum};
    };
    run(false);run(true);
    for(let round=0;round<9;round++){
      // Alternate order to avoid favoring the second run after CPU warmup.
      const order=round%2?[true,false]:[false,true],row={};
      for(const optimized of order)row[optimized?'optimized':'reference']=run(optimized);
      rounds.push(row);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const median=key=>rounds.map(row=>row[key].milliseconds).sort((a,b)=>a-b)[4];
    return{browser:navigator.userAgent,clips:clips.length,samplesPerRound:samples,rounds,medianMilliseconds:{reference:median('reference'),optimized:median('optimized')}};
  });
  for(const row of result.rounds)assert.equal(row.reference.checksum,row.optimized.checksum);
  result.medianSpeedup=result.medianMilliseconds.reference/result.medianMilliseconds.optimized;
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
