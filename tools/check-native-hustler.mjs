#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {HUSTLER_CLIPS} from './native-hustler-profile.mjs';
import {inspectNativeArmFamily,verifyArmFamilyPreservation} from './check-native-arm-family.mjs';
export const verifyHustlerPreservation=(before,after)=>verifyArmFamilyPreservation(before,after,HUSTLER_CLIPS);
export const inspectNativeHustler=options=>inspectNativeArmFamily({modelKey:'ayame',readyName:'Ring_Ready',weaponKind:'dao',clips:HUSTLER_CLIPS,...options});

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},before:{type:'string'},rate:{type:'string',default:'480'},clip:{type:'string',multiple:true},skin:{type:'boolean'},help:{type:'boolean'}}});
 if(values.help){console.log('node tools/check-native-hustler.mjs --model MODEL.glb --record RECORDS.json [--output REPORT.json] [--before ORIGINAL.glb] [--skin] [--rate 480] [--clip NAME]\nChecks actual native hinge/twist, wrist, finger fit, blade clearance, and continuity. --skin also checks deformed arm surfaces. Blade edge metrics are diagnostics, not visual approval.');process.exit(0);}
 const result=await inspectNativeHustler({model:values.model,record:values.record,rate:Number(values.rate),skin:values.skin,clips:values.clip??HUSTLER_CLIPS});
 if(values.before)result.preservation=verifyHustlerPreservation(values.before,values.model);
 if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:result.passed,violationCount:result.violationCount,clips:Object.fromEntries(Object.entries(result.clips).map(([name,m])=>[name,{samples:m.samples,wrist:m.maxWristDegrees,fold:m.maxFoldDepth,upperTorso:m.maxUpperarmTorsoPairs,armStep:m.maxArmStep120Hz}]))},null,2));
 if(!result.passed)process.exitCode=1;
}
