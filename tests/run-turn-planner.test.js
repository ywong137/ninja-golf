import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {RunTurnPlanner} from '../src/run-turn-planner.js';
import {recoveryWeight} from '../src/leg-recovery.js';
import {RunEntryFlight} from '../src/run-entry-flight.js';

const options=(phase,angle=135*Math.PI/180)=>({angle,phase,dt:1/240,sourceHeading:45*Math.PI/180,center:new Vector3(),rootYaw:0,scale:1,amplitude:.25});
const pose=(planner,side,p=new Vector3(-.2,.1,0),q=new Quaternion())=>{planner.place(side,p,q);return{p,q};};

test('collecting steps preserve initial cadence and approach running without a rate jump',()=>{
 for(const initial of [1.8,3.2])for(const hz of [40,120]){
  const planner=new RunTurnPlanner({contactEntry:true});planner.cadence=initial;
  assert.equal(planner.advanceCadence(3,0),initial);
  for(const landings of [0,1,2]){
   planner.entryLandings=landings;const previous=planner.cadence;
   const average=planner.advanceCadence(3,1/hz);
   assert.ok(Math.abs(planner.cadence-previous)<=4/hz+1e-10);
   assert.ok(average>=Math.min(previous,planner.cadence)-1e-10&&average<=Math.max(previous,planner.cadence)+1e-10);
   if(landings===0)assert.ok(Math.abs(planner.cadence-1/.48)<Math.abs(initial-1/.48),
    'A fast walking cadence must not persist through the longer collecting stride.');
  }
 }
});

test('planned and actual collecting contacts shorten during lateral travel',()=>{
 for(const direction of [0,Math.PI,Math.PI/2,-Math.PI/2]){
  const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:.99},l:{p:new Vector3(.2,.1,0),q:new Quaternion(),phase:.49}};
  const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactEntry:true});
  Object.assign(planner,{phase:.99,travelHeading:direction});
  const expected=planner.landingSupport('r',0),lateral=Math.abs(Math.sin(direction))>.5;
  if(lateral)assert.ok(expected<.5,'A lateral collecting contact must release earlier than a straight step.');
  else assert.ok(Math.abs(expected-.5)<1e-10,'Straight walking support must remain unchanged.');
  planner.begin({...options(.01,direction),dt:0,sourceHeading:0,movementHeading:direction,focused:true});
  assert.ok(Math.abs(planner.feet.r.support-expected)<1e-10,'Landing changed the support duration used to plan its footprint.');
 }
});

test('a reachable late-flight endpoint does not follow the root before contact',()=>{
 const endpoint=new Vector3(-.2,.1,.62),shoe=new Quaternion();
 const samples=[];
 for(const centerZ of [0,.015,.03]){
  const planner=new RunTurnPlanner({heading:0,contactEntry:true});
  Object.assign(planner,{phase:.97,scale:1,entryWeight:1,center:new Vector3(0,0,centerZ)});
  planner.feet.r={support:.28,release:.28};
  const hip=new Vector3(-.13,.65,centerZ),target=endpoint.clone();
  assert.ok(hip.distanceTo(target)<.9,'The fixture must stay within the anatomical reach.');
  planner.limitFlightTarget('r',target,shoe,.97,{hip,reach:1});
  samples.push(target);
 }
 assert.ok(samples.every(p=>p.distanceTo(samples[0])<1e-10),'A body-relative stride limit moved the otherwise reachable landing.');
 assert.ok(samples[0].distanceTo(endpoint)<.003,'The landing moved substantially before contact.');
});

test('a leading footprint stays loaded until travel passes and leaves it behind',()=>{
 const footprint=new Vector3(-.16,.1,.58),velocity={x:0,z:2.5};
 const feet={r:{p:footprint,q:new Quaternion(),phase:.001},l:{p:new Vector3(.2,.2,0),q:new Quaternion(),phase:.501}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactEntry:true});
 const motionPrediction={source:velocity,wanted:velocity,time:0,duration:.2};
 planner.begin({...options(.015,0),dt:1/144,sourceHeading:0,motionPrediction});
 assert.equal(planner.feet.r.support,.5,'An approaching footprint lost its support after touchdown.');
 assert.equal(planner.supportDeadline(planner.feet.r,.1),.1,'The forecast discards an approaching footprint.');
 const trailing=new Vector3(0,0,1.1);
 assert.equal(planner.beyondSupportRadius(footprint,trailing),true,'A receding footprint must still release.');
 const outward=Math.sqrt(.48**2-.16**2);
 assert.ok(Math.abs(planner.supportDeadline(planner.feet.r,.6)-(.58+outward)/2.5)<3e-6,'The forecast must retain the leading support until travel passes its outgoing radius.');
});

