import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const modulePath=fileURLToPath(new URL('../tools/native-locomotion-profile.py',import.meta.url));
const data=JSON.parse(execFileSync('python3',['-c',`
import importlib.util,json,math,sys
spec=importlib.util.spec_from_file_location('profile',sys.argv[1]);p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
phases=[i/1000 for i in range(1001)]
print(json.dumps({'lift':[p.posture_lift(t,[.07,.16]) for t in phases],'unreachable':[p.posture_lift(t,[.01,.16]) for t in phases],'yaw':[p.pelvis_yaw(t,0) for t in phases],'backward':[p.pelvis_yaw(t,math.pi) for t in phases],'feet':[[p.recovery_lift(t,h) for t in phases] for h in [.14,.18,.24,.30]]}))
`,modulePath],{encoding:'utf8'}));
test('Support-aware posture loops smoothly and preserves its reach reserve',()=>{
 assert.ok(data.lift.every(x=>x>=0&&x<=.05));assert.ok(data.unreachable.every(x=>x===0));assert.ok(Math.abs(data.lift[0]-data.lift.at(-1))<1e-12);
 assert.ok(Math.abs((data.lift[1]-data.lift[0])-(data.lift.at(-1)-data.lift.at(-2)))<1e-5);
 assert.ok(Math.max(...data.lift.slice(1).map((x,i)=>Math.abs(x-data.lift[i])))<.0005);
});
test('Hip transfer has a periodic phase and reverses with backpedal',()=>{
 assert.ok(Math.abs(data.yaw[0]-data.yaw.at(-1))<1e-12);assert.ok(Math.max(...data.yaw.map(Math.abs))<=Math.PI/45+1e-12);
 data.yaw.forEach((value,i)=>assert.ok(Math.abs(value+data.backward[i])<1e-12));
});
test('Free-foot folding preserves departure samples and never lowers recovery clearance',()=>{
 for(const [i,h]of [.14,.18,.24,.30].entries()){
  const feet=data.feet[i];assert.ok(feet.every((value,j)=>value+1e-12>=h*Math.sin(Math.PI*j/1000)**1.2));assert.ok(Math.abs(feet[0])<1e-12&&Math.abs(feet.at(-1))<1e-12);
  for(const j of [0,8,20,40])assert.ok(Math.abs(feet[j]-h*Math.sin(Math.PI*j/1000)**1.2)<1e-12,'Keep the first free samples unchanged so stance interpolation stays fixed');
  assert.ok(Math.max(...feet)<h+.12,'Keep recovery below an excessive high-knee lift');
 }
});
