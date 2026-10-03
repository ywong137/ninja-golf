// Shared actual-surface scanner for bounded windows within Golf_Swing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repo=path.resolve(process.env.NINJA_GOLF_REPO??process.cwd());
const load=relative=>import(pathToFileURL(path.join(repo,relative)));
const T=await load('node_modules/three/build/three.module.js');
const {loadNativeSkin}=await load('tests/native-skin-helper.mjs');
const {installLimbSkinning}=await load('src/forearm-twist.js');
const {golfShoulderSkinWeight}=await load('src/golf-shoulder-skin.js');
const {createGolfClub}=await load('src/golf-club.js');
const {captureGolfRestPose,calibrateGolfClub}=await load('src/golf-club-fit.js');
const {headSurfaceMetadata:headOnlyMetadata,measureTriangleHeadClearance}=await load('tools/blade-head-surface.mjs');
function headSurfaceMetadata(g,{includeNeck=false}={}){
 const head=headOnlyMetadata(g);if(!includeNeck)return head;
 g.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex:ids,skinWeight:weights}=mesh.geometry.attributes,names=mesh.skeleton.bones.map(b=>b.name),index=mesh.geometry.index;
  const neckWeight=Array.from({length:ids.count},(_,i)=>{let sum=0;for(let k=0;k<4;k++)if(/^neck_/.test(names[ids.getComponent(i,k)]))sum+=weights.getComponent(i,k);return sum;});
  let surface=head.find(row=>row.mesh===mesh);if(!surface){surface={mesh,triangles:[]};head.push(surface);}
  const existing=new Set(surface.triangles.map(t=>t.join(',')));
  for(let i=0;i<(index?index.count:ids.count);i+=3){const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(vertices.some(v=>neckWeight[v]>.5)&&!existing.has(vertices.join(',')))surface.triangles.push(vertices);}
 });
 return head.filter(s=>s.triangles.length);
}
const limbs=['upperarm_r','upperarm_l','lowerarm_r','lowerarm_l','hand_r','hand_l'];
const canonical=name=>name.replace(/^(lowerarm|upperarm)_skin_(?:base|mid)_([rl])$/,'$1_$2');

function armTriangles(scene,headSurfaces) {
  const groups=Object.fromEntries(limbs.map(name=>[name,[]]));
  const handBones={};
  for(const side of ['r','l'])scene.getObjectByName('hand_'+side).traverse(bone=>{if(bone.isBone)handBones[bone.name]='hand_'+side;});
  let meshId=0;
  scene.traverse(mesh=>{
    if (!mesh.isSkinnedMesh) return;
    const id=meshId++,attributes=mesh.geometry.attributes,index=mesh.geometry.index;
    const names=mesh.skeleton.bones.map(bone=>handBones[bone.name]??canonical(bone.name));
    const headVertices=new Set(headSurfaces.find(surface=>surface.mesh===mesh)?.triangles.flat()??[]);
    const weights=Object.fromEntries(limbs.map(limb=>[limb,Array.from({length:attributes.position.count},(_,vertex)=>{
      let sum=0;
      for (let slot=0;slot<4;slot++) {
        if (names[attributes.skinIndex.getComponent(vertex,slot)]===limb) sum+=attributes.skinWeight.getComponent(vertex,slot);
      }
      return sum;
    })]));
    for (let offset=0;offset<(index?.count??attributes.position.count);offset+=3) {
      const vertices=[0,1,2].map(k=>index?index.getX(offset+k):offset+k);
      for (const limb of limbs) {
        // Include the entire limb and its mixed boundary triangles. Do not cut
        // the upper arm down to a central capsule or omit helper-weighted skin.
        if (!vertices.some(vertex=>weights[limb][vertex]>=.5)) continue;
        assert.ok(!vertices.some(vertex=>headVertices.has(vertex)),
          `${limb}: arm and head share a skin vertex. Review their classification before excluding a seam.`);
        groups[limb].push({mesh,meshId:id,vertices,triangleIndex:offset/3});
      }
    }
  });
  for (const limb of limbs) assert.ok(groups[limb].length>0,`Missing actual ${limb} triangles.`);
  return groups;
}

