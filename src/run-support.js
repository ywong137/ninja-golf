import {Vector3,Quaternion,MathUtils} from 'three';
const UP=new Vector3(0,1,0);

// Turn a loaded shoe around one real sole contact. Move its construction
// together so the next support sample retains the same fixed ground point.
export function pivotRunSupport(state,geometry,angle){
 if(!state.roll||!state.contactAnchor||!Number.isFinite(angle)||angle===0)return;
 const r=state.roll,normal=geometry.normal??UP;
 // Ordinary runs carry a changing floor offset outside this construction.
 // Their reported contact includes that offset; keep the stored pivot in the
 // same base frame as the other support anchors to avoid adding it twice.
 r.pivotIndex??=state.contact;r.pivotAnchor??=state.contactAnchor.clone().addScaledVector(UP,-(state.contactFloorDelta??0));
 r.pivotQ??=state.lastQ?.clone()??state.supportQ.clone();
 const turn=new Quaternion().setFromAxisAngle(normal,angle),pivot=r.pivotAnchor;
 for(const p of [state.anchor,r.anchor,r.flatPosition])p.sub(pivot).applyQuaternion(turn).add(pivot);
 for(const q of [state.supportQ,r.initial,r.flat])q.premultiply(turn);
 state.heading+=angle;state.pivotTurn=(state.pivotTurn??0)+angle;
}

// The ankle moves while the contact stays fixed. Flatten onto the sole, then
// roll around the toe or heel as the body passes the supporting shoe.
export function rollRunSupport(state,geometry,hip,phase,floorDelta=0,dt=0){
 const points=geometry.points;
 const normal=geometry.normal??UP;
 if(!state.roll){
  const initial=state.supportQ.clone(),up=geometry.up.clone().applyQuaternion(initial);
  const flat=new Quaternion().setFromUnitVectors(up,normal).multiply(initial);
  const first=points[0].clone().applyQuaternion(initial).dot(normal)<=points[1].clone().applyQuaternion(initial).dot(normal)?0:1;
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
  const toe=points[0].clone().sub(points[1]).applyQuaternion(r.flat);toe.addScaledVector(normal,-toe.dot(normal)).normalize();
  const flatPosition=r.flatPosition.clone().addScaledVector(UP,floorDelta);
  const foreaft=flatPosition.clone().sub(hip).dot(toe),height=Math.max(.1,hip.clone().sub(flatPosition).dot(normal));
  let pitch=MathUtils.clamp(1.7*Math.atan2(-foreaft,height),-.6,.65);
  pitch*=MathUtils.smootherstep(Math.abs(pitch),0,.06)*MathUtils.smootherstep(u,.4,1);
  index=pitch>=0?0:1;
  q=new Quaternion().setFromAxisAngle(normal.clone().cross(toe),pitch).multiply(r.flat);
  anchor=r.flatPosition.clone().add(points[index].clone().applyQuaternion(r.flat));
 }
 if(r.pivotAnchor){
  index=r.pivotIndex;anchor=r.pivotAnchor;
  const toe=points[0].clone().sub(points[1]).applyQuaternion(q),length=toe.length();
  const gap=points[1-index].clone().sub(points[index]).applyQuaternion(q).dot(normal);
  const clearance=Math.min(.018,Math.abs(state.pivotTurn??0)*.10)*length/.22;
  if(gap<clearance){
   const axis=normal.clone().cross(toe).normalize();
   const lift=(index===0?1:-1)*(Math.asin(clearance/length)-Math.asin(MathUtils.clamp(gap/length,-1,1)));
   q.premultiply(new Quaternion().setFromAxisAngle(axis,lift));
  }
  // A shortened pivot support must not compress the complete heel roll into
  // a few frames. Keep its ground point fixed while limiting shoe rotation.
  if(dt>0){
   const angle=r.pivotQ.angleTo(q);
   if(angle>8*dt)q.copy(r.pivotQ.clone().slerp(q,8*dt/angle));
  }
  r.pivotQ.copy(q);
 }
 const position=anchor.clone().sub(points[index].clone().applyQuaternion(q)).addScaledVector(UP,floorDelta);
 state.contactFloorDelta=floorDelta;
 return{position,q,index,anchor:anchor.clone().addScaledVector(UP,floorDelta)};
}
