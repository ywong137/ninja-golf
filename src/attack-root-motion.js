// Immutable motion-record positions use native-model metres and animation seconds.
const verified=new WeakSet();

export function validatePlanarRoot(path){
 if(verified.has(path))return path;
 if(!path||!Number.isFinite(path.duration)||path.duration<=0||!Array.isArray(path.rows)||path.rows.length<2)
  throw new Error('Planar root motion needs a positive duration and at least two rows.');
 let previous=-Infinity;
 for(const row of path.rows){
  if(![row.time,row.x,row.z].every(Number.isFinite)||row.time<=previous)
   throw new Error('Planar root rows need finite positions and strictly increasing times.');
  previous=row.time;
 }
 const first=path.rows[0],last=path.rows.at(-1);
 if(Math.abs(first.time)>1e-7||Math.hypot(first.x,first.z)>1e-7||Math.abs(last.time-path.duration)>1e-6)
  throw new Error('Planar root motion must start at time/position zero and end at its duration.');
 verified.add(path);return path;
}

export function samplePlanarRoot(path,time,out={x:0,z:0}){
 validatePlanarRoot(path);
 if(!Number.isFinite(time))throw new Error('Root sample time must be finite animation seconds.');
 const rows=path.rows,t=Math.max(0,Math.min(path.duration,time));let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time>t)hi=mid;else lo=mid;}
 const a=rows[lo],b=rows[hi],u=(t-a.time)/(b.time-a.time);
 out.x=a.x+(b.x-a.x)*u;out.z=a.z+(b.z-a.z)*u;return out;
}

// Use differences, so frame rate, pauses and partial final frames cannot change
// the total travel. The caller still applies terrain and obstacle collision.
export function attackRootDelta(path,previousTime,time,actionDuration,yaw,scale=1,out={x:0,z:0}){
 if(![previousTime,time,actionDuration,yaw,scale].every(Number.isFinite)||actionDuration<=0||scale<=0||time<previousTime)
  throw new Error('Root travel needs forward action times, a positive duration/scale, and a finite yaw.');
 validatePlanarRoot(path);
 const before=samplePlanarRoot(path,previousTime/actionDuration*path.duration);
 samplePlanarRoot(path,time/actionDuration*path.duration,out);
 const x=(out.x-before.x)*scale,z=(out.z-before.z)*scale,c=Math.cos(yaw),s=Math.sin(yaw);
 out.x=x*c+z*s;out.z=z*c-x*s;return out;
}
