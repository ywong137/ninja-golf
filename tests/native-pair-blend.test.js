import test from 'node:test';
import assert from 'node:assert/strict';
import {compatibleNativePair} from '../src/hand-grip.js';

const pair={nativeAttachment:true,pairedGrip:true,twoHanded:true,primaryGrip:-.36,gripSpacing:.4};

test('Native pairs share the same two palm stations',()=>{
 assert.equal(compatibleNativePair(pair,{...pair},0),true);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},{...pair,primaryGrip:undefined},-.36),true);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},pair,-.36),true);
 for(const change of [{primaryGrip:-.3},{gripSpacing:.3},{nativeAttachment:false},{pairedGrip:false},{twoHanded:false},{gripSpacing:0},{gripSpacing:NaN},{primaryGrip:Infinity}]){
  assert.equal(compatibleNativePair(pair,{...pair,...change},0),false,JSON.stringify(change));
  assert.equal(compatibleNativePair({...pair,...change},pair,0),false,JSON.stringify(change));
 }
 assert.equal(compatibleNativePair(undefined,pair,0),false);
 assert.equal(compatibleNativePair(pair,undefined,0),false);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},pair,undefined),false);
});
