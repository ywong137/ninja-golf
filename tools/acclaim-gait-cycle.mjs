import {Quaternion,Vector3} from 'three';
import {sampleAcclaimFrame} from './acclaim-motion.mjs';

const slope=(a,b)=>a*b>0?2*a*b/(a+b):0;
const cubic=(a,b,c,d,t)=>{
 const m0=slope(b-a,c-b),m1=slope(c-b,d-c),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*b+(t3-2*t2+t)*m0+(-2*t3+3*t2)*c+(t3-t2)*m1;
};
const endBlend=phase=>{const t=Math.max(0,Math.min(1,(phase-.85)/.15));return t*t*t*(10+t*(-15+6*t));};

/** Close one measured stride in source joint coordinates.
 * Remove only linear root travel; retain its within-stride acceleration.
 * Close small angular residuals over the last 15 percent of the cycle. Global
 * angular detrending can turn a straight captured knee into hyperextension.
 * Cyclic monotone interpolation gives matching endpoint positions/tangents
 * without overshooting a captured joint extremum.
 * In particular, a one-axis ASF knee stays a one-axis knee after closure.
 */
export function createAcclaimGaitCycle(skeleton,motion,{startFrame,endFrame,rate,smooth=false}={}){
 if(!Number.isInteger(startFrame)||!Number.isInteger(endFrame)||startFrame<1||endFrame>motion.length||endFrame-startFrame<4||!Number.isFinite(rate)||rate<=0)
  throw Error('Choose an inclusive Acclaim frame range of at least five frames and a positive capture rate.');
 const frames=motion.slice(startFrame-1,endFrame),count=frames.length-1,curves={},residuals={};
 const delta=new Vector3(...frames.at(-1).channels.root.slice(0,3)).sub(new Vector3(...frames[0].channels.root.slice(0,3))).multiplyScalar(skeleton.scale);
 if(Math.hypot(delta.x,delta.z)<.1)throw Error('The selected gait cycle has insufficient forward travel.');
 for(const name of Object.keys(frames[0].channels)){
  const width=frames[0].channels[name].length;
  curves[name]=Array.from({length:width},(_,axis)=>{
   const values=frames.map(f=>f.channels[name][axis]);
   if(name!=='root'||axis>=3)for(let i=1;i<values.length;i++)values[i]+=360*Math.round((values[i-1]-values[i])/360);
   const residual=values.at(-1)-values[0];
   (residuals[name]??=[]).push(residual);
   // Horizontal motion belongs to the actor, but vertical height belongs to
   // the capture. Keep its first-frame height when removing endpoint drift.
   const origin=name==='root'&&axis<3&&axis!==1?values[0]:0;
   const closed=values.slice(0,-1).map((v,i)=>v-origin-residual*(name==='root'&&axis<3?i/count:endBlend(i/count)));
   // A five-frame binomial filter removes capture noise before time warping.
   // Positive weights cannot overshoot or change the source hinge channel.
   // Filtering the periodic array retains the closed cycle and its mean.
   return smooth?closed.map((_,i)=>[1,4,6,4,1].reduce((sum,w,j)=>sum+w*closed[(i+j-2+count)%count],0)/16):closed;
  });
 }
 const yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(delta.x,delta.z));
 const channelsAt=phase=>{
  if(!Number.isFinite(phase))throw Error('Gait phase must be finite.');
  const x=((phase%1)+1)%1*count,i=Math.floor(x),t=x-i;
  const at=(values,j)=>values[(j+count)%count];
  return Object.fromEntries(Object.entries(curves).map(([name,axes])=>[name,axes.map(v=>cubic(at(v,i-1),at(v,i),at(v,i+1),at(v,i+2),t))]));
 };
 return {duration:count/rate,count,rate,startFrame,endFrame,yaw,worldTravel:delta,horizontalTravel:Math.hypot(delta.x,delta.z),residuals,channelsAt,
  sample:phase=>sampleAcclaimFrame(skeleton,{channels:channelsAt(phase)}),
 };
}
