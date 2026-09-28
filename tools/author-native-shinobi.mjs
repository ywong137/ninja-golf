#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {authorNativeArmFamily} from './author-native-arm-family.mjs';
import {SHINOBI_CLIPS,SHINOBI_TIMING,shinobiArms} from './native-shinobi-profile.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},frames:{type:'string'},help:{type:'boolean'}}});
if(values.help)console.log('node tools/author-native-shinobi.mjs --output /tmp/shinobi.glb --record /tmp/shinobi.json [--input MODEL.glb] [--frames FRAMES.json]\nRebuilds Ready, attacks, and guards with independent hand timing. Preserves body poses, golf, and unrelated animations. Outputs candidates only.');
else await authorNativeArmFamily({values,modelKey:'shinobi',clips:SHINOBI_CLIPS,timing:SHINOBI_TIMING,arms:shinobiArms,framesPath:new URL('./native-shinobi-frames.json',import.meta.url),weaponKind:'twin',extrasKey:'nativeShinobiVersion',dualWield:true});
