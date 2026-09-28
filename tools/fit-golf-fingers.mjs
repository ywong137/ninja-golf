#!/usr/bin/env node
// Candidate-only finger fit. Keep the shaft frame and palm center unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{hero:{type:'string'},side:{type:'string'},grips:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/fit-golf-fingers.mjs --hero MODEL --side r|l --grips GRIPS.json --output /tmp/CANDIDATE.json\nFits four fingers with anatomical hinges and limited knuckle splay. Keeps the supplied center, shaft axis, frame, and thumb. Writes one candidate hand profile.');process.exit(0);}
if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(values.hero)||!['r','l'].includes(values.side)||!values.grips||!values.output)throw Error('Supply all options. See --help.');
const outputPath=path.resolve(values.output),publicPath=new URL('../public/',import.meta.url).pathname;
if(outputPath.startsWith(publicPath)||outputPath.startsWith(new URL('../src/',import.meta.url).pathname)||outputPath===path.resolve(values.grips))throw Error('Write a separate candidate outside public/.');
const profile=JSON.parse(fs.readFileSync(values.grips))[values.hero]?.golf?.[values.side],side=values.side;
if(!profile)throw Error('The grip file lacks '+values.hero+'.golf.'+side+'.');
for(const name of ['center','axis'])if(!Array.isArray(profile[name])||profile[name].length!==3||!profile[name].every(Number.isFinite))throw Error(name+' must contain three finite numbers.');
if(Math.abs(Math.hypot(...profile.axis)-1)>.001)throw Error('The shaft axis must be normalized.');
if(!(profile.radius>.003&&profile.radius<.04))throw Error('The handle radius must be between 3 and 40 mm.');
if(!profile.rotations||typeof profile.rotations!=='object')throw Error('Supply the fitted finger rotations.');
for(const [name,q]of Object.entries(profile.rotations))if(!/^(thumb|index|middle|ring|pinky)_0[123]_[rl]$/.test(name)||!name.endsWith('_'+side)||!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>.001)throw Error('Invalid finger rotation: '+name);
const g=await loadNativeSkin(new URL('../public/models/'+values.hero+'.glb',import.meta.url)),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const hand=bones['hand_'+side],handInverse=hand.matrixWorld.clone().invert(),handRotation=hand.getWorldQuaternion(new T.Quaternion()).normalize(),inverseRotation=handRotation.clone().invert();
const point=bone=>bone.getWorldPosition(new T.Vector3()).applyMatrix4(handInverse),long=point(bones['middle_01_'+side]).normalize(),across=point(bones['index_01_'+side]).sub(point(bones['pinky_01_'+side]));across.addScaledVector(long,-across.dot(long)).normalize();
const center=new T.Vector3().fromArray(profile.center),axis=new T.Vector3().fromArray(profile.axis).normalize(),normal=across.clone().cross(long).normalize();if(normal.dot(center)<0)normal.negate();
const fingers=['index','middle','ring','pinky'],rows=Object.fromEntries(fingers.map(f=>[f,[]])),meshes=[];
g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const a=mesh.geometry.attributes;
 for(let i=0;i<a.position.count;i++){
  const weights={};let dominant='',highest=0;
  for(let k=0;k<4;k++){const name=mesh.skeleton.bones[a.skinIndex.getComponent(i,k)].name,m=/^(index|middle|ring|pinky)_(\d+)_(r|l)$/.exec(name);if(!m||m[3]!==side)continue;const weight=a.skinWeight.getComponent(i,k);weights[m[1]]=(weights[m[1]]??0)+weight;if(weight>highest){highest=weight;dominant=name;}}
  const choice=Object.entries(weights).sort((a,b)=>b[1]-a[1])[0];if(choice?.[1]>.45)rows[choice[0]].push({mesh,index:i,segment:Number(dominant.split('_')[1])});
 }
});
for(const finger of fingers)for(const segment of [1,2,3])if(!rows[finger].some(row=>row.segment===segment))throw Error('Missing '+finger+' segment '+segment+' skin weights.');
const controls={};for(const finger of fingers){
 const chain=[1,2,3].map(i=>bones[`${finger}_0${i}_${side}`]);
 controls[finger]=chain.map((bone,i)=>{
  const inHand=inverseRotation.clone().multiply(bone.getWorldQuaternion(new T.Quaternion()).normalize()),p=point(bone);
  // Distal bones lack children. Continue the preceding anatomical segment.
  const direction=(i<2?point(chain[i+1]).sub(p):p.clone().sub(point(chain[i-1]))).normalize();
  return{bone,rest:bone.quaternion.clone(),hinge:direction.clone().cross(normal).normalize().applyQuaternion(inHand.clone().invert()),splay:normal.clone().applyQuaternion(inHand.clone().invert())};
 });
}
const params=Object.fromEntries(fingers.map(f=>[f,[1,1,.65,0]]));
function apply(f){controls[f].forEach((c,i)=>{c.bone.quaternion.copy(c.rest);if(i===0)c.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(c.splay,params[f][3]));c.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(c.hinge,params[f][i]));});hand.updateWorldMatrix(false,true);for(const m of meshes)m.skeleton.update();}
for(const [name,q]of Object.entries(profile.rotations))bones[name].quaternion.fromArray(q);
for(const f of fingers)apply(f);
const v=new T.Vector3(),radius=profile.radius;
function measure(f){
 const near={1:[],2:[],3:[]};let penetration=0,maxDepth=0,tip=new T.Vector3(),tipCount=0;
 for(const row of rows[f]){row.mesh.getVertexPosition(row.index,v).applyMatrix4(row.mesh.matrixWorld).applyMatrix4(handInverse);if(row.segment===3){tip.add(v);tipCount++;}v.sub(center);v.addScaledVector(axis,-v.dot(axis));const r=v.length();near[row.segment].push(r);const depth=Math.max(0,radius-r);penetration+=depth*depth;maxDepth=Math.max(maxDepth,depth);}
 tip.multiplyScalar(1/tipCount);let contact=0;const closest={};
 for(const k of [1,2,3]){near[k].sort((a,b)=>a-b);const r=near[k][Math.floor(near[k].length*.08)];closest[k]=r-radius;contact+=(k===1?.25:2)*(r-radius-.0008)**2;}
 const chain=[...controls[f].map(c=>point(c.bone)),tip].map(p=>{p.sub(center);return p.addScaledVector(axis,-p.dot(axis)).normalize();});
 let winding=0;for(let i=1;i<chain.length;i++)winding+=Math.atan2(axis.dot(chain[i-1].clone().cross(chain[i])),chain[i-1].dot(chain[i]));const wrap=Math.abs(winding);
 const [mcp,pip,dip,splay]=params[f],coupling=(dip-.65*pip)**2+Math.max(0,.65*mcp-pip)**2;
 const error=500*penetration/rows[f].length+500*Math.max(0,maxDepth-.001)**2+contact+.0015*Math.max(0,2.65-wrap)**2+.00015*coupling+100*Math.max(0,.55*mcp-pip)**2+100*Math.max(0,.45*pip-dip)**2+100*Math.max(0,dip-.85*pip)**2+.00003*splay*splay;
 return{error,maxDepth,closest,wrap};
}
const limits=[[0,1.65],[.35,1.85],[.15,1.30],[-.35,.35]];
function fit(f){for(const step of [.24,.12,.06,.03,.012,.005])for(let pass=0;pass<7;pass++){let changed=false;for(let j=0;j<4;j++){const old=params[f][j];let best=old,error=measure(f).error;for(const x of [old-step,old+step]){if(x<limits[j][0]||x>limits[j][1])continue;params[f][j]=x;apply(f);const score=measure(f).error;if(score<error){error=score;best=x;}}params[f][j]=best;apply(f);changed||=best!==old;}if(!changed)break;}}
const measurements={};
for(const f of fingers){let best=null;for(const start of [[.05,1.3,.85,0],[.2,1.6,1.1,.2],[.2,1.6,1.1,-.2],[.65,1.1,.65,0],[1.2,1.3,.8,0],[1.4,.9,.6,.25],[1.4,.9,.6,-.25],[.7,1.65,1,.2],[.7,1.65,1,-.2]]){params[f]=[...start];apply(f);fit(f);const metric=measure(f);if(!best||metric.error<best.error)best={...metric,parameters:[...params[f]]};}params[f]=best.parameters;apply(f);measurements[f]=measure(f);}
const output=structuredClone(profile);delete output.parameters;delete output.measurements;for(const f of fingers)for(const c of controls[f])output.rotations[c.bone.name]=c.bone.quaternion.toArray();output.fingerClosureFit={method:'anatomical-four-finger-hinges',parameters:params,measurements};fs.writeFileSync(values.output,JSON.stringify(output,null,2));console.log(JSON.stringify({hero:values.hero,side,measurements,parameters:params}));
