// One pilot: the pelvis leads each alternating cut, then braces before contact.
// Values are seconds, pelvis yaw, chest yaw, left-foot weight, height, advance,
// chest pitch, and pelvis pitch. Angles are degrees relative to native Ready.
const ROWS=[
 [0,0,0,.50,0,0,0,0],
 [.10,-12,-22,.25,-.035,-.010,4,2],
 [.17,4,-18,.30,-.025,.025,5,2],
 [.225,14,14,.55,-.020,.050,6,3],
 [.260,16,26,.68,-.06,.070,6,3],
 [.300,16,26,.68,-.06,.070,6,3],
 [.340,13,30,.70,-.06,.060,4,1],
 [.385,12,22,.65,-.055,.040,4,2],
 [.430,4,20,.60,-.055,.040,5,2],
 [.480,-13,-13,.45,-.020,.060,6,3],
 [.512,-16,-26,.32,-.045,.070,6,3],
 [.555,-16,-26,.32,-.045,.070,6,3],
 [.600,-13,-30,.30,-.045,.060,4,1],
 [.700,-5,-12,.43,-.010,.025,2,1],
 [.812,0,0,.50,0,0,0,0],
];
function curve(column,time){
 let i=0;while(i<ROWS.length-2&&time>ROWS[i+1][0])i++;
 const a=ROWS[i],b=ROWS[i+1],h=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/h));
 const slope=j=>{if(j===0||j===ROWS.length-1)return 0;const a=ROWS[j-1],b=ROWS[j],c=ROWS[j+1],h0=b[0]-a[0],h1=c[0]-b[0],d0=(b[column]-a[column])/h0,d1=(c[column]-b[column])/h1;if(d0*d1<=0)return 0;return(3*h0+3*h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);};
 return(2*u**3-3*u*u+1)*a[column]+(u**3-2*u*u+u)*h*slope(i)+(-2*u**3+3*u*u)*b[column]+(u**3-u*u)*h*slope(i+1);
}
export function shinobiSweepBody(time){return Object.fromEntries(['hip','chest','leftWeight','height','advance','bend','pelvisBend'].map((key,i)=>[key,curve(i+1,time)]));}
export const shinobiSweepBodyTimes=ROWS.map(row=>row[0]);

// Rear feet turn on the planted toe as weight passes to the opposite leg.
export function shinobiSweepPivot(side,time){
 const keys=side==='r'?[[0,0],[.12,0],[.25,1],[.39,1],[.50,0],[.812,0]]:[[0,0],[.43,0],[.512,1],[.616,1],[.73,0],[.812,0]];
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],u=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0]))),weight=a[1]+(b[1]-a[1])*u*u*(3-2*u);
 return{yaw:(side==='r'?80:-65)*weight,heel:25*weight};
}
