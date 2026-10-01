import fs from 'node:fs';
import path from 'node:path';
import {routeMotionCandidate} from '../../route-motion-candidate.mjs';
export async function routeFixedGripCandidate(page,directory,{withDiagonal=false,withGuards=false,withReturn=false}={}){
 if(withReturn&&!withDiagonal)throw Error('The return route requires its first light cut.');
 const file=name=>path.join(directory,name);
 await routeShoulder(page);
 await routeMotionCandidate(page,{hero:0,model:file('ronin.glb'),motionRecord:file('motion.json'),readyRecord:file('ready.json'),replaceClip:'Ronin_Heavy_Cleave'});
 if(withDiagonal||withGuards){
  const source=name=>fs.readFileSync(new URL('../../../src/'+name,import.meta.url),'utf8');
  const motions=JSON.parse(source('motion-data.json'));
  for(const name of ['motion.json','ready.json',...(withDiagonal?['diagonal.json']:[]),...(withGuards?['guards.json']:[]),...(withReturn?['return.json']:[])])Object.assign(motions,JSON.parse(fs.readFileSync(file(name))));
  if(withGuards)for(const [name,record]of Object.entries(motions).filter(([name])=>name.startsWith('Odachi_Guard_'))){
   if(!record.fixedGripFrame||record.gripSpacing!==.12)throw Error('Missing fitted guard record: '+name);
  }
  await page.route('**/src/motion.js*',route=>route.fulfill({contentType:'application/javascript',body:source('motion.js').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';')}));
  if(withDiagonal){
   const diagonal=motions.Ronin_Cut_Diagonal;
   if(!diagonal?.fixedGripFrame||!(diagonal.duration>0)||diagonal.impacts?.length!==1)throw Error('The diagonal record needs its fixed grip, duration, and one contact time.');
   const returnCut=withReturn?motions.Ronin_Cut_Return:null;
   if(withReturn&&(!returnCut?.fixedGripFrame||!(returnCut.duration>0)||returnCut.impacts?.length!==1))throw Error('The return record needs its fixed grip, duration, and one contact time.');
   const overrides={Cut_Diagonal:'Ronin_Cut_Diagonal',...(withReturn?{Cut_Return:'Ronin_Cut_Return'}:{})};
   // Native time retains the dense authoring samples. Combat time is shorter
   // for light cuts; damage follows the same normalized contact pose.
   const timings=[[diagonal,.4],...(withReturn?[[returnCut,.5]]:[])].map(([record,duration])=>({duration,hits:record.impacts.map(time=>time*duration/record.duration)}));
   const travel=fs.existsSync(file('travel.json'))?JSON.parse(fs.readFileSync(file('travel.json'))):null;
   await page.route('**/src/warriors.js*',route=>route.fulfill({contentType:'application/javascript',body:source('warriors.js')+'\nWARRIORS[0].motionOverrides={...WARRIORS[0].motionOverrides,...'+JSON.stringify(overrides)+'};'+(travel?'\nWARRIORS[0].pairedTravelGrip='+JSON.stringify(travel)+';':'')}));
   await page.route('**/src/combat.js*',route=>route.fulfill({contentType:'application/javascript',body:source('combat.js')+'\nSTYLE_ATTACKS.odachi={...STYLE_ATTACKS.odachi,light:'+JSON.stringify(timings)+'};'}));
  }
 }
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
  body=body.replace(finalWeight,`if(this.type===0){for(const [name,scale]of [['Ronin_Heavy_Cleave',1],['Ronin_Cut_Diagonal',.76/.60]])for(const action of [this.actions.get(name),this.repeatActions?.get(name)])if(action?.isScheduled())weight+=THREE.MathUtils.clamp(action.getEffectiveWeight(),0,1)*THREE.MathUtils.smoothstep(action.time*scale,.40,.46)*(1-THREE.MathUtils.smoothstep(action.time*scale,.58,.66));for(const action of [this.actions.get('Ronin_Cut_Return_Connected')])if(action?.isScheduled())weight+=THREE.MathUtils.clamp(action.getEffectiveWeight(),0,1)*(1-THREE.MathUtils.smoothstep(action.time,0,.08));}weight=Math.min(1,weight);`);
  await route.fulfill({response,body});
 });
}
