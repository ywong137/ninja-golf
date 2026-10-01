// A hero may author a complete two-hand hold in all five combat run clips.
// Other animations keep their own records, including golf and selection.
const runNames=new Set(['Run_Forward','Run_Right','Run_Backward','Run_Left','Sprint_Forward']);
export function pairedTravelGrip(warrior,clipName){
 const grip=warrior?.pairedTravelGrip;
 if(!grip||!runNames.has(clipName))return null;
 if(grip.nativeAttachment!==true||grip.pairedGrip!==true||grip.fixedGripFrame!==true||grip.twoHanded!==true
  ||!Number.isFinite(grip.gripSpacing)||grip.gripSpacing<=0)
  throw Error('A paired travel grip requires authored native hand frames and positive palm spacing.');
 return grip;
}
