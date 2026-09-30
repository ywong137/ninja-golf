// Exact skin regression around the top of the backswing for all six heroes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectGolfHeadClearance} from './golf-head-clearance-helper.mjs';
const repo=path.resolve(process.env.NINJA_GOLF_REPO??process.cwd());

for(const [model,label] of [['ronin','Ronin'],['shinobi','Shinobi'],['monk','Vice President'],['kaede','Ace'],['ayame','Hustler'],['sora','Closer']])test(`${label} backswing keeps arms and club outside the head and neck`,async t=>{
  const directory=path.resolve(process.env.NINJA_GOLF_MODEL_DIR??path.join(repo,'public/models'));
  const report=await inspectGolfHeadClearance(path.join(directory,model+'.glb'),{start:.58,end:1.38,includeNeck:true});
  if (process.env.NINJA_GOLF_HEAD_REPORT) fs.writeFileSync(model==='monk'?process.env.NINJA_GOLF_HEAD_REPORT:process.env.NINJA_GOLF_HEAD_REPORT.replace(/\.json$/,'.'+model+'.json'),JSON.stringify(report,null,2)+'\n');
  t.diagnostic(JSON.stringify({samples:report.samples,statistics:report.statistics}));
  const failures=Object.entries(report.statistics).filter(([,result])=>result.maxCrossings>0);
  assert.deepEqual(failures.map(([limb,result])=>({limb,time:result.firstFailure.time,worstTime:result.worstTime,
    maxCrossings:result.maxCrossings,vertices:result.firstFailure.vertices})),[],
    'An arm, hand, or club surface crosses the head or neck during Golf_Swing. Keep the candidate rejected; inspect the reported part and time.');
});
