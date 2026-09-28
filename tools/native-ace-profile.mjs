// One-handed jian cut: +Y up, +Z forward, anatomical right -X.
import {Vector3,Quaternion,Matrix4} from 'three';
export const ACE_DURATION=.60;
export const ACE_IMPACT=.27;
export const ACE_PLANTS={r:[[0,.19],[.58,ACE_DURATION]],l:[[0,.04],[.13,.38],[.598,ACE_DURATION]]};
export const ACE_KEYS=[
 // t, pelvis/chest turn and hinge, pelvis xyz, upper arm, free arm.
 [0,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.54]],
 [.07,-.08,-.16,.06,.075,-.01,-.055,-.01,[-.65,-.40,.65],[.20,-.94,-.16],[.05,-.45,.89]],
 [.10,-.15,-.28,.07,.085,-.018,-.065,-.018,[-.75,.20,.63],[.32,-.88,-.30],[.10,.02,.99]],
 [.15,-.24,-.52,.075,.07,-.028,-.075,-.015,[-.70,.55,.46],[.32,-.88,-.30],[.10,.02,.99]],
 [.22,.26,.20,.08,.10,.018,-.08,.04,[-.65,.45,.61],[.32,-.88,-.30],[.10,.02,.99]],
 [.27,.40,.60,.10,.14,.04,-.075,.065,[-.50,.25,.83],[.32,-.88,-.30],[.10,.02,.99]],
 [.34,.44,.78,.09,.16,.05,-.065,.08,[.45,-.45,.77],[.32,-.88,-.30],[.10,.02,.99]],
 [.39,.44,.80,.07,.13,.04,-.06,.06,[.40,-.55,.73],[.32,-.88,-.30],[.10,.02,.99]],
 [.44,.28,.52,.065,.10,.025,-.055,.04,[.15,-.55,.82],[.27,-.90,-.30],[.10,.02,.99]],
 [.48,.20,.34,.065,.10,.018,-.055,.035,[-.35,-.40,.85],[.20,-.95,-.15],[.0,-.20,.98]],
 [.60,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.54]],
].map(([t,hip,chest,hinge,bend,x,y,z,upper,leftUpper,leftLower])=>({t,hip,chest,hinge,bend,x,y,z,upper,leftUpper,leftLower}));
const Z=new Vector3(0,0,1),DOWN_LEFT=new Vector3(Math.SQRT1_2,-Math.SQRT1_2,0);
const NORMAL=new Vector3().crossVectors(DOWN_LEFT,Z).normalize();
const contact=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(DOWN_LEFT.clone().negate(),Z,NORMAL.clone().negate()));
const readyShaft=new Vector3(0,.96,.28).normalize(),readyEdge=new Vector3(0,.28,-.96).normalize();
const ready=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(readyEdge,readyShaft,new Vector3().crossVectors(readyEdge,readyShaft)));
const arc=angle=>new Quaternion().setFromAxisAngle(NORMAL,-angle*Math.PI/180).multiply(contact);
const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
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
 for(const key of ['upper','leftUpper','leftLower'])phase[key]=new Vector3().fromArray(phase[key]).normalize();
 const weapon=time<.15?ready.clone().slerp(arc(-80),smooth(time/.15)):time<.39?arc(curve([[.15,-80],[.22,-40],[.27,0],[.34,40],[.39,45]],time)):arc(45).slerp(ready,smooth((time-.39)/.21));
 // The measured, neutral wrist makes 75 degrees with the handle. The fixed
 // mounting roll puts the forearm and the cutting edge in the same plane.
 phase.shaft=new Vector3(0,1,0).applyQuaternion(weapon);
 phase.forearm=new Vector3(-Math.sin(75*Math.PI/180),Math.cos(75*Math.PI/180),0).applyQuaternion(weapon);
 return phase;
}

