// Native world space: +Y is up, +Z is forward, anatomical right is -X.
// The elbow and forearm determine the sword. The wrist stays close to neutral.
// The shaft fit has no blade-roll information. This fixed mounting aligns the
// honed edge with the complete contact arc. It does not rotate any hand bones.
const BASE_BODY_KEYS=[
 // t, hip/chest yaw, hip/chest hinge, pelvis xyz, step, protraction, rear heel.
 [0,0,0,.07,.11,0,-.055,0,0,.30,0],
 [.16,-.20,-.38,.05,-.06,0,-.045,-.03,0,.05,0],
 [.25,.30,-.12,.08,.02,.02,-.05,.08,.6,.16,.4],
 [.30,.46,.10,.14,.16,-.04,-.085,.15,1,.25,.9],
 [.36,.40,.40,.18,.20,-.06,-.11,.20,1,.25,1],
 [.44,.34,.50,.20,.26,-.07,-.13,.23,1,.25,1],
 [.54,.20,.27,.14,.20,-.04,-.10,.13,1,.24,.5],
 [.65,.05,.03,.085,.16,-.01,-.065,.025,.45,.26,0],
 [.76,0,0,.07,.11,0,-.055,0,0,.30,0],
].map(([t,hip,chest,hinge,bend,x,y,z,step,protraction,heel])=>({t,hip,chest,hinge,bend,x,y,z,step,protraction,heel}));

// Native controls: upper-arm azimuth/elevation, humeral roll, elbow flexion,
// forearm twist, and two small wrist swings. All values use degrees.
const BASE_READY=[-2.4774317410582762,-33.07033274075599,-7.9243203997678,53.8858776515589,38.6988450891282,-13.172824201635642,-2.45697053334219];
const BASE_ARM_KEYS=[
 [0,BASE_READY],
 [.16,[20.18,43.62,58.49,22.15,16.07,-12.63,-1.04]],
 [.36,[-23.386229525891352,-49.90786338939209,4.326299303504519,51.06710392645979,68.49999990836908,-2.186357585140961,-13.220683386068483]],
 [.44,[-26.9137492193672,-48.19827766738061,-0.1520119421366808,49.88928285398716,68.4999999974678,-9.232842172183677,-9.712117539103392]],
 [.76,BASE_READY],
].map(([t,control])=>({t,control}));
function interpolateBaseline(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],span=b.t-a.t,u=Math.max(0,Math.min(1,(time-a.t)/span));
 const value=key=>{
  const component=k=>{
   const at=j=>k===null?keys[j][key]:keys[j][key][k];
   const slope=j=>{
    if(j===0||j===keys.length-1)return 0;
    const h0=keys[j].t-keys[j-1].t,h1=keys[j+1].t-keys[j].t,d0=(at(j)-at(j-1))/h0,d1=(at(j+1)-at(j))/h1;
    if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);
   };
   return(2*u**3-3*u*u+1)*at(i)+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*at(i+1)+(u**3-u*u)*span*slope(i+1);
  };
  return Array.isArray(a[key])?a[key].map((_,k)=>component(k)):component(null);
 };
 const phase=Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,value(k)]));
 return phase;
}

const BASE_ELBOW_KEYS=[{"t":0,"secondaryElbow":[0.23648180032210955,1.1340776660637073,0.22151082360308916]},{"t":0.08,"secondaryElbow":[0.14467541991743296,1.3003794763061136,0.3304182476599898]},{"t":0.16,"secondaryElbow":[0.0928247217096903,1.5262260231807059,0.29393502942000627]},{"t":0.25,"secondaryElbow":[0.19911227362782358,1.3706302809073325,0.43486952752019287]},{"t":0.3,"secondaryElbow":[0.18701968693034843,1.1834922081305126,0.4762171719301519]},{"t":0.36,"secondaryElbow":[0.22406544565382314,1.0677758811860847,0.3887188427731453]},{"t":0.44,"secondaryElbow":[0.20731623440393115,1.0486837716317607,0.41528032861607567]},{"t":0.54,"secondaryElbow":[0.22813001356738793,1.0988179765369979,0.3571659341747838]},{"t":0.65,"secondaryElbow":[0.2481720019012756,1.141195419297451,0.2811045898317438]},{"t":0.76,"secondaryElbow":[0.23648180032210955,1.1340776660637073,0.22151082360308916]}];
function baselinePhase(time){
 const phase={...interpolateBaseline(BASE_BODY_KEYS,time),...interpolateBaseline(BASE_ARM_KEYS,time),...interpolateBaseline(BASE_ELBOW_KEYS,time)};
 return phase;
}

