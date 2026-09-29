#!/usr/bin/env node
/** Reproduce the accepted fixed-arm address and shoulder-driven putt. */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const METHOD='Fixed fitted driver-address arms and hand pair. C1 chest pendulum about actor-local +Z; virtual pivot above physical head body. Pelvis and legs keep the fitted driver-address pose. Head counter-aims at the calibrated ball.';

export async function dependencies(repo,manifest) {
  for (const relative of ['src/golf-club.js','src/golf-club-fit.js','src/golf-equipment.js','node_modules/three/package.json']) {
    if (sha(fs.readFileSync(path.join(repo,relative)))!==manifest.dependencies[relative]?.sha256) {
      throw Error(`${relative} differs from the reviewed equipment dependency. Review it before updating the recipe manifest.`);
    }
  }
  const load=relative=>import(pathToFileURL(path.join(repo,relative)));
  return {
    T:await load('node_modules/three/build/three.module.js'),
    ...await load('src/golf-club-fit.js'),
    ...await load('src/golf-club.js'),
  };
}

export function createRig(recipe,T) {
  const objects=recipe.hierarchy.map(row=>row.bone?new T.Bone():new T.Object3D());
  const bones={};
  recipe.hierarchy.forEach((row,index)=>{
    const object=objects[index];
    object.name=row.name;
    object.position.fromArray(row.position);
    object.quaternion.fromArray(row.quaternion);
    object.scale.fromArray(row.scale);
    if (row.parent>=0) {
      if (row.parent>=index) throw Error('The recipe hierarchy must place each parent before its children.');
      objects[row.parent].add(object);
    } else if (index!==0) throw Error('The recipe requires exactly one root.');
    if (row.bone) {
      if (bones[row.name]) throw Error('Duplicate native bone: '+row.name);
      bones[row.name]=object;
    }
  });
  const root=objects[0];
  root.updateMatrixWorld(true);
  function apply(pose) {
    if (Object.keys(pose).length!==Object.keys(bones).length) throw Error('The pose does not cover every native bone.');
    for (const [name,value] of Object.entries(pose)) {
      const bone=bones[name];
      if (!bone) throw Error('Unknown native bone: '+name);
      for (const [key,count] of [['position',3],['quaternion',4],['scale',3]]) {
        if (value[key]?.length!==count||!value[key].every(Number.isFinite)) throw Error(`Invalid ${name}.${key}.`);
        bone[key].fromArray(value[key]);
      }
    }
    root.updateMatrixWorld(true);
  }
  const snapshot=()=>Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{
    position:bone.position.toArray(),quaternion:bone.quaternion.toArray(),scale:bone.scale.toArray(),
  }]));
  return {root,bones,apply,snapshot};
}

/** Cubic Hermite interpolation preserves the specified angle and angular velocity. */
export function pendulumAngle(time,nodes) {
  if (time<nodes[0].t||time>nodes.at(-1).t) throw Error('The pendulum time is outside the authored clip.');
  let index=nodes.findIndex((node,i)=>i<nodes.length-1&&time>=node.t&&time<=nodes[i+1].t);
  if (index<0) index=nodes.length-2;
  const a=nodes[index],b=nodes[index+1],dt=b.t-a.t,u=(time-a.t)/dt;
  return ((2*u*u*u-3*u*u+1)*a.a+(u*u*u-2*u*u+u)*dt*a.v
    +(-2*u*u*u+3*u*u)*b.a+(u*u*u-u*u)*dt*b.v)*Math.PI/180;
}

