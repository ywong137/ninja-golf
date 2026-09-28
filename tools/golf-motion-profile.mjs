// Left-handed golf: anatomical R leads, anatomical L trails.
import {Vector3} from 'three';
export const GOLF_CONTACT=Object.freeze([0,-.945,.118]);
export const GOLF_GRIP_SPACING=-.09;
export const GOLF_LENGTH=Math.hypot(.625,.722);
const ADDRESS_HEIGHT=.745;
const ADDRESS_FORWARD=.945-Math.sqrt(GOLF_LENGTH**2-(ADDRESS_HEIGHT-.118)**2);
const ADDRESS_GRIP=[0,-ADDRESS_FORWARD,ADDRESS_HEIGHT];
const ADDRESS_DIRECTION=[0,ADDRESS_FORWARD-.945,.118-ADDRESS_HEIGHT];
const impactHeight=.745;
const impactForward=.945-Math.sqrt(GOLF_LENGTH**2-(impactHeight-.118)**2-.05**2);
// t, pelvis yaw, chest yaw, hip hinge, chest hinge, side bend, root X/Y/Z.
export const GOLF_BODY=[
 [0,0,0,.54,.65,-.30,-.03,-.045,-.045,0],
 [.22,.20,.40,.52,.62,-.08,.015,-.047,-.055,0],
 [.435,.72,1.57,.48,.59,0,.045,-.040,-.055,0],
 [1.15/2.4,.38,1.43,.49,.61,.07,-.03,-.060,-.055,.04],
 [1.32/2.4,-.40,.20,.51,.62,-.14,-.06,-.075,-.055,.16],
 [1.4/2.4,-.66,-.40,.50,.61,-.28,-.075,-.075,-.045,.29],
 [1.56/2.4,-1.20,-1.52,.27,.34,-.13,-.10,-.070,-.035,.58],
 [.79,-1.42,-1.85,.10,.08,-.02,-.115,-.045,-.015,.95],
 [1,-1.48,-1.92,.06,.045,0,-.115,-.045,-.015,1],
].map(([t,hip,chest,hinge,bend,side,x,y,z,heel])=>({t,hip,chest,hinge,bend,side,x,y,z,heel}));
const SWING=[
 [0,ADDRESS_GRIP,ADDRESS_DIRECTION],
 [.22,[.30,-.37,.84],[1,-.045,.025]],
 [.32,[.40,-.26,1.34],[.56,.04,.83]],
 [.385,[.42,-.16,1.56],[-.38,.05,.92]],
 [.435,[.41,-.14,1.61],[-.94,0,.34]],
 [1.15/2.4,[.46,-.22,1.47],[-.35,.08,.93]],
 [1.27/2.4,[.32,-.34,1.00],[.77,-.30,.56]],
 [1.36/2.4,[.06,-.36,.89],[.15,-.85,-.50]],
 [1.4/2.4,[-.05,-impactForward,impactHeight],[.05,impactForward-.945,.118-impactHeight]],
 [1.56/2.4,[-.43,-.35,1.02],[-1,-.25,.4]],
 [1.70/2.4,[-.49,-.20,1.46],[-.15,.05,.99]],
 [.82,[-.29,.16,1.75],[1,.08,.025]],
 [1,[-.28,.17,1.73],[1,.12,.025]],
].map(([t,grip,direction])=>({t,grip,direction:new Vector3().fromArray(direction).normalize().toArray()}));

export function sampleRows(rows,t){
 let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;
 const a=rows[i],b=rows[i+1],p=rows[Math.max(0,i-1)],n=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
 const value=(key,k=null)=>{const v=row=>k===null?row[key]:row[key][k],m0=i===0?0:(v(b)-v(p))/(b.t-p.t),m1=i+1===rows.length-1?0:(v(n)-v(a))/(n.t-a.t);return (2*u**3-3*u*u+1)*v(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*v(b)+(u**3-u*u)*span*m1;};
 return Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,Array.isArray(a[k])?a[k].map((_,j)=>value(k,j)):value(k)]));
}
export function nativeGolfPhase(name,t,armScale=1){
 let body,grip,direction;
 if(name==='Golf_Swing'){
  body=sampleRows(GOLF_BODY,t);const path=sampleRows(SWING,t);grip=new Vector3().fromArray(path.grip);direction=new Vector3().fromArray(path.direction).normalize();
  // Different native arm lengths share the ball contact, but not the high arc.
  const height=Math.max(0,grip.z-.98);grip.z-=height*(1-armScale);const follow=Math.max(0,Math.min(1,(t-1.41/2.4)/.05));grip.x*=1-Math.max(Math.min(1,height/.4),follow)*(1-armScale);
 }else{
  body={...GOLF_BODY[0]};grip=new Vector3().fromArray(ADDRESS_GRIP);direction=new Vector3().fromArray(ADDRESS_DIRECTION).normalize();
  if(name==='Golf_Putt'){
   const rows=[{t:0,x:0},{t:.38,x:.075},{t:22/45,x:0},{t:.72,x:-.10},{t:1,x:-.075}];
   const x=sampleRows(rows,t).x;grip.x=x;grip.z+=.025*(x/.10)**2;body.side+=x*1.0;
   direction.applyAxisAngle(new Vector3(0,1,0),-x*.80);
  }
 }
 const fitting=(1-armScale)*Math.max(0,1-Math.max(0,-body.chest)/1.92);body.hinge+=fitting*.80;const addressWeight=name==='Golf_Swing'?1-Math.min(1,t/.22):1;body.bend+=fitting*(1.55-.35*addressWeight);body.side-=fitting*.35*addressWeight;body.x-=fitting*.26*addressWeight;body.y-=fitting*.16;
 return{body,grip,direction,tip:grip.clone().addScaledVector(direction,GOLF_LENGTH)};
}
export function golfRecords(){
 return Object.fromEntries([['Golf_Address',2],['Golf_Swing',2.4],['Golf_Putt',1.5]].map(([name,duration])=>{
  const count=Math.round(duration*240),times=Array.from({length:count+1},(_,i)=>i/count);
  const poses=times.map(t=>{const {body,grip,tip}=nativeGolfPhase(name,t);return{t,grip:grip.toArray(),tip:tip.toArray(),hip:body.hip,chest:body.chest,bend:body.bend,pelvisBend:body.hinge,torsoSideBend:body.side,shift:[body.x,-body.z,body.y],heel:body.heel,step:0};});
  return[name,{duration,nativeAttachment:true,twoHanded:true,gripSpacing:GOLF_GRIP_SPACING,fixedShaftLength:GOLF_LENGTH,nativeGolfVersion:3,poses}];
 }));
}
