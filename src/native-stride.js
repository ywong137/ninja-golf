import locomotion from './locomotion-data.json' with {type:'json'};

function distanceScale(clip){
 const scale=clip.userData?.nativeStrideScale??1;
 if(!Number.isFinite(scale)||scale<=0)throw Error(`Invalid nativeStrideScale in ${clip.name}: expected a positive distance ratio.`);
 return scale;
}

// The native clip and its distance clock must describe the same stride.
// Old clips retain their existing data; fitted clips carry their own ratio.
export function nativeRunSpec(clip){
 const spec=locomotion[clip.userData?.legacyLocomotion??clip.name];
 if(!spec)return undefined;
 const scale=distanceScale(clip);
 return scale===1?spec:{...spec,amplitude:spec.amplitude*scale};
}

export function nativeWalkSpec(clip,spec){
 if(!spec||!(spec.walkSpeed>0))throw Error(`Missing walking speed for ${clip.name}.`);
 const scale=distanceScale(clip);
 return scale===1?spec:{...spec,walkSpeed:spec.walkSpeed*scale};
}