// Retain the accepted motion through contact, then continue into the finish.
// Native world space: +Y is up, +Z is forward, anatomical right is -X.
// The elbow and forearm determine the sword. The wrist stays close to neutral.
export const CLEAVE_DURATION=.76;
// The shaft fit has no blade-roll information. This fixed mounting aligns the
// honed edge with the complete contact arc. It does not rotate any hand bones.
export const CLEAVE_MOUNT_ROLL=-100*Math.PI/180;
export const CLEAVE_KEYS=[
 // t, hip/chest yaw, hip/chest hinge, pelvis xyz, step, protraction, rear heel.
 [0,0,0,.07,.11,0,-.055,0,0,.30,0],
 [.16,-.20,-.38,.05,-.06,0,-.045,-.03,0,.05,0],
 [.25,.30,-.12,.08,.02,.02,-.05,.08,.6,.16,.4],
 [.30,.46,.10,.14,.16,-.04,-.085,.15,1,.25,.9],
 [.36,.40,.40,.18,.20,-.06,-.11,.20,1,.25,1],
 [.46,.34,.50,.22,.325,-.07,-.13,.25,1,.25,1],
 [.50,.34,.50,.22,.325,-.07,-.13,.25,1,.25,1],
 [.58,.20,.27,.14,.20,-.04,-.10,.13,1,.24,.5],
 [.65,.05,.03,.085,.16,-.01,-.065,.025,.45,.26,0],
 [.76,0,0,.07,.11,0,-.055,0,0,.30,0],
].map(([t,hip,chest,hinge,bend,x,y,z,step,protraction,heel])=>({t,hip,chest,hinge,bend,x,y,z,step,protraction,heel}));

// Native controls: upper-arm azimuth/elevation, humeral roll, elbow flexion,
// forearm twist, and two small wrist swings. All values use degrees.
const READY=[-2.4774317410582762,-33.07033274075599,-7.9243203997678,53.8858776515589,38.6988450891282,-13.172824201635642,-2.45697053334219];
const ARM_KEYS=[
 [0,READY],
 [.16,[20.18,43.62,58.49,22.15,16.07,-12.63,-1.04]],
 [.36,[-23.386229525891352,-49.90786338939209,4.326299303504519,51.06710392645979,68.49999990836908,-2.186357585140961,-13.220683386068483]],
 [.46,[-29.507243545233152, -59.89217926978663, -20.41918866261292, 44.608403553145365, 68.4999999987275, -12.604174966894266, -4.5507935363849334]],
 [.50,[-29.507243545233152, -59.89217926978663, -20.41918866261292, 44.608403553145365, 68.4999999987275, -12.604174966894266, -4.5507935363849334]],
 [.76,READY],
].map(([t,control])=>({t,control}));
function interpolate(keys,time){
 let i=0;while(i<keys.length-2&&time>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],span=b.t-a.t,u=Math.max(0,Math.min(1,(time-a.t)/span));
 const value=key=>{
  const component=k=>{
   const at=j=>k===null?keys[j][key]:keys[j][key][k];
   const slope=j=>{
    if(j===0||j===keys.length-1)return 0;
    const h0=keys[j].t-keys[j-1].t,h1=keys[j+1].t-keys[j].t,d0=(at(j)-at(j-1))/h0,d1=(at(j+1)-at(j))/h1;
    if(d0*d1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return(w0+w1)/(w0/d0+w1/d1);
   };
   return(2*u**3-3*u*u+1)*at(i)+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*at(i+1)+(u**3-u*u)*span*slope(i+1);
  };
  return Array.isArray(a[key])?a[key].map((_,k)=>component(k)):component(null);
 };
 const phase=Object.fromEntries(Object.keys(a).filter(k=>k!=='t').map(k=>[k,value(k)]));
 return phase;
}

const ELBOW_KEYS=[{"t": 0, "secondaryElbow": [0.23648180032210955, 1.1340776660637073, 0.22151082360308916]}, {"t": 0.08, "secondaryElbow": [0.14467541991743296, 1.3003794763061136, 0.3304182476599898]}, {"t": 0.16, "secondaryElbow": [0.0928247217096903, 1.5262260231807059, 0.29393502942000627]}, {"t": 0.25, "secondaryElbow": [0.19911227362782358, 1.3706302809073325, 0.43486952752019287]}, {"t": 0.3, "secondaryElbow": [0.18701968693034843, 1.1834922081305126, 0.4762171719301519]}, {"t": 0.36, "secondaryElbow": [0.22406544565382314, 1.0677758811860847, 0.3887188427731453]}, {"t": 0.46, "secondaryElbow": [0.21052252696567442, 1.000712917854546, 0.355316053558104]}, {"t": 0.5, "secondaryElbow": [0.21052252696567442, 1.000712917854546, 0.355316053558104]}, {"t": 0.58, "secondaryElbow": [0.22813001356738793, 1.0988179765369979, 0.3571659341747838]}, {"t": 0.65, "secondaryElbow": [0.2481720019012756, 1.141195419297451, 0.2811045898317438]}, {"t": 0.76, "secondaryElbow": [0.23648180032210955, 1.1340776660637073, 0.22151082360308916]}];
export function cleavePhase(time){
 const phase={...interpolate(CLEAVE_KEYS,time),...interpolate(ARM_KEYS,time),...interpolate(ELBOW_KEYS,time)};
 if(time<=.36)return baselinePhase(time);
 if(time<.40){const base=baselinePhase(time),u=(time-.36)/.04,w=u*u*(3-2*u);for(const key of Object.keys(phase))phase[key]=Array.isArray(phase[key])?phase[key].map((v,i)=>base[key][i]+(v-base[key][i])*w):base[key]+(phase[key]-base[key])*w;}
 return phase;
}