test('a free reversal keeps one world target through backward and forward clip changes',()=>{
 for(const rate of [40,144]){
  const planner=new RunTurnPlanner({heading:0,contactEntry:true});let previous=0;
  for(let i=0;i<=rate;i++){
   const yaw=Math.min(Math.PI,i/rate*3*Math.PI),angle=Math.PI-yaw;
   planner.begin({...options((i/rate*1.7)%1,angle),dt:1/rate,rootYaw:yaw,sourceHeading:Math.min(angle,Math.PI/2)*85/90,movementHeading:Math.PI});
   assert.ok(Math.abs(planner.desiredHeading-Math.PI)<1e-10,'The root-relative clip choice changed the world target.');
   assert.ok(planner.heading>=previous-1e-10,'The pelvis reversed direction during one continuous turn.');
   previous=planner.heading;
  }
  assert.ok(Math.abs(planner.heading-Math.PI)<1e-10);
 }
});

test('focused backward movement retains a forward-facing pelvis without a heading jump',()=>{
 const planner=new RunTurnPlanner({heading:0,contactEntry:true});let previous=0;
 for(let i=0;i<=180;i++){
  const angle=i*Math.PI/180;
  planner.begin({...options(i/181,angle),movementHeading:angle,focused:true});
  assert.ok(Math.abs(planner.desiredHeading-previous)<.05,'Focused steering jumped between backward and forward branches.');
  assert.ok(Math.abs(planner.desiredHeading)<=85*Math.PI/180+1e-10);
  previous=planner.desiredHeading;
 }
 assert.ok(Math.abs(planner.desiredHeading)<1e-10,'Backpedaling turned the pelvis away from the facing direction.');
});

test('landing heading respects the current support pivot rate and budget',()=>{
 const planner=new RunTurnPlanner({heading:0,contactEntry:true});
 Object.assign(planner,{desiredHeading:Math.PI,travelHeading:0,phase:.1,cadence:2,distanceCadence:2,entryLandings:2,support:.28});
 planner.feet.r={anchor:new Vector3(),support:.4,pivotTurn:20*Math.PI/180};
 planner.feet.l={support:.28};
 const budget=5*Math.PI/180;
 assert.ok(Math.abs(planner.predictHeading(.1)-budget)<1e-10,'A loaded pivot forecast exceeded its remaining turn budget.');
 assert.ok(Math.abs(planner.predictHeading(.3)-(budget+6*.05+3*.1))<1e-10,'The forecast missed the opposite foot landing after the free turn.');
});

test('a lateral step lifts before the pelvis crosses its planted footprint',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const footprint=new Vector3(-.2,.1,0);
 const feet={r:{p:footprint,q:new Quaternion(),phase:.04},l:{p:new Vector3(.2,.25,0),q:new Quaternion(),phase:.54}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 const velocity={x:-2.5,z:0};
 planner.begin({...options(.05,0),sourceHeading:0,groundHeight:()=>0,motionPrediction:{source:velocity,wanted:velocity,time:0,duration:.2}});
 const target=new Vector3(-.2,.1,.3),shoe=new Quaternion();
 planner.place('r',target,shoe,{hip:new Vector3(-.12,.83,0),reach:.95});
 assert.equal(planner.feet.r.releaseType,'lane','The foot waited until the body crossed over it.');
 assert.equal(planner.feet.r.release,.05);
 assert.ok(target.distanceTo(footprint)<1e-10,'Early release slid the planted footprint.');
 planner.begin({...options(.07,0),sourceHeading:0,groundHeight:()=>0,motionPrediction:{source:velocity,wanted:velocity,time:0,duration:.2}});
 planner.place('r',target,shoe,{hip:new Vector3(-.12,.83,0),reach:.95});
 assert.ok(planner.gap('r',target,shoe)>.001,'Early release did not start lifting the shoe.');
});

