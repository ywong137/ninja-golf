// Arm poses are relative to the chest. Angles use the calibrated native hinge.
// The fixed hand mount determines the blade; no shaft target changes an arm frame.
export const HUSTLER_CLIPS=['Ring_Ready',...['Guard_Loop','Guard_Impact','Guard_Break','Guard_Walk_Forward','Guard_Walk_Right','Guard_Walk_Backward','Guard_Walk_Left'].map(name=>'Ring_'+name),...['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'].map(name=>'Ring_'+name)];
export const HUSTLER_TIMING={
 Ring_Cut_Diagonal:{originalDuration:.40,duration:.64,impacts:[.24]},
 Ring_Cut_Return:{originalDuration:.43,duration:.688,impacts:[.256]},
 Ring_Cut_Rising:{originalDuration:.48,duration:.768,impacts:[.32]},
 Ring_Cut_Sweep:{originalDuration:.58,duration:.928,impacts:[.32,.608]},
 Ring_Heavy_Sweep:{originalDuration:.82,duration:.984,impacts:[.336,.636]},
};
const arm=(upper,flex=75,roll=0,twist=0,wrist=0)=>({upper,flex,roll,twist,wrist});
const READY={r:arm([-.55,-.55,.60],75,20,20),l:arm([.43,-.89,-.08],55)};
const LOAD={r:arm([-.58,.12,.68],90,48,25,10),l:arm([.46,-.78,-.34],75,0,-5)};
const MID_FOLLOW={r:arm([-.44,-.54,.66],33,-5,47,-15.2),l:arm([.50,-.82,-.22],70,0,0)};
const FOLLOW={r:arm([-.48,-.70,.52],30,-25,55,-16),l:arm([.56,-.80,-.25],65,0,0)};
const SHORT_LOAD={r:arm([-.50,-.20,.84],70,38,30,5),l:arm([.46,-.78,-.34],75,0,-5)};
function curve(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/span));
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],d0=(keys[j][1]-keys[j-1][1])/h0,d1=(keys[j+1][1]-keys[j][1])/h1;if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);};
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*slope(i+1);
}
const GUARD={r:arm([-.56,-.25,.79],78,30,20,5),l:arm([.49,-.72,.49],85,-10,0)};
const RECOIL={r:arm([-.58,-.20,.84],80,31,18,6),l:arm([.50,-.65,.57],90,-10,0)};
const BREAK={r:arm([-.66,-.55,.48],60,10,25,-5),l:arm([.55,-.78,.30],70,0,0)};
function keysFor(name,duration,impacts){
 if(name.includes('Guard_Impact'))return[[0,GUARD],[duration*.3,RECOIL],[duration,GUARD]];
 if(name.includes('Guard_Break'))return[[0,GUARD],[duration*.55,BREAK],[duration,BREAK]];
 if(name.includes('Guard_'))return[[0,GUARD],[duration,GUARD]];
 if(name==='Ring_Ready')return[[0,READY],[duration,READY]];
 if(impacts.length>1){
  const rows=[[0,READY]];
  for(let i=0;i<impacts.length;i++){
   const hit=impacts[i],previous=impacts[i-1]??0,gap=hit-previous;
   rows.push([hit-gap*(i===0?.34:.25),i===0?LOAD:SHORT_LOAD],[hit+gap*(i===0?.20:.18),i===impacts.length-1?FOLLOW:MID_FOLLOW]);
  }
  rows.push([duration,READY]);return rows;
 }
 const hit=impacts[0];
 return[[0,READY],[hit*.45,LOAD],[hit*.60,LOAD],[hit*1.25,FOLLOW],[duration,READY]];
}
export function hustlerArms(name,time,duration,impacts){
 const keys=keysFor(name,duration,impacts);
 return Object.fromEntries(['r','l'].map(side=>[side,Object.fromEntries(Object.keys(READY[side]).map(key=>[key,Array.isArray(READY[side][key])?[0,1,2].map(axis=>curve(keys.map(([t,p])=>[t,p[side][key][axis]]),time)):curve(keys.map(([t,p])=>[t,p[side][key]]),time)]))]));
}
