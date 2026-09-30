import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {RunTurnPlanner} from '../src/run-turn-planner.js';

const options=(phase,angle=135*Math.PI/180)=>({angle,phase,dt:1/240,sourceHeading:45*Math.PI/180,center:new Vector3(),rootYaw:0,scale:1,amplitude:.25});
const pose=(planner,side,p=new Vector3(-.2,.1,0),q=new Quaternion())=>{planner.place(side,p,q);return{p,q};};

test('loaded feet retain their location and orientation during a turn',()=>{
 const planner=new RunTurnPlanner();planner.begin(options(.01));const first=pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
 const support=planner.feet.r.support;
 for(let i=1;i<20;i++){
  const args=options(.01+i*.005,(135-i)*Math.PI/180);args.center.x=i*.002;
  planner.begin(args);const result=pose(planner,'r',new Vector3(-.7,.1,.4),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1));pose(planner,'l',new Vector3(.3,.2,0));
  assert.equal(planner.feet.r.support,support,'A step changed its support duration');
  assert.ok(result.p.distanceTo(first.p)<1e-10);assert.ok(result.q.angleTo(first.q)<1e-7);
 }
});

test('release and touchdown retain the previous shoe pose',()=>{
 const planner=new RunTurnPlanner();planner.begin(options(.27));const first=pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
 planner.begin(options(.281));const released=pose(planner,'r',new Vector3(-.4,.2,.2),new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.7));pose(planner,'l',new Vector3(.2,.1,0));
 assert.ok(released.q.angleTo(first.q)<1e-7,'Release changes shoe rotation');
 assert.ok(released.p.distanceTo(first.p)<1e-5,'Release changes the ankle position');
 planner.begin(options(.999));const last=pose(planner,'r',new Vector3(-.3,.1,.1));pose(planner,'l',new Vector3(.2,.1,0));
 planner.begin(options(.001,175*Math.PI/180));const landed=pose(planner,'r',new Vector3(-.9,.1,-.5),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.9));pose(planner,'l',new Vector3(.2,.1,0));
 assert.ok(landed.p.distanceTo(last.p)<1e-8,'Landing snaps to a new plan');assert.ok(landed.q.angleTo(last.q)<1e-7);
});

test('a released foot cannot land again before its phase wraps',()=>{
 const planner=new RunTurnPlanner({heading:0});let wasAirborne=false,contacts=0;
 for(let i=0;i<240;i++){
  const phase=i/240,angle=i<80?Math.PI*.61:Math.PI;
  planner.begin(options(phase,angle));pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
  const supported=planner.contacts().stance.r;
  if(wasAirborne&&supported)contacts++;if(!supported)wasAirborne=true;
 }
 assert.equal(contacts,0,'One cycle contained a second landing');
});

test('hip branch hysteresis avoids repeated turns and routes them through the front',()=>{
 const planner=new RunTurnPlanner({heading:95*Math.PI/180});
 planner.begin(options(0,115*Math.PI/180));assert.equal(planner.back,true);
 for(let i=0;i<300;i++){
  const angle=(i%2?103:109)*Math.PI/180;
  planner.begin(options((i/240)%1,angle));pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
  assert.equal(planner.back,true);assert.ok(Math.abs(planner.localHeading)<=95*Math.PI/180+1e-8);
 }
 planner.begin(options(.3,90*Math.PI/180));assert.equal(planner.back,false);
});

test('an emergency release at phase zero keeps finite swing targets',()=>{
 const planner=new RunTurnPlanner();planner.begin(options(0));pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
 const args=options(0);args.center.x=2;planner.begin(args);
 assert.equal(planner.feet.r.support,0);
 assert.ok(Number.isFinite(planner.travel('r'))&&Number.isFinite(planner.animationPhase('r')));
 const result=pose(planner,'r');assert.ok(result.p.toArray().every(Number.isFinite));
});

test('a new landing does not reuse the previous contact reach velocity',()=>{
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const planner=new RunTurnPlanner({contactGeometry:{r:geometry,l:geometry}});
 planner.begin(options(.99));pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
 planner.feet.r.supportDistance=.2;
 planner.begin(options(.01));
 planner.place('r',new Vector3(-.2,.1,0),new Quaternion(),{hip:new Vector3(-.15,.85,0),reach:.95});
 assert.ok(planner.feet.r.anchor,'A reachable landing released because it inherited stale approach velocity');
 assert.ok(planner.feet.r.support>.1);
});