test('landing heading includes a support lost to root travel before nominal liftoff',()=>{
 const planner=new RunTurnPlanner({heading:0,contactEntry:true}),velocity={x:0,z:5.6};
 Object.assign(planner,{desiredHeading:Math.PI,travelHeading:0,phase:.1,cadence:2,distanceCadence:2,entryLandings:2,support:.28,scale:1,center:new Vector3(),motionPrediction:{source:velocity,wanted:velocity,time:0,duration:.2}});
 planner.feet.r={anchor:new Vector3(0,.1,0),support:.9,pivotTurn:0};planner.feet.l={support:.28};
 const release=.48/5.6;
 assert.ok(Math.abs(planner.supportDeadline(planner.feet.r,.4)-release)<3e-6);
 assert.ok(Math.abs(planner.predictHeading(.2)-(3*release+6*(.2-release)))<1e-5,'The forecast retained an unreachable support pivot.');
});

test('an unfinished collection forecasts its known acceleration before it starts',()=>{
 const planner=new RunTurnPlanner({heading:0,contactEntry:true});
 planner.cadence=1/.48;
 const prediction={source:{x:0,z:2.52},wanted:{x:0,z:5.6},time:0,duration:.2,pending:true};
 for(const rate of [40,144]){
  planner.begin({...options(.15,0),sourceHeading:0,dt:1/rate,motionPrediction:prediction});
  const continuous=(1-.65)*.48,delay=-planner.motionPrediction.time;
  assert.ok(delay>=continuous-1e-10&&delay<continuous+1/rate,'Pending acceleration must start at the next landing frame.');
  assert.equal(planner.motionPrediction.wanted.z,5.6,'The forecast lost the full requested running speed.');
 }
 planner.entryLandings=1;
 planner.begin({...options(.16,0),sourceHeading:0,motionPrediction:prediction});
 assert.ok(planner.motionPrediction.time===0,'A completed collection still delayed acceleration.');
});

test('a short support does not release for a crossing after its scheduled liftoff',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const footprint=new Vector3(-.2,.1,0);
 const feet={r:{p:footprint,q:new Quaternion(),phase:.19},l:{p:new Vector3(.2,.25,0),q:new Quaternion(),phase:.69}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 Object.assign(planner,{entryLandings:2,cadence:2,distanceCadence:2});planner.feet.r.support=.28;
 const velocity={x:-2.5,z:0};
 planner.begin({...options(.2,0),sourceHeading:0,groundHeight:()=>0,motionPrediction:{source:velocity,wanted:velocity,time:0,duration:.2}});
 const target=footprint.clone();
 planner.place('r',target,new Quaternion(),{hip:new Vector3(-.12,.83,0),reach:.95});
 assert.ok(planner.feet.r.anchor,'A crossing after scheduled liftoff discarded a valid support.');
 assert.ok(target.distanceTo(footprint)<1e-10,'The contact moved to retain support.');
});

test('reach prediction ends at scheduled liftoff for native and transferred steps',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 for(const contactEntry of [false,true])for(const support of [.1,.28]){
  const footprint=new Vector3(-.2,.1,0),dt=1/120;
  const feet={r:{p:footprint,q:new Quaternion(),phase:.05},l:{p:new Vector3(.2,.25,0),q:new Quaternion(),phase:.55}};
  const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry});
  Object.assign(planner,{entryLandings:2,cadence:3.6,distanceCadence:3.6});
  const hip=new Vector3(-.2,.89,.2);
  Object.assign(planner.feet.r,{support,rollStart:.08,lastHip:hip.clone().add(new Vector3(0,0,-8*dt))});
  planner.begin({...options(.08,0),dt,sourceHeading:0,groundHeight:()=>0});
  const target=footprint.clone();planner.place('r',target,new Quaternion(),{hip,reach:.86});
  if(support===.1){
   assert.ok(planner.feet.r.anchor,'A reach violation after scheduled liftoff discarded valid support');
   assert.ok(target.distanceTo(footprint)<1e-10,'Keeping a short support moved its footprint');
  }else{
   assert.equal(planner.feet.r.anchor,null,'A reach violation before liftoff must still release support');
   assert.equal(planner.feet.r.releaseType,'reach');
  }
 }
});

