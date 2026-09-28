import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const tool=new URL('../tools/fit-golf-fingers.mjs',import.meta.url);
test('separate finger and thumb fits close the actual Kaede hand without changing its shaft',()=>{
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
  const thumbOutput=path.join(directory,'thumb.json');
  const thumbFit=spawnSync(process.execPath,[new URL('../tools/fit-golf-thumb-pad.mjs',import.meta.url).pathname,'--hero','kaede','--side','r','--profile',output,'--output',thumbOutput,'--distal-axis','preceding-segment','--search','compact'],{encoding:'utf8'});
  assert.equal(thumbFit.status,0,thumbFit.stderr);
  const complete=JSON.parse(fs.readFileSync(thumbOutput)),pad=complete.thumbPadFit;
  for(const key of ['center','axis','radius','frame'])assert.deepEqual(complete[key],candidate[key]);
  for(const [name,q]of Object.entries(candidate.rotations))if(!name.startsWith('thumb'))assert.deepEqual(complete.rotations[name],q);
  assert.equal(pad.crossing.crossings,0,'The thumb crosses the closed fingers.');
  assert.ok(pad.maxDepth<.001&&pad.padGap<.005,'The distal pad lacks usable shaft contact.');
  assert.ok(pad.capAlignment>.8&&pad.padFacing>.55,'The thumb does not follow the shaft with the pad facing inward.');
  assert.ok(pad.capVertexCount>=3&&pad.padVertexCount>=3,'The fit lacks an actual cap or contact patch.');
  assert.deepEqual(JSON.parse(fs.readFileSync(output)),candidate,'The thumb fit overwrote its source profile.');
  assert.ok(fs.existsSync(path.join(directory,'thumb.report.json')),'The fit did not write a separate review report.');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('golf finger fitter rejects overwriting its source profile',()=>{
 const result=spawnSync(process.execPath,[tool.pathname,'--hero','kaede','--side','r','--grips','/tmp/source.json','--output','/tmp/source.json'],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Write a separate candidate/);
});


test('thumb fitting rejects unsafe output paths and malformed hand frames before fitting',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-thumb-validation-'));
 try{
  const profile=structuredClone(JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.golf.r),input=path.join(directory,'input.json');
  fs.writeFileSync(input,JSON.stringify(profile));
  const run=output=>spawnSync(process.execPath,[new URL('../tools/fit-golf-thumb-pad.mjs',import.meta.url).pathname,'--hero','kaede','--side','r','--profile',input,'--output',output],{encoding:'utf8'});
  for(const output of [input,path.join(directory,'thumb.txt')]){
   const result=run(output);assert.notEqual(result.status,0);assert.match(result.stderr,/separate candidate|must end with .json/);
  }
  for(const mutation of [p=>p.axis=[1,1,0],p=>p.axis=[1,null,0],p=>p.radius=null,p=>p.rotations.index_01_r=[2,0,0,0]]){
   const invalid=structuredClone(profile);mutation(invalid);fs.writeFileSync(input,JSON.stringify(invalid));
   const result=run(path.join(directory,'output.json'));assert.notEqual(result.status,0);
   assert.match(result.stderr,/normalized shaft axis|unit rotation/);assert.equal(fs.existsSync(path.join(directory,'output.json')),false);
  }
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
