import {Bone,Group,Quaternion,Vector3} from 'three';
import {sampleAcclaimFrame} from './acclaim-motion.mjs';

const center=points=>new Vector3(...points.lhipjoint).add(new Vector3(...points.rhipjoint)).multiplyScalar(.5);
const PARTS=[
 ['pelvis',null,null,'root'],['spine_01','pelvis','lowerback','root'],
 ['spine_02','spine_01','upperback','upperback'],['spine_03','spine_02','thorax','thorax'],
 ['neck_01','spine_03','lowerneck','thorax'],['Head','neck_01','upperneck','head'],
 ...['r','l'].flatMap(s=>[
  ['thigh_'+s,'spine_01',s+'hipjoint',s+'femur'],
  ['calf_'+s,'thigh_'+s,s+'femur',s+'tibia'],
  ['foot_'+s,'calf_'+s,s+'tibia',s+'foot'],
  ['ball_'+s,'foot_'+s,s+'foot',s+'toes'],
 ]),
];

/** Adapt the measured Acclaim body and legs to the shared gait interface.
 * ASF points are distal endpoints. A femur rotation therefore belongs to the
 * canonical thigh joint at the hipjoint endpoint, not to the knee endpoint.
 * Arms remain outside this adapter; the hero's paired carry owns those tracks.
 */
export function createAcclaimGaitRig(skeleton,{mirror=false}={}){
 if(typeof mirror!=='boolean')throw Error('Acclaim gait mirror must be a boolean.');
 const channels={root:[0,0,0,0,0,0]};
 for(const name of skeleton.order)channels[name]=skeleton.bones[name].dof.map(()=>0);
 for(const side of ['r','l']){
  // The ASF reference legs stand 20 degrees apart. Bring each femur over its
  // ankle and add a small positive knee bend for a measurable bind frame.
  const femur=skeleton.bones[side+'femur'],tibia=skeleton.bones[side+'tibia'];
  const rz=femur.dof.indexOf('rz'),rx=tibia.dof.indexOf('rx');
  if(rz<0||rx<0)throw Error('Acclaim gait requires femur rz and tibia rx channels.');
  channels[side+'femur'][rz]=-femur.axis[2];channels[side+'tibia'][rx]=3;
  const foot=skeleton.bones[side+'foot'],footRx=foot.dof.indexOf('rx');
  if(footRx<0)throw Error('Acclaim gait requires foot rx for neutral sole calibration.');
  channels[side+'foot'][footRx]=-3;
 }
 const neutral=sampleAcclaimFrame(skeleton,{channels});
 const floor=Math.min(...['r','l'].map(s=>neutral.points[s+'toes'][1]));
 const root=new Group(),bones={};
 for(const [name,parent]of PARTS){const b=new Bone();b.name=name;(parent?bones[parent]:root).add(b);bones[name]=b;}
 const apply=(sample,{origin=new Vector3(),yaw=new Quaternion(),floorOffset=0}={})=>{
  for(const [name,,pointName,rotationName]of PARTS){
   const counterpart=n=>mirror?n.replace(/^([rl])(hipjoint|femur|tibia|foot|toes)$/,(all,side,part)=>(side==='r'?'l':'r')+part):n;
   const bone=bones[name],p=(pointName?new Vector3(...sample.points[counterpart(pointName)]):center(sample.points)).sub(origin).applyQuaternion(yaw);p.y+=floorOffset;
   const q=yaw.clone().multiply(new Quaternion().fromArray(sample.rotations[counterpart(rotationName)]));
   // Reflect world motion after its travel heading is removed. Reflect the
   // neutral frame too, so retarget calibration retains each knee's hinge.
   if(mirror){p.x=-p.x;q.set(q.x,-q.y,-q.z,q.w);}
   bone.position.copy(bone.parent.worldToLocal(p));
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q)).normalize();
   bone.updateWorldMatrix(false,true);
  }
  return center(sample.points);
 };
 apply(neutral,{floorOffset:-floor});
 return {root,bones,apply,neutral,floorOffset:-floor};
}
