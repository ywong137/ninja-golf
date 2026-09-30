import motions from './motion-data.json';
import selectionMotions from './selection-data.json';
export {motions,selectionMotions};
// Cubic Hermite curves keep velocity continuous through authored phase landmarks.
export function sampleMotion(name,seconds){
  return sampleMotionInto(name,seconds,{});
}
// The caller owns this output and its arrays. Reuse it only after consuming the previous sample.
export function sampleMotionInto(name,seconds,pose){
  const clip=motions[name]||selectionMotions[name];if(!clip)return null;const t=Math.max(0,Math.min(1,seconds/clip.duration)),rows=clip.poses;
  // Match the original left interval at an exact key, including nonuniform authoring times.
  let lo=0,hi=rows.length-2;
  while(lo<hi){const mid=(lo+hi)>>>1;if(t>rows[mid+1].t)lo=mid+1;else hi=mid;}
  const i=lo,a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  // A different clip can have fewer channels. Never leak an old offhand or foot target.
  for(const key in pose)if(key==='t'||!Object.hasOwn(a,key))delete pose[key];
  for(const key in a){
    if(key==='t')continue;
    if(Array.isArray(a[key])){
      let values=pose[key];if(!Array.isArray(values)||values.length!==a[key].length)values=pose[key]=new Array(a[key].length);
      for(let k=0;k<values.length;k++){
        const m0=i===0?0:(b[key][k]-prev[key][k])/(b.t-prev.t),m1=i+1===rows.length-1?0:(next[key][k]-a[key][k])/(next.t-a.t);
        values[k]=h00*a[key][k]+h10*span*m0+h01*b[key][k]+h11*span*m1;
      }
    }else{
      const m0=i===0?0:(b[key]-prev[key])/(b.t-prev.t),m1=i+1===rows.length-1?0:(next[key]-a[key])/(next.t-a.t);
      pose[key]=h00*a[key]+h10*span*m0+h01*b[key]+h11*span*m1;
    }
  }
  if(clip.fixedShaftLength){
    const x=pose.tip[0]-pose.grip[0],y=pose.tip[1]-pose.grip[1],z=pose.tip[2]-pose.grip[2],length=Math.hypot(x,y,z);
    if(length<1e-8)throw new Error(`Invalid shaft direction in ${name} at ${seconds}s.`);
    pose.tip[0]=pose.grip[0]+x*clip.fixedShaftLength/length;
    pose.tip[1]=pose.grip[1]+y*clip.fixedShaftLength/length;
    pose.tip[2]=pose.grip[2]+z*clip.fixedShaftLength/length;
  }
  return pose;
}
export const ATTACK_CLIPS={light:['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep'],heavy:['Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'],musou:['Musou_Flow']};
export function combatMotionName(warrior,kind,step=0){
  const prefix=warrior?.motionPrefix||(warrior?.dualWield?'Twin_':'');
  if(kind==='ready')return warrior?.readyClip||(motions[`${prefix}Ready`]?`${prefix}Ready`:'Idle_Loop');
  const family=ATTACK_CLIPS[kind];
  if(!family)throw new Error(`Unknown combat motion kind: ${kind}`);
  const name=prefix+family[kind==='musou'?0:Math.max(0,Math.min(family.length-1,step))];
  return warrior?.motionOverrides?.[name]??name;
}
export function musouHeadings(warrior){return motions[combatMotionName(warrior,'musou')].headings;}
