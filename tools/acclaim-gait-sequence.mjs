import {Quaternion,Vector3} from 'three';
import {sampleAcclaimFrame} from './acclaim-motion.mjs';

const slope=(a,b)=>a*b>0?2*a*b/(a+b):0;
function interpolate(values,i,t){
 const a=values[i],b=values[i+1],delta=b-a;
 const m0=i?slope(a-values[i-1],delta):delta;
 const m1=i+2<values.length?slope(delta,values[i+2]-b):delta;
 const t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
}

/** Preserve a non-looping capture, including its measured acceleration.
 * Interpolate in source joint coordinates without overshooting joint extrema.
 * Time uses seconds. A start never wraps into its standing pose at the end.
 */
export function createAcclaimGaitSequence(skeleton,motion,{startFrame=1,endFrame=motion.length,rate}={}){
 if(!Number.isInteger(startFrame)||!Number.isInteger(endFrame)||startFrame<1||endFrame>motion.length||endFrame<=startFrame||!Number.isFinite(rate)||rate<=0)
  throw Error('Choose an inclusive Acclaim sequence of at least two frames and a positive capture rate.');
 const frames=motion.slice(startFrame-1,endFrame),count=frames.length-1,duration=count/rate;
 const curves=Object.fromEntries(Object.keys(frames[0].channels).map(name=>[name,
  frames[0].channels[name].map((_,axis)=>{
   const values=frames.map(f=>f.channels[name][axis]);
   if(name!=='root'||axis>=3)for(let i=1;i<values.length;i++)values[i]+=360*Math.round((values[i-1]-values[i])/360);
   return values;
  }),
 ]));
 const first=new Vector3(...frames[0].channels.root.slice(0,3)).multiplyScalar(skeleton.scale).setY(0);
 const last=new Vector3(...frames.at(-1).channels.root.slice(0,3)).multiplyScalar(skeleton.scale).setY(0);
 const travel=last.clone().sub(first);
 if(travel.length()<.1)throw Error('The selected gait sequence needs at least 0.1 metres of horizontal travel.');
 const yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(travel.x,travel.z));
 const channelsAt=time=>{
  if(!Number.isFinite(time)||time<0||time>duration)throw Error(`Gait sequence time must be between 0 and ${duration} seconds.`);
  const at=time*rate,i=Math.min(count-1,Math.floor(at)),t=at-i;
  return Object.fromEntries(Object.entries(curves).map(([name,axes])=>[name,axes.map(v=>interpolate(v,i,t))]));
 };
 return {startFrame,endFrame,count,duration,rate,yaw,horizontalTravel:travel.length(),channelsAt,
  sample(time){
   const pose=sampleAcclaimFrame(skeleton,{channels:channelsAt(time)});
   const origin=new Vector3(...pose.points.root).setY(0);
   return {...pose,origin,displacement:origin.clone().sub(first).applyQuaternion(yaw)};
  },
 };
}
