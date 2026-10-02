import {Vector3,Quaternion} from 'three';

// Measure the rendered shoe, rather than comparing a requested anchor with
// itself. A rolling shoe moves its ankle while its toe or heel stays planted.
export function runSupportPoint(actor,side){
 const foot=actor.bones['foot_'+side],point=foot.getWorldPosition(new Vector3());
 const phase=(actor.runPhase+(side==='r'?0:.5))%1,plan=actor.runFootwork.turnPlanner?.feet[side];
 const action=actor.runActions?.find(a=>a.getEffectiveWeight()>.99);
 const schedule=action?.getClip().userData?.nativeContactSchedule;
 if(schedule&&(!Number.isFinite(schedule.flat)||!Number.isFinite(schedule.release)||schedule.flat<=0||schedule.release<=schedule.flat||schedule.release>=.5))throw Error('Invalid nativeContactSchedule: require 0 < flat < release < 0.5.');
 if(schedule&&![0,1].includes(schedule.landingContact??1))throw Error('Invalid nativeContactSchedule: landingContact must be toe (0) or heel (1).');
 const loaded=schedule&&!plan?phase<schedule.release:phase>.04&&phase<(plan?.support??.28)-.04;
 if(plan&&plan.contact!==null&&plan.contact!==undefined){
  point.add(actor.footPlacement.feet[side].contacts[plan.contact].clone().applyQuaternion(foot.getWorldQuaternion(new Quaternion())));
  return{point,loaded,id:plan.contact};
 }
 // A native clip can also contain a real toe pivot. Keep measuring the
 // rendered contact, never the animation's requested target. An ankle is
 // expected to move during heel rise and cannot measure support drift.
 const pivot=action?.getClip().userData?.nativeSupportPivot;
 if(schedule&&!plan){
  const contact=phase<schedule.flat?(schedule.landingContact??1):0;
  point.add(actor.footPlacement.feet[side].contacts[contact].clone().applyQuaternion(foot.getWorldQuaternion(new Quaternion())));
  return {point,loaded,id:`native-sole-${contact}`};
 }
 if(pivot){
  if(!Number.isFinite(pivot.phase)||pivot.phase<0||pivot.phase>=.28||![0,1].includes(pivot.contact))throw Error('Invalid nativeSupportPivot: supply a support phase and sole contact 0 or 1.');
  if(phase>=pivot.phase){
   point.add(actor.footPlacement.feet[side].contacts[pivot.contact].clone().applyQuaternion(foot.getWorldQuaternion(new Quaternion())));
   return {point,loaded,id:`native-sole-${pivot.contact}`};
  }
 }
 return{point,loaded,id:'native-ankle'};
}
