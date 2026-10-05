import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionDataLoader} from '../src/motion-data-loader.js';
const poses=[{t:0,grip:[1,2,3]},{t:1,grip:[4,5,6]}];

test('character motion loading shares requests and updates existing metadata references',async()=>{
 const records={Golf:{duration:1},Ronin:{duration:1},Ace:{duration:1}},reference=records.Ronin,calls=[];
 const load=createMotionDataLoader(records,{Golf:'shared',Ronin:'ronin',Ace:'ace'},async group=>{calls.push(group);return{Golf:poses,Ronin:poses,Ace:poses};});
 await Promise.all([load(['Golf','Ronin']),load(['Ronin','native-clip-without-extra-pose-data'])]);
 assert.deepEqual(calls.sort(),['ronin','shared']);assert.equal(records.Ronin,reference);assert.deepEqual(reference.poses,poses);assert.equal(records.Ace.poses,undefined);
 await load(['Golf','Ace']);assert.deepEqual(calls,['ronin','shared','ace']);assert.deepEqual(records.Ace.poses,poses);
});
test('failed and incomplete motion bundles retry without partial publication',async()=>{
 const records={A:{duration:1},B:{duration:1}},owners={A:'same',B:'same'};let attempt=0;
 const load=createMotionDataLoader(records,owners,async()=>{if(++attempt===1)throw Error('Interrupted');if(attempt===2)return{A:poses};return{A:poses,B:poses};});
 await assert.rejects(load(['A']),/Interrupted/);await assert.rejects(load(['B']),/incomplete: B/);
 assert.equal(records.A.poses,undefined);assert.equal(records.B.poses,undefined);
 await load(['A']);assert.equal(attempt,3);assert.deepEqual(records.A.poses,poses);assert.deepEqual(records.B.poses,poses);
});
