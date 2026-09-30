import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraRelativeMove,aimDelta,radarPoint,turnToward} from '../src/navigation.js';
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,.71]){
  test(`Camera-relative left/right stays correct at yaw ${yaw}`,()=>{
    const r={x:-Math.cos(yaw),z:Math.sin(yaw)};
    for(const input of [-1,1]){const d=cameraRelativeMove(input,0,yaw);assert.ok((d.x*r.x+d.z*r.z)*input>.999);}
    const f=cameraRelativeMove(0,1,yaw);assert.ok(f.x*Math.sin(yaw)+f.z*Math.cos(yaw)>.999);
    const diagonal=cameraRelativeMove(1,1,yaw);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);
  });
}
test('Golf aim moves towards the requested screen direction',()=>{assert.ok(aimDelta(-1,1)>0);assert.ok(aimDelta(1,1)<0);});
test('Combat radar agrees with movement and clips distant waypoints',()=>{for(const yaw of [0,1.2,3]){const m=cameraRelativeMove(1,0,yaw),p=radarPoint(m.x*100,m.z*100,yaw,90,60);assert.ok(Math.abs(p.x-90)<1e-8);assert.ok(Math.abs(p.y)<1e-8);assert.equal(p.outside,true);}});
test('Character turning takes the shortest route across the angle boundary',()=>{assert.ok(Math.abs(turnToward(3.13,-3.13,.5)-Math.PI)<.0001);});
test('Movement reversals respect a turn-rate limit at different frame rates without overshooting',()=>{
  for(const hz of [40,60,120])for(const target of [-Math.PI,Math.PI,.02]){
    let yaw=0;const maxStep=3*Math.PI/hz;
    for(let i=0;i<hz;i++){const next=turnToward(yaw,target,18/hz,maxStep);assert.ok(Math.abs(next-yaw)<=maxStep+1e-12);assert.ok(Math.abs(target-next)<=Math.abs(target-yaw)+1e-12);yaw=next;}
    assert.ok(Math.abs(target-yaw)<.0001);
  }
});
