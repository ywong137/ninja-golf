import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {RunTurnPlanner} from '../src/run-turn-planner.js';

// Turning over a forward supporting foot must not carry it across the body's
// midline. Test the actual ankle orbit, not the unrotated anchor approximation.
for(const side of ['r','l'])test(`${side}: an ordinary loaded pivot preserves its leg lane`,()=>{
 const sign=side==='r'?-1:1,other=side==='r'?'l':'r';
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const ankle=new Vector3(sign*.15,.1,.4),q=new Quaternion(),center=new Vector3();
 const feet={
  [side]:{phase:.10,p:ankle,q},
  [other]:{phase:.60,p:new Vector3(-sign*.15,.15,-.1),q},
 };
 const planner=new RunTurnPlanner({heading:0,feet,center,toeAxes:{r:new Vector3(0,0,1),l:new Vector3(0,0,1)},contactGeometry:{r:geometry,l:geometry}});
 const phase=p=>(p+(side==='l'?.5:0))%1,hip=new Vector3(sign*.15,.85,0);
 const options={dt:1/120,center,rootYaw:0,scale:1,amplitude:.3};
 planner.begin({...options,angle:0,sourceHeading:0,phase:phase(.10)});
 planner.place(side,ankle.clone(),q.clone(),{hip,reach:1});
 let smallest=Infinity;
 for(let i=1;i<=30;i++){
  planner.begin({...options,angle:sign*.7,sourceHeading:sign*.7,phase:phase(.10+i*.004)});
  const target=ankle.clone();planner.place(side,target,q.clone(),{hip,reach:1});
  const lane=sign*target.clone().sub(center).dot(new Vector3(Math.cos(planner.heading),0,-Math.sin(planner.heading)));
  smallest=Math.min(smallest,lane);
  assert.ok(planner.feet[side].anchor,'This regression must remain in supporting contact.');
  assert.ok(lane>=.08-1e-7,`The pivot crossed its supporting leg lane: ${lane}`);
 }
 assert.ok(Math.abs(planner.feet[side].pivotTurn)>0.01,'The test must exercise an actual pivot.');
 assert.ok(smallest<.085,'The turn must reach the lane constraint.');
});