test('an attack exit collects the trailing foot before lengthening the stride',()=>{
 for(const rate of [40,144]){
  const dt=1/rate,geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
  const feet={r:{p:new Vector3(-.2,.1,.31),q:new Quaternion(),phase:0},l:{p:new Vector3(.2,.22,-.41),q:new Quaternion(),phase:.5}};
  const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
  let phase=0,time=0,firstLanding=null,secondLanding=null,previousCadence=null;
  for(let i=0;i<Math.ceil(.7*rate);i++){
   time+=dt;const cadence=planner.advanceCadence(.9,dt);
   if(previousCadence!==null)assert.ok(Math.abs(cadence-previousCadence)<=4*dt+1e-10,'Cadence jumped after collection.');
   phase=(phase+cadence*dt)%1;
   const center=new Vector3(0,0,time*2.52),amplitude=2.52*.28/(2*cadence);
   planner.begin({...options(phase,0),dt,sourceHeading:0,center,amplitude,groundHeight:()=>0});
   for(const side of ['r','l']){
    const sign=side==='r'?-1:1,hip=center.clone().add(new Vector3(sign*.12,.83,0));
    planner.place(side,center.clone().add(new Vector3(sign*.2,.1,0)),new Quaternion(),{hip,reach:.96});
   }
   if(planner.collecting)assert.ok(planner.feet.r.anchor,'A reachable source contact released before collection landed.');
   if(planner.entryLandings>=1)firstLanding??=time;
   if(planner.entryLandings>=2)secondLanding??=time;
   previousCadence=cadence;
  }
  assert.ok(Math.abs(firstLanding-.24)<=dt+1e-10,`${rate} Hz first landing: ${firstLanding}`);
  assert.ok(Math.abs(secondLanding-.48)<=dt+1e-10,`${rate} Hz second landing: ${secondLanding}`);
  assert.equal(planner.collecting,false);
 }
});

test('only the next collecting landing receives the long support interval',()=>{
 const planner=new RunTurnPlanner({heading:0,contactEntry:true});
 Object.assign(planner,{phase:.1,travelHeading:0});
 assert.equal(planner.landingSupport('l'),.5,'The first collecting landing lost its support.');
 assert.equal(planner.landingSupport('r'),.28,'The second landing incorrectly forecast another collecting support.');
 planner.entryLandings=1;planner.phase=.6;
 assert.equal(planner.landingSupport('r'),.28);
 assert.equal(planner.landingSupport('l'),.28);
});

test('recovery rotation uses the actual departure clock',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:.26},l:{p:new Vector3(.2,.2,0),q:new Quaternion(),phase:.76}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 planner.feet.r.support=.28;
 planner.begin({...options(.32,0),sourceHeading:0,groundHeight:()=>0});
 planner.place('r',new Vector3(-.2,.15,.1),new Quaternion());
 assert.equal(planner.feet.r.release,.32);
 assert.equal(recoveryWeight(planner.recoveryPhase('r')),0,'The shoe unfolded before its lift began.');
 planner.begin({...options(.36,0),sourceHeading:0,groundHeight:()=>0});
 planner.place('r',new Vector3(-.2,.2,.2),new Quaternion());
 assert.ok(recoveryWeight(planner.recoveryPhase('r'))>0,'Recovery did not start after departure.');
});

test('ordinary running retains its distance-driven cadence',()=>{
 const planner=new RunTurnPlanner();
 for(const rate of [.1,.75,1.7,2.8])assert.equal(planner.advanceCadence(rate,1/40),rate);
});

test('a loaded pivot can unwind after reaching its turn limit',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:.06},l:{p:new Vector3(.2,.25,.1),q:new Quaternion(),phase:.56}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 planner.begin({...options(.06,0),sourceHeading:0});
 planner.place('r',feet.r.p.clone(),feet.r.q.clone(),{hip:new Vector3(-.2,.85,0),reach:.95});
 planner.feet.r.pivotTurn=25*Math.PI/180;
 planner.begin({...options(.065,0),sourceHeading:.5});
 assert.equal(planner.heading,0,'The pivot exceeded its positive limit.');
 planner.begin({...options(.07,0),sourceHeading:-.5});
 assert.ok(planner.heading<0,'The foot could not turn back from its positive limit.');
 assert.ok(planner.feet.r.pivotTurn<25*Math.PI/180);
});

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

