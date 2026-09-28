/** Native model metres; excludes the runtime scale of 1.1.
 * Candidate (only after bake completion):
 *   node --test tests/native-ronin-wide-stance.test.js
 * Baseline sensitivity check:
 *   RONIN_MODEL_DIR=/tmp/ninja-roster-before-137b930 RONIN_EXPECT_BASELINE=1 node --test tests/native-ronin-wide-stance.test.js
 * Optional RONIN_MOTION_FILE and RONIN_STANCE_REPORT override metadata/report paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {fileURLToPath} from 'node:url';
import {loadNativeSkin} from './native-skin-helper.mjs';
const cwd=fileURLToPath(new URL('..',import.meta.url)),directory=process.env.RONIN_MODEL_DIR||cwd+'/public/models';
const localMotion=path.join(directory,'motion-data.json');
const motionFile=process.env.RONIN_MOTION_FILE||(fs.existsSync(localMotion)?localMotion:cwd+'/src/motion-data.json');
const motions=JSON.parse(fs.readFileSync(motionFile)),names=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'];
const RATE=240,EPS=.001,baseline=process.env.RONIN_EXPECT_BASELINE==='1';
const reportFile=process.env.RONIN_STANCE_REPORT||(baseline?'/tmp/ninja-ronin-wide-stance-baseline.json':'/tmp/ninja-ronin-wide-stance-candidate.json');
function point(g,name){return g.scene.getObjectByName(name).getWorldPosition(new T.Vector3());}
function pose(g){
 const feet={r:point(g,'foot_r'),l:point(g,'foot_l')},hips={r:point(g,'thigh_r'),l:point(g,'thigh_l')};
 const height=(hips.r.y+hips.l.y)/2,legs={};
 for(const side of ['r','l']){
  const knee=point(g,'calf_'+side),upper=hips[side].distanceTo(knee),lower=knee.distanceTo(feet[side]);
  legs[side]={reach:hips[side].distanceTo(feet[side])/(upper+lower),flex:180-hips[side].clone().sub(knee).angleTo(feet[side].clone().sub(knee))*180/Math.PI};
 }
 return{width:Math.abs(feet.r.x-feet.l.x),depth:Math.abs(feet.r.z-feet.l.z),hipHeight:height,legs,feet};
}
test('Ronin uses a wide, loaded, reachable stance at every authored impact',async t=>{
 const g=await loadNativeSkin(path.join(directory,'ronin.glb')),reports=[],failures=[];
 for(const sourceName of names){
  const name=!baseline&&sourceName==='Heavy_Cleave'?'Ronin_Heavy_Cleave':sourceName;
  const clip=g.animations.find(c=>c.name===name),spec=motions[name];assert.ok(clip&&spec?.impacts?.length,`${name}: missing native clip or impact metadata`);
  assert.ok(spec.footPlants?.r&&spec.footPlants?.l,`${name}: missing support intervals`);
  g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  const evaluate=time=>{action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);return pose(g);};
  const heavy=name.includes('Heavy_'),nativeCleave=name==='Ronin_Heavy_Cleave',row={name,impacts:[],maxReach:0,minFlex:180,maxFlex:0,maxSupportDrift:0,maxSupportTurn:0};
  const fail=(kind,details)=>failures.push({name,kind,...details});
  for(const time of spec.impacts){
   const p=evaluate(time);delete p.feet;row.impacts.push({time,...p});
   const minimumWidth=nativeCleave?.40:heavy?.80:.60;
   if(p.width<minimumWidth-EPS)fail('impact width',{time,actual:p.width,minimum:minimumWidth});
   if(nativeCleave&&p.width>.65)fail('cleave becomes a lateral squat',{time,actual:p.width,maximum:.65});
   const minimumDepth=nativeCleave?.30:heavy?.45:.22;
   if(p.depth<minimumDepth-EPS)fail('impact fore/aft span',{time,actual:p.depth,minimum:minimumDepth});
   const maximumHeight=nativeCleave?.87:.70;
   if(heavy&&p.hipHeight>maximumHeight+EPS)fail('heavy hips too high',{time,actual:p.hipHeight,maximum:maximumHeight});
   for(const side of ['r','l']){
    if(p.legs[side].flex<25||p.legs[side].flex>115)fail('impact knee flex',{time,side,actual:p.legs[side].flex,range:[25,115]});
    if(p.legs[side].reach>.977)fail('impact leg near full extension',{time,side,actual:p.legs[side].reach,maximum:.977});
   }
   if(!['r','l'].every(side=>spec.footPlants[side].some(([a,b])=>time>=a-1e-6&&time<=b+1e-6)))fail('impact lacks two planted feet',{time});
  }
  const references=new Map();
  for(let frame=0;frame<=Math.floor(clip.duration*RATE);frame++){
   const time=frame/RATE,p=evaluate(time);
   for(const side of ['r','l']){
    row.maxReach=Math.max(row.maxReach,p.legs[side].reach);row.minFlex=Math.min(row.minFlex,p.legs[side].flex);row.maxFlex=Math.max(row.maxFlex,p.legs[side].flex);
    for(const [index,[start,end]]of spec.footPlants[side].entries()){
     // Stay clear of the landing boundary; inspect actual support matrices.
     if(time<start+.012||time>end-.012)continue;
     const key=side+index,rotation=g.scene.getObjectByName('foot_'+side).getWorldQuaternion(new T.Quaternion()).normalize();
     if(!references.has(key))references.set(key,{position:p.feet[side].clone(),rotation});
     const ref=references.get(key);row.maxSupportDrift=Math.max(row.maxSupportDrift,ref.position.distanceTo(p.feet[side]));row.maxSupportTurn=Math.max(row.maxSupportTurn,ref.rotation.angleTo(rotation));
    }
   }
  }
  if(row.maxReach>.99)fail('whole-clip leg reach',{actual:row.maxReach,maximum:.99});
  if(row.minFlex<12||row.maxFlex>125)fail('whole-clip knee flex',{range:[row.minFlex,row.maxFlex],allowed:[12,125]});
  if(row.maxSupportDrift>.003)fail('support slides',{actual:row.maxSupportDrift,maximum:.003});
  if(row.maxSupportTurn>.02)fail('support twists',{actual:row.maxSupportTurn,maximum:.02});
  reports.push(row);
 }
 const report={modelDirectory:directory,motionFile,sampleRate:RATE,units:'native metres',baseline,clips:reports,failures};fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
 t.diagnostic(`Detailed native stance report: ${reportFile}`);
 if(baseline){
  // Demonstrate that the old narrow stance cannot satisfy the new requirements.
  const narrow=new Set(failures.filter(f=>f.kind==='impact width').map(f=>f.name));assert.equal(narrow.size,8,'Baseline must fail the intended width requirement in every clip');
  const high=new Set(failures.filter(f=>f.kind==='heavy hips too high').map(f=>f.name));assert.ok(high.size>=1,'Baseline should expose at least one high heavy impact');
 }else assert.deepEqual(failures,[],JSON.stringify(failures,null,2));
});
