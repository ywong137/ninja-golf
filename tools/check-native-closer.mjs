#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {inspectNativeArmFamily,verifyArmFamilyPreservation} from './check-native-arm-family.mjs';
import {CLOSER_CLIPS} from './native-closer-profile.mjs';

export const inspectNativeCloser=options=>inspectNativeArmFamily({modelKey:'sora',readyName:'Sickle_Ready',weaponKind:'wakizashi',clips:CLOSER_CLIPS,...options});
export const verifyCloserPreservation=(before,after)=>verifyArmFamilyPreservation(before,after,CLOSER_CLIPS);

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},before:{type:'string'},rate:{type:'string',default:'480'},clip:{type:'string',multiple:true},skin:{type:'boolean'},help:{type:'boolean'}}});
 if(values.help)console.log('node tools/check-native-closer.mjs --model MODEL.glb --record RECORDS.json [--output REPORT.json] [--before ORIGINAL.glb] [--skin] [--rate 480] [--clip NAME]\nChecks actual native joint limits, hand grip, blade path, continuity, and optional deformed arm surfaces.');
 else{
  const result=await inspectNativeCloser({model:values.model,record:values.record,rate:Number(values.rate),skin:values.skin,clips:values.clip??CLOSER_CLIPS});
  if(values.before)result.preservation=verifyCloserPreservation(values.before,values.model);
  if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:result.passed,violationCount:result.violationCount,violations:result.violations.slice(0,10),clips:Object.fromEntries(Object.entries(result.clips).map(([name,m])=>[name,{fold:m.maxFoldDepth,upperTorso:m.maxUpperarmTorsoPairs,speed:m.peakTipSpeed,contacts:m.contacts}]))},null,2));
  if(!result.passed)process.exitCode=1;
 }
}
