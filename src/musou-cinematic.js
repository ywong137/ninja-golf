export const MUSOU_WIPES=Object.freeze([{time:0,duration:1.32},{time:1.26,duration:1.14}]);
// A posed orbit, then a tighter side pan. The camera never flies into the face.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function musouCameraFrame(progress,{reducedMotion=false}={}){
 const close=progress>=.34;
 const t=smooth(close?(progress-.34)/.66:progress/.34);
 return {shot:close?1:0,yaw:reducedMotion?.30:close?.55-.85*t:1.05-.50*t,
  distance:close?1.20:3.2,height:close?.035:-.15,lookBelowEyes:close?.055:.35,roll:reducedMotion?0:close?-.025+.05*t:-.035};
}
export function musouReadyPose(motions,motionName,progress){
 const clip=motionName,motion=motions[clip];
 if(!motion||!motion.impacts?.length)throw Error('Musou cinematic needs an authored attack windup: '+clip);
 const impact=motion.impacts[0];
 // Use the captured preparation of the actual weapon, with a little live tension.
 // Use light preparation where an overhead heavy hides the face or weapon.
 const end=Math.max(0,impact-.12),start=Math.max(0,end-.12);
 return {clip,time:start+(end-start)*smooth(progress)};
}
