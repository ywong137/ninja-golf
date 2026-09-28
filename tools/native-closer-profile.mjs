// Native, chest-relative arm poses. The wakizashi has one fixed palm mount.
export const CLOSER_CLIPS=['Sickle_Ready',...['Guard_Loop','Guard_Impact','Guard_Break','Guard_Walk_Forward','Guard_Walk_Right','Guard_Walk_Backward','Guard_Walk_Left','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'].map(name=>'Sickle_'+name)];
export const CLOSER_TIMING={
 Sickle_Cut_Diagonal:{originalDuration:.40,duration:.56,impacts:[.21]},
 Sickle_Cut_Return:{originalDuration:.43,duration:.602,impacts:[.224]},
 Sickle_Cut_Rising:{originalDuration:.48,duration:.672,impacts:[.28]},
 Sickle_Cut_Sweep:{originalDuration:.58,duration:.812,impacts:[.28,.532]},
 Sickle_Heavy_Sweep:{originalDuration:.82,duration:.984,impacts:[.336,.636]},
};
const arm=(upper,flex=75,roll=0,twist=0,wrist=0)=>({upper,flex,roll,twist,wrist});
const READY={r:arm([-.57,-.64,.57],68,15,10),l:arm([.43,-.85,.12],62,-5,-5)};
const HIGH={r:arm([-.56,.10,.90],76,46,22,10),l:arm([.46,-.75,-.34],72,0,-5)};
const LOW={r:arm([-.43,-.71,.55],32,-22,52,-16),l:arm([.56,-.80,-.25],62,0,0)};
const COMPACT={r:arm([-.51,-.20,.79],74,38,25,6),l:arm([.46,-.78,-.34],75,0,-5)};
const BACK_LOAD={r:arm([-.75,-.32,.75],42,50,-30,0),l:arm([.55,-.70,.56],85,-10,-10)};
const BACK_FOLLOW={r:arm([-.95,-.25,.10],42,50,-30,-12),l:arm([.58,-.72,-.30],55,0,10)};
const UP_LOAD={r:arm([-.85,-.70,.50],120,10,-60,18),l:arm([.55,-.70,.56],82,-5,-10)};
const UP_FOLLOW={r:arm([-.90,-.30,.55],95,60,-60,-18),l:arm([.57,-.73,-.35],65,5,10)};
const GUARD={r:arm([-.48,-.36,.79],80,22,10,4),l:arm([.46,-.75,.39],80,-10,0)};
const GUARD_BREATH={r:arm([-.50,-.34,.79],78,23,12,3),l:arm([.49,-.71,.41],83,-8,0)};
const RECOIL={r:arm([-.50,-.34,.82],82,24,8,5),l:arm([.51,-.69,.49],89,-10,0)};
const BREAK={r:arm([-.66,-.57,.44],58,10,22,-5),l:arm([.55,-.78,.30],70,0,0)};

function curve(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/span));
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],d0=(keys[j][1]-keys[j-1][1])/h0,d1=(keys[j+1][1]-keys[j][1])/h1;if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);};
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*slope(i+1);
}
function keysFor(name,duration,impacts){
 if(name.includes('Guard_Impact'))return[[0,GUARD],[duration*.3,RECOIL],[duration,GUARD]];
 if(name.includes('Guard_Break'))return[[0,GUARD],[duration*.55,BREAK],[duration,BREAK]];
 if(name.includes('Guard_'))return[[0,GUARD],[duration*.5,GUARD_BREATH],[duration,GUARD]];
 if(name==='Sickle_Ready')return[[0,READY],[duration,READY]];
 const rows=[[0,READY]],high=name.includes('Heavy')?HIGH:COMPACT;
 for(let i=0;i<impacts.length;i++){
  const hit=impacts[i],gap=hit-(impacts[i-1]??0);
  let load=i===0?high:COMPACT,follow=LOW;
  if(name.includes('Return')){load=BACK_LOAD;follow=BACK_FOLLOW;}
  if(name.includes('Rising')||i%2===1){load=UP_LOAD;follow=UP_FOLLOW;}
  rows.push([hit-gap*(i===0?.36:.20),load],[hit+gap*(i===0?.23:.18),follow]);
 }
 rows.push([duration,READY]);return rows;
}
export function closerArms(name,time,duration,impacts){
 const keys=keysFor(name,duration,impacts);
 return Object.fromEntries(['r','l'].map(side=>[side,Object.fromEntries(Object.keys(READY[side]).map(key=>[key,Array.isArray(READY[side][key])?[0,1,2].map(axis=>curve(keys.map(([t,p])=>[t,p[side][key][axis]]),time)):curve(keys.map(([t,p])=>[t,p[side][key]]),time)]))]));
}
