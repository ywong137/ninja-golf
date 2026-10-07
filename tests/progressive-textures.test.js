import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ProgressiveTextures} from '../src/progressive-textures.js';
import manifest from '../public/textures/previews/manifest.json' with {type:'json'};
function fixture(){
 const pending=[];const loader={load(url,ok,progress,fail){const t={image:url,dispose(){this.disposed=true;}};pending.push({url,ok,fail,t});return t;}};
 const entry={file:'previews/ground-hash.jpg',sourceSHA256:'123456789012abcdef'},warnings=[];
 return{pending,warnings,textures:new ProgressiveTextures({loader,base:'/game/textures/',manifest:{'ground.jpg':entry},warn:(...args)=>warnings.push(args)})};
}
test('previews retain texture identity and settings through a bounded detail queue',async()=>{
 const {textures,pending}=fixture();let ready=0;
 const ts=Array.from({length:4},()=>textures.load('ground.jpg',()=>ready++));
 ts.forEach(t=>{t.colorSpace='srgb';t.repeat={x:12,y:9};});
 pending.slice().forEach(p=>p.ok(p.t));assert.equal(ready,4);assert.equal(pending.length,4);
 textures.start();assert.equal(pending.length,6);assert.equal(textures.active,2);
 pending[4].ok(pending[4].t);await Promise.resolve();await Promise.resolve();
 assert.equal(pending.length,7);assert.equal(ts[0].image,'/game/textures/ground.jpg?v=123456789012');assert.equal(ts[0].colorSpace,'srgb');assert.deepEqual(ts[0].repeat,{x:12,y:9});assert.equal(ts[0].needsUpdate,true);assert.equal(pending[4].t.disposed,true);
 pending[5].ok(pending[5].t);await Promise.resolve();await Promise.resolve();pending[6].ok(pending[6].t);pending[7].ok(pending[7].t);await Promise.resolve();await Promise.resolve();assert.equal(textures.active,0);
});
test('preview failure falls back; detail failure keeps the usable preview and releases its queue slot',async()=>{
 const {textures,pending,warnings}=fixture();let ready=0;const t=textures.load('ground.jpg',()=>ready++);pending[0].fail(Error('missing'));pending[1].ok(pending[1].t);assert.equal(ready,1);assert.equal(t.image,pending[1].url);
 const next=textures.load('ground.jpg');pending[2].ok(pending[2].t);textures.start();pending[3].fail(Error('offline'));await Promise.resolve();await Promise.resolve();assert.equal(next.image,pending[2].url);assert.equal(textures.active,0);assert.equal(warnings.length,1);
});
test('textures without previews keep the original loader path',()=>{const {textures,pending}=fixture();let ready=false;textures.load('small.png',()=>ready=true);assert.equal(pending[0].url,'/game/textures/small.png');pending[0].ok(pending[0].t);assert.equal(ready,true);assert.equal(textures.queue.length,0);});
test('checked-in surface previews match their original assets and content hashes',()=>{
 let original=0,preview=0;
 for(const [name,entry]of Object.entries(manifest)){
  const source=readFileSync(new URL('../public/textures/'+name,import.meta.url)),small=readFileSync(new URL('../public/textures/'+entry.file,import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),entry.sourceSHA256,`Regenerate surface previews after changing ${name}`);
  assert.ok(entry.file.includes(createHash('sha256').update(small).digest('hex').slice(0,12)));
  assert.ok(Math.max(entry.width,entry.height)<=1024);assert.equal(entry.width/entry.height,entry.sourceWidth/entry.sourceHeight);assert.equal(small.length,entry.bytes);original+=source.length;preview+=small.length;
 }
 assert.ok(preview<original*.3,'First-screen textures must save at least 70% of their download size.');
});

test('foreground selections suspend queued detail until every request releases its hold',async()=>{
 const {textures,pending}=fixture();textures.resumeDelayMs=0;
 for(let i=0;i<4;i++)textures.load('ground.jpg');pending.slice().forEach(p=>p.ok(p.t));
 const releaseA=textures.hold(),releaseB=textures.hold();textures.start();assert.equal(pending.length,4);
 releaseA();releaseA();assert.equal(textures.holds,1);assert.equal(pending.length,4);
 releaseB();assert.equal(pending.length,6);
 const releaseC=textures.hold();pending[4].ok(pending[4].t);pending[5].ok(pending[5].t);await Promise.resolve();await Promise.resolve();assert.equal(pending.length,6);
 releaseC();assert.equal(pending.length,8);pending[6].ok(pending[6].t);pending[7].ok(pending[7].t);
});
