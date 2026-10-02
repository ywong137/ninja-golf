import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {fitSupportFootprint} from '../src/run-landing.js';

test('a footprint satisfies both the landing and departing body planes',()=>{
 const preferred=new Vector3(.2,.1,.3);
 const fitted=fitSupportFootprint(preferred,[{normal:new Vector3(-1,0,0),minimum:.1},{normal:new Vector3(0,0,-1),minimum:.2}]);
 assert.ok(fitted.distanceTo(new Vector3(-.1,.1,-.2))<1e-10);
 assert.deepEqual(preferred.toArray(),[.2,.1,.3],'Planning changed the original contact.');
});

test('a reachable landing uses the nearest plane and reach-circle intersection',()=>{
 const result=fitSupportFootprint(new Vector3(2,.1,2),[{normal:new Vector3(1,0,0),minimum:.8}],[{center:new Vector3(),radius:1}]);
 assert.ok(result.distanceTo(new Vector3(.8,.1,.6))<1e-10);
});

test('a footprint can remain reachable from both ends of its support',()=>{
 const result=fitSupportFootprint(new Vector3(0,.1,2),[],[{center:new Vector3(-.6,0,0),radius:1},{center:new Vector3(.6,0,0),radius:1}]);
 assert.ok(result.distanceTo(new Vector3(0,.1,.8))<1e-10);
});

test('an impossible support reports failure instead of moving a planted contact',()=>{
 const result=fitSupportFootprint(new Vector3(),[{normal:new Vector3(1,0,0),minimum:2}],[{center:new Vector3(),radius:1}]);
 assert.equal(result,null);
});

test('a valid footprint is unchanged',()=>{
 const preferred=new Vector3(.2,.1,.3);
 const result=fitSupportFootprint(preferred,[{normal:new Vector3(1,0,0),minimum:.1}],[{center:new Vector3(),radius:1}]);
 assert.ok(result.equals(preferred));
});
