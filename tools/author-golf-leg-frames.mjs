#!/usr/bin/env node
// Candidate-only correction of native golf leg frames.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {patchAnimationRotations} from './patch-animation-rotations.mjs';
const sources={
 "ronin": "2de32bb3b59e6fc488ea3de56c68b4278b8eb1f1574936704da11e1f0c035225",
 "shinobi": "c18f2e47954d353aabb8ee5d3b8a1d0cb7b20cd7947575c8c15efaa48fab0aba",
 "monk": "13d4ecdd456ba8be17f7275af039f2716b17885596f33d9d57d49e46ad80e871",
 "kaede": "c65d89a3152fd36d72d3c46ae1df1f23f496b681a473894c71ccf6c784e63ee0",
 "ayame": "439dc03b269f72c0e50aac093629c3ab99ac07e3cbdd62328477e588faf1f551",
 "sora": "5ebeb02050d4923f2a6b21495776a8c8c41eeb191a03a70d0dc53d7f591809e1"
};
const {values:o}=parseArgs({options:{'source-dir':{type:'string'},motions:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(o.help){console.log('node tools/author-golf-leg-frames.mjs --source-dir SOURCE --motions MOTIONS.json --output /tmp/NEW_DIRECTORY\nUse the six models and motion data from fd0c6b17. Changes only native golf thigh, calf, and foot rotations. Preserves all other tracks and payloads. Outputs candidate models, records, and measurements. Refuses changed source hashes or an existing output directory.');process.exit(0);}
if(!o['source-dir']||!o.motions||!o.output)throw Error('Supply --source-dir, --motions, and --output. See --help.');
const folder=path.resolve(o.output),parent=fs.realpathSync(path.dirname(folder)),tmp=fs.realpathSync('/tmp');
if((parent!==tmp&&!parent.startsWith(tmp+path.sep))||fs.existsSync(folder))throw Error('Use a new candidate directory under /tmp.');
const motions=JSON.parse(fs.readFileSync(o.motions));
for(const hero of Object.keys(sources)){
 const raw=fs.readFileSync(path.resolve(o['source-dir'],hero+'.glb'));
 if(createHash('sha256').update(raw).digest('hex')!==sources[hero])throw Error('Wrong '+hero+' source. Extract the model from fd0c6b17.');
}
fs.mkdirSync(folder);
for(const hero of ['kaede','ronin','shinobi','monk','ayame','sora']){
 const file=path.resolve(o['source-dir'],hero+'.glb'),g=await loadNativeSkin(file),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});g.scene.updateMatrixWorld(true);
 const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize(),changed=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'];
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),entries=[],report=[];
 for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
  a.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);const startFeet=Object.fromEntries(['r','l'].map(s=>[s,{ankle:p('foot_'+s),toe:p('ball_'+s),q:q('foot_'+s)}]));
  for(const side of ['r','l']){
   const f=startFeet[side];f.vertices=[];f.floor=Infinity;const inverse=f.q.clone().invert();
   g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const {skinIndex:ids,skinWeight:w,position}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++){let amount=0;for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(mesh.skeleton.bones[ids.getComponent(i,k)].name))amount+=w.getComponent(i,k);if(amount<=.9)continue;
     const v=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);f.floor=Math.min(f.floor,v.y);f.vertices.push(v.sub(f.ankle).applyQuaternion(inverse));}
   });
  }
  const count=Math.ceil(clip.duration*120),times=[...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*clip.duration)),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b),rotations=Object.fromEntries(changed.map(n=>[n,[]]));
  for(const time of times){
   a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);const saved=changed.map(n=>[b[n],b[n].quaternion.clone()]);
   for(const s of ['r','l']){
    const foot=p('foot_'+s),shoe=q('foot_'+s),before=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
    const smooth=u=>{u=T.MathUtils.clamp(u,0,1);return u*u*(3-2*u)};
    // Keep the forefoot fixed. Turn the raised rear shoe around its own forefoot.
    const start=startFeet[s],toe=start.toe,up=new T.Vector3(0,1,0);
    foot.copy(start.ankle);shoe.copy(start.q);
    if(name==='Golf_Swing'){
     if(s==='r'){
      const turn=new T.Quaternion().setFromAxisAngle(up,-25*Math.PI/180*smooth((time-1.42)/.48));
      foot.copy(toe).add(start.ankle.clone().sub(toe).applyQuaternion(turn));shoe.premultiply(turn);
     }else{
      const u=smooth((time-1.1)/.85),forward=toe.clone().sub(start.ankle).setY(0).normalize();
      const turn=new T.Quaternion().setFromAxisAngle(up,-45*Math.PI/180*u).multiply(new T.Quaternion().setFromAxisAngle(up.clone().cross(forward).normalize(),.9*u));
      foot.copy(toe).add(start.ankle.clone().sub(toe).applyQuaternion(turn));shoe.premultiply(turn);
     }
    }
    const sole=Math.min(...start.vertices.map(v=>v.clone().applyQuaternion(shoe).add(foot).y));
    foot.y+=start.floor-sole;
    const solve=angle=>{
     solveLeg(b['thigh_'+s],b['calf_'+s],b['foot_'+s],foot,shoe,{maxReach:.9999999,kneeSolver:(h,f,u,l,forward)=>headingKnee(h,f,u,l,forward,angle*Math.PI/180)});
     alignLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s],cal[s].hinge);
     return measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
    };
    const cost=angle=>{const m=solve(angle);return(m.hipTwist/40)**4+(m.ankleTwist/15)**4+(m.ankleOffPitch/18)**4+(angle/80)**2};let lo=-85,hi=85;for(let i=0;i<20;i++){const l=lo+(hi-lo)/3,r=hi-(hi-lo)/3;if(cost(l)<cost(r))hi=r;else lo=l;}
    const angle=(lo+hi)/2,after=solve(angle);
    report.push({name,time,side:s,angle,before,after,hip:p('thigh_'+s).toArray(),knee:p('calf_'+s).toArray(),foot:foot.toArray(),footError:p('foot_'+s).distanceTo(foot),footAngle:q('foot_'+s).angleTo(shoe)});
   }
   for(const n of changed){const v=rotations[n],r=b[n].quaternion.clone().normalize();if(v.length&&r.dot(new T.Quaternion().fromArray(v,v.length-4))<0)r.set(-r.x,-r.y,-r.z,-r.w);v.push(...r.toArray());}
   for(const [bone,rotation]of saved)bone.quaternion.copy(rotation);g.scene.updateMatrixWorld(true);
  }
  entries.push({clip:name,times,rotations,extras:{nativeGolfLegFrames:1}});
 }
 for(const r of report)if(Math.abs(r.after.hipTwist)>45||Math.abs(r.after.ankleTwist)>17||r.after.ankleOffPitch>24||r.after.kneeDeviation>.01||r.footError>.00005||r.footAngle>.001)throw Error('Leg-frame fit failed: '+hero+' '+JSON.stringify(r));
 fs.writeFileSync(folder+'/'+hero+'.glb',patchAnimationRotations(fs.readFileSync(file),entries));fs.writeFileSync(folder+'/'+hero+'.json',JSON.stringify(report));
 console.log(hero,Object.fromEntries(['hipTwist','ankleTwist','ankleOffPitch','kneeDeviation','kneeFlexion'].map(k=>[k,{before:Math.max(...report.map(r=>Math.abs(r.before[k]))),after:Math.max(...report.map(r=>Math.abs(r.after[k])))}])));
}
const records=Object.fromEntries(['Golf_Address','Golf_Swing','Golf_Putt'].map(name=>{
 const duration=motions[name].duration,swing=name==='Golf_Swing';
 return[name,{...motions[name],nativeKneeHeading:true,nativeKneeHinges:true,
  footPlants:{r:[[0,swing?1.42:duration]],l:[[0,swing?1.1:duration]]},
  ...(swing?{toePlants:{r:[[1.42,duration]],l:[[1.1,duration]]}}:{})}];
}));
fs.writeFileSync(folder+'/motions.json',JSON.stringify(records));
