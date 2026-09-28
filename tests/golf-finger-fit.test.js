import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const tool=new URL('../tools/fit-golf-fingers.mjs',import.meta.url);
test('anatomical golf finger fit closes the actual Kaede mesh without changing the shaft or thumb',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-finger-fit-'));
 try{
  const data=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
  const hand=data.kaede.golf.r;
  hand.center=[.020186746053350284,.09267569016935082,.025197343180877636];
  hand.axis=[.687962537277114,.6427881862596186,-.3369434595125802];
  hand.radius=.012;
  const input=path.join(directory,'input.json'),output=path.join(directory,'output.json');
  fs.writeFileSync(input,JSON.stringify(data));
  const result=spawnSync(process.execPath,[tool.pathname,'--hero','kaede','--side','r','--grips',input,'--output',output],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const candidate=JSON.parse(fs.readFileSync(output));
  for(const key of ['center','axis','radius','frame'])assert.deepEqual(candidate[key],hand[key],key+' changed during the finger fit.');
  for(const [name,q]of Object.entries(hand.rotations))if(name.startsWith('thumb'))assert.deepEqual(candidate.rotations[name],q,'The four-finger fit changed the thumb.');
  for(const [finger,measurement]of Object.entries(candidate.fingerClosureFit.measurements)){
   assert.ok(measurement.maxDepth<.001,finger+' penetrates the handle.');
   assert.ok(measurement.wrap>2.6,finger+' remains open around the handle.');
   for(const segment of [2,3])assert.ok(Math.abs(measurement.closest[segment])<.002,finger+' loses middle or distal contact.');
   const [mcp,pip,dip]=candidate.fingerClosureFit.parameters[finger];
   assert.ok(pip>=.55*mcp-.001&&dip>=.45*pip-.001&&dip<=.85*pip+.001,finger+' has an uncoupled distal curl.');
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(input)),data,'The source profile was changed.');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('golf finger fitter rejects overwriting its source profile',()=>{
 const result=spawnSync(process.execPath,[tool.pathname,'--hero','kaede','--side','r','--grips','/tmp/source.json','--output','/tmp/source.json'],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Write a separate candidate/);
});
