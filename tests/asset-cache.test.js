import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetCache} from '../src/asset-cache.js';
import {WARRIOR_ASSET_NAMES,INITIAL_WARRIOR_ASSET_NAMES} from '../src/warrior-assets.js';
import {WARRIORS} from '../src/warriors.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

test('overlapping requests share work; completion order preserves asset identity',async()=>{
 const gates={a:deferred(),b:deferred()},calls=[];
 const cache=createAssetCache(key=>{calls.push(key);return gates[key].promise;});
 const a=cache.load('a'),same=cache.load('a'),b=cache.load('b');
 assert.equal(a,same);assert.equal(cache.has('a'),false);assert.throws(()=>cache.get('a'),/not ready/);
 gates.b.resolve({name:'b'});await b;assert.equal(cache.get('b').name,'b');assert.equal(cache.has('a'),false);
 gates.a.resolve({name:'a'});await a;assert.deepEqual(calls,['a','b']);assert.equal(cache.get('a').name,'a');
 assert.equal(await cache.load('a'),cache.get('a'));assert.deepEqual(calls,['a','b']);
});
test('a failed asset can retry without invalidating successful or pending assets',async()=>{
 let attempts=0;const gate=deferred();const cache=createAssetCache(key=>{
  if(key==='slow')return gate.promise;
  if(key==='bad'&&++attempts===1)throw new Error('Connection interrupted');return key;
 });
 const slow=cache.load('slow');assert.equal(await cache.load('good'),'good');
 await assert.rejects(cache.load('bad'),/Connection interrupted/);assert.equal(cache.has('bad'),false);
 assert.equal(await cache.load('bad'),'bad');assert.equal(cache.get('good'),'good');assert.equal(cache.has('slow'),false);
 gate.resolve('slow');assert.equal(await slow,'slow');assert.equal(attempts,2);
});
test('startup includes the default hero and round assets, but no unselected heroes',()=>{
 assert.ok(INITIAL_WARRIOR_ASSET_NAMES.includes(WARRIORS[0].model));
 for(const warrior of WARRIORS.slice(1))assert.ok(!INITIAL_WARRIOR_ASSET_NAMES.includes(warrior.model));
 assert.deepEqual(new Set([...INITIAL_WARRIOR_ASSET_NAMES,...WARRIORS.map(w=>w.model)]),new Set(WARRIOR_ASSET_NAMES));
});
