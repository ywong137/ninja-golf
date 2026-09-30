// Exact skin regression for every golf finish. Run from the repository root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectGolfFinish} from './golf-head-clearance-helper.mjs';
export {inspectGolfFinish};
const repo=path.resolve(process.env.NINJA_GOLF_REPO??process.cwd());

for(const [model,label] of [['ronin','Ronin'],['shinobi','Shinobi'],['monk','Vice President'],['kaede','Ace'],['ayame','Hustler'],['sora','Closer']])test(`${label} golf finish keeps arms, hands, and club shaft outside the actual head surface`,async t=>{
  const directory=path.resolve(process.env.NINJA_GOLF_MODEL_DIR??path.join(repo,'public/models'));
  const report=await inspectGolfFinish(path.join(directory,model+'.glb'));
  if (process.env.NINJA_GOLF_HEAD_REPORT) fs.writeFileSync(model==='monk'?process.env.NINJA_GOLF_HEAD_REPORT:process.env.NINJA_GOLF_HEAD_REPORT.replace(/\.json$/,'.'+model+'.json'),JSON.stringify(report,null,2)+'\n');
  t.diagnostic(JSON.stringify({samples:report.samples,statistics:report.statistics}));
  const failures=Object.entries(report.statistics).filter(([,result])=>result.maxCrossings>0);
  assert.deepEqual(failures.map(([limb,result])=>({limb,time:result.firstFailure.time,worstTime:result.worstTime,
    maxCrossings:result.maxCrossings,vertices:result.firstFailure.vertices})),[],
    'An arm, hand, or club surface crosses the head or jaw during Golf_Swing. Keep the candidate rejected; inspect the reported part and time.');
});
