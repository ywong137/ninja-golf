import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
// Offline only: solve on the same native skin and local quaternions used by Three.js.
// The metrics describe surface contact. They do not replace visual pose review.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [hero,side,radiusText,output,profile='sword']=process.argv.slice(2);
if(process.argv.includes('--help')){console.log('Usage: node tools/solve-grip.mjs MODEL r|l RADIUS_METRES OUTPUT_JSON [sword|golf]');process.exit(0);}
const radius=Number(radiusText);
if(!hero||!['r','l'].includes(side)||!(radius>=.010&&radius<=.022)||!output||!['sword','golf'].includes(profile))throw Error('Use --help. Supply a native model, hand, outer handle radius, output path, and optional profile.');
const g=await loadNativeSkin(path.join(root,'public/models',hero+'.glb')),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const hand=bones['hand_'+side],rest={};const restHandInverse=hand.getWorldQuaternion(new T.Quaternion()).invert();
const neutralForearm=hand.getWorldPosition(new T.Vector3()).sub(bones['lowerarm_'+side].getWorldPosition(new T.Vector3())).normalize().applyQuaternion(restHandInverse);
const bindTip=hand.worldToLocal(bones['middle_03_'+side].getWorldPosition(new T.Vector3()));
for(const [name,bone]of Object.entries(bones))if(/^(thumb|index|middle|ring|pinky)_\d+_[rl]$/.test(name)&&name.endsWith('_'+side))rest[name]={local:bone.quaternion.clone(),inHand:restHandInverse.clone().multiply(bone.getWorldQuaternion(new T.Quaternion()))};
g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Address')).play();g.mixer.update(0);g.scene.updateMatrixWorld(true);
const center=g.scene.getObjectByName('PalmGrip_'+side).getWorldPosition(new T.Vector3()),axis=g.scene.getObjectByName('PalmShaft_'+side).getWorldPosition(new T.Vector3()).sub(center).normalize(),handAxis=axis.clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).invert());
const handInverse=hand.matrixWorld.clone().invert(),centerLocal=center.clone().applyMatrix4(handInverse),initialCenter=center.clone(),meshes=[],vertices={},palmVertices=[];
const fingers=['index','middle','ring','pinky','thumb'];const across=axis.clone();const distal=bones['middle_01_'+side].getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3()));distal.addScaledVector(across,-distal.dot(across)).normalize();const normal=new T.Vector3().crossVectors(across,distal).normalize();
const closedTip=hand.worldToLocal(bones['middle_03_'+side].getWorldPosition(new T.Vector3()));
if(closedTip.sub(bindTip).dot(normal.clone().transformDirection(handInverse))<0)normal.negate();
const normalSign=Math.sign(new T.Vector3().crossVectors(across,distal).dot(normal));
const centerOffset=[0,0];for(const finger of fingers)vertices[finger]=[];
g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;meshes.push(mesh);const{skinIndex,skinWeight,position}=mesh.geometry.attributes;
 for(let i=0;i<position.count;i++){
  const w={};let dominant='',weight=-1,palmWeight=0;
  for(let k=0;k<4;k++){const name=mesh.skeleton.bones[skinIndex.getComponent(i,k)].name,match=name.match(/^(thumb|index|middle|ring|pinky)_(\d+)_[rl]$/);if(!match||!name.endsWith('_'+side))continue;const amount=skinWeight.getComponent(i,k);w[match[1]]=(w[match[1]]||0)+amount;if(amount>weight){weight=amount;dominant=name;}}
  for(let k=0;k<4;k++)if(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name==='hand_'+side)palmWeight+=skinWeight.getComponent(i,k);
  const row=Object.entries(w).sort((a,b)=>b[1]-a[1])[0];if(palmWeight>.15)palmVertices.push({mesh,index:i});if(!row||row[1]<.45)continue;vertices[row[0]].push({mesh,index:i,segment:Number(dominant.split('_')[1])});
 }
});
const controls={};for(const finger of fingers)controls[finger]=[1,2,3].map(segment=>{
 const name=finger+'_'+String(segment).padStart(2,'0')+'_'+side,bone=bones[name],r=rest[name],closed=bone.quaternion.clone();
 let hinge=handAxis.clone().applyQuaternion(r.inHand.clone().invert());const child=bone.children.find(o=>o.isBone);if(child){const direction=child.position.clone().normalize();hinge.addScaledVector(direction,-hinge.dot(direction));}hinge.normalize();
 const delta=r.local.clone().invert().multiply(closed),sign=Math.sign(new T.Vector3(delta.x,delta.y,delta.z).dot(hinge)*delta.w)||1;hinge.multiplyScalar(sign);
 return{name,bone,rest:r.local,closed,hinge};
});
const thumbAxes=[axis,distal,normal].map(a=>a.clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).invert()).applyQuaternion(rest['thumb_01_'+side].inHand.clone().invert()));
// Keep the finger hinges anatomical. Only the held cylinder runs diagonally.
if(profile==='golf')axis.addScaledVector(distal,.18).normalize();
else{
 const forearm=neutralForearm.clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
 const angle=75*Math.PI/180;
 axis.addScaledVector(forearm,-axis.dot(forearm)).normalize().multiplyScalar(Math.sin(angle)).addScaledVector(forearm,Math.cos(angle));
}
distal.addScaledVector(axis,-distal.dot(axis)).normalize();normal.crossVectors(axis,distal).normalize().multiplyScalar(normalSign);
const indexAxial=bones['index_01_'+side].getWorldPosition(new T.Vector3()).sub(center).dot(axis),middleAxial=bones['middle_01_'+side].getWorldPosition(new T.Vector3()).sub(center).dot(axis);
const thumbAxial=T.MathUtils.lerp(indexAxial,middleAxial,.40);
const params=Object.fromEntries(fingers.map(f=>[f,f==='thumb'?[0,0,0,.45,.45]:[.65,1.1,.65]]));
function apply(finger){controls[finger].forEach((c,i)=>{
 if(finger==='thumb'){
  if(i===0){c.bone.quaternion.copy(c.closed);for(let j=0;j<3;j++)c.bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(thumbAxes[j],params[finger][j]));}
  else c.bone.quaternion.copy(c.rest).multiply(new T.Quaternion().setFromAxisAngle(c.hinge,params[finger][i+2]));
 }else c.bone.quaternion.copy(c.rest).multiply(new T.Quaternion().setFromAxisAngle(c.hinge,params[finger][i]));
 });g.scene.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();}