export function authorQuietGolf(recipe,modules) {
  const {T,captureGolfRestPose,calibrateGolfClub,createGolfClub}=modules;
  const {root,bones,apply,snapshot}=createRig(recipe,T);
  const restPose=captureGolfRestPose(root);
  const worldPosition=name=>bones[name].getWorldPosition(new T.Vector3());
  const worldRotation=name=>bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
  function clubFrame() {
    const center=bones.hand_r.localToWorld(new T.Vector3().fromArray(recipe.profiles.r.center));
    const rotation=worldRotation('hand_r').multiply(new T.Quaternion().fromArray(recipe.profiles.r.frame)).normalize();
    return {
      center:center.toArray(),primaryPalm:center.toArray(),rotation:rotation.toArray(),
      axis:new T.Vector3(0,1,0).applyQuaternion(rotation).toArray(),
    };
  }
  function clipFromRows(rows) {
    const tracks=Object.keys(bones).flatMap(name=>['position','quaternion','scale'].map(type=>{
      const Track=type==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;
      return new Track(name+'.'+type,rows.map(row=>row.time),rows.flatMap(row=>row.pose[name][type]));
    }));
    return new T.AnimationClip('Golf_Putt',1.5,tracks);
  }

  // The captured Address body is constant. Its local arms come from the accepted Swing0 anchor.
  const rows=recipe.addressTimes.map(time=>{
    const pose=structuredClone(recipe.addressPose);
    apply(pose);
    return {name:'Golf_Address',time,pose,club:{world:clubFrame()}};
  });

  // The PT calibration uses its own contact. It does not inherit the driver head or ball placement.
  apply(recipe.puttBasePose);
  const fixedClip=clipFromRows([{time:0,pose:recipe.puttBasePose},{time:1.5,pose:recipe.puttBasePose}]);
  const club=createGolfClub('PT');
  const grip={
    center:new T.Vector3().fromArray(recipe.profiles.r.center),
    frame:new T.Quaternion().fromArray(recipe.profiles.r.frame).normalize(),
  };
  const fit=calibrateGolfClub({root,hand:bones.hand_r,clip:fixedClip,addressClip:fixedClip,restPose,grip,club,contactTime:22/30});
  club.head.position.y=fit.shaftLengthNative;
  club.setBodyOrientation(fit.bodyQuaternion);
  const initialFrame=clubFrame();
  club.root.position.fromArray(initialFrame.center);
  club.root.quaternion.fromArray(initialFrame.rotation);
  club.root.updateMatrixWorld(true);
  const bodyCenter=new T.Box3().setFromObject(club.head.getObjectByName('Golf club body')).getCenter(new T.Vector3());
  const baseSpinePosition=worldPosition('spine_03'),baseSpineRotation=worldRotation('spine_03');
  const baseHeadPosition=worldPosition('Head'),baseHeadRotation=worldRotation('Head');
  const pivot=new T.Vector3(bodyCenter.x,baseSpinePosition.y,baseSpinePosition.z);
  const ball=fit.ballOffsetNative.clone(),baseGaze=ball.clone().sub(baseHeadPosition).normalize();
  const times=[...new Set([...Array.from({length:181},(_,i)=>i/120),...recipe.nodes.map(node=>node.t)])].sort((a,b)=>a-b);
  const headArc=[];

  for (const time of times) {
    apply(recipe.puttBasePose);
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),pendulumAngle(time,recipe.nodes));
    const spine=bones.spine_03;
    const position=baseSpinePosition.clone().sub(pivot).applyQuaternion(rotation).add(pivot);
    spine.position.copy(spine.parent.worldToLocal(position));
    spine.quaternion.copy(spine.parent.getWorldQuaternion(new T.Quaternion()).normalize().invert()
      .multiply(rotation.clone().multiply(baseSpineRotation))).normalize();
    root.updateMatrixWorld(true);

    // Preserve the address head-to-ball direction. This is not an optical gaze calibration.
    const gaze=ball.clone().sub(worldPosition('Head')).normalize();
    const headRotation=new T.Quaternion().setFromUnitVectors(baseGaze,gaze).multiply(baseHeadRotation);
    bones.Head.quaternion.copy(bones.Head.parent.getWorldQuaternion(new T.Quaternion()).normalize().invert()
      .multiply(headRotation)).normalize();
    root.updateMatrixWorld(true);
    const frame=clubFrame();
    rows.push({name:'Golf_Putt',time,pose:snapshot(),club:{world:frame}});

    club.root.position.fromArray(frame.center).multiplyScalar(recipe.actorScale);
    club.root.quaternion.fromArray(frame.rotation);
    club.root.scale.setScalar(recipe.actorScale);
    club.root.updateMatrixWorld(true);
    let sole=Infinity;
    club.head.traverse(object=>{
      if (!object.isMesh) return;
      const positions=object.geometry.attributes.position;
      for (let index=0;index<positions.count;index++) {
        const point=new T.Vector3().fromBufferAttribute(positions,index).applyMatrix4(object.matrixWorld);
        sole=Math.min(sole,point.y);
      }
    });
    headArc.push({time,angleDegrees:pendulumAngle(time,recipe.nodes)*180/Math.PI,soleY:sole,socket:club.head.getWorldPosition(new T.Vector3()).toArray()});
  }
  const generated=clipFromRows(rows.filter(row=>row.name==='Golf_Putt'));
  const calibration=calibrateGolfClub({root,hand:bones.hand_r,clip:generated,addressClip:generated,restPose,grip,club,contactTime:22/30});
  return {
    poses:{hero:recipe.hero,durations:{Golf_Address:2,Golf_Putt:1.5},method:METHOD,provenance:recipe.originalProvenance,rows},
    report:{hero:recipe.hero,pivotNative:pivot.toArray(),nodes:recipe.nodes,calibration,headArc,
      minimumSole:Math.min(...headArc.map(row=>row.soleY)),maximumSole:Math.max(...headArc.map(row=>row.soleY)),
      shotTravel:Math.max(...headArc.map(row=>row.socket[0]))-Math.min(...headArc.map(row=>row.socket[0]))},
  };
}