function timesFor(clip,start,end) {
  const keys=new Set([start,end]);
  if(start<=2.2&&end>=2.2)keys.add(2.2);
  assert.ok(clip.duration>=end-1e-6,'Golf_Swing ends before the inspection window.');
  for (let i=Math.ceil(start*60);i<=Math.floor(end*60);i++) keys.add(i/60);
  // Every authored key and its adjacent midpoint matters. Do not rely on a
  // sparse set of named golf phases or AnimationMixer's cached property state.
  for (const track of clip.tracks) {
    for (let i=0;i<track.times.length;i++) {
      const time=track.times[i];
      if (time>=start-1e-7&&time<=end+1e-7) keys.add(Math.max(start,Math.min(end,time)));
      if (i+1<track.times.length) {
        const midpoint=(time+track.times[i+1])/2;
        if (midpoint>=start&&midpoint<=end) keys.add(midpoint);
      }
    }
  }
  return [...keys].sort((a,b)=>a-b).filter((time,index,array)=>!index||time-array[index-1]>1e-9);
}

export async function inspectGolfHeadClearance(model,{start=1.6,end=2.4,includeNeck=false}={}) {
  assert.ok(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start,'Supply a positive golf inspection window.');
  const gltf=await loadNativeSkin(model),scene=gltf.scene;
  const clip=gltf.animations.find(item=>item.name==='Golf_Swing');
  assert.ok(clip,'Missing Golf_Swing.');
  const hero=path.basename(model,'.glb'),profile=JSON.parse(fs.readFileSync(path.join(repo,'src/grip-data.json')))[hero].golf.r;
  const hand=scene.getObjectByName('hand_r'),grip={center:new T.Vector3().fromArray(profile.center),frame:new T.Quaternion().fromArray(profile.frame)},club=createGolfClub();
  const fit=calibrateGolfClub({root:scene,hand,clip,restPose:captureGolfRestPose(scene),grip,club,contactTime:1.4});
  club.shaft.scale.y=fit.shaftLengthNative-.14;club.shaft.position.y=.14+club.shaft.scale.y*.5;
  const rest=[];
  scene.traverse(object=>rest.push({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}));
  const bound=clip.tracks.map(track=>{
    const separator=track.name.lastIndexOf('.'),name=track.name.slice(0,separator),property=track.name.slice(separator+1);
    const object=scene.getObjectByName(name);
    assert.ok(object&&['position','quaternion','scale'].includes(property),`Unsupported native track ${track.name}.`);
    return {object,property,interpolant:track.createInterpolant()};
  });
  const headBefore=headSurfaceMetadata(gltf,{includeNeck});
  const originalGroups=armTriangles(scene,headBefore);
  const helper=installLimbSkinning(scene,{upperArms:hero==='kaede'?['r']:[],overflow:gltf.userData?.wardrobeDefault?.replacedBody?'nearest':'reject'});
  try {
    const head=headSurfaceMetadata(gltf,{includeNeck}),groups=armTriangles(scene,head);
    for (const limb of limbs) {
      const signature=rows=>rows.map(row=>[row.meshId,row.triangleIndex,...row.vertices]);
      assert.deepEqual(signature(groups[limb]),signature(originalGroups[limb]),
        `${limb}: helper installation changed the set of tested surface triangles.`);
    }
    for(const [name,mesh] of [['clubShaft',club.shaft],['clubGrip',club.root.getObjectByName('Golf club grip')]]){
      const index=mesh.geometry.index,position=mesh.geometry.attributes.position;
      groups[name]=Array.from({length:(index?.count??position.count)/3},(_,triangleIndex)=>({mesh,meshId:name,triangleIndex,vertices:[0,1,2].map(k=>index?index.getX(triangleIndex*3+k):triangleIndex*3+k)}));
    }
    const parts=Object.keys(groups);
    const times=timesFor(clip,start,end),rows=[],firstFailures={};
    const statistics=Object.fromEntries(parts.map(limb=>[limb,{
      triangles:groups[limb].length,minimumClearance:.005,maxCrossings:0,worstTime:null,firstFailure:null,
    }]));
    for (const time of times) {
      for (const item of rest) {
        item.object.position.copy(item.position);
        item.object.quaternion.copy(item.quaternion);
        item.object.scale.copy(item.scale);
      }
      for (const item of bound) item.object[item.property].fromArray(item.interpolant.evaluate(time));
      scene.updateMatrixWorld(true);
      helper.update({upperArmWeight:golfShoulderSkinWeight(time)});
      club.root.position.copy(hand.localToWorld(grip.center.clone()));
      club.root.quaternion.copy(hand.getWorldQuaternion(new T.Quaternion()).multiply(grip.frame));club.root.updateMatrixWorld(true);
      const cache=new Map();
      function posed(row) {
        if (!cache.has(row.mesh)) { row.mesh.skeleton?.update(); cache.set(row.mesh,new Map()); }
        const points=cache.get(row.mesh);
        return row.vertices.map(vertex=>{
          if (!points.has(vertex)) points.set(vertex,row.mesh.getVertexPosition(vertex,new T.Vector3()).applyMatrix4(row.mesh.matrixWorld));
          return points.get(vertex);
        });
      }
      const current={time,limbs:{}};
      for (const limb of parts) {
        const triangles=groups[limb].map(posed);
        const result=measureTriangleHeadClearance(head,{[limb]:triangles},{distanceCap:.005});
        current.limbs[limb]=result;
        const stats=statistics[limb];
        stats.minimumClearance=Math.min(stats.minimumClearance,result.minimumClearance);
        if (result.crossings>stats.maxCrossings) {stats.maxCrossings=result.crossings;stats.worstTime=time;}
        if (result.crossings&&!firstFailures[limb]) {
          // Preserve a concrete triangle witness only on the first failure.
          // The existing scanner performs the exact narrow-phase query.
          for (let index=0;index<triangles.length;index++) {
            const witness=measureTriangleHeadClearance(head,{[limb]:[triangles[index]]},{distanceCap:.000001});
            if (!witness.crossings) continue;
            const source=groups[limb][index];
            firstFailures[limb]={time,limb,mesh:source.mesh.name,meshId:source.meshId,
              triangleIndex:source.triangleIndex,vertices:source.vertices,
              posedTriangle:triangles[index].map(point=>point.toArray()),headMesh:witness.closest?.headMesh,
              pairs:result.crossings};
            stats.firstFailure=firstFailures[limb];
            break;
          }
          assert.ok(firstFailures[limb],`Failed to recover ${limb} collision witness at ${time}.`);
        }
      }
      rows.push(current);
    }
    return {
      model,pathSha256:createHash('sha256').update(fs.readFileSync(model)).digest('hex'),clip:clip.name,
      window:[start,end],samples:times.length,times,
      sampling:'60 Hz, every native key, and adjacent native-key midpoints within the selected window.',
      classification:'Any triangle with a vertex carrying at least 50% weight from the named limb. Limb helper weights pool with their anatomical arm segment; fingers pool with hand. Shaft and grip use their complete rendered meshes.',
      head:'Actual skinned Head descendants, including jaw/eyes/hair'+(includeNeck?' and neck-weighted skin':'')+'. Rigid eyewear is outside this focused test.',
      clearanceCap:.005,helperVersion:helper.report.version,statistics,rows,
    };
  } finally {helper.dispose();}
}


export const inspectGolfFinish=model=>inspectGolfHeadClearance(model);
