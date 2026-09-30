import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {measureTriangleHeadClearance} from '../tools/blade-head-surface.mjs';

// These checks use the deformed skin. A finger bone near the shaft is not contact.
test('Ace golf grasp keeps the complete hands separate and all fingers on the finite handle',async t=>{
  const model=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,'kaede.glb'):new URL('../public/models/kaede.glb',import.meta.url);
  const profiles=JSON.parse(fs.readFileSync(process.env.NINJA_GOLF_PROFILE_FILE??new URL('../src/grip-data.json',import.meta.url))).kaede.golf;
  const g=await loadNativeSkin(model),bones={},groups=['palm','thumb','index','middle','ring','pinky'];
  const hands=Object.fromEntries(['r','l'].map(side=>[side,{all:[],surfaces:Object.fromEntries(groups.map(f=>[f,[]])),vertices:Object.fromEntries(groups.map(f=>[f,[]]))}]));
  g.scene.traverse(mesh=>{
    if(mesh.isBone)bones[mesh.name]=mesh;
    if(!mesh.isSkinnedMesh)return;
    const a=mesh.geometry.attributes,index=mesh.geometry.index;
    for(const side of ['r','l']){
      const hand=hands[side],weights=Array.from({length:a.position.count},(_,i)=>{
        const row={};for(let k=0;k<4;k++){
          const name=mesh.skeleton.bones[a.skinIndex.getComponent(i,k)].name;
          if(!name.endsWith('_'+side)||!/^(hand|thumb|index|middle|ring|pinky)_/.test(name))continue;
          const group=name.startsWith('hand_')?'palm':name.split('_')[0];row[group]=(row[group]??0)+a.skinWeight.getComponent(i,k);
        }
        for(const group of groups)if((row[group]??0)>.5)hand.vertices[group].push({mesh,index:i});
        return row;
      });
      const all=[],byGroup=Object.fromEntries(groups.map(f=>[f,[]]));
      for(let i=0;i<(index?.count??a.position.count);i+=3){
        const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
        if(ids.every(id=>Object.values(weights[id]).reduce((sum,w)=>sum+w,0)>.5))all.push(ids);
        for(const f of groups)if(ids.every(id=>(weights[id][f]??0)>.5))byGroup[f].push(ids);
      }
      if(all.length)hand.all.push({mesh,triangles:all});
      for(const [f,triangles]of Object.entries(byGroup))if(triangles.length)hand.surfaces[f].push({mesh,triangles});
    }
  });
  const stats={samples:0,maximumDepth:0,maximumFingerGap:0,minimumHandClearance:.01};
  const clipY=(points,limit,sign)=>{
    const out=[];for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=sign*(a.y-limit),db=sign*(b.y-limit);
      if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(a.clone().lerp(b,da/(da-db)));
    }return out;
  };
  const projectedDepth=(points,radius)=>{
    points=clipY(clipY(points,-.06,1),.20,-1);if(points.length<3)return 0;
    const p=points.map(v=>new T.Vector2(v.x,v.z)),cross=(a,b)=>a.x*b.y-a.y*b.x;
    const signs=p.map((v,i)=>cross(p[(i+1)%p.length].clone().sub(v),v.clone().negate()));
    if(signs.every(x=>x>=0)||signs.every(x=>x<=0))return radius;
    let distance=Infinity;for(let i=0;i<p.length;i++){const a=p[i],d=p[(i+1)%p.length].clone().sub(a);distance=Math.min(distance,a.clone().addScaledVector(d,T.MathUtils.clamp(-a.dot(d)/Math.max(1e-20,d.lengthSq()),0,1)).length());}
    return Math.max(0,radius-distance);
  };
  for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
    g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
    for(let i=0;i<=Math.ceil(clip.duration*30);i++){
      const time=Math.min(i/30,clip.duration);action.time=time;g.mixer.update(0);
      for(const side of ['r','l'])for(const [n,q]of Object.entries(profiles[side].rotations))bones[n].quaternion.fromArray(q);
      g.scene.updateMatrixWorld(true);const cache=new Map();
      const vertices=mesh=>{if(!cache.has(mesh)){mesh.skeleton.update();cache.set(mesh,Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));}return cache.get(mesh);};
      const triangles=entries=>entries.flatMap(({mesh,triangles})=>triangles.map(ids=>ids.map(i=>vertices(mesh)[i])));
      const pair=measureTriangleHeadClearance(hands.r.all,{left:triangles(hands.l.all)},{distanceCap:.01});
      assert.equal(pair.crossings,0,`${name}/${time}: hands intersect`);stats.minimumHandClearance=Math.min(stats.minimumHandClearance,pair.minimumClearance);
      for(const side of ['r','l']){
        const hand=hands[side],profile=profiles[side];
        const grip=new T.Matrix4().compose(new T.Vector3().fromArray(profile.center),new T.Quaternion().fromArray(profile.frame),new T.Vector3(1,1,1));
        const inverse=bones['hand_'+side].matrixWorld.clone().multiply(grip).invert();
        const local=p=>{const v=p.clone().applyMatrix4(inverse);if(side==='l')v.y-=profiles.gripSpacing;return v;};
        for(const tri of triangles(hand.all))stats.maximumDepth=Math.max(stats.maximumDepth,projectedDepth(tri.map(local),profile.radius));
        for(const f of groups.filter(f=>f!=='palm')){
          const gap=Math.min(...hand.vertices[f].map(({mesh,index})=>{const v=local(vertices(mesh)[index]),radial=Math.hypot(v.x,v.z)-profile.radius,axial=Math.max(-.06-v.y,v.y-.20);return Math.hypot(Math.max(radial,0),Math.max(axial,0));}));
          stats.maximumFingerGap=Math.max(stats.maximumFingerGap,gap);
          assert.ok(gap<.003,`${name}/${time}/${side}/${f}: finger is off the handle`);
        }
        // Finger surfaces are almost rigid; sample their mutual clearance at 6 Hz.
        if(i%5===0){const digits=groups.filter(f=>f!=='palm');for(let a=0;a<digits.length;a++)for(let b=a+1;b<digits.length;b++){
          const hit=measureTriangleHeadClearance(hand.surfaces[digits[a]],{other:triangles(hand.surfaces[digits[b]])},{distanceCap:.001});
          assert.equal(hit.crossings,0,`${name}/${time}/${side}: ${digits[a]} intersects ${digits[b]}`);
        }}
      }
      stats.samples++;
    }
  }
  assert.ok(stats.maximumDepth<=.0015,'The hand penetrates the finite handle by more than 1.5 mm.');
  t.diagnostic(JSON.stringify(stats));
});
