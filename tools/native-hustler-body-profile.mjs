// Native coordinates: +Y up, +Z forward, anatomical left +X.
export const HUSTLER_BODY_CLIP='Ring_Heavy_Cleave';
export const HUSTLER_BODY_DURATION=1.06;
export const HUSTLER_BODY_IMPACT=.36;
// Finish the running carry before the blade enters the raised chamber.
export const HUSTLER_BODY_CARRY_EXIT=.14;
export const HUSTLER_BODY_PLANTS={r:[[0,.22],[.64,HUSTLER_BODY_DURATION]],l:[[0,.07],[.26,.68],[1.02,HUSTLER_BODY_DURATION]]};
export const HUSTLER_BODY_TOES={r:[[.22,.64]],l:[]};
// Time, hip/chest yaw, pelvis X/Y/Z, chest/hip pitch, step, rear pivot.
export const HUSTLER_BODY_KEYS=[
 [0,0,0,0,0,0,0,0,0,0],
 [.07,-6,-10,-.045,.005,-.015,-2,0,0,0],
 [.16,-16,-28,-.075,.015,-.03,-6,-1,.45,0],
 [.22,-14,-28,-.045,.005,.015,-3,0,.85,0],
 [.26,-8,-24,-.005,-.015,.06,0,1,1,0],
 [.32,6,-8,.035,-.035,.14,7,3,1,.75],
 [.36,10,4,.065,-.055,.20,12,5,1,1],
 [.46,15,14,.08,-.07,.225,14,5,1,1],
 [.55,12,12,.065,-.055,.20,11,4,1,.85],
 [.64,6,7,.04,-.025,.12,6,2,1,0],
 [.68,3,4,.015,-.01,.09,4,1,1,0],
 [.84,3,7,-.03,-.01,.025,1,0,.55,0],
 [1.02,0,0,0,0,0,0,0,0,0],
 [1.06,0,0,0,0,0,0,0,0,0],
];

function curve(rows,column,time){
 let i=0;while(i<rows.length-2&&time>rows[i+1][0])i++;
 const a=rows[i],b=rows[i+1],h=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/h));
 const slope=j=>{if(j===0||j===rows.length-1)return 0;const h0=rows[j][0]-rows[j-1][0],h1=rows[j+1][0]-rows[j][0],d0=(rows[j][column]-rows[j-1][column])/h0,d1=(rows[j+1][column]-rows[j][column])/h1;if(d0*d1<=0)return 0;return(3*h0+3*h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);};
 return(2*u**3-3*u*u+1)*a[column]+(u**3-2*u*u+u)*h*slope(i)+(-2*u**3+3*u*u)*b[column]+(u**3-u*u)*h*slope(i+1);
}

export function hustlerHeavyBody(time){
 const p=Object.fromEntries(['hip','chest','x','y','z','bend','pelvisBend','step','pivot'].map((name,i)=>[name,curve(HUSTLER_BODY_KEYS,i+1,time)]));
 p.footLift=(time<.26?.075:time>.68?.065:0)*Math.sin(Math.PI*p.step);
 p.chamberLift=curve([[0,0],[.10,6],[.18,14],[.27,20],[.32,18],[.36,8],[.43,-10],[.50,-14],[.60,-8],[.82,0],[1.06,0]],1,time);
 p.counter=curve([[0,0],[.18,1],[.26,1],[.38,-.5],[.5,-.6],[.7,0],[1.06,0]],1,time);
 return p;
}
export function hustlerHeavyArmTime(time){
 return curve([[0,0],[.18,.18],[.36,.36],[.46,.44],[.63,.50],[.82,.62],[1.06,.76]],1,time);
}