test('a new reachable landing retains a useful support interval',()=>{
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const planner=new RunTurnPlanner({contactGeometry:{r:geometry,l:geometry}});
 planner.begin(options(.99));pose(planner,'r');pose(planner,'l',new Vector3(.2,.1,0));
 planner.begin(options(.01));
 planner.place('r',new Vector3(-.2,.1,0),new Quaternion(),{hip:new Vector3(-.15,.85,0),reach:.95});
 assert.ok(planner.feet.r.anchor,'A reachable landing released immediately');
 assert.ok(planner.feet.r.support>.1);
});

test('a completed world footstep lands at the same position at different render rates',()=>{
 const positions=[],end=new Vector3(-.25,.1,.25);
 for(const rate of [40,144]){
  const flight=new RunEntryFlight({start:new Vector3(-.25,.1,-.3),velocity:new Vector3(),end,phase:.5,phaseRate:2});
  const previous=1-2/rate;
  const feet={r:{p:flight.sample(previous).p,q:new Quaternion(),phase:previous},l:{p:new Vector3(.25,.1,0),q:new Quaternion(),phase:previous-.5}};
  const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactEntry:true});
  Object.assign(planner.feet.r,{flight,release:.5});
  planner.age=.5-1/rate; // Compare the same elapsed transition time.
  planner.begin({...options(.001,0),dt:1/rate,sourceHeading:0});
  const result=pose(planner,'r').p;positions.push(result);
  assert.ok(result.distanceTo(end)<.002,'Touchdown stopped at an unfinished flight sample');
 }
 assert.ok(positions[0].distanceTo(positions[1])<1e-10,'The preceding frame changed the landing footprint');
});

test('transferred support retains its takeoff clock on the following frame',()=>{
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:.06},l:{p:new Vector3(.2,.25,.1),q:new Quaternion(),phase:.56}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 planner.feet.r.lastHip=new Vector3(-.2,.83,.15);
 planner.begin({...options(.10,0),dt:.025,sourceHeading:0,center:new Vector3(0,0,.29)});
 const departing=new Vector3(-.2,.1,.4),q=new Quaternion();
 planner.place('r',departing,q,{hip:new Vector3(-.2,.83,.29),reach:.88});
 assert.equal(planner.feet.r.release,.10,'The support decision must start the lift clock');
 const start=planner.feet.r.entryStart.clone();
 planner.begin({...options(.14,0),dt:.025,sourceHeading:0,center:new Vector3(0,0,.43)});
 const airborne=new Vector3(-.2,.12,.5),nextQ=new Quaternion();
 planner.place('r',airborne,nextQ,{hip:new Vector3(-.2,.83,.43),reach:.88});
 assert.equal(planner.feet.r.release,.10,'The following frame restarted the lift clock');
 assert.ok(planner.feet.r.entryStart.equals(start),'The held outgoing pose changed after release');
 const gap=Math.min(...points.map(p=>p.clone().applyQuaternion(nextQ).add(airborne).y));
 assert.ok(gap>.005,'The first airborne frame must already lift the foot');
});

test('a contact handover lifts the free shoe before adopting the new gait velocity',()=>{
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:0},l:{p:new Vector3(.2,.1,0),q:new Quaternion(),phase:.5}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 const update=(phase,target)=>{
  planner.begin({...options(phase,0),sourceHeading:0});const q=new Quaternion();planner.place('l',target,q);return{target,q};
 };
 const first=update(.01,new Vector3(.2,.2,-.25));
 const next=update(.02,new Vector3(.2,.25,-.1));
 const horizontal=Math.hypot(next.target.x-first.target.x,next.target.z-first.target.z);
 assert.ok(horizontal<.001,'A newly free foot immediately inherited native swing velocity');
 const gap=Math.min(...points.map(p=>p.clone().applyQuaternion(next.q).add(next.target).y));
 assert.ok(gap>.002,'The foot moved without clearing the floor');
});

test('a long outgoing support does not snap inward when radial swing limits engage',()=>{
 const feet={r:{p:new Vector3(-.2,.1,-.52),q:new Quaternion(),phase:.20},l:{p:new Vector3(.2,.25,.1),q:new Quaternion(),phase:.70}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3()});
 planner.begin({...options(.21,0),sourceHeading:0});
 const released=new Vector3(-.2,.15,-.3);planner.place('r',released,new Quaternion());
 assert.ok(released.distanceTo(feet.r.p)<1e-8,'The radial bound moved the departing footprint before lift');
});

