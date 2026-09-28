#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {authorNativeArmFamily} from './author-native-arm-family.mjs';
import {CLOSER_CLIPS,CLOSER_TIMING,closerArms} from './native-closer-profile.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},frames:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/author-native-closer.mjs --output /tmp/closer.glb --record /tmp/closer.json [--input MODEL.glb] [--frames FRAMES.json]\nRebuilds Closer combat arms from native joint frames. Preserves body poses, golf, geometry, and unrelated clips. Outputs candidates only.');
}else await authorNativeArmFamily({values,modelKey:'sora',clips:CLOSER_CLIPS,timing:CLOSER_TIMING,arms:closerArms,framesPath:new URL('./native-closer-frames.json',import.meta.url),weaponKind:'wakizashi',extrasKey:'nativeCloserVersion',clavicleYaw:{r:.18,l:-.10}});
