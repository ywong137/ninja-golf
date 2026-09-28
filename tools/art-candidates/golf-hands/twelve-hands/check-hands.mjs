#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from '../../../../tests/native-skin-helper.mjs';
import {measureTriangleHeadClearance} from '../../../blade-head-surface.mjs';
const {values}=parseArgs({options:{output:{type:'string'},rate:{type:'string',default:'120'},'bind-only':{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/art-candidates/golf-hands/twelve-hands/check-hands.mjs --output /tmp/CHECK.json [--rate 120] [--bind-only]\nChecks actual posed skin against the 12 mm shaft and separate digit surfaces. Mixed proximal web folds remain a separate documented limit.');process.exit(0);}
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..'),rate=Number(values.rate),posed=!values['bind-only'],output=values.output&&path.resolve(values.output),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
if(!Number.isInteger(rate)||rate<1||rate>480)throw Error('--rate must be an integer from 1 through 480.');
if(!output||path.extname(output)!=='.json'||output.startsWith(root+path.sep))throw Error('Supply a .json output outside the project, such as /tmp/CHECK.json.');
const report={posed,rate:posed?rate:0,scope:'Every triangle vertex must have more than 50% weight on the named digit. Mixed proximal webs are reported separately in web-fold-depth.json.',hands:{}};

for(const hero of ['ronin','kaede','shinobi','monk','ayame','sora']){
 const g=await loadNativeSkin(path.join(root,'public/models/'+hero+'.glb'));
 for(const side of ['r','l']){
  const file=dir+'/'+hero+'-'+side+'.fit.json';if(!fs.existsSync(file))throw Error('Missing candidate: '+file);
  const entry=manifest.hands.find(h=>h.hero===hero&&h.side===side),profile=JSON.parse(fs.readFileSync(file)),source=JSON.parse(fs.readFileSync(path.join(dir,entry.beforeAdjacent))),changedFingers=entry.adjacentRepair?.active??[];
  for(const key of ['center','axis','radius','frame'])assert.deepEqual(profile[key],source[key],hero+' '+side+': shaft field changed: '+key);
  for(const [name,q]of Object.entries(source.rotations))if(!changedFingers.some(f=>name.startsWith(f+'_')))assert.deepEqual(profile.rotations[name],q,hero+' '+side+': unrelated rotation changed: '+name);
  const hand=g.scene.getObjectByName('hand_'+side),axis=new T.Vector3().fromArray(profile.axis),center=new T.Vector3().fromArray(profile.center),u=new T.Vector3(1,0,0).addScaledVector(axis,-axis.x).normalize(),v=axis.clone().cross(u),surfaces=Object.fromEntries(['palm','thumb','index','middle','ring','pinky'].map(n=>[n,[]])),all=[];
  g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes,idx=mesh.geometry.index,groups=Array.from({length:a.position.count},(_,i)=>{const weights={};for(let k=0;k<4;k++){const n=mesh.skeleton.bones[a.skinIndex.getComponent(i,k)].name,w=a.skinWeight.getComponent(i,k);if(!n.endsWith('_'+side)||! /^(hand|thumb|index|middle|ring|pinky)_/.test(n))continue;const kind=n.startsWith('hand_')?'palm':n.split('_')[0];weights[kind]=(weights[kind]??0)+w;}return weights;}),triangles=[],byGroup=Object.fromEntries(Object.keys(surfaces).map(n=>[n,[]]));for(let i=0;i<(idx?idx.count:a.position.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);if(ids.every(id=>Object.values(groups[id]).reduce((a,b)=>a+b,0)>.5))triangles.push(ids);for(const group of Object.keys(surfaces))if(ids.every(id=>(groups[id][group]??0)>.5))byGroup[group].push(ids);}if(triangles.length)all.push({mesh,triangles,groups});for(const[group,triangles]of Object.entries(byGroup))if(triangles.length)surfaces[group].push({mesh,triangles});});
  for(const [group,entries]of Object.entries(surfaces))assert.ok(entries.length,hero+' '+side+': no '+group+' surface.');
  const row={samples:0,maxTriangleDepth:0,worstDepth:null,maxGroupTriangleDepth:{},minimumThumbFingerClearance:.03,crossings:{}};
  const samples=posed?['Golf_Address','Golf_Swing']:['bind'];
  for(const name of samples){g.mixer.stopAllAction();let a=null,duration=0;if(name!=='bind'){const clip=g.animations.find(c=>c.name===name);if(!clip)throw Error(hero+': missing '+name);a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();a.clampWhenFinished=true;duration=clip.duration;}const times=name==='Golf_Swing'?Array.from({length:Math.ceil(duration*rate)+1},(_,i)=>Math.min(i/rate,duration)):[0];
   for(const time of times){if(a){a.time=time;g.mixer.update(0);}for(const[n,q]of Object.entries(profile.rotations))g.scene.getObjectByName(n).quaternion.fromArray(q);g.scene.updateMatrixWorld(true);const inverse=hand.matrixWorld.clone().invert(),cache=new Map();
    const vertices=mesh=>{if(cache.has(mesh))return cache.get(mesh);mesh.skeleton.update();const vs=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));cache.set(mesh,vs);return vs;};
    const query={};for(const[group,entries]of Object.entries(surfaces))query[group]=entries.flatMap(({mesh,triangles})=>{const vs=vertices(mesh);return triangles.map(ids=>ids.map(id=>vs[id]));});
    const fingerSurfaces=['index','middle','ring','pinky'].flatMap(n=>surfaces[n]);const thumb=measureTriangleHeadClearance(fingerSurfaces,{thumb:query.thumb},{distanceCap:.03});row.minimumThumbFingerClearance=Math.min(row.minimumThumbFingerClearance,thumb.minimumClearance);row.crossings.thumbFinger=(row.crossings.thumbFinger??0)+thumb.crossings;
    const fingers=['index','middle','ring','pinky'];for(let i=0;i<fingers.length;i++)for(let j=i+1;j<fingers.length;j++){const hit=measureTriangleHeadClearance(surfaces[fingers[i]],{[fingers[j]]:query[fingers[j]]},{distanceCap:.005}),key=fingers[i]+'_'+fingers[j];row.crossings[key]=(row.crossings[key]??0)+hit.crossings;}
    const project=p=>{p=p.clone().applyMatrix4(inverse).sub(center);return new T.Vector2(p.dot(u),p.dot(v));},area=(a,b)=>a.x*b.y-a.y*b.x,edge=(a,b)=>{const d=b.clone().sub(a),den=d.lengthSq();if(den<1e-20)return a.length();return a.clone().addScaledVector(d,T.MathUtils.clamp(-a.dot(d)/den,0,1)).length();};
    const depthOf=points=>{const tri=points.map(project),signs=tri.map((p,i)=>area(tri[(i+1)%3].clone().sub(p),p.clone().negate())),inside=signs.every(x=>x>=0)||signs.every(x=>x<=0),r=inside?0:Math.min(...tri.map((p,i)=>edge(p,tri[(i+1)%3])));return Math.max(0,profile.radius-r);};
    for(const[group,triangles]of Object.entries(query))for(const tri of triangles)row.maxGroupTriangleDepth[group]=Math.max(row.maxGroupTriangleDepth[group]??0,depthOf(tri));
    for(const{mesh,triangles}of all){const vs=vertices(mesh);for(const ids of triangles){const depth=depthOf(ids.map(id=>vs[id]));if(depth>row.maxTriangleDepth){row.maxTriangleDepth=depth;row.worstDepth={clip:name,time,mesh:mesh.name,vertices:ids};}}}
    row.samples++;
   }
  }
  assert.equal(Object.values(row.crossings).reduce((sum,count)=>sum+count,0),0,hero+' '+side+': separate digit surfaces intersect.');
  assert.ok(row.maxTriangleDepth<=.0015,hero+' '+side+': hand penetrates shaft by more than 1.5 mm.');
  report.hands[hero+'_'+side]=row;console.log(hero,side,row.samples,'poses; shaft depth',+(row.maxTriangleDepth*1000).toFixed(3),'mm; zero separate digit crossings');
 }
}
fs.writeFileSync(output,JSON.stringify(report,null,2));
