import {Vector3,Quaternion} from 'three';

// Measure the rendered shoe, rather than comparing a requested anchor with
// itself. A rolling shoe moves its ankle while its toe or heel stays planted.
export function runSupportPoint(actor,side){
 const foot=actor.bones['foot_'+side],point=foot.getWorldPosition(new Vector3());
 const phase=(actor.runPhase+(side==='r'?0:.5))%1,plan=actor.runFootwork.turnPlanner?.feet[side];
 const loaded=phase>.04&&phase<(plan?.support??.28)-.04;
 if(plan&&plan.contact!==null&&plan.contact!==undefined){
  point.add(actor.footPlacement.feet[side].contacts[plan.contact].clone().applyQuaternion(foot.getWorldQuaternion(new Quaternion())));
  return{point,loaded,id:plan.contact};
 }
 return{point,loaded,id:'native-ankle'};
}
