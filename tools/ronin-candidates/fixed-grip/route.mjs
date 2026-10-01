import fs from 'node:fs';
import path from 'node:path';
import {routeMotionCandidate} from '../../route-motion-candidate.mjs';
export async function routeFixedGripCandidate(page,directory){
 const file=name=>path.join(directory,name);
 await routeShoulder(page);
 await routeMotionCandidate(page,{hero:0,model:file('ronin.glb'),motionRecord:file('motion.json'),readyRecord:file('ready.json'),replaceClip:'Ronin_Heavy_Cleave'});
 const profiles=JSON.parse(fs.readFileSync(file('grips.json')));
 await page.route('**/src/grip-data.json*',route=>route.fulfill({contentType:'application/javascript',body:'export default '+JSON.stringify(profiles)+';'}));
 await page.route('**/src/weapons.js*',async route=>{
  const response=await route.fetch(),original=await response.text();
  const radius="['jian','dao','wakizashi'].includes(kind)?",length=/curve:\s*\.16,\s*grip:\s*\.34/;
  if(!original.includes(radius)||!length.test(original))throw Error('The weapon source changed. Review the candidate handle route.');
  const body=original.replace(radius,"['jian','dao','wakizashi','odachi'].includes(kind)?").replace(length,'curve:.16,grip:.27');
  await route.fulfill({response,body});
 });
 return profiles;
}
// Candidate-only deformation. Neither the published actor nor its asset changes.
async function routeShoulder(page){
 await page.route('**/src/actors.js*',async route=>{
  const response=await route.fetch();let body=await response.text();
  const installation=/upperArms:\s*WARRIORS\[type\]\.model\s*===\s*['"]kaede['"]\s*\?\s*\[['"]r['"]\]\s*:\s*\[\]/;
  const golf=/if\s*\(this\.forearmTwist\.upperArmHelpers\.r\)/;
  const finalWeight=/weight\s*=\s*Math\.min\(1,\s*weight\);/;
  if(!installation.test(body)||!golf.test(body)||!finalWeight.test(body))throw Error('The actor changed; review the candidate shoulder route.');
  body=body.replace(installation,"upperArms:['kaede','ronin'].includes(WARRIORS[type].model)?['r']:[],overflow:WARRIORS[type].model==='ronin'?'nearest':'reject'");
  body=body.replace(golf,'if(this.type!==0&&this.forearmTwist.upperArmHelpers.r)');
  body=body.replace(finalWeight,`if(this.type===0){for(const action of [this.actions.get('Ronin_Heavy_Cleave'),this.repeatActions?.get('Ronin_Heavy_Cleave')])if(action?.isScheduled())weight+=THREE.MathUtils.clamp(action.getEffectiveWeight(),0,1)*THREE.MathUtils.smoothstep(action.time,.40,.46)*(1-THREE.MathUtils.smoothstep(action.time,.58,.66));}weight=Math.min(1,weight);`);
  await route.fulfill({response,body});
 });
}
