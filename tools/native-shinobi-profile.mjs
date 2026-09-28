// Alternate independent cuts while the other blade provides a moving cover.
export const SHINOBI_CLIPS=['Twin_Ready',...['Guard_Loop','Guard_Impact','Guard_Break','Guard_Walk_Forward','Guard_Walk_Right','Guard_Walk_Backward','Guard_Walk_Left','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'].map(name=>'Twin_'+name)];
export const SHINOBI_TIMING={
 Twin_Cut_Diagonal:{originalDuration:.4,duration:.56,impacts:[.21],impactHands:['r']},
 Twin_Cut_Return:{originalDuration:.43,duration:.602,impacts:[.224],impactHands:['l']},
 Twin_Cut_Rising:{originalDuration:.48,duration:.672,impacts:[.28],impactHands:['r']},
 Twin_Cut_Sweep:{originalDuration:.58,duration:.812,impacts:[.28,.532],impactHands:['r','l']},
 Twin_Heavy_Cleave:{impactHands:['r']},
 Twin_Heavy_Rising:{impactHands:['l']},
 Twin_Heavy_Sweep:{originalDuration:.82,duration:.984,impacts:[.336,.636],impactHands:['r','l']},
 Twin_Heavy_Slam:{impactHands:['l']},
 Twin_Musou_Flow:{impactHands:['r','l','r','l','r','l']},
};
const arm=(upper,flex,roll=0,twist=0,wrist=0)=>({upper,flex,roll,twist,wrist});
const READY={r:arm([-.50,-.68,.58],75,15,15),l:arm([.48,-.60,.64],85,-20,-10)};
const LOAD={r:arm([-.55,.08,.76],85,40,20,8),l:arm([.50,-.40,.74],88,-25,-20,3)};
const FOLLOW={r:arm([-.52,-.60,.56],35,-20,50,-14),l:arm([.58,-.52,.62],82,-20,-10,0)};
const RECOVER={r:arm([-.54,-.67,.55],48,-5,32,-5),l:arm([.53,-.62,.59],78,-12,-5,0)};
const UP_LOAD=arm([-.85,-.70,.50],118,10,-60,16);
const UP_FOLLOW=arm([-.90,-.30,.55],95,60,-60,-16);
const COVER_L=arm([.67,-.73,.28],65,-15,-15,0);
const LOW_COVER_R=arm([-.67,-.73,.28],65,15,15,0);
const HIGH=arm([-.58,.12,.70],94,45,22,10);
const GUARD={r:arm([-.50,-.34,.76],82,22,12,4),l:arm([.52,-.26,.80],89,-27,-15,4)};
const GUARD_BREATH={r:arm([-.51,-.33,.76],80,23,14,3),l:arm([.54,-.24,.78],88,-26,-14,3)};
// Let the body absorb the block. A small lead-arm yield keeps both blades apart.
const RECOIL={r:arm([-.51,-.33,.76],84,23,12,5),l:GUARD.l};
const BREAK={r:arm([-.70,-.61,.39],65,8,22,-5),l:arm([.66,-.48,.58],74,-14,-14,-3)};
const mirror=p=>({...p,upper:[-p.upper[0],p.upper[1],p.upper[2]],roll:-p.roll,twist:-p.twist});
function strikePose(side,primary){
 return side==='r'?{r:primary,l:COVER_L}:{r:LOW_COVER_R,l:mirror(primary)};
}
function keysFor(name,duration,impacts){
 if(name==='Twin_Ready')return[[0,READY],[duration,READY]];
 if(name==='Twin_Cut_Diagonal'){const hit=impacts[0];return[[0,READY],[hit*.62,LOAD],[hit*1.23,FOLLOW],[duration*.76,RECOVER],[duration,READY]];}
 if(name.includes('Guard_Impact'))return[[0,GUARD],[duration*.3,RECOIL],[duration,GUARD]];
 if(name.includes('Guard_Break'))return[[0,GUARD],[duration*.55,BREAK],[duration,BREAK]];
 if(name.includes('Guard_'))return[[0,GUARD],[duration*.5,GUARD_BREATH],[duration,GUARD]];
 const rows=[[0,READY]],sides=SHINOBI_TIMING[name].impactHands;
 for(let i=0;i<impacts.length;i++){
  const hit=impacts[i],gap=hit-(impacts[i-1]??0),side=sides[i];
  const rising=name.includes('Rising')||(name.includes('Heavy_Sweep')&&i===1)||(name.includes('Musou')&&i%2===1);
  let load=rising?UP_LOAD:name.includes('Heavy')?HIGH:LOAD.r,follow=rising?UP_FOLLOW:FOLLOW.r;
  if(name==='Twin_Cut_Sweep'&&i===0){load={...load,upper:[-.75,.08,.70],flex:75,twist:load.twist-40};follow={...follow,twist:follow.twist-40};}
  if(name==='Twin_Cut_Sweep'&&i===1){load={...load,twist:load.twist-8};follow={...follow,twist:follow.twist-8};}
  rows.push([hit-gap*(i===0?.38:.20),strikePose(side,load)],[hit+gap*(i===0?.22:.18),strikePose(side,follow)]);
 }
 rows.push([duration,READY]);return rows;
}
function curve(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/span));
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],d0=(keys[j][1]-keys[j-1][1])/h0,d1=(keys[j+1][1]-keys[j][1])/h1;if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);};
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*slope(i+1);
}
export function shinobiArms(name,time,duration,impacts){
 const keys=keysFor(name,duration,impacts);
 return Object.fromEntries(['r','l'].map(side=>[side,Object.fromEntries(Object.keys(READY[side]).map(key=>[key,Array.isArray(READY[side][key])?[0,1,2].map(axis=>curve(keys.map(([t,p])=>[t,p[side][key][axis]]),time)):curve(keys.map(([t,p])=>[t,p[side][key]]),time)]))]));
}
