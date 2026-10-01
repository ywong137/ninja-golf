import test from 'node:test';
import assert from 'node:assert/strict';
import {pairedTravelGrip} from '../src/travel-grip.js';
const grip={nativeAttachment:true,pairedGrip:true,fixedGripFrame:true,twoHanded:true,gripSpacing:.12};
test('Paired travel applies only to a configured hero and the authored combat runs',()=>{
 const hero={pairedTravelGrip:grip};
 for(const name of ['Run_Forward','Run_Right','Run_Backward','Run_Left','Sprint_Forward'])assert.equal(pairedTravelGrip(hero,name),grip);
 for(const name of ['Golf_Swing','Ronin_Selection_Idle','Roll','Ronin_Cut_Diagonal','Jog_Fwd_Loop'])assert.equal(pairedTravelGrip(hero,name),null);
 assert.equal(pairedTravelGrip({},'Run_Forward'),null);
 assert.equal(pairedTravelGrip(undefined,'Run_Forward'),null);
});
test('Incomplete authored travel grips fail before overriding the procedural carry',()=>{
 for(const key of ['nativeAttachment','pairedGrip','fixedGripFrame','twoHanded','gripSpacing']){
  const invalid={...grip};delete invalid[key];
  assert.throws(()=>pairedTravelGrip({pairedTravelGrip:invalid},'Run_Forward'),/authored native hand frames/);
 }
 for(const spacing of [0,-.12,NaN,Infinity])assert.throws(()=>pairedTravelGrip({pairedTravelGrip:{...grip,gripSpacing:spacing}},'Run_Left'),/positive palm spacing/);
});
