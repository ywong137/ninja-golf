// Frozen b174c45 sampler for exact numerical and performance comparisons.
// Cubic Hermite curves keep velocity continuous through authored phase landmarks.
export function sampleReference(clip,seconds,name="reference"){
  if(!clip)return null;const t=Math.max(0,Math.min(1,seconds/clip.duration)),rows=clip.poses;
  let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;const a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  const interp=(key,k)=>{const value=(row)=>k===undefined?row[key]:row[key][k];const m0=i===0?0:(value(b)-value(prev))/(b.t-prev.t),m1=i+1===rows.length-1?0:(value(next)-value(a))/(next.t-a.t);return h00*value(a)+h10*span*m0+h01*value(b)+h11*span*m1;};
  const pose=Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,Array.isArray(a[k])?a[k].map((_,j)=>interp(k,j)):interp(k)]));
  if(clip.fixedShaftLength){
    const direction=pose.tip.map((v,k)=>v-pose.grip[k]),length=Math.hypot(...direction);
    if(length<1e-8)throw new Error(`Invalid shaft direction in ${name} at ${seconds}s.`);
    pose.tip=pose.grip.map((v,k)=>v+direction[k]*clip.fixedShaftLength/length);
  }
  return pose;
}
