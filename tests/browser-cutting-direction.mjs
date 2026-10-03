import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const corrections=JSON.parse(fs.readFileSync(new URL('../docs/reviews/blade-mount-corrections.json',import.meta.url)));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-cutting-direction-'));
try{
 const output=path.join(folder,'report.json');
 execFileSync(process.execPath,['tools/audit-blade-direction.mjs','--output',output,'--url',process.env.GAME_URL||'http://localhost:5174'],{stdio:'pipe',maxBuffer:1024*1024});
 const report=JSON.parse(fs.readFileSync(output)),rows=[];
 assert.deepEqual(report.errors,[]);
 const checked=[...corrections,{clip:'Shinobi_Stepping_Cut'}];
 for(const {clip}of checked){
  const cuts=report.rows.filter(r=>r.clip===clip&&r.active);assert.ok(cuts.length,'Missing corrected clip: '+clip);
  for(const cut of cuts){assert.ok(cut.edge>.85&&cut.flat<.5,`${clip}: the blade flat leads its cutting interval.`);rows.push({clip,edge:cut.edge,flat:cut.flat});}
 }
 assert.equal(new Set(rows.map(r=>r.clip)).size,checked.length);
 const covering=report.rows.find(r=>r.clip==='Shinobi_Stepping_Cut'&&r.hand==='left');assert.ok(covering&&!covering.active,'The covering sword is not a cutting contact.');
 console.log(JSON.stringify({passed:rows.length,rows},null,2));
}finally{fs.rmSync(folder,{recursive:true,force:true});}
