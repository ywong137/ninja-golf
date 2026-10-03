import {MathUtils,Quaternion,Vector3} from 'three';
import {captureArmPose,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,measureWristAnatomy,wristRotationFromAngles} from '../src/wrist-anatomy.js';
import {capturePalmPronation} from './source-arm-pronation.mjs';

/** Adapt an over-rotated source palm within the native forearm's authoring range.
 * Preserve the elbow path. Discard excess axial rotation instead of leaving it
 * in the wrist. This intentionally changes the sword path and needs visual QA.
 */
export function fitSourceSwordPalm({bones,arm,wrist,state}){
 if(!state)throw Error('Supply a fresh persistent palm-fit state for each sequential bake.');
 const desiredPalm=capturePalmPronation(bones,'r',arm);
 const angle=measureWristAnatomy(wrist,captureWristPose(bones,'r'));
 const lower=bones.lowerarm_r,hand=bones.hand_r;
 hand.quaternion.copy(wristRotationFromAngles(wrist,{flexionDegrees:12*Math.tanh(angle.flexionDegrees/12),ulnarDeviationDegrees:25*Math.tanh(angle.ulnarDeviationDegrees/25),axialTwistDegrees:0}));
 hand.updateWorldMatrix(false,true);
 const neutralPalm=capturePalmPronation(bones,'r',arm);
 const required=MathUtils.euclideanModulo(desiredPalm-neutralPalm+180,360)-180;
 const current=measureArmAnatomy(arm,captureArmPose(bones,'r')).forearmTwistDegrees;
 let raw=current+required;
 if(state.palmRequest!==undefined)raw+=360*Math.round((state.palmRequest-raw)/360);
 state.palmRequest=raw;
 // Smooth saturation avoids a velocity discontinuity at the range limit.
 const desired=70*Math.tanh(raw/70);
 const axis=hand.getWorldPosition(new Vector3()).sub(lower.getWorldPosition(new Vector3())).normalize();
 const world=lower.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromAxisAngle(axis,MathUtils.degToRad(desired-current)));
 lower.quaternion.copy(lower.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));lower.updateWorldMatrix(false,true);
 const actualPalm=capturePalmPronation(bones,'r',arm);
 const discarded=raw-desired;
 const error=MathUtils.euclideanModulo(desiredPalm-actualPalm-discarded+180,360)-180;
 if(Math.abs(error)>.001)throw Error('Palm fitting changed the requested twist direction: '+error+' degrees.');
 return {desiredPalm,actualPalm,requestedForearm:raw,forearmTwist:desired,discardedDegrees:discarded};
}

/** Fit a single sword hand without changing the source elbow or shoulder path.
 * Use one persistent state per sequential 120 Hz bake. Bounds are authoring
 * constraints relative to this rig's bind pose, not clinical human limits.
 */
export function fitSourceSwordWrist({bones,arm,wrist,state}){
 if(!state||!bones?.lowerarm_r||!bones?.hand_r)throw Error('Supply the right arm and a persistent wrist-fit state.');
 const lower=bones.lowerarm_r,hand=bones.hand_r;
 const handWorld=hand.getWorldQuaternion(new Quaternion());
 const forearm=lower.getWorldQuaternion(new Quaternion());
 const axis=hand.getWorldPosition(new Vector3()).sub(lower.getWorldPosition(new Vector3())).normalize();
 const delta=handWorld.clone().multiply(wrist.referenceHandInForearm.clone().invert()).multiply(forearm.clone().invert());
 // q and -q encode the same rotation. Use the principal angle before limits;
 // otherwise -10 degrees can become +350 and clamp to the opposite rotation.
 const axial=MathUtils.euclideanModulo(MathUtils.radToDeg(2*Math.atan2(new Vector3(delta.x,delta.y,delta.z).dot(axis),delta.w))+180,360)-180;
 const current=measureArmAnatomy(arm,captureArmPose(bones,'r')).forearmTwistDegrees;
 const previous=state.forearmTwist;
 const desired=MathUtils.clamp(current+axial,previous===undefined?-70:Math.max(-70,previous-5),previous===undefined?70:Math.min(70,previous+5));
 forearm.premultiply(new Quaternion().setFromAxisAngle(axis,MathUtils.degToRad(desired-current)));
 lower.quaternion.copy(lower.parent.getWorldQuaternion(new Quaternion()).invert().multiply(forearm));lower.updateWorldMatrix(false,true);
 // Preserve the whole fist while moving its axial twist into the forearm.
 hand.quaternion.copy(forearm.clone().invert().multiply(handWorld));hand.updateWorldMatrix(false,true);
 state.forearmTwist=desired;
 const angle=measureWristAnatomy(wrist,captureWristPose(bones,'r'));
 hand.quaternion.copy(wristRotationFromAngles(wrist,{flexionDegrees:12*Math.tanh(angle.flexionDegrees/12),ulnarDeviationDegrees:25*Math.tanh(angle.ulnarDeviationDegrees/25),axialTwistDegrees:angle.axialTwistDegrees}));
 hand.updateWorldMatrix(false,true);
 return {forearmTwist:desired,axialTransferDegrees:desired-current};
}
