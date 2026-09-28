import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FacialPose} from '../src/facial-pose.js';

// Fixed camera from the visual review. This detects the specific inner-lid
// overhang, which turns less than 90 degrees and passes a 3D flip check.
// It is not a general face-validity test or a photo-fitting measurement.
const camera={
 origin:[.044977052250795894,1.6662760188486123,.14324361654387896],
 rotation:[-3.109502500739543,-.008424192554161623,.22747098566030852],
 translation:[-.008758120586365443,-.023085117663649922,1.0616441693694938],
};
const folds=[
 {triangle:1444,vertices:[755,700,706]},
 {triangle:1445,vertices:[706,756,755]},
 {triangle:2291,vertices:[1334,1331,1281]},
 {triangle:2292,vertices:[1281,1275,1334]},
];

async function loadFoldMeter(){
 const model=await loadNativeSkin(fileURLToPath(new URL('../public/models/monk.glb',import.meta.url)));
 const clip=model.animations.find(c=>c.name==='Naginata_Selection_Idle');
 assert.ok(clip,'The reviewed selection pose must exist');
 model.mixer.clipAction(clip).play();model.mixer.update(.1);model.scene.updateMatrixWorld(true);
 const bones={};model.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const mesh=model.scene.getObjectByName('Mesh_1');mesh.skeleton.update();
 const index=mesh.geometry.index;
 for(const fold of folds)assert.deepEqual([0,1,2].map(k=>index.getX(fold.triangle*3+k)),fold.vertices,
  `Head topology changed: review and rebase inner-lid triangle ${fold.triangle}`);
 const pose=new FacialPose(bones,{identity:'monk'}),rotation=new Vector3().fromArray(camera.rotation);
 const q=new Quaternion().setFromAxisAngle(rotation.clone().normalize(),rotation.length());
 const origin=new Vector3().fromArray(camera.origin),translation=new Vector3().fromArray(camera.translation);
 const project=i=>{
  const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(q).add(translation);
  assert.ok(p.z>0,'The reviewed lid surface must stay in front of the camera');
  return [p.x/p.z,p.y/p.z];
 };
 const area=vertices=>{
  const [a,b,c]=vertices.map(project);
  return ((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
 };
 const neutral=folds.map(fold=>area(fold.vertices));
 assert.ok(neutral.every(value=>Math.abs(value)>1e-6),'The camera must resolve all four lid folds');
 return {pose,scan(){
  let minimumRatio=Infinity,firstReversal=null;
  for(let step=0;step<=40;step++){
   const strength=step/40;pose.restore();pose.anger=strength;pose.apply(0,{musou:strength});
   model.scene.updateMatrixWorld(true);mesh.skeleton.update();
   folds.forEach((fold,i)=>{
    const ratio=area(fold.vertices)/neutral[i];minimumRatio=Math.min(minimumRatio,ratio);
    if(ratio<=0&&!firstReversal)firstReversal={strength,triangle:fold.triangle,ratio};
   });
  }
  pose.restore();return {minimumRatio,firstReversal};
 }};
}

test('Executive musou preserves the visible inner-lid folds through the full expression',async()=>{
 const meter=await loadFoldMeter(),result=meter.scan();
 assert.equal(result.firstReversal,null,`The inner-lid fold turns behind its crease: ${JSON.stringify(result.firstReversal)}`);
 assert.ok(result.minimumRatio>0,'Every reviewed fold must retain its original camera-facing side');
});

test('The fold check detects the former excessive brow descent',async()=>{
 const meter=await loadFoldMeter();
 meter.pose.expression={...meter.pose.expression,RInnerEyebrow:[.0025,-.006,.0018],LInnerEyebrow:[-.0025,-.006,.0018]};
 const result=meter.scan();
 assert.ok(result.firstReversal,'The known bad expression must fail the visual regression');
 assert.ok(result.firstReversal.strength<1,'The check must catch the fold before the full frown');
 assert.ok(result.minimumRatio<0);
});