test('an already airborne foot retains its incoming velocity when running starts',()=>{
 const dt=1/240,velocity=new Vector3(0,0,1.5),source=new Vector3(.2,.3,0);
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:0},l:{p:source,q:new Quaternion(),velocity,phase:.5}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactEntry:true});
 const positions=[];
 for(let i=1;i<=2;i++){
  planner.begin({...options(i*.005,0),sourceHeading:0,dt});
  const p=new Vector3(.2,.4,-.4+i*.05);planner.place('l',p,new Quaternion());positions.push(p);
 }
 const actual=positions[1].clone().sub(positions[0]).divideScalar(dt);
 assert.ok(Math.abs(actual.z-velocity.z)<.015,`Airborne entry lost its incoming velocity: ${actual.z}`);
 assert.ok(positions[0].z>0,'The incoming free foot must not freeze on the handover frame.');
});

test('transferred support stays on its world footprint while the body climbs',()=>{
 const groundHeight=(x,z)=>.12*z,normal=new Vector3(0,1,-.12).normalize();
 const q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),normal);
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const ankle=new Vector3(-.2,0,0);
 ankle.y-=Math.min(...points.map(p=>{const v=p.clone().applyQuaternion(q).add(ankle);return v.y-groundHeight(v.x,v.z);}));
 const feet={r:{p:ankle,q,phase:0},l:{p:new Vector3(.2,.2,0),q,phase:.5}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 const anchors={};
 for(let i=1;i<=15;i++){
  planner.begin({...options(i*.008,0),sourceHeading:0,center:new Vector3(0,i*.0024,i*.02),groundHeight});
  const p=new Vector3(-.2,.1+i*.0024,.3),shoe=q.clone();planner.place('r',p,shoe,{hip:new Vector3(-.2,.85+i*.0024,i*.02),reach:1});
  const side=planner.feet.r,contact=points[side.contact].clone().applyQuaternion(shoe).add(p);
  anchors[side.contact]??=contact.clone();
  assert.ok(contact.distanceTo(anchors[side.contact])<1e-9,'Changing the root floor moved a supporting contact.');
  assert.ok(Math.abs(planner.gap('r',p,shoe))<1e-9,'Support must stay on the actual slope.');
 }
});

test('an already raised incoming foot descends without adding another lift',()=>{
 const points=[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],geometry={points,up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:0},l:{p:new Vector3(.2,.32,0),q:new Quaternion(),phase:.5}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry},contactEntry:true});
 for(let i=1;i<=45;i++){
  planner.begin({...options(i*.01,0),sourceHeading:0,groundHeight:()=>0});
  const p=new Vector3(.2,.6,0);planner.place('l',p,new Quaternion());
  assert.ok(p.y<=.320001,`The incoming recovery added an unnecessary lift: ${p.y}`);
  assert.ok(p.y>=.1,'The incoming recovery entered the floor.');
 }
});

test('ordinary recovery uses its supporting-frame release clock for motion and lift',()=>{
 const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
 const feet={r:{p:new Vector3(-.2,.1,0),q:new Quaternion(),phase:.06},l:{p:new Vector3(.2,.2,0),q:new Quaternion(),phase:.56}};
 const planner=new RunTurnPlanner({heading:0,feet,center:new Vector3(),contactGeometry:{r:geometry,l:geometry}});
 planner.feet.r.lastHip=new Vector3(-.2,.83,.15);
 planner.begin({...options(.10,0),dt:.025,sourceHeading:0,center:new Vector3(0,0,.29)});
 const released=new Vector3(-.2,.1,.4);planner.place('r',released,new Quaternion(),{hip:new Vector3(-.2,.83,.29),reach:.8});
 assert.equal(planner.feet.r.release,.10);
 planner.begin({...options(.14,0),dt:.025,sourceHeading:0,center:new Vector3(0,0,.43)});
 const next=new Vector3(-.2,.12,.5),q=new Quaternion();planner.place('r',next,q,{hip:new Vector3(-.2,.83,.43),reach:.8});
 assert.equal(planner.feet.r.release,.10,'The first free frame restarted the departure clock.');
 assert.ok(planner.gap('r',next,q)>.005,'Ordinary recovery moved without clearing the ground.');
});
