import motions from './motion-data.json';
import selectionMotions from './selection-data.json';
export {motions,selectionMotions};
// Cubic Hermite curves keep velocity continuous through authored phase landmarks.
export function sampleMotion(name,seconds){
  const clip=motions[name]||selectionMotions[name];if(!clip)return null;const t=Math.max(0,Math.min(1,seconds/clip.duration)),rows=clip.poses;
  let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;const a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  const interp=(key,k)=>{const value=(row)=>k===undefined?row[key]:row[key][k];const m0=i===0?0:(value(b)-value(prev))/(b.t-prev.t),m1=i+1===rows.length-1?0:(value(next)-value(a))/(next.t-a.t);return h00*value(a)+h10*span*m0+h01*value(b)+h11*span*m1;};
  return Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,Array.isArray(a[k])?a[k].map((_,j)=>interp(k,j)):interp(k)]));
}
export const ATTACK_CLIPS={light:['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep'],heavy:['Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'],musou:['Musou_Flow']};
export function combatMotionName(warrior,kind,step=0){
  const prefix=warrior?.motionPrefix||(warrior?.dualWield?'Twin_':'');
  if(kind==='ready')return warrior?.readyClip||(motions[`${prefix}Ready`]?`${prefix}Ready`:'Idle_Loop');
  const family=ATTACK_CLIPS[kind];
  if(!family)throw new Error(`Unknown combat motion kind: ${kind}`);
  return prefix+family[kind==='musou'?0:Math.max(0,Math.min(family.length-1,step))];
}
export function musouHeadings(warrior){return motions[combatMotionName(warrior,'musou')].headings;}