async function main() {
  const {values}=parseArgs({options:{repo:{type:'string'},recipe:{type:'string'},output:{type:'string'},hero:{type:'string'},help:{type:'boolean'}}});
  if (values.help) {
    console.log('node author-address-putt.mjs --repo REPO --recipe RECIPE_DIRECTORY --output NEW_DIRECTORY [--hero kaede]\nReproduce accepted pose JSON. No models or production files are changed. The output directory must not exist. Equipment dependency hashes must match the recipe manifest.');
    return;
  }
  for (const key of ['repo','recipe','output']) if (!values[key]) throw Error(`Supply --${key}. Use --help.`);
  const repo=path.resolve(values.repo),directory=path.resolve(values.recipe),output=path.resolve(values.output);
  if (fs.existsSync(output)) throw Error('Choose a new output directory.');
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
  const modules=await dependencies(repo,manifest);
  const names=values.hero?[values.hero]:Object.keys(manifest.outputs).map(filename=>path.basename(filename,'.json'));
  const results=[];
  for (const hero of names) {
    const filename=hero+'.json',entry=manifest.outputs[filename];
    if (!entry) throw Error('Unknown hero: '+hero);
    const raw=fs.readFileSync(path.join(directory,filename));
    if (sha(raw)!==entry.sha256) throw Error(`${filename}: recipe hash changed.`);
    const recipe=JSON.parse(raw),result=authorQuietGolf(recipe,modules);
    const rowsHash=sha(JSON.stringify(result.poses.rows));
    if (rowsHash!==recipe.accepted.rowsSha256) throw Error(`${hero}: output poses differ from the reviewed checkpoint.`);
    const poseBytes=JSON.stringify(result.poses);
    if (sha(poseBytes)!==recipe.accepted.sha256) throw Error(`${hero}: accepted pose document did not reproduce byte-for-byte.`);
    results.push({hero,poseBytes,report:result.report});
  }
  fs.mkdirSync(output,{recursive:true});
  const summary=[];
  for (const result of results) {
    const directory=path.join(output,result.hero);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory,'pendulum-poses.json'),result.poseBytes,{flag:'wx'});
    fs.writeFileSync(path.join(directory,'pendulum-report.json'),JSON.stringify(result.report,null,2),{flag:'wx'});
    summary.push({hero:result.hero,posesSha256:sha(result.poseBytes),byteExact:true,minimumSole:result.report.minimumSole});
  }
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,results:summary}));
}
if (process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(new URL(import.meta.url))) {
  main().catch(error=>{console.error('author-address-putt: '+error.message);process.exitCode=1;});
}
