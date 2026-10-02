import {Vector3,MathUtils} from 'three';

// The first running flight has a real departure pose. A fixed world endpoint
// avoids holding that pose while the native running target travels away.
export class RunEntryFlight{
 constructor({start,velocity,end,phase,phaseRate,lift=.08,outward=new Vector3(),recovering=false}){
  if(!Number.isFinite(phaseRate)||!(phaseRate>0)||!Number.isFinite(phase)||phase>=1||phase<0)throw Error('A running flight needs a positive phase rate and a departure phase below one.');
  this.start=start.clone();this.tangent=velocity.clone().divideScalar(phaseRate);
  this.acceleration=recovering?end.clone().sub(start).multiplyScalar(6/(1-phase)**2).addScaledVector(this.tangent,-4/(1-phase)):new Vector3();
  this.outward=outward.clone();
  this.end=end.clone();this.phase=phase;this.departure=phase;this.lift=lift;
 }
 sampleBase(phase){
  const span=1-this.phase,u=MathUtils.clamp((phase-this.phase)/span,0,1),u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
  const travel=10*u3-15*u4+6*u5,speed=30*u2-60*u3+30*u4,acceleration=60*u-180*u2+120*u3;
  // Zero horizontal acceleration at departure gives a resting shoe time to
  // lift. Preserve measured incoming velocity when the shoe is already moving.
  const p=this.start.clone().multiplyScalar(1-travel)
   .addScaledVector(this.tangent,(u-6*u3+8*u4-3*u5)*span)
   .addScaledVector(this.acceleration,(.5*u2-1.5*u3+1.5*u4-.5*u5)*span*span).addScaledVector(this.end,travel);
  const derivative=this.start.clone().multiplyScalar(-speed/span)
   .addScaledVector(this.tangent,1-18*u2+32*u3-15*u4)
   .addScaledVector(this.acceleration,(u-4.5*u2+6*u3-2.5*u4)*span).addScaledVector(this.end,speed/span);
  const secondDerivative=this.end.clone().sub(this.start).multiplyScalar(acceleration/(span*span))
   .addScaledVector(this.tangent,(-36*u+96*u2-60*u3)/span)
   .addScaledVector(this.acceleration,1-9*u+18*u2-10*u3);
  return{p,derivative,secondDerivative};
 }
 sample(phase){
  const result=this.sampleBase(phase),span=1-this.departure,u=MathUtils.clamp((phase-this.departure)/span,0,1);
  // Use one clearance arc throughout steering. Retarget only the base curve;
  // adding a new arc at each update accumulates height and lift speed.
  result.p.y+=this.lift*16*u*u*(1-u)**2;
  result.derivative.y+=this.lift*32*u*(1-u)*(1-2*u)/span;
  result.secondDerivative.y+=this.lift*32*(1-6*u+6*u*u)/(span*span);
  // Plan the clearance turn at departure. The offset has zero position,
  // velocity, and acceleration at both ends and survives endpoint updates.
  const norm=(3/8)**3*(5/8)**5;
  result.p.addScaledVector(this.outward,u**3*(1-u)**5/norm);
  result.derivative.addScaledVector(this.outward,u*u*(1-u)**4*(3-8*u)/(norm*span));
  result.secondDerivative.addScaledVector(this.outward,2*u*(1-u)**3*(3-21*u+28*u*u)/(norm*span*span));
  return result;
 }
 retarget(phase,end){
  const progress=(phase-this.departure)/(1-this.departure);
  if(progress>=.5||end.distanceTo(this.end)<.035)return false;
  const current=this.sampleBase(phase);
  this.start=current.p;this.tangent=current.derivative;this.acceleration=current.secondDerivative;this.phase=phase;
  this.end.copy(end);
  return true;
 }
}

export function predictRunLanding({center,phase,amplitude,scale,travelHeading,bodyHeading,side,width=.17,minimumLane=0,clearance=.1,support=.28,displacement=null,landingAmplitude=amplitude}){
 const sign=side==='r'?-1:1;
 // Cadence advances by speed * .28 / (2 * amplitude * scale). Projecting
 // distance in phase therefore remains valid during forward acceleration.
 const travel=Math.min(landingAmplitude*support/.28,.34)*scale;
 const drift=displacement??new Vector3(Math.sin(travelHeading),0,Math.cos(travelHeading)).multiplyScalar((1-phase)*2*amplitude*scale/.28);
 const offset=new Vector3(Math.sin(travelHeading)*travel+sign*width*scale*Math.cos(bodyHeading),clearance,
  Math.cos(travelHeading)*travel-sign*width*scale*Math.sin(bodyHeading));
 const lateral=new Vector3(Math.cos(bodyHeading),0,-Math.sin(bodyHeading));
 // Sideways travel already widens the outside step. Add clearance only to
 // the inside foot, where travel would otherwise cross the body's centre.
 const lane=sign*offset.dot(lateral);
 if(lane<minimumLane*scale)offset.addScaledVector(lateral,sign*(minimumLane*scale-lane));
 return offset.add(drift).add(center);
}
