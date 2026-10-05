#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {ACE_FAMILY_CLIPS} from './native-ace-family-profile.mjs';
import {inspectNativeArmFamily,verifyArmFamilyPreservation} from './check-native-arm-family.mjs';
const ready=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))).Ace_Ready;
export const verifyAceFamilyPreservation=(before,after)=>verifyArmFamilyPreservation(before,after,ACE_FAMILY_CLIPS);
export const inspectNativeAceFamily=({includeReady=true,...options}={})=>inspectNativeArmFamily({modelKey:'kaede',readyName:'Ace_Ready',weaponKind:'jian',doubleEdged:true,clips:includeReady?ACE_FAMILY_CLIPS:ACE_FAMILY_CLIPS.filter(n=>!n.endsWith('_Ready')),readyRecord:ready,referenceClip:includeReady?undefined:ACE_FAMILY_CLIPS.find(n=>!n.endsWith('_Ready')),...options});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},before:{type:'string'},output:{type:'string'},skin:{type:'boolean'},rate:{type:'string',default:'480'},help:{type:'boolean'}}});
 if(values.help){console.log('node tools/check-native-ace-family.mjs --model MODEL.glb --record RECORDS.json [--before ORIGINAL.glb] [--output REPORT.json] [--skin] [--rate 480]\nChecks actual baked arm joints, wrists, finger fit, blade clearance, speed, and cutting edge. --skin checks deformed arm surfaces.');process.exit(0);}
 const report=await inspectNativeAceFamily({model:values.model,record:values.record,skin:values.skin,rate:Number(values.rate)});
 if(values.before)report.preservation=verifyAceFamilyPreservation(values.before,values.model);
 if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,violationCount:report.violationCount,violations:report.violations},null,2));
 if(!report.passed)process.exitCode=1;
}
