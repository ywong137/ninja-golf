import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {bakeCandidate,parseGlb} from './bake-native-golf.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),writer=fileURLToPath(new URL('./bake-native-golf.mjs',import.meta.url)),dir=fs.mkdtempSync('/tmp/golf-bake-check-'),model=path.join(repo,'public/models/kaede.glb'),raw=fs.readFileSync(model),g=await loadNativeSkin(model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});const bind=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
function sample(name,time){for(const[n,p]of Object.entries(bind)){bones[n].position.copy(p.position);bones[n].quaternion.copy(p.quaternion);bones[n].scale.copy(p.scale);}const clip=g.animations.find(a=>a.name===name);for(const t of clip.tracks){const i=t.name.lastIndexOf('.'),b=g.scene.getObjectByName(t.name.slice(0,i));b[t.name.slice(i+1)].fromArray(t.createInterpolant().evaluate(time));}return{name,time,pose:Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray()}]))};}
const base={hero:'kaede',durations:{Golf_Swing:2.4},rows:[sample('Golf_Swing',2.4),sample('Golf_Swing',0),sample('Golf_Swing',.9)]};base.rows[2].pose.pelvis.position[0]+=.001;const duplicate=structuredClone(base.rows[2]);for(const p of Object.values(duplicate.pose))p.quaternion=p.quaternion.map(x=>-2*x);base.rows.push(duplicate);
fs.writeFileSync(dir+'/writer-fixture.json',JSON.stringify(base));const results=[];
function test(name,fn){fn();results.push({name,pass:true});}
const result=bakeCandidate({hero:'kaede',inputRaw:raw,poses:base});
test('only provided clip replaced; original geometry andother clips preserved',()=>{assert.equal(result.report.clips.length,1);assert.deepEqual(result.report.clips[0].times,[0,.9,2.4]);assert.equal(result.report.duplicateRows,1);assert.equal(result.report.geometrySha256.length,64);assert.equal(result.report.unchangedAnimations.length,parseGlb(raw).doc.animations.length-1);assert.equal(result.report.allGeometryUnchanged,true);});
const parsed=parseGlb(result.output),animation=parsed.doc.animations.find(a=>a.name==='Golf_Swing');
function values(accessor){const a=parsed.doc.accessors[accessor],v=parsed.doc.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type],out=[];for(let i=0;i<a.count*n;i++)out.push(parsed.bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));return out;}
test('all TRS tracks contain exactly three supplied LINEAR keys',()=>{assert.equal(animation.channels.length,Object.keys(bones).length*3);for(const s of animation.samplers){assert.equal(s.interpolation,'LINEAR');assert.deepEqual(values(s.input),[0,Math.fround(.9),Math.fround(2.4)]);assert.equal(parsed.doc.accessors[s.output].count,3);}});
test('quaternion normalization and hemisphere continuity',()=>{for(const c of animation.channels.filter(c=>c.target.path==='rotation')){const arr=values(animation.samplers[c.sampler].output);let old=null;for(let i=0;i<arr.length;i+=4){const q=arr.slice(i,i+4);assert.ok(Math.abs(Math.hypot(...q)-1)<1e-7);if(old)assert.ok(q.reduce((a,x,j)=>a+x*old[j],0)>=-1e-8);old=q;}}});
test('authored middle pelvis displacement survives writer',()=>{const id=parsed.doc.nodes.findIndex(n=>n.name==='pelvis'),c=animation.channels.find(c=>c.target.node===id&&c.target.path==='translation'),arr=values(animation.samplers[c.sampler].output);assert.equal(arr[3],Math.fround(base.rows[2].pose.pelvis.position[0]));});
test('target extras and all other document structures remain',()=>{assert.deepEqual(animation.extras,parseGlb(raw).doc.animations.find(a=>a.name==='Golf_Swing').extras);assert.deepEqual(parsed.doc.nodes,parseGlb(raw).doc.nodes);assert.deepEqual(parsed.doc.skins,parseGlb(raw).doc.skins);});
test('unknown GLB chunk retained byte-for-byte',()=>{const chunk=Buffer.alloc(12);chunk.writeUInt32LE(4,0);chunk.writeUInt32LE(0x12345678,4);chunk.writeUInt32LE(0xfedcba98,8);const fixture=Buffer.concat([raw,chunk]);fixture.writeUInt32LE(fixture.length,8);const r=bakeCandidate({hero:'kaede',inputRaw:fixture,poses:base});assert.deepEqual(r.output.subarray(-12),chunk);assert.equal(r.report.unknownChunksPreserved.length,1);});
function rejection(name,edit,pattern){test(name,()=>{const x=structuredClone(base);edit(x);assert.throws(()=>bakeCandidate({hero:'kaede',inputRaw:raw,poses:x}),pattern);});}
rejection('reject unnamed keys',x=>delete x.rows[0].name,/needs name/);
rejection('reject non-golf clip',x=>x.rows[0].name='Kaede_Cut_Diagonal',/needs name/);
rejection('reject missing duration',x=>delete x.durations,/explicit durations/);
rejection('reject mismatched endpoint',x=>x.durations.Golf_Swing=3,/final time/);
rejection('reject missing time0',x=>x.rows=x.rows.filter(r=>r.time!==0),/time0/);
rejection('reject conflicting duplicate',x=>x.rows[3].pose.pelvis.position[0]+=.001,/Conflicting duplicate/);
rejection('reject helper bones',x=>x.rows[0].pose.lowerarm_skin_base_r=x.rows[0].pose.lowerarm_r,/Unknown or helper/);
rejection('reject incomplete bone pose',x=>delete x.rows[0].pose.Head,/misses native bones/);
rejection('reject zero quaternion',x=>x.rows[0].pose.Head.quaternion=[0,0,0,0],/zero length/);
rejection('reject quaternion non-finite',x=>x.rows[0].pose.Head.quaternion[0]=NaN,/finite numbers/);
rejection('reject mismatched hero',x=>x.hero='ronin',/differs/);
rejection('reject ambiguous input aliases',x=>x.rows[0].pose['Bip01 REye']=x.rows[0].pose.Bip01_REye,/Duplicate aliases/);
rejection('reject colliding Float32 times',x=>{const r=structuredClone(x.rows[2]);r.time=.9000000001;x.rows.push(r);},/collide/);
test('multiple named clips only replace their explicit rows',()=>{const poses={durations:{Golf_Address:2,Golf_Putt:1.8},rows:[sample('Golf_Address',0),sample('Golf_Address',1),sample('Golf_Address',2),sample('Golf_Putt',0),sample('Golf_Putt',.9),sample('Golf_Putt',1.8)]},r=bakeCandidate({hero:'kaede',inputRaw:raw,poses});assert.equal(r.report.clips.length,2);assert.ok(r.report.unchangedAnimations.some(c=>c.name==='Golf_Swing'));});
const output=dir+'/writer-fixture.glb';
test('real CLI writes candidate and validation report',()=>{const p=spawnSync(process.execPath,[writer,'--hero','kaede','--poses',dir+'/writer-fixture.json','--output',output],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.ok(fs.readFileSync(output).equals(result.output));assert.equal(JSON.parse(fs.readFileSync(output+'.validation.json')).geometrySha256,result.report.geometrySha256);});
test('real CLI rejects production output before writing',()=>{const p=spawnSync(process.execPath,[writer,'--hero','kaede','--poses',dir+'/writer-fixture.json','--output',model],{encoding:'utf8'});assert.notEqual(p.status,0);assert.match(p.stderr,/under \/tmp/);assert.ok(fs.readFileSync(model).equals(raw));});
const reread=await loadNativeSkin(output);
test('Three.js reads the resulting animation and mesh',()=>{assert.equal(reread.animations.length,g.animations.length);assert.equal(reread.animations.find(a=>a.name==='Golf_Swing').tracks.length,Object.keys(bones).length*3);assert.ok(reread.animations.find(a=>a.name==='Golf_Swing').tracks.every(t=>t.times.length===3));});
test('all six native models support complete source-name poses',()=>{for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){const bytes=fs.readFileSync(path.join(repo,'public/models',hero+'.glb')),d=parseGlb(bytes).doc,joints=[...new Set(d.skins.flatMap(s=>s.joints))],pose=Object.fromEntries(joints.map(i=>[d.nodes[i].name,{position:d.nodes[i].translation??[0,0,0],quaternion:d.nodes[i].rotation??[0,0,0,1],scale:d.nodes[i].scale??[1,1,1]}])),input={hero,durations:{Golf_Address:.2},rows:[{name:'Golf_Address',time:0,pose},{name:'Golf_Address',time:.2,pose}]},r=bakeCandidate({hero,inputRaw:bytes,poses:input});assert.equal(r.report.allGeometryUnchanged,true);assert.equal(r.report.unchangedAnimations.length,d.animations.length-1);}});
const report={tests:results.length,passed:results.length,results,sourceModelUnchanged:fs.readFileSync(model).equals(raw),output,validationReport:output+'.validation.json'};fs.writeFileSync(dir+'/writer-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
