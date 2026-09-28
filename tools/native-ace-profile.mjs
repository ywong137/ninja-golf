// One-handed jian cut: +Y up, +Z forward, anatomical right -X.
import {Vector3} from 'three';
export const ACE_DURATION=.60;
export const ACE_IMPACT=.27;
export const ACE_PLANTS={r:[[0,.19],[.58,ACE_DURATION]],l:[[0,.04],[.13,.38],[.598,ACE_DURATION]]};
export const ACE_KEYS=[
 // Time, pelvis/chest turn and hinge, pelvis position.
 [0,0,0,.045,.065,0,-.045,0],
 [.07,-.08,-.16,.06,.075,-.01,-.055,-.01],
 [.10,-.15,-.28,.07,.085,-.018,-.065,-.018],
 [.15,-.24,-.52,.075,.07,-.028,-.075,-.015],
 [.22,.26,.20,.08,.10,.018,-.08,.04],
 [.27,.40,.60,.10,.14,.04,-.075,.065],
 [.34,.44,.78,.09,.16,.05,-.065,.08],
 [.39,.44,.80,.07,.13,.04,-.06,.06],
 [.44,.28,.52,.065,.10,.025,-.055,.04],
 [.48,.20,.34,.065,.10,.018,-.055,.035],
 [.60,0,0,.045,.065,0,-.045,0],
].map(([t,hip,chest,hinge,bend,x,y,z])=>({t,hip,chest,hinge,bend,x,y,z}));
function curve(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=Math.max(0,Math.min(1,(time-a[0])/span));
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const h0=keys[j][0]-keys[j-1][0],h1=keys[j+1][0]-keys[j][0],d0=(keys[j][1]-keys[j-1][1])/h0,d1=(keys[j+1][1]-keys[j][1])/h1;if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);};
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*slope(i+1);
}
export function acePhase(time){
 const phase=Object.fromEntries(Object.keys(ACE_KEYS[0]).filter(k=>k!=='t').map(k=>[k,Array.isArray(ACE_KEYS[0][k])?ACE_KEYS[0][k].map((_,axis)=>curve(ACE_KEYS.map(row=>[row.t,row[k][axis]]),time)):curve(ACE_KEYS.map(row=>[row.t,row[k]]),time)]));
 phase.heel=curve([[0,0],[.19,0],[.30,.35],[.42,.35],[.58,0],[.60,0]],time);
 phase.step=curve([[0,0],[.04,0],[.13,1],[.38,1],[.60,0]],time);
 Object.assign(phase,armPhase(time,false));
 return phase;
}

export const ACE_HEAVY_DURATION=.84;
export const ACE_HEAVY_IMPACT=.376;
const heavyTime=t=>t*ACE_HEAVY_DURATION/.76;
export const ACE_HEAVY_PLANTS={r:[[0,heavyTime(.24)],[heavyTime(.72),ACE_HEAVY_DURATION]],l:[[0,heavyTime(.06)],[heavyTime(.24),heavyTime(.53)],[heavyTime(.758),ACE_HEAVY_DURATION]]};
const HEAVY_KEYS=[
 [0,0,0,.045,.065,0,-.045,0],
 [.10,-.10,-.18,.07,.08,-.065,-.075,-.065],
 [.20,-.24,-.48,.07,.045,.015,-.11,.035],
 [.26,-.02,-.42,.10,.065,.025,-.13,.07],
 [.31,.30,.10,.22,.25,.045,-.13,.12],
 [.36,.48,.51,.40,.55,.105,-.15,.23],
 [.44,.52,.72,.40,.57,.125,-.155,.25],
 [.53,.50,.73,.36,.50,.12,-.15,.24],
 [.62,.29,.46,.17,.25,.04,-.09,.09],
 [.68,.12,.20,.065,.09,.01,-.055,.025],
 [.76,0,0,.045,.065,0,-.045,0],
].map(([t,hip,chest,hinge,bend,x,y,z])=>({t,hip,chest,hinge,bend,x,y,z}));
export function aceHeavyPhase(seconds){
 const time=seconds*.76/ACE_HEAVY_DURATION;
 const phase=Object.fromEntries(Object.keys(HEAVY_KEYS[0]).filter(k=>k!=='t').map(k=>[k,Array.isArray(HEAVY_KEYS[0][k])?HEAVY_KEYS[0][k].map((_,axis)=>curve(HEAVY_KEYS.map(row=>[row.t,row[k][axis]]),time)):curve(HEAVY_KEYS.map(row=>[row.t,row[k]]),time)]));
 phase.heel=curve([[0,0],[.24,0],[.39,.43],[.54,.43],[.72,0],[.76,0]],time);
 phase.step=curve([[0,0],[.06,0],[.24,1],[.53,1],[.76,0]],time);
 phase.stepDistance=.33;phase.stepOutward=.035;
 phase.footLift=time<.24?.08*Math.sin(Math.PI*phase.step):time>.53?.055*Math.sin(Math.PI*phase.step):0;
 Object.assign(phase,armPhase(seconds,true));
 return phase;
}

// Authored joint controls: upper direction, positive hinge flexion, shoulder
// roll, and forearm twist. The fixed grip determines the resulting blade path.
const ARM_KEYS=[
 // phase, upper arm in chest space, elbow flexion, humeral roll, forearm twist,
 // radial wrist deviation, collarbone lift, free-arm upper direction and flexion.
 [0,[-.20,-.95,.30],70,5,10,0,0,[.27,-.96,-.04],55],
 [.13,[-.55,-.45,.55],85,25,25,5,.06,[.32,-.94,.10],65],
 [.263,[-.65,.05,.45],95,50,35,12,.20,[.35,-.9,.15],75],
 [.310,[-.65,.05,.45],95,50,35,12,.20,[.35,-.9,.15],75],
 [.474,[-.35,-.35,.85],35,20,35,-18,0,[.25,-.90,.10],80],
 [.650,[-.15,-.65,.70],30,-30,65,-18,0,[.30,-.90,-.25],65],
 [.750,[-.15,-.75,.60],40,-15,65,-8,0,[.30,-.92,-.18],60],
 [.870,[-.25,-.85,.40],55,0,20,0,0,[.27,-.96,-.04],55],
 [.940,[-.20,-.95,.30],70,5,10,0,0,[.27,-.96,-.04],55],
 [1,[-.20,-.95,.30],70,5,10,0,0,[.27,-.96,-.04],55],
];
function armPhase(time,heavy){
 const u=time/(heavy?ACE_HEAVY_DURATION:ACE_DURATION);
 const scalar=index=>curve(ARM_KEYS.map(row=>[row[0],row[index]]),u);
 const vector=index=>new Vector3(...[0,1,2].map(axis=>curve(ARM_KEYS.map(row=>[row[0],row[index][axis]]),u))).normalize();
 return{upper:vector(1),rightFlex:scalar(2),rightHumeral:scalar(3),rightTwist:scalar(4),wrist:scalar(5),clavicleLift:scalar(6),leftUpper:vector(7),leftFlex:scalar(8),leftHumeral:0,leftTwist:0};
}
