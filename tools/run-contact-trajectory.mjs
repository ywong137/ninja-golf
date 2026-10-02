import {MathUtils,Quaternion,Vector3} from 'three';

// Canonical native phase: right touchdown at zero, left at one half.
// Recovery can blend after release, but it must not extend ground support.
export const RUN_CONTACT_SCHEDULE=Object.freeze({landing:0,flat:.06,heelRise:.14,release:.28});
const UP=new Vector3(0,1,0);

export function createRunningStance({landingPosition,landingRotation,flatRotation,contacts,releaseToeZ,travelPerPhase,landingContact=1}){
 const schedule=RUN_CONTACT_SCHEDULE;
 if(contacts.length!==2||!Number.isFinite(releaseToeZ))throw Error('A stance needs toe and heel sole points and a finite release position.');
 if(![0,1].includes(landingContact))throw Error('Landing contact must be toe (0) or heel (1).');
 const landing=landingPosition.clone().add(contacts[landingContact].clone().applyQuaternion(landingRotation));landing.y=0;
 const heel=landingContact===1?landing:landing.clone().add(contacts[1].clone().sub(contacts[0]).applyQuaternion(flatRotation));
 const toe=landingContact===0?landing:landing.clone().add(contacts[0].clone().sub(contacts[1]).applyQuaternion(flatRotation));
 const travel=travelPerPhase??(toe.z-releaseToeZ)/schedule.release;
 if(!Number.isFinite(travel)||travel<=0)throw Error('The release toe must lie behind the landing toe.');
 const forward=contacts[0].clone().sub(contacts[1]).applyQuaternion(flatRotation);
 const axis=UP.clone().cross(forward).normalize();
 const releaseRotation=new Quaternion().setFromAxisAngle(axis,35*Math.PI/180).multiply(flatRotation);
 return {travelPerPhase:travel,heelAnchor:heel,toeAnchor:toe,schedule,sample(phase){
  if(!Number.isFinite(phase)||phase<0||phase>schedule.release)throw Error('Sample a stance only from touchdown through release.');
  const contact=phase<schedule.flat?landingContact:0;
  const q=phase<schedule.flat
   ?landingRotation.clone().slerp(flatRotation,MathUtils.smootherstep(phase,0,schedule.flat))
   :flatRotation.clone().slerp(releaseRotation,MathUtils.smootherstep(phase,schedule.heelRise,schedule.release));
  const anchor=(contact===1?heel:toe).clone();anchor.z-=travel*phase;
  return {p:anchor.sub(contacts[contact].clone().applyQuaternion(q)),q,contact};
 }};
}

// C2 vector interpolation. Tangents and accelerations use the same units as t.
export function quinticVector(start,end,t,duration){
 if(!(duration>0)||!Number.isFinite(t))throw Error('Supply a positive segment duration and finite sample time.');
 const u=MathUtils.clamp(t/duration,0,1),u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
 const weights=[1-10*u3+15*u4-6*u5,u-6*u3+8*u4-3*u5,(u2-3*u3+3*u4-u5)/2,
  10*u3-15*u4+6*u5,-4*u3+7*u4-3*u5,(u3-2*u4+u5)/2];
 return new Vector3().addScaledVector(start.p,weights[0]).addScaledVector(start.v,weights[1]*duration)
  .addScaledVector(start.a,weights[2]*duration**2).addScaledVector(end.p,weights[3])
  .addScaledVector(end.v,weights[4]*duration).addScaledVector(end.a,weights[5]*duration**2);
}

export function sampleDerivatives(sample,t,epsilon=1e-4){
 const p=sample(t),before=sample(t-epsilon),after=sample(t+epsilon);
 return {p,v:after.clone().sub(before).divideScalar(2*epsilon),a:after.clone().add(before).addScaledVector(p,-2).divideScalar(epsilon**2)};
}
