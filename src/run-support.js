import {Vector3,Quaternion,MathUtils} from 'three';
const UP=new Vector3(0,1,0);

// The ankle moves while the contact stays fixed. Flatten onto the sole, then
// roll around the toe or heel as the body passes the supporting shoe.
export function rollRunSupport(state,geometry,hip,phase,floorDelta=0){
 const points=geometry.points;
 if(!state.roll){
  const initial=state.supportQ.clone(),up=geometry.up.clone().applyQuaternion(initial);
  const flat=new Quaternion().setFromUnitVectors(up,UP).multiply(initial);
  const first=points[0].clone().applyQuaternion(initial).y<=points[1].clone().applyQuaternion(initial).y?0:1;
  const anchor=state.anchor.clone().add(points[first].clone().applyQuaternion(initial));
  const flatPosition=anchor.clone().sub(points[first].clone().applyQuaternion(flat));
  state.roll={initial,flat,first,anchor,flatPosition,start:state.rollStart??0};
 }
 // Joining an existing support phase must not compress a complete foot roll
 // into its last few milliseconds. Only new landings start the full roll.
 const r=state.roll,u=MathUtils.clamp((phase-r.start)/Math.max(.2,state.support),0,1);
 let q,anchor,index;
 if(u<.4){
  q=r.initial.clone().slerp(r.flat,MathUtils.smootherstep(u,0,.4));anchor=r.anchor;index=r.first;
 }else{
  const toe=points[0].clone().sub(points[1]).applyQuaternion(r.flat).setY(0).normalize();
  const flatPosition=r.flatPosition.clone().addScaledVector(UP,floorDelta);
  const foreaft=flatPosition.clone().sub(hip).dot(toe),height=Math.max(.1,hip.y-flatPosition.y);
  let pitch=MathUtils.clamp(1.7*Math.atan2(-foreaft,height),-.6,.65);
  pitch*=MathUtils.smootherstep(Math.abs(pitch),0,.06)*MathUtils.smootherstep(u,.4,1);
  index=pitch>=0?0:1;
  q=new Quaternion().setFromAxisAngle(UP.clone().cross(toe),pitch).multiply(r.flat);
  anchor=r.flatPosition.clone().add(points[index].clone().applyQuaternion(r.flat));
 }
 const position=anchor.clone().sub(points[index].clone().applyQuaternion(q)).addScaledVector(UP,floorDelta);
 return{position,q,index,anchor:anchor.clone().addScaledVector(UP,floorDelta)};
}
