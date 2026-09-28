// Joint controls for the rest of the Ace's one-handed moveset.
// Body motion remains in the native clips; arms move relative to that chest.
export const ACE_FAMILY_CLIPS=[...['Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow','Guard_Loop','Guard_Impact','Guard_Break','Guard_Walk_Forward','Guard_Walk_Right','Guard_Walk_Backward','Guard_Walk_Left'].map(n=>'Fan_'+n)];
export const ACE_FAMILY_TIME_SCALE={Fan_Cut_Return:1.6,Fan_Cut_Rising:1.6,Fan_Cut_Sweep:1.6};
const arm=(upper,flex,roll=0,twist=0,wrist=0)=>({upper,flex,roll,twist,wrist});
const pose=(r,l=arm([.30,-.92,-.12],65))=>({r,l});
const READY=pose(arm([-.20,-.95,.30],70,5,10),arm([.27,-.96,-.04],55));
const HIGH=pose(arm([-.65,.05,.45],95,50,35,12),arm([.35,-.9,.15],75));
const DOWN=pose(arm([-.35,-.35,.85],35,20,35,-18),arm([.25,-.90,.10],80));
const LOW=pose(arm([-.35,-.70,.65],35,-25,60,-16),arm([.38,-.89,-.20],65));
const OUT=pose(arm([-.75,-.35,.55],48,30,15,-10),arm([.35,-.91,-.08],75));
const RISING_ROLL=19,RISING_TWIST=-40;
const rising=p=>Object.fromEntries(Object.entries(p).map(([side,a])=>[side,side==='r'?{...a,roll:a.roll+RISING_ROLL,twist:a.twist+RISING_TWIST}:a]));
const RISE_LOW=rising(LOW),RISE_HIGH=rising(HIGH);
const GUARD=pose(arm([-.42,-.62,.66],95,18,12,0),arm([.40,-.90,.05],80));

function curve(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/span));
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],d0=(keys[j][1]-keys[j-1][1])/h0,d1=(keys[j+1][1]-keys[j][1])/h1;if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);};
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*slope(i+1);
}
function keysFor(name,duration,impacts){
 if(name.includes('Guard_')){
  if(name.endsWith('Impact'))return[[0,GUARD],[duration*.35,HIGH],[duration,GUARD]];
  if(name.endsWith('Break'))return[[0,GUARD],[duration*.38,OUT],[duration,READY]];
  return[[0,GUARD],[duration,GUARD]];
 }
 const isRising=name.includes('Rising')||name.includes('Return');
 const cut=isRising?[RISE_LOW,RISE_HIGH,RISE_HIGH]:[HIGH,DOWN,LOW];
 if(impacts.length===1){const hit=impacts[0];if(isRising)return[[0,READY],[hit*.4,cut[0]],[hit*.6,cut[0]],[hit+(duration-hit)*.35,cut[1]],[hit+(duration-hit)*.5,cut[2]],[duration,READY]];return[[0,READY],[hit*.52,cut[0]],[hit*.74,cut[0]],[hit+(duration-hit)*.09,cut[1]],[hit+(duration-hit)*.37,cut[2]],[duration,READY]];}
 // A continuous alternating arc crosses each damage time between its extrema.
 // Both edges of the jian cut; body turns carry this plane around the player.
 const rows=[[0,READY],[impacts[0]*.45,RISE_HIGH]];
 for(let i=0;i<impacts.length;i++){
  const hit=impacts[i],next=impacts[i+1]??duration;
  rows.push([hit+(next-hit)*.50,i%2===0?RISE_LOW:RISE_HIGH]);
 }
 rows.push([duration,READY]);return rows;
}
export function aceFamilyArms(name,time,duration,impacts){
 const keys=keysFor(name,duration,impacts);
 return Object.fromEntries(['r','l'].map(side=>[side,Object.fromEntries(Object.keys(READY[side]).map(key=>[key,Array.isArray(READY[side][key])?[0,1,2].map(axis=>curve(keys.map(([t,p])=>[t,p[side][key][axis]]),time)):curve(keys.map(([t,p])=>[t,p[side][key]]),time)]))]));
}
