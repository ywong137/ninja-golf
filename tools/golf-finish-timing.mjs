import * as T from 'three';

// Slow the late shoulder transition without changing the fitted pose path.
// Contact and the complete downswing retain their original timing.
const points=[[1.75,1.75],[1.82,1.82],[1.90,1.875],[2.00,1.91],[2.12,1.96],[2.28,2.15],[2.4,2.4]];
const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]));
const tangents=points.map((_,i)=>i===0?1:i===points.length-1?1:2/(1/slopes[i-1]+1/slopes[i]));

export function golfFinishSourceTime(time){
  if(time<=points[0][0]||time>=points.at(-1)[0])return time;
  const i=points.findIndex(p=>p[0]>time)-1,[a,b]=points.slice(i,i+2),h=b[0]-a[0],u=(time-a[0])/h;
  return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*h*tangents[i]
    +(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*h*tangents[i+1];
}

export function retimeGolfFinish(entry){
  const result={...entry,rotations:{},translations:{},extras:{...entry.extras,nativeGolfFinishTiming:1}};
  for(const [kind,width,Track]of [['rotations',4,T.QuaternionKeyframeTrack],['translations',3,T.VectorKeyframeTrack]]){
    for(const [name,values]of Object.entries(entry[kind]??{})){
      const sample=new Track(name,entry.times,values).createInterpolant(),output=[];
      for(const time of entry.times)output.push(...sample.evaluate(golfFinishSourceTime(time)));
      if(output.length!==entry.times.length*width)throw Error('Unexpected finish sample count: '+name);
      result[kind][name]=output;
    }
  }
  return result;
}
