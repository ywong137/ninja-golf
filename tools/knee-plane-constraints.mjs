import {Quaternion,Vector3} from 'three';
import {captureLegPole,solveLegWithPole,setFootWorldRotation} from '../src/leg-pole.js';
import {measureLegAnatomy} from '../src/leg-anatomy.js';

const RAD=Math.PI/180;
const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();

// Search only the continuous local knee branch, retaining the exact shoe pose.
// The returned interval uses radians and does not change the supplied skeleton.
export function kneePlaneWindow(thigh,calf,foot,calibration,{hipLimit=27,ankleLimit=14.5,maxCorrection=32,outward=null,maxMedial=.019,offPitchLimit=180}={}){
 if(![hipLimit,ankleLimit,maxCorrection].every(x=>Number.isFinite(x)&&x>0)||maxCorrection>45)throw Error('Supply positive joint limits and at most 45 degrees of local correction.');
 if(outward&&(!Number.isFinite(maxMedial)||!outward.toArray().every(Number.isFinite)||Math.abs(outward.length()-1)>1e-6))throw Error('Loaded knee alignment needs a unit outward axis and a finite medial limit.');
 const saved=[thigh,calf,foot].map(b=>b.quaternion.clone());
 const restore=()=>{[thigh,calf,foot].forEach((b,i)=>b.quaternion.copy(saved[i]));thigh.updateWorldMatrix(true,true);};
 const evaluate=degrees=>{
  restore();applyKneePlane(thigh,calf,foot,calibration,degrees*RAD);
  const a=measureLegAnatomy(calibration,thigh,calf,foot);
  return Math.abs(a.hipTwist)<=hipLimit&&Math.abs(a.ankleTwist)<=ankleLimit&&a.ankleOffPitch<=offPitchLimit
   &&(!outward||-point(calf).sub(point(foot)).dot(outward)<=maxMedial);
 };
 try{
  const steps=Math.ceil(maxCorrection),samples=Array.from({length:steps*2+1},(_,i)=>-maxCorrection+i*maxCorrection/steps);
  const valid=samples.map(evaluate),candidates=samples.map((degrees,i)=>({degrees,i})).filter(x=>valid[x.i]);
  if(!candidates.length)throw Error('No local knee-plane interval satisfies both joint limits.');
  const center=candidates.reduce((a,b)=>Math.abs(a.degrees)<=Math.abs(b.degrees)?a:b).i;
  let first=center,last=center;
  while(first>0&&valid[first-1])first--;
  while(last+1<samples.length&&valid[last+1])last++;
  const edge=(inside,outside)=>{
   for(let i=0;i<20;i++){const middle=(inside+outside)/2;if(evaluate(middle))inside=middle;else outside=middle;}
   return inside;
  };
  const lower=first===0?samples[first]:edge(samples[first],samples[first-1]);
  const upper=last===samples.length-1?samples[last]:edge(samples[last],samples[last+1]);
  return {lower:lower*RAD,upper:upper*RAD};
 }finally{restore();}
}

export function applyKneePlane(thigh,calf,foot,calibration,angle){
 if(!Number.isFinite(angle))throw Error('Knee correction must be finite radians.');
 const target=point(foot),shoe=rotation(foot);
 const saved=[thigh,calf,foot].map(b=>b.quaternion.clone()),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
 pole.bend.applyAxisAngle(pole.axis,angle);
 // Keep the calibrated hinge as well as the shoe target. Small imported scale
 // differences leave an endpoint residual after an analytic world-space solve.
 // Correct that residual offline instead of adding another runtime adjustment.
 const requested=target.clone();
 for(let i=0;i<4;i++){
  [thigh,calf,foot].forEach((b,j)=>b.quaternion.copy(saved[j]));thigh.updateWorldMatrix(true,true);
  solveLegWithPole(thigh,calf,foot,requested,shoe,calibration.hinge,pole);
  const error=target.clone().sub(point(foot));if(error.length()<1e-7)break;
  requested.add(error);
 }
 setFootWorldRotation(foot,shoe);
 return point(foot).distanceTo(target);
}

export function samplePeriodicAngle(controls,phase){
 if(controls.length<8||!Number.isFinite(phase))throw Error('Supply at least eight periodic angle controls and a finite phase.');
 const n=controls.length,at=((phase%1)+1)%1*n,i=Math.floor(at),t=at-i;
 const weights=[(1-t)**3/6,(3*t**3-6*t*t+4)/6,(-3*t**3+3*t*t+3*t+1)/6,t**3/6];
 return weights.reduce((value,w,j)=>value+w*controls[(i+j-1+n)%n],0);
}