export const ACE_HEAVY_DURATION=.76;
export const ACE_HEAVY_IMPACT=.36;
export const ACE_HEAVY_PLANTS={r:[[0,.24],[.72,ACE_HEAVY_DURATION]],l:[[0,.06],[.24,.53],[.758,ACE_HEAVY_DURATION]]};
const HEAVY_KEYS=[
 [0,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.54]],
 [.10,-.10,-.18,.07,.08,-.065,-.075,-.065,[-.55,-.25,.80],[.25,-.93,-.22],[.10,-.30,.95]],
 [.20,-.24,-.48,.07,.045,.015,-.11,.035,[-.48,.70,.53],[.32,-.88,-.30],[.10,.02,.99]],
 [.26,-.02,-.42,.10,.065,.025,-.13,.07,[-.45,.72,.53],[.32,-.88,-.30],[.10,.02,.99]],
 [.31,.30,.10,.22,.25,.045,-.13,.12,[-.43,.53,.73],[.32,-.88,-.30],[.10,.02,.99]],
 [.36,.48,.51,.40,.55,.105,-.15,.23,[-.35,.15,.925],[.32,-.88,-.30],[.10,.02,.99]],
 [.44,.52,.72,.40,.57,.125,-.155,.25,[.22,-.55,.805],[.32,-.88,-.30],[.10,.02,.99]],
 [.53,.50,.73,.36,.50,.12,-.15,.24,[.26,-.64,.72],[.32,-.88,-.30],[.10,.02,.99]],
 [.62,.29,.46,.17,.25,.04,-.09,.09,[-.60,-.40,.69],[.24,-.93,-.24],[.05,-.25,.96]],
 [.68,.12,.20,.065,.09,.01,-.055,.025,[-.55,-.60,.58],[.21,-.96,-.18],[.10,-.55,.83]],
 [.76,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.54]],
].map(([t,hip,chest,hinge,bend,x,y,z,upper,leftUpper,leftLower])=>({t,hip,chest,hinge,bend,x,y,z,upper,leftUpper,leftLower}));
const heavyDown=new Vector3(.20,-.98,0).normalize(),heavyNormal=new Vector3().crossVectors(heavyDown,Z).normalize();
const heavyContact=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(heavyDown.clone().negate(),Z,heavyNormal.clone().negate()));
const heavyArc=angle=>new Quaternion().setFromAxisAngle(heavyNormal,-angle*Math.PI/180).multiply(heavyContact);
export function aceHeavyPhase(time){
 const phase=Object.fromEntries(Object.keys(HEAVY_KEYS[0]).filter(k=>k!=='t').map(k=>[k,Array.isArray(HEAVY_KEYS[0][k])?HEAVY_KEYS[0][k].map((_,axis)=>curve(HEAVY_KEYS.map(row=>[row.t,row[k][axis]]),time)):curve(HEAVY_KEYS.map(row=>[row.t,row[k]]),time)]));
 phase.heel=curve([[0,0],[.24,0],[.39,.43],[.54,.43],[.72,0],[.76,0]],time);
 phase.step=curve([[0,0],[.06,0],[.24,1],[.53,1],[.76,0]],time);
 phase.stepDistance=.33;phase.stepOutward=.035;
 phase.freeArmBend=Math.max(0,phase.bend-.065);
 phase.footLift=time<.24?.08*Math.sin(Math.PI*phase.step):time>.53?.055*Math.sin(Math.PI*phase.step):0;
 for(const key of ['upper','leftUpper','leftLower'])phase[key]=new Vector3().fromArray(phase[key]).normalize();
 const weapon=time<.20?ready.clone().slerp(heavyArc(-90),smooth(time/.20)):time<.53?heavyArc(curve([[.20,-90],[.28,-65],[.32,-38],[.36,0],[.44,45],[.49,50],[.53,50]],time)):heavyArc(50).slerp(ready,smooth((time-.53)/.23));
 phase.shaft=new Vector3(0,1,0).applyQuaternion(weapon);
 phase.forearm=new Vector3(-Math.sin(75*Math.PI/180),Math.cos(75*Math.PI/180),0).applyQuaternion(weapon);
 return phase;
}
