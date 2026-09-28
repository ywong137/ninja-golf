// One-handed jian cut: +Y up, +Z forward, anatomical right -X.
import {Vector3,Quaternion,Matrix4} from 'three';
export const ACE_DURATION=.60;
export const ACE_IMPACT=.27;
export const ACE_PLANTS={r:[[0,.19],[.58,ACE_DURATION]],l:[[0,.04],[.13,.38],[.598,ACE_DURATION]]};
export const ACE_KEYS=[
 // t, pelvis/chest turn and hinge, pelvis xyz, upper arm, free arm.
 [0,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.46]],
 [.07,-.08,-.16,.06,.075,-.01,-.055,-.01,[-.65,-.40,.65],[.20,-.94,-.16],[.05,-.45,.89]],
 [.10,-.15,-.28,.07,.085,-.018,-.065,-.018,[-.75,.20,.63],[.32,-.88,-.30],[.10,.02,.99]],
 [.15,-.24,-.52,.075,.07,-.028,-.075,-.015,[-.70,.55,.46],[.32,-.88,-.30],[.10,.02,.99]],
 [.22,.26,.20,.08,.10,.018,-.08,.04,[-.65,.45,.61],[.32,-.88,-.30],[.10,.02,.99]],
 [.27,.40,.60,.10,.14,.04,-.075,.065,[-.50,.25,.83],[.32,-.88,-.30],[.10,.02,.99]],
 [.34,.44,.78,.09,.16,.05,-.065,.08,[.45,-.45,.77],[.32,-.88,-.30],[.10,.02,.99]],
 [.39,.44,.80,.07,.13,.04,-.06,.06,[.40,-.55,.73],[.32,-.88,-.30],[.10,.02,.99]],
 [.44,.28,.52,.065,.10,.025,-.055,.04,[.15,-.55,.82],[.27,-.90,-.30],[.10,.02,.99]],
 [.48,.20,.34,.065,.10,.018,-.055,.035,[-.35,-.40,.85],[.20,-.95,-.15],[.0,-.20,.98]],
 [.60,0,0,.045,.065,0,-.045,0,[-.20,-.95,.30],[.18,-.97,-.10],[.22,-.86,.46]],
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