for(const f of fingers)apply(f);
const v=new T.Vector3();
function measure(finger){
 let penetration=0,maxDepth=0,inside=0;const near={1:[],2:[],3:[]};
 for(const row of vertices[finger]){
  row.mesh.getVertexPosition(row.index,v).applyMatrix4(row.mesh.matrixWorld).sub(center);const along=v.dot(axis);v.addScaledVector(axis,-along);const r=v.length(),d=Math.max(0,radius+.0003-r);penetration+=d*d;maxDepth=Math.max(maxDepth,radius-r);inside+=r<radius-.001?1:0;near[row.segment]?.push(r);
 }
 let contact=0;const closest={};for(const s of [1,2,3]){const values=near[s].sort((a,b)=>a-b);if(!values.length)continue;const r=values[Math.floor(values.length*.06)];closest[s]=r;contact+=(s===1?.5:1)*(r-radius-.0007)**2;}
 const chain=controls[finger].map(c=>c.bone.getWorldPosition(new T.Vector3()).sub(center));
 // A distal pad center adds the end of the chain beyond the last bone joint.
 const last=vertices[finger].filter(row=>row.segment===3),tip=new T.Vector3();
 for(const row of last)tip.add(row.mesh.getVertexPosition(row.index,new T.Vector3()).applyMatrix4(row.mesh.matrixWorld));tip.multiplyScalar(1/last.length).sub(center);
 const thumbGoal=finger==='thumb'?(tip.dot(axis)-(profile==='golf'?indexAxial+.012:thumbAxial))**2+(tip.dot(distal)+.005)**2+(tip.dot(normal)-(radius+.007))**2:0;
 chain.push(tip);
 for(const p of chain)p.addScaledVector(axis,-p.dot(axis)).normalize();
 let wrap=0;for(let i=1;i<chain.length;i++)wrap+=Math.atan2(new T.Vector3().crossVectors(chain[i-1],chain[i]).dot(axis),chain[i-1].dot(chain[i]));wrap=Math.abs(wrap);
 const coupling=finger==='thumb'?0:(params[finger][2]-.65*params[finger][1])**2*1e-5;
 const wrapError=finger==='thumb'?0:Math.max(0,2.65-wrap)**2*8e-5;
 const error=500*penetration/vertices[finger].length+contact+coupling+wrapError+thumbGoal*3;
 return{error,maxDepth,inside,closest,wrap};
}
function fit(f){
 for(const step of [.30,.15,.08,.04,.02,.01])for(let pass=0;pass<5;pass++){
  let changed=false;
  for(let j=0;j<params[f].length;j++){
   const old=params[f][j];let best=old,error=measure(f).error;
   for(const x of [old-step,old+step]){const lo=f==='thumb'&&j<3?-1.5:f==='thumb'?0:.15,hi=f==='thumb'&&j<3?1.5:[1.65,1.84,1.40][f==='thumb'?j-3:j];if(x<lo||x>hi)continue;params[f][j]=x;apply(f);const candidate=measure(f).error;if(candidate<error){error=candidate;best=x;}}
   params[f][j]=best;apply(f);changed||=best!==old;
  }
  if(!changed)break;
 }
}
function palmMeasure(){let penetration=0,min=Infinity,maxDepth=0;for(const row of palmVertices){row.mesh.getVertexPosition(row.index,v).applyMatrix4(row.mesh.matrixWorld).sub(center);v.addScaledVector(axis,-v.dot(axis));const r=v.length(),d=Math.max(0,radius+.0003-r);min=Math.min(min,r);maxDepth=Math.max(maxDepth,radius-r);penetration+=d*d;}return{error:1000*penetration/palmVertices.length+(min-radius-.0005)**2+(profile==='sword'?Math.max(0,maxDepth-.0015)**2*50:0),min,maxDepth};}
function total(){return fingers.reduce((sum,f)=>sum+measure(f).error,0)+palmMeasure().error;}
function move(){center.copy(initialCenter).addScaledVector(distal,centerOffset[0]).addScaledVector(normal,centerOffset[1]);}
centerOffset[0]=-.018;centerOffset[1]=radius+.001;move();
let seed=17;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
let bestThumb={error:Infinity};
for(let attempt=0;attempt<48;attempt++){
 params.thumb=[(random()-.5)*2.8,(random()-.5)*2.8,(random()-.5)*2.8,random()*1.1,random()*.9];apply('thumb');fit('thumb');const result=measure('thumb');if(result.error<bestThumb.error)bestThumb={...result,parameters:[...params.thumb]};
}
params.thumb=[...bestThumb.parameters];apply('thumb');
for(let round=0;round<25;round++){
 for(const f of fingers)fit(f);
 for(const step of [.01,.005,.002,.001])for(let pass=0;pass<4;pass++){
  let changed=false;for(let j=0;j<2;j++){const old=centerOffset[j];let best=old,error=total();for(const x of [old-step,old+step]){if(Math.abs(x)>.035)continue;centerOffset[j]=x;move();const e=total();if(e<error){error=e;best=x;}}centerOffset[j]=best;move();changed||=best!==old;}if(!changed)break;
 }
}
centerLocal.copy(center).applyMatrix4(handInverse);
const result={hero,side,profile,center:centerLocal.toArray(),axis:axis.clone().transformDirection(handInverse).toArray(),radius,parameters:params,rotations:Object.fromEntries(Object.values(controls).flat().map(c=>[c.name,c.bone.quaternion.toArray()])),measurements:Object.fromEntries([...fingers.map(f=>[f,measure(f)]),['palm',palmMeasure()]])};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({hero,side,profile,output,maxPenetrationMm:Math.max(...Object.values(result.measurements).map(m=>m.maxDepth))*1000}));
