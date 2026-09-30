// Exact skin regression for the Vice President and Ace golf finishes. Run from the repository root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repo=path.resolve(process.env.NINJA_GOLF_REPO??process.cwd());
const load=relative=>import(pathToFileURL(path.join(repo,relative)));
const T=await load('node_modules/three/build/three.module.js');
const {loadNativeSkin}=await load('tests/native-skin-helper.mjs');
const {installForearmTwistHelpers}=await load('src/forearm-twist.js');
const {headSurfaceMetadata,measureTriangleHeadClearance}=await load('tools/blade-head-surface.mjs');
const limbs=['upperarm_r','upperarm_l','lowerarm_r','lowerarm_l'];
const canonical=name=>name.replace(/^lowerarm_skin_(?:base|mid)_([rl])$/,'lowerarm_$1');

function armTriangles(scene,headSurfaces) {
  const groups=Object.fromEntries(limbs.map(name=>[name,[]]));
  let meshId=0;
  scene.traverse(mesh=>{
    if (!mesh.isSkinnedMesh) return;
    const id=meshId++,attributes=mesh.geometry.attributes,index=mesh.geometry.index;
    const names=mesh.skeleton.bones.map(bone=>canonical(bone.name));
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

function timesFor(clip) {
  const start=1.8,end=2.4,keys=new Set([start,end,2.2]);
  assert.ok(clip.duration>=end-1e-6,'Golf_Swing ends before the finish window.');
  for (let i=108;i<=144;i++) keys.add(i/60);
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

export async function inspectGolfFinish(model) {
  const gltf=await loadNativeSkin(model),scene=gltf.scene;
  const clip=gltf.animations.find(item=>item.name==='Golf_Swing');
  assert.ok(clip,'Missing Golf_Swing.');
  const rest=[];
  scene.traverse(object=>rest.push({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}));
  const bound=clip.tracks.map(track=>{
    const separator=track.name.lastIndexOf('.'),name=track.name.slice(0,separator),property=track.name.slice(separator+1);
    const object=scene.getObjectByName(name);
    assert.ok(object&&['position','quaternion','scale'].includes(property),`Unsupported native track ${track.name}.`);
    return {object,property,interpolant:track.createInterpolant()};
  });
  const headBefore=headSurfaceMetadata(gltf);
  const originalGroups=armTriangles(scene,headBefore);
  const helper=installForearmTwistHelpers(scene);
  try {
    const head=headSurfaceMetadata(gltf),groups=armTriangles(scene,head);
    for (const limb of limbs) {
      const signature=rows=>rows.map(row=>[row.meshId,row.triangleIndex,...row.vertices]);
      assert.deepEqual(signature(groups[limb]),signature(originalGroups[limb]),
        `${limb}: helper installation changed the set of tested surface triangles.`);
    }
    const times=timesFor(clip),rows=[],firstFailures={};
    const statistics=Object.fromEntries(limbs.map(limb=>[limb,{
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
      helper.update();
      const cache=new Map();
      function posed(row) {
        if (!cache.has(row.mesh)) { row.mesh.skeleton.update(); cache.set(row.mesh,new Map()); }
        const points=cache.get(row.mesh);
        return row.vertices.map(vertex=>{
          if (!points.has(vertex)) points.set(vertex,row.mesh.getVertexPosition(vertex,new T.Vector3()).applyMatrix4(row.mesh.matrixWorld));
          return points.get(vertex);
        });
      }
      const current={time,limbs:{}};
      for (const limb of limbs) {
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
      window:[1.8,2.4],samples:times.length,times,
      sampling:'60 Hz, every native key, and adjacent native-key midpoints within the finish window.',
      classification:'Any triangle with a vertex carrying at least 50% weight from the named limb. Forearm helper weights pool with lowerarm.',
      head:'Actual skinned Head descendants, including jaw/eyes/hair. Rigid eyewear is outside this focused test.',
      clearanceCap:.005,helperVersion:helper.report.version,statistics,rows,
    };
  } finally {helper.dispose();}
}

for(const [model,label] of [['monk','Vice President'],['kaede','Ace']])test(`${label} golf finish keeps both upper arms and forearms outside the actual head surface`,async t=>{
  const directory=path.resolve(process.env.NINJA_GOLF_MODEL_DIR??path.join(repo,'public/models'));
  const report=await inspectGolfFinish(path.join(directory,model+'.glb'));
  if (process.env.NINJA_GOLF_HEAD_REPORT) fs.writeFileSync(model==='monk'?process.env.NINJA_GOLF_HEAD_REPORT:process.env.NINJA_GOLF_HEAD_REPORT.replace(/\.json$/,'.kaede.json'),JSON.stringify(report,null,2)+'\n');
  t.diagnostic(JSON.stringify({samples:report.samples,statistics:report.statistics}));
  const failures=Object.entries(report.statistics).filter(([,result])=>result.maxCrossings>0);
  assert.deepEqual(failures.map(([limb,result])=>({limb,time:result.firstFailure.time,worstTime:result.worstTime,
    maxCrossings:result.maxCrossings,vertices:result.firstFailure.vertices})),[],
    'An actual arm surface crosses the head or jaw during Golf_Swing. Keep the candidate rejected; inspect the reported limb and time.');
});
