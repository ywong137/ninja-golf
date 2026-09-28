import * as THREE from 'three';

const UP=new THREE.Vector3(0,1,0),clamp=THREE.MathUtils.clamp;
const ease=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
export const slamTerrainWeight=time=>ease(0,.20,time)*(1-ease(.78,1.06,time));
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);

// Candidate planner. It evaluates the source trajectory at one actor location.
// A moving caller must refresh the plan before relying on its clearance result.
export function planSlamTerrain({probes,origin,yaw=0,rootScale=1.1,groundHeight,pelvisOffset=0,clearance=.006,maxPitch=25*Math.PI/180,iterations=12}){
 if(probes?.schemaVersion!==1||probes.clip!=='Ronin_Heavy_Slam'||probes.units!=='metres'||probes.sourceScale!==1||Math.abs(probes.duration-1.06)>1e-6||!Number.isFinite(probes.duration)||probes.axes?.up!=='+Y'||probes.axes?.forward!=='+Z'||!Array.isArray(probes.samples)||!probes.samples.length)throw Error('Supply the actor-local Ronin_Heavy_Slam V1 probe data in metres, with +Y up and +Z forward.');
 if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isFinite)||!Number.isFinite(yaw)||!Number.isFinite(pelvisOffset))throw Error('Supply a finite world origin, yaw, and pelvis offset.');
 if(rootScale!==probes.footCalibrationRootScale)throw Error('The root scale must match the probe foot calibration.');
 if(typeof groundHeight!=='function'||!Number.isFinite(clearance)||clearance<0||!(maxPitch>0&&maxPitch<Math.PI/2)||!Number.isInteger(iterations)||iterations<1||iterations>24)throw Error('Supply a terrain function, finite nonnegative clearance, bounded pitch, and 1–24 iterations.');
 let previousTime=-Infinity;
 for(const sample of probes.samples){
  if(!Number.isFinite(sample.time)||sample.time<0||sample.time>probes.duration||sample.time<=previousTime||!finitePoint(sample.pivot))throw Error('Probe times must increase within the clip duration, with a finite pivot at every sample.');
  previousTime=sample.time;
  if(!Array.isArray(sample.blade)||sample.blade.length<3||!sample.blade.every(finitePoint))throw Error(`Invalid blade hull at ${sample.time}.`);
  for(const side of ['r','l']){
   const foot=sample.feet?.[side];
   if(!foot||![foot.ankle,foot.hip,foot.knee].every(finitePoint)||foot.solePoints?.length!==2||!foot.solePoints.every(finitePoint)||!Number.isFinite(foot.weight)||foot.weight<0||foot.weight>1)throw Error(`Invalid ${side} foot probe at ${sample.time}.`);
  }
 }
 const c=Math.cos(yaw),s=Math.sin(yaw),axisX=-c,axisZ=s;
 let terrainQueries=0;
 const height=(x,z)=>{terrainQueries++;const y=groundHeight(x,z);if(!Number.isFinite(y))throw Error(`Non-finite terrain height at ${x}, ${z}.`);return y;};
 const vector=p=>new THREE.Vector3((c*p[0]+s*p[2])*rootScale,p[1]*rootScale,(-s*p[0]+c*p[2])*rootScale);
 const point=p=>vector(p).add(new THREE.Vector3(...origin));
 let downhill=0;const reach=.7*rootScale;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;downhill=Math.min(downhill,height(origin[0]+Math.cos(a)*reach,origin[2]+Math.sin(a)*reach)-origin[1]);}
 const frames=[];let minimumPelvis=0,maximumPelvis=-Infinity;
 for(const sample of probes.samples){
  const feet=[];let terrainChanged=false;
  for(const side of ['r','l']){
   const source=sample.feet?.[side];
   const ankle=point(source.ankle),hip=point(source.hip),knee=point(source.knee),e=.12;
   const normal=new THREE.Vector3(height(ankle.x-e,ankle.z)-height(ankle.x+e,ankle.z),2*e,height(ankle.x,ankle.z-e)-height(ankle.x,ankle.z+e)).normalize();
   const tilt=Math.acos(clamp(normal.y,-1,1));if(tilt>.55)normal.lerp(UP,1-.55/tilt).normalize();
   const rotation=new THREE.Quaternion().setFromUnitVectors(UP,normal).slerp(new THREE.Quaternion(),1-source.weight);
   let penetration=-Infinity,sourceSoleGap=Infinity;
   for(const local of source.solePoints){
    const old=vector(local),relative=old.clone().applyQuaternion(rotation);
    sourceSoleGap=Math.min(sourceSoleGap,ankle.y+old.y-origin[1]);
    penetration=Math.max(penetration,height(ankle.x+relative.x,ankle.z+relative.z)-ankle.y-relative.y);
   }
   const offset=clamp(Math.max((penetration+sourceSoleGap)*source.weight,penetration-Math.max(0,-sourceSoleGap)),-.32,.32);
   terrainChanged||=Math.abs(offset)>1e-7||rotation.angleTo(new THREE.Quaternion())>1e-6;
   feet.push({ankle,hip,knee,target:ankle.clone().addScaledVector(UP,offset)});
  }
  let pelvisLimit=0;
  if(terrainChanged)for(const foot of feet){
   const length=(foot.hip.distanceTo(foot.knee)+foot.knee.distanceTo(foot.ankle))*.985;
   const horizontal=Math.hypot(foot.target.x-foot.hip.x,foot.target.z-foot.hip.z);
   pelvisLimit=Math.min(pelvisLimit,foot.target.y+Math.sqrt(Math.max(.01,length*length-horizontal*horizontal))-foot.hip.y);
  }
  pelvisLimit=clamp(pelvisLimit,-.20,0);
  const wanted=clamp(Math.min(downhill,pelvisLimit),-.20,0);
  // The runtime approaches the reserve over time. Its lower bound is safer for
  // the upcoming strike than assuming the current, potentially higher pelvis.
  const drop=terrainChanged||wanted<-.0000001?Math.min(pelvisOffset,wanted):0;
  minimumPelvis=Math.min(minimumPelvis,drop);maximumPelvis=Math.max(maximumPelvis,drop);
  const pivot=point(sample.pivot).addScaledVector(UP,drop),vertices=[];
  for(const local of sample.blade){const p=point(local).addScaledVector(UP,drop).sub(pivot);vertices.push(p.x,p.y,p.z);}
  frames.push({time:sample.time,pivot,vertices:Float64Array.from(vertices),weight:slamTerrainWeight(sample.time)});
 }
 function measure(pitch,stopOnObstruction=false){
  let minimum=Infinity,worst=null;
  for(const frame of frames){
   const angle=pitch*frame.weight,cos=Math.cos(angle),sin=Math.sin(angle),v=frame.vertices;
   for(let i=0;i<v.length;i+=3){
    const x=v[i],y=v[i+1],z=v[i+2],dot=axisX*x+axisZ*z,oneMinus=1-cos;
    const px=frame.pivot.x+x*cos-axisZ*y*sin+axisX*dot*oneMinus;
    const py=frame.pivot.y+y*cos+(axisZ*x-axisX*z)*sin;
    const pz=frame.pivot.z+z*cos+axisX*y*sin+axisZ*dot*oneMinus;
    const gap=py-height(px,pz);
    if(gap<minimum){minimum=gap;worst={time:frame.time,point:[px,py,pz],clearance:gap};}
    if(stopOnObstruction&&gap<clearance)return {minimum,worst};
   }
  }
  return {minimum,worst};
 }
 const before=measure(0);let pitch=0,after=before,limited=false;
 if(before.minimum<clearance){
  let low=0,high=maxPitch;after=measure(high);
  if(after.minimum<clearance){pitch=high;limited=true;}
  else{
   for(let i=0;i<iterations;i++){const mid=(low+high)/2,candidate=measure(mid,true);if(candidate.minimum<clearance)low=mid;else{high=mid;after=candidate;}}
   pitch=high;
  }
 }
 return {pitch,limited,clearanceBefore:before.minimum,clearanceAfter:after.minimum,worst:after.worst,predictedPelvisRange:[minimumPelvis,maximumPelvis],terrainQueries,samples:frames.length};
}
