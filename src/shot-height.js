// Game-tuned flight choices. They change launch conditions, not the wind itself.
export const SHOT_HEIGHTS = [
  {value:-1,id:'low',label:'Low',loftScale:.65,loftOffset:0,carryScale:.86,rollScale:1.12,hint:'Flatter flight. Less carry, more run.'},
  {value:0,id:'normal',label:'Normal',loftScale:1,loftOffset:0,carryScale:1,rollScale:1,hint:'Full carry with a balanced flight.'},
  {value:1,id:'high',label:'High',loftScale:1,loftOffset:8,carryScale:.92,rollScale:.86,hint:'Steeper landing. More wind exposure.'},
];
export function shotHeightProfile(value=0){
  const profile=SHOT_HEIGHTS.find(profile=>profile.value===value);
  if(!profile)throw new RangeError('Shot height must be -1 (low), 0 (normal), or 1 (high).');
  return profile;
}
