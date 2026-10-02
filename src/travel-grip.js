// A hero may author a complete two-hand hold through combat travel.
// Other animations keep their own records, including golf and selection.
const runNames=new Set(['Run_Start','Run_Stop_Left','Run_Stop_Right','Run_Forward','Run_Directional_Forward','Run_Right','Run_Backward','Run_Left','Sprint_Forward']);
export function pairedTravelGrip(warrior,clipName){
 const grip=warrior?.pairedTravelGrip;
 if(!grip||!runNames.has(clipName)&&!clipName?.startsWith('Run_Turn_'))return null;
 if(grip.nativeAttachment!==true||grip.pairedGrip!==true||grip.fixedGripFrame!==true||grip.twoHanded!==true
  ||!Number.isFinite(grip.gripSpacing)||grip.gripSpacing<=0)
  throw Error('A paired travel grip requires authored native hand frames and positive palm spacing.');
 return grip;
}
