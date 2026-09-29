import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {authorQuietGolf,createRig,dependencies,pendulumAngle} from './author-address-putt.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.env.NINJA_REPO??process.cwd());
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'recipe/manifest.json')));
const modules=await dependencies(repo,manifest),{T}=modules;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

for (const filename of Object.keys(manifest.outputs)) {
  const raw=fs.readFileSync(path.join(directory,'recipe',filename));
  assert.equal(sha(raw),manifest.outputs[filename].sha256);
  const recipe=JSON.parse(raw);
  test(`${recipe.hero}: reproduce the accepted documents and preserve the rigid native pair`,()=>{
    const {poses,report}=authorQuietGolf(recipe,modules);
    assert.equal(sha(JSON.stringify(poses)),recipe.accepted.sha256);
    const {root,bones,apply}=createRig(recipe,T);
    const rows=poses.rows.filter(row=>row.name==='Golf_Putt');
    assert.equal(rows.length,182);
    assert.equal(poses.rows.filter(row=>row.name==='Golf_Address').length,241);
    for (const row of rows) for (const [name,value] of Object.entries(row.pose)) {
      for (const key of ['position','quaternion','scale']) {
        if (name==='spine_03'&&key!=='scale' || name==='Head'&&key==='quaternion') continue;
        assert.deepEqual(value[key],recipe.puttBasePose[name][key],`${name}.${key} at ${row.time}`);
      }
    }
    const samples=[];
    rows.forEach((row,index)=>{
      samples.push(row.pose);
      if (index===rows.length-1) return;
      const next=rows[index+1].pose,pose={};
      for (const [name,value] of Object.entries(row.pose)) pose[name]={
        position:value.position.map((v,k)=>(v+next[name].position[k])/2),
        scale:value.scale.map((v,k)=>(v+next[name].scale[k])/2),
        quaternion:new T.Quaternion().fromArray(value.quaternion).slerp(new T.Quaternion().fromArray(next[name].quaternion),.5).toArray(),
      };
      samples.push(pose);
    });
    assert.equal(samples.length,363);
    for (const pose of samples) {
      apply(pose);
      const hands={};
      for (const side of ['r','l']) {
        const hand=bones['hand_'+side],profile=recipe.profiles[side];
        hands[side]={
          palm:hand.localToWorld(new T.Vector3().fromArray(profile.center)),
          frame:hand.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(profile.frame)).normalize(),
        };
      }
      const expected=hands.r.palm.clone().addScaledVector(new T.Vector3(0,1,0).applyQuaternion(hands.r.frame),recipe.spacing);
      assert.ok(expected.distanceTo(hands.l.palm)<.000002,'The paired palm gap exceeds 0.002 mm.');
      assert.ok(hands.r.frame.angleTo(hands.l.frame)<.000002,'The mounted hand frames differ.');
      assert.deepEqual(root.scale.toArray(),[1,1,1]);
    }
    assert.ok(report.minimumSole>.0015,'The actual head sole loses its flat-ground clearance.');
    assert.ok(Math.abs(report.calibration.soleHeightWorld-.002)<1e-7);
    assert.ok(Math.abs(report.calibration.faceGapWorld)<1e-7);
    assert.ok(report.calibration.addressFit.accepted);
    assert.ok(Math.abs(report.calibration.addressFit.offsetWorld.x-.005)<1e-7);
    assert.ok(report.shotTravel>.23&&report.shotTravel<.26);
  });
}

test('The authored pendulum preserves angle and velocity through every phase boundary',()=>{
  const recipe=JSON.parse(fs.readFileSync(path.join(directory,'recipe/kaede.json')));
  const radians=Math.PI/180,epsilon=1e-6;
  for (const node of recipe.nodes) {
    assert.ok(Math.abs(pendulumAngle(node.t,recipe.nodes)-node.a*radians)<1e-12);
    for (const direction of [-1,1]) {
      const time=node.t+direction*epsilon;
      if (time<0||time>1.5) continue;
      const velocity=(pendulumAngle(time,recipe.nodes)-pendulumAngle(node.t,recipe.nodes))/(direction*epsilon);
      assert.ok(Math.abs(velocity-node.v*radians)<2e-5,`Angular velocity is discontinuous at ${node.t}.`);
    }
  }
  assert.throws(()=>pendulumAngle(-1,recipe.nodes),/outside/);
});
