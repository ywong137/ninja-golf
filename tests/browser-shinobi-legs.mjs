import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 if(process.env.NINJA_SHINOBI_CANDIDATE){
  const candidate=process.env.NINJA_SHINOBI_CANDIDATE;
  const records={...JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))),...JSON.parse(fs.readFileSync(candidate+'.json'))};
  const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(records)+';');
  await page.route('**/src/motion.js*',r=>r.fulfill({contentType:'application/javascript',body:source}));
  await page.route('**/models/shinobi.glb?*',r=>r.fulfill({path:candidate+'.glb'}));
 }
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions}=await import('/src/motion.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs');await loadWarriorAssets();
 const rows=[];
 for(const hz of [40,60,120])for(const slope of [0,.10,-.10])for(const mode of ['musou','Loop','Impact','Break',0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4,-3*Math.PI/4,-Math.PI/4]){
 const w=new Warrior(1),b=w.bones,saved=[];for(const [bone,rest]of w.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}w.root.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),walking=typeof mode==='number',name=walking?'Twin_Guard_Walk_Forward':mode==='musou'?'Twin_Musou_Flow':'Twin_Guard_'+mode,spec=motions[name],groundHeight=(x,z)=>slope*(x+z),row={hz,slope,mode,name,hip:0,ankle:0,hinge:0,drift:0};
 for(const[bone,p,q,s]of saved){bone.position.copy(p);bone.quaternion.copy(q);bone.scale.copy(s);}let time=0;for(let i=0;i<30;i++){time+=1/hz;w.update(time,1/hz,{groundHeight});}
 const action={token:Math.random(),kind:'musou',step:0,time:0,duration:spec.duration},anchors={},duration=walking?spec.duration*3:spec.duration,holds={};
 let previousFeet=null;row.walkDrift=0;row.stopFootSpeed=0;
 for(let i=0;i<Math.ceil((duration+.5)*hz);i++){
  time+=1/hz;action.time+=1/hz;const inside=action.time<duration;
  const inputs=walking?{blocking:true,moving:inside,focused:true,moveAngle:mode,moveSpeed:inside?2.3:0}:mode==='musou'?{action:inside?action:null}:mode==='Loop'?{blocking:inside}:mode==='Impact'?{blocking:inside,guardHitToken:inside?1:0}:{guardBreak:inside?1:0};
  if(walking&&inside){w.root.position.x+=Math.sin(mode)*2.3/hz;w.root.position.z+=Math.cos(mode)*2.3/hz;w.root.position.y=groundHeight(w.root.position.x,w.root.position.z);}
  w.update(time,1/hz,{groundHeight,...inputs});w.root.updateMatrixWorld(true);
  if(action.time<spec.duration-.04 && action.time>.12 && !walking && w.current!==name)throw Error('Wrong clip '+w.current+' expected '+name);
  for(const side of ['r','l']){const a=measureLegAnatomy(cal[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]);row.hip=Math.max(row.hip,Math.abs(a.hipTwist));row.ankle=Math.max(row.ankle,Math.abs(a.ankleTwist));row.hinge=Math.max(row.hinge,a.kneeDeviation);
   if(walking&&inside){
    const phase=(w.guardWalkPhase+(side==='r'?.25:.75))%1,expected=phase<.5?1:phase<.6?1-T.MathUtils.smoothstep(phase,.5,.6):T.MathUtils.smoothstep(phase,.9,1),actual=w.footPlacement.report.feet.find(f=>f.side===side).weight;
    if(Math.abs(actual-expected)>1e-8)throw Error('Guard contacts lost the gait phase');
    // Also measure the foot itself; the contact formula alone cannot prove support.
    const ankle=b['foot_'+side].getWorldPosition(new T.Vector3());
    if(action.time>.35&&phase>.08&&phase<.42){holds[side]??=ankle.clone();row.walkDrift=Math.max(row.walkDrift,ankle.distanceTo(holds[side]));}else holds[side]=null;
   }
   if(!walking&&w.current===name)for(const[j,[from,to]]of (spec.footPlants?.[side]??[]).entries()){if(action.time<Math.max(.12,from+.04)||action.time>to-.04)continue;const pos=b['foot_'+side].getWorldPosition(new T.Vector3()),key=side+j;anchors[key]??=pos;row.drift=Math.max(row.drift,pos.distanceTo(anchors[key]));}
  }
  if(walking){const feet=['r','l'].map(side=>b['foot_'+side].getWorldPosition(new T.Vector3()));if(!inside&&previousFeet)for(let j=0;j<2;j++)row.stopFootSpeed=Math.max(row.stopFootSpeed,feet[j].distanceTo(previousFeet[j])*hz);previousFeet=feet;}
 }
 rows.push(row);w.dispose();
 }
 return rows;
 });
 fs.writeFileSync('/tmp/ninja-shinobi-legs-runtime.json',JSON.stringify({errors,report},null,2));
 assert.deepEqual(errors,[]);assert.equal(report.length,108);
 for(const row of report){assert.ok(row.hip<50&&row.ankle<22&&row.hinge<.1&&row.drift<.004&&row.walkDrift<.03&&row.stopFootSpeed<6,JSON.stringify(row));}
 console.log(JSON.stringify({cases:report.length,...Object.fromEntries(['hip','ankle','hinge','drift'].map(k=>[k,Math.max(...report.map(r=>r[k]))]))}));
}finally{await browser.close();}
