// Native world space: +Y is up, +Z is forward, anatomical right is -X.
// The elbow and forearm determine the sword. The wrist stays close to neutral.
import {Vector3} from 'three';
export const CLEAVE_DURATION=.76;
const SECONDARY_HANDS=[[0.3308052845110779,0.3912777005572382,0.6841462958429151,0.5190505983954166],[0.08168742504203785,0.7213562134516268,0.3563808109196241,0.588188104991223],[0.13679500787620683,0.6692436346493088,0.4413639487342369,0.5818918854726362],[0.32763370871439984,0.46679218415522483,0.6496318882176478,0.5027323105211943],[0.562139161408235,-0.01756291918510153,0.7976629179866267,0.2177727895252401],[0.5776329208212588,-0.06824874026548458,0.8035669063987119,0.1263429784143004],[0.4912006899618195,0.1866777267364135,0.7769822242992511,0.34665827204549393],[0.3747686367333974,0.34598495410141505,0.7111560467108635,0.4838387528622961],[0.3308052999896031,0.39127768812971797,0.6841463018129964,0.5190505910192263]];
const SECONDARY_SWIVEL=[-0.8628607932287118,-1.5738167723787404,-1.4141486104005836,-1.0663525460661405,0.7511575446999401,1.3893297028004528,-0.6358758511227376,-0.8570589534920559,-0.8628607982274406];
export const CLEAVE_KEYS=[
 // t, hip/chest yaw, hip/chest hinge, pelvis xyz, forearm guide,
 // sword shaft direction, lead-foot step, clavicle protraction.
 [0,0,0,.07,.11,0,-.055,0,[.14,-.18,.97],[0,.92,.392],0,.30],
 [.16,.08,-.06,.03,-.07,.04,-.06,-.03,[.20,.75,.63],[0,.788,-.616],0,.05],
 [.25,.23,-.03,.08,.015,.02,-.085,.055,[.20,.62,.76],[0,.906,-.423],.6,.09],
 [.30,.28,.025,.13,.14,-.015,-.105,.105,[.20,.10,.97],[0,.961,.276],1,.16],
 [.36,.18,.13,.17,.38,-.075,-.105,.14,[.25,-.87,.42],[0,.015,1],1,.34],
 [.44,.14,.14,.19,.46,-.085,-.11,.16,[.23,-.93,.27],[0,-.174,.985],1,.42],
 [.54,.12,.09,.13,.28,-.030,-.10,.075,[.25,-.63,.74],[0,.5,.866],1,.16],
 [.65,.05,.03,.085,.16,-.01,-.065,.025,[.14,-.18,.97],[0,.85,.527],.45,.26],
 [.76,0,0,.07,.11,0,-.055,0,[.14,-.18,.97],[0,.92,.392],0,.30],
].map(([t,hip,chest,hinge,bend,x,y,z,forearm,shaft,step,protraction],i)=>({t,hip,chest,hinge,bend,x,y,z,forearm,shaft,step,protraction,leftSwivel:SECONDARY_SWIVEL[i],leftHand:SECONDARY_HANDS[i],inward:[.55,.40,.40,.40,.30,.29,.30,.55,.55][i],elbow:[50,25,40,30,18,14,28,48,50][i]*Math.PI/180,release:[0,0,0,0,10,12,4,0,0][i]*Math.PI/180}));
export function cleavePhase(time){
 let i=0;while(i<CLEAVE_KEYS.length-2&&time>CLEAVE_KEYS[i+1].t)i++;
 const a=CLEAVE_KEYS[i],b=CLEAVE_KEYS[i+1],span=b.t-a.t,u=Math.max(0,Math.min(1,(time-a.t)/span));
 const value=key=>{
  const component=k=>{
   const at=j=>k===null?CLEAVE_KEYS[j][key]:CLEAVE_KEYS[j][key][k];
   const slope=j=>{
    if(j===0||j===CLEAVE_KEYS.length-1)return 0;
    // Carry elbow rotation into and out of contact instead of compressing it into one sample.
    if(key==='leftSwivel'&&(j===3||j===4))return 1150*Math.PI/180;
    const h0=CLEAVE_KEYS[j].t-CLEAVE_KEYS[j-1].t,h1=CLEAVE_KEYS[j+1].t-CLEAVE_KEYS[j].t,d0=(at(j)-at(j-1))/h0,d1=(at(j+1)-at(j))/h1;
    if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);
   };
   return(2*u**3-3*u*u+1)*at(i)+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*at(i+1)+(u**3-u*u)*span*slope(i+1);
  };
  return Array.isArray(a[key])?a[key].map((_,k)=>component(k)):component(null);
 };
 const phase=Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,value(k)]));
 for(const key of ['forearm','shaft'])phase[key]=new Vector3().fromArray(phase[key]).normalize();
 return phase;
}
