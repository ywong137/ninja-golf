import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {samplePeriodicAngle} from '../tools/knee-plane-constraints.mjs';

const count=192,duration=.8,RAD=Math.PI/180;
function run(rows,extra={}){
 return spawnSync(process.env.NINJA_PYTHON??'python3',[new URL('../tools/fit-periodic-angle.py',import.meta.url).pathname],{
  input:JSON.stringify({duration,speedLimit:2,controls:48,rows,...extra}),encoding:'utf8',
  env:{...process.env,OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'},
 });
}
function fit(rows,extra){const result=run(rows,extra);assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}

test('an already admissible cycle receives no joint correction',()=>{
 const fitResult=fit(Array.from({length:count},()=>({lower:-.2,upper:.3})));
 assert.ok(fitResult.controls.every(x=>x===0));
 assert.equal(fitResult.maxSpeed,0);
});

test('a narrow joint constraint creates smooth anticipation instead of a frame clamp',()=>{
 const rows=Array.from({length:count},(_,i)=>({lower:i===76?5*RAD:-12*RAD,upper:12*RAD}));
 const result=fit(rows,{speedLimit:1.2});
 for(let i=0;i<count;i++){
  const value=samplePeriodicAngle(result.controls,i/count);
  assert.ok(value>=rows[i].lower-1e-7&&value<=rows[i].upper+1e-7);
  assert.ok(Math.abs(value-result.angles[i])<1e-10,'The authoring sampler must agree with the fitted basis.');
 }
 assert.ok(samplePeriodicAngle(result.controls,72/count)>1*RAD,'The knee must prepare before the constrained frame.');
 assert.ok(result.maxSpeed<=1.2+1e-7);
 let maxSpeed=0;
 for(let i=0;i<4096;i++)maxSpeed=Math.max(maxSpeed,
  Math.abs(samplePeriodicAngle(result.controls,(i+1)/4096)-samplePeriodicAngle(result.controls,i/4096))*4096/duration);
 assert.ok(maxSpeed<=1.21,'The interpolated curve must also respect the speed bound.');
});

test('signed corrections retain value and first derivatives across the cycle boundary',()=>{
 const rows=Array.from({length:count},(_,i)=>({lower:i<4?3*RAD:-10*RAD,upper:i===count/2?-3*RAD:10*RAD}));
 const result=fit(rows),sample=u=>samplePeriodicAngle(result.controls,u),e=1e-5;
 assert.ok(Math.abs(sample(0)-sample(1))<1e-12);
 assert.ok(Math.abs((sample(e)-sample(0))/e-(sample(1)-sample(1-e))/e)<.002);
 assert.ok(sample(0)>2.99*RAD&&sample(.5)<-2.99*RAD);
});

test('infeasible joint motion fails with an actionable constraint error',()=>{
 const rows=Array.from({length:count},(_,i)=>({lower:i%2?.1:-.2,upper:i%2?.2:-.1}));
 const result=run(rows,{speedLimit:.1});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/No periodic angle satisfies the measured bounds and speed limit/);
});
