import {Vector3} from 'three';

// Find the nearest planar footprint inside every side-clearance half-plane
// and every hip-reach disk. The optimum is either the original point, an
// edge projection, or an intersection of two boundaries.
export function fitSupportFootprint(preferred,planes,disks=[]){
 const candidates=[preferred.clone()],epsilon=1e-8;
 const feasible=p=>planes.every(({normal,minimum})=>normal.dot(p)>=minimum-epsilon)&&
  disks.every(({center,radius})=>Math.hypot(p.x-center.x,p.z-center.z)<=radius+epsilon);
 const add=(x,z)=>candidates.push(new Vector3(x,preferred.y,z));
 for(const {normal:n} of planes)if(n.x*n.x+n.z*n.z<epsilon)throw Error('A footprint constraint needs a planar normal.');
 if(disks.some(({radius:r})=>!(r>0)||!Number.isFinite(r)))return null;
 if(feasible(preferred))return preferred.clone();
 for(const {normal:n,minimum:b} of planes){
  const length=n.x*n.x+n.z*n.z;
  const offset=(b-n.dot(preferred))/length;add(preferred.x+n.x*offset,preferred.z+n.z*offset);
 }
 for(const {center:c,radius:r} of disks){
  const dx=preferred.x-c.x,dz=preferred.z-c.z,length=Math.hypot(dx,dz);
  if(length>epsilon)add(c.x+dx*r/length,c.z+dz*r/length);
 }
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
  const a=planes[i],b=planes[j],det=a.normal.x*b.normal.z-a.normal.z*b.normal.x;
  if(Math.abs(det)>epsilon)add((a.minimum*b.normal.z-a.normal.z*b.minimum)/det,(a.normal.x*b.minimum-a.minimum*b.normal.x)/det);
 }
 for(const {normal:n,minimum:b} of planes)for(const {center:c,radius:r} of disks){
  const length=n.x*n.x+n.z*n.z,offset=(b-n.dot(c))/length;
  const x=c.x+n.x*offset,z=c.z+n.z*offset,d2=length*offset*offset;
  if(d2>r*r+epsilon)continue;
  const tangent=Math.sqrt(Math.max(0,r*r-d2)/length);
  add(x-n.z*tangent,z+n.x*tangent);add(x+n.z*tangent,z-n.x*tangent);
 }
 for(let i=0;i<disks.length;i++)for(let j=i+1;j<disks.length;j++){
  const a=disks[i],b=disks[j],dx=b.center.x-a.center.x,dz=b.center.z-a.center.z,d=Math.hypot(dx,dz);
  if(d<epsilon||d>a.radius+b.radius+epsilon||d<Math.abs(a.radius-b.radius)-epsilon)continue;
  const along=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),height=Math.sqrt(Math.max(0,a.radius*a.radius-along*along));
  const x=a.center.x+dx*along/d,z=a.center.z+dz*along/d;
  add(x-dz*height/d,z+dx*height/d);add(x+dz*height/d,z-dx*height/d);
 }
 let result=null,distance=Infinity;
 for(const p of candidates)if(feasible(p)){
  const d=p.distanceToSquared(preferred);if(d<distance){result=p;distance=d;}
 }
 return result;
}
