// Native world coordinates: +Y up, +Z forward, anatomical right −X.
// The rear hand and shaft define both palm stations, separated by 0.40 m.
import {Vector3} from 'three';
export const NAGINATA_SPACING=.40;
export const NAGINATA_PRIMARY_STATION=-.36;
const rad=x=>x*Math.PI/180;
const ready={hip:rad(30),chest:rad(25),hinge:.08,bend:.17,shift:[0,-.07,-.01],rear:[.04,.98,.25],shaft:[-.40,.65,.65],step:0,protraction:.12};
const key=(t,values={})=>({t,...ready,...values});
export const NAGINATA_PROFILES={
 Ethan_Naginata_Ready:{duration:2,hit:null,replaces:'Naginata_Ready',keys:[key(0),key(2)]},
 Ethan_Naginata_Cut_Diagonal:{duration:.60,sourceDuration:.46,hit:.30,sourceHit:.19,timing:[[0,0,0],[.15,.085,0],[.30,.19,34],[.38,.25,0],[.60,.46,0]],replaces:'Naginata_Cut_Diagonal',keys:[
  key(0),
  key(.085,{hip:rad(5),chest:rad(-15),hinge:.05,bend:.12,shift:[-.03,-.09,-.05],rear:[-.02,1.26,.36],shaft:[-.45,.77,-.45],protraction:.05}),
  key(.135,{hip:rad(20),chest:rad(-12),hinge:.08,bend:.16,shift:[-.01,-.10,0],rear:[-.02,1.23,.36],shaft:[-.30,.88,.37],protraction:.08}),
  key(.19,{hip:rad(40),chest:rad(30),hinge:.12,bend:.30,shift:[0,-.11,.10],rear:[-.01,1.06,.39],shaft:[-.30,.15,.94],protraction:.22}),
  key(.25,{hip:rad(45),chest:rad(50),hinge:.15,bend:.32,shift:[.01,-.12,.12],rear:[-.02,1.06,.37],shaft:[-.50,-.30,.812],protraction:.24}),
  key(.33,{hip:rad(39),chest:rad(44),hinge:.12,bend:.24,shift:[.01,-.09,.04],rear:[.01,1.03,.31],shaft:[-.25,.20,.94],protraction:.18}),
  key(.46),
 ]},
 Ethan_Naginata_Heavy_Cleave:{duration:.92,sourceDuration:.80,hit:.46,sourceHit:.38,timing:[[0,0,0],[.24,.22,0],[.29,.27,0],[.46,.38,32],[.56,.46,0],[.65,.56,0],[.92,.80,0]],replaces:'Naginata_Heavy_Cleave',keys:[
  key(0),
  key(.10,{hip:rad(20),chest:rad(18),hinge:.04,bend:.12,shift:[0,-.06,-.04],rear:[.03,1.20,.34],shaft:[0,.89,.45],protraction:.10}),
  key(.22,{hip:rad(15),chest:rad(10),hinge:.00,bend:-.05,shift:[0,-.06,-.07],rear:[.02,1.47,.36],shaft:[-.10,.83,-.55],protraction:.03}),
  key(.27,{hip:rad(15),chest:rad(10),hinge:.04,bend:.04,shift:[0,-.07,-.03],rear:[.02,1.46,.37],shaft:[-.10,.83,-.55],step:.12,protraction:.06}),
  key(.34,{hip:rad(25),chest:rad(18),hinge:.12,bend:.24,shift:[-.01,-.12,.16],rear:[.01,1.23,.45],shaft:[-.06,.82,.57],step:1,protraction:.15}),
  key(.38,{hip:rad(30),chest:rad(35),hinge:.16,bend:.35,shift:[-.02,-.14,.24],rear:[0,1.02,.52],shaft:[-.30,.30,.905],step:1,protraction:.22}),
  key(.46,{hip:rad(30),chest:rad(42),hinge:.17,bend:.30,shift:[-.02,-.19,.28],rear:[.12,1.03,.47],shaft:[-.50,-.20,.842],step:1,protraction:.26}),
  key(.56,{hip:rad(30),chest:rad(42),hinge:.17,bend:.30,shift:[-.02,-.19,.28],rear:[.12,1.03,.47],shaft:[-.50,-.20,.842],step:1,protraction:.26}),
  key(.70,{hip:rad(22),chest:rad(20),hinge:.10,bend:.22,shift:[0,-.09,.08],rear:[.07,1.00,.34],shaft:[-.08,.10,.99],step:.1,protraction:.17}),
  key(.80),
 ]},
};
const FITTED_TARGETS={"Ethan_Naginata_Ready":[{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]}],"Ethan_Naginata_Cut_Diagonal":[{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[-0.02,1.38,0.46],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.11220220756794805,0.15875511694747935,0.132047984199686,0.9719932136227448]},{"rear":[-0.02,1.16,0.4],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.024338260586673106,0.16154480429177678,0.024658268590616945,0.9862570126838438]},{"rear":[0.18,1.03,0.36],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.3,1.06,0.38],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.14,1.04,0.3],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]}],"Ethan_Naginata_Heavy_Cleave":[{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.03,1.0999999999999999,0.34],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.035547769706199855,0.15945353803214354,0.09339601369789045,0.982134466304533]},{"rear":[0.02,1.42,0.41],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[0.009780642204238854,0.1630748716391521,-0.18093493682780853,0.969831672978906]},{"rear":[0.02,1.3599999999999999,0.42],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.0016187109504204183,0.16335989255907418,-0.11284215078307996,0.9800905949373229]},{"rear":[0.2,0.96,0.48],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.035547769706199855,0.15945353803214354,0.09339601369789045,0.982134466304533]},{"rear":[0.22,1.01,0.5],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.04658409366496731,0.1565854301634313,0.1616787428145623,0.9732270595291981]},{"rear":[0.27,0.95,0.43],"handR":[-0.00036049256492922364,-0.15882209998375066,0.08981339732956066,0.9832135903566348],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.27,0.95,0.43],"handR":[-0.00036049256492922364,-0.15882209998375066,0.08981339732956066,0.9832135903566348],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]},{"rear":[0.07,0.95,0.19],"handR":[0.05739399990602803,-0.15295553444994112,0.22917386128171152,0.9595779669006321],"handL":[-0.024338260586673106,0.16154480429177678,0.024658268590616945,0.9862570126838438]},{"rear":[0.22,1.03,0.3],"handR":[0.03554814940589381,-0.15945468264650153,0.093396115750973,0.9821342570232191],"handL":[-0.05739346460201576,0.1529544538188752,0.22917378934813198,0.9595781883482788]}]};
for(const [name,rows]of Object.entries(FITTED_TARGETS))rows.forEach((pose,i)=>Object.assign(NAGINATA_PROFILES[name].keys[i],pose));
// Every family member shares the reviewed grip and matching Ready endpoints.
const clone=value=>structuredClone(value);
const light=NAGINATA_PROFILES.Ethan_Naginata_Cut_Diagonal;
const heavy=NAGINATA_PROFILES.Ethan_Naginata_Heavy_Cleave;
light.footMotion=[{t:0,lift:0,advance:0},{t:.045,lift:.055,advance:.03},{t:.085,lift:0,advance:.06},{t:.25,lift:0,advance:.06},{t:.33,lift:.055,advance:.03},{t:.46,lift:0,advance:0}];
light.footPlants={r:[[0,0],[.085,.25],[.46,.46]],l:[[0,.46]]};
heavy.footPlants={r:[[0,.22],[.34,.56],[.8,.8]],l:[[0,.8]]};
for(const profile of Object.values(NAGINATA_PROFILES))for(const pose of profile.keys)Object.assign(pose,{facing:0,turn:0,lift:0});
function variant(name,base,{duration=base.duration,reverse=false,facing=0}={}){
 const profile=clone(base),sourceDuration=base.sourceDuration??base.duration,factor=duration/base.duration;
 profile.duration=duration;profile.replaces=name.replace('Ethan_','');profile.hit=(reverse?base.duration-base.hit:base.hit)*factor;
 if(reverse){if(profile.footMotion){profile.footMotion.reverse();for(const row of profile.footMotion)row.t=sourceDuration-row.t;}profile.keys.reverse();for(const pose of profile.keys)pose.t=sourceDuration-pose.t;profile.timing.reverse();for(const point of profile.timing){point[0]=base.duration-point[0];point[1]=sourceDuration-point[1];}if(profile.footPlants)for(const intervals of Object.values(profile.footPlants)){intervals.reverse();for(const pair of intervals){const[a,b]=pair;pair[0]=sourceDuration-b;pair[1]=sourceDuration-a;}}}
 for(const point of profile.timing){point[0]*=factor;point[2]/=factor;}
 for(const pose of profile.keys)pose.facing=facing*Math.sin(Math.PI*pose.t/sourceDuration)**2;
 NAGINATA_PROFILES[name]=profile;return profile;
}
variant('Ethan_Naginata_Cut_Return',light,{reverse:true});
variant('Ethan_Naginata_Cut_Rising',heavy,{reverse:true,duration:.82});
variant('Ethan_Naginata_Heavy_Rising',heavy,{reverse:true,duration:.96,facing:.18});
variant('Ethan_Naginata_Heavy_Slam',heavy,{duration:1.02,facing:-.12});
const readyPose=clone(light.keys[0]),forwardPose=clone(light.keys[3]),sweepLoad=clone(light.keys[2]),sweepFinish=clone(light.keys[4]);
const sweep={duration:.72,sourceDuration:.64,hit:.36,sourceHit:.32,replaces:'Naginata_Cut_Sweep',timing:[[0,0,0],[.20,.18,0],[.36,.32,18],[.49,.43,0],[.72,.64,0]],keys:[
 {...clone(readyPose),t:0},
 {...clone(sweepLoad),t:.18,facing:.40},
 {...clone(forwardPose),t:.32,facing:0},
 {...clone(sweepFinish),t:.43,facing:-.40},
 {...clone(readyPose),t:.64},
]};
sweep.footMotion=[{t:0,lift:0,advance:0},{t:.09,lift:.055,advance:.03},{t:.18,lift:0,advance:.06},{t:.43,lift:0,advance:.06},{t:.535,lift:.055,advance:.03},{t:.64,lift:0,advance:0}];
sweep.footPlants={r:[[0,0],[.18,.43],[.64,.64]],l:[[0,.64]]};
NAGINATA_PROFILES.Ethan_Naginata_Cut_Sweep=sweep;
const heavySweep={duration:1.28,sourceDuration:.98,hit:.40,impacts:[.40,.86],replaces:'Naginata_Heavy_Sweep',timing:[[0,0,0],[.22,.18,0],[.40,.32,18],[.55,.43,0],[.66,.50,0],[.86,.64,18],[1.02,.78,0],[1.28,.98,0]],keys:[
 {...clone(readyPose),t:0},
 {...clone(sweepLoad),t:.18,facing:.65},
 {...clone(forwardPose),t:.32,facing:0},
 {...clone(sweepFinish),t:.43,facing:-.65},
 {...clone(sweepFinish),t:.50,facing:-.65},
 {...clone(forwardPose),t:.64,facing:0},
 {...clone(sweepLoad),t:.78,facing:.65},
 {...clone(readyPose),t:.98},
],footMotion:[{t:0,lift:0,advance:0},{t:.09,lift:.055,advance:.03},{t:.18,lift:0,advance:.06},{t:.78,lift:0,advance:.06},{t:.88,lift:.055,advance:.03},{t:.98,lift:0,advance:0}],footPlants:{r:[[0,0],[.18,.78],[.98,.98]],l:[[0,.98]]}};
NAGINATA_PROFILES.Ethan_Naginata_Heavy_Sweep=heavySweep;
// A six-beat combination keeps each complete body motion and changes its heading.
const pieces=[['Ethan_Naginata_Cut_Diagonal',.35],['Ethan_Naginata_Cut_Return',-.35],['Ethan_Naginata_Cut_Sweep',0],['Ethan_Naginata_Cut_Rising',.3],['Ethan_Naginata_Heavy_Sweep',0],['Ethan_Naginata_Heavy_Slam',-.3]];
const guard=clone(NAGINATA_PROFILES.Ethan_Naginata_Ready);guard.replaces='Naginata_Guard_Loop';NAGINATA_PROFILES.Naginata_Guard_Loop=guard;
// Blocking keeps the same two palm stations through a small body recoil.
for(const [name,duration,peak,strength,turn,handBack]of [['Naginata_Guard_Impact',.30,.06,1.8,.10,.03],['Naginata_Guard_Break',.40,.112,2,.36,.06]]){
 const load={...clone(readyPose),t:peak,hinge:readyPose.hinge+.025*strength,bend:readyPose.bend+.055*strength,shift:[.012*strength,readyPose.shift[1]-.020*strength,readyPose.shift[2]-.015*strength],rear:[readyPose.rear[0]+.012*strength,readyPose.rear[1]-.005*strength,readyPose.rear[2]-handBack],facing:turn};
 NAGINATA_PROFILES[name]={duration,hit:null,replaces:name,keys:[{...clone(readyPose),t:0},load,{...clone(readyPose),t:duration}]};
}
const seconds=value=>Number(value.toFixed(6));
const flow={duration:0,sourceDuration:0,hit:0,impacts:[],replaces:'Naginata_Musou_Flow',timing:[],keys:[],footMotion:[],footPlants:{r:[],l:[]}};
for(const [pieceIndex,[name,facing]]of pieces.entries()){const p=NAGINATA_PROFILES[name],sourceDuration=p.sourceDuration??p.duration,turn=pieceIndex*Math.PI*2/(pieces.length-1),previousTurn=Math.max(0,pieceIndex-1)*Math.PI*2/(pieces.length-1),hopEnd=pieceIndex?p.keys[1].t:0;
 const keys=clone(p.keys);if(pieceIndex){const mid=hopEnd*.5,phase=naginataPhase(name,mid);keys.push({...phase,rear:phase.rear.toArray(),shaft:phase.shaft.toArray(),t:mid,lift:.12,turn:(turn+previousTurn)/2});keys.sort((a,b)=>a.t-b.t);}
 for(const [i,pose]of keys.entries()){if(flow.keys.length&&i===0)continue;flow.keys.push({...clone(pose),t:seconds(pose.t+flow.sourceDuration),facing:pose.facing+facing*Math.sin(Math.PI*pose.t/sourceDuration)**2,turn:pose.t===0?previousTurn:pose.turn||turn,lift:pose.lift||0});}
 for(const [i,point]of p.timing.entries()){if(flow.timing.length&&i===0)continue;flow.timing.push([seconds(point[0]+flow.duration),seconds(point[1]+flow.sourceDuration),point[2]]);}
 for(const side of ['r','l'])for(const [a,b]of p.footPlants?.[side]??[[0,sourceDuration]])if(b>=hopEnd)flow.footPlants[side].push([seconds(Math.max(a,hopEnd)+flow.sourceDuration),seconds(b+flow.sourceDuration)]);
 for(const row of p.footMotion??[{t:0,lift:0,advance:0},{t:sourceDuration,lift:0,advance:0}]){if(flow.footMotion.length&&row.t===0)continue;flow.footMotion.push({...row,t:seconds(row.t+flow.sourceDuration)});}
 flow.impacts.push(...(p.impacts??[p.hit]).map(hit=>seconds(flow.duration+hit)));flow.duration=seconds(flow.duration+p.duration);flow.sourceDuration=seconds(flow.sourceDuration+sourceDuration);
}
flow.hit=flow.impacts[0];NAGINATA_PROFILES.Ethan_Naginata_Musou_Flow=flow;
function sample(rows,t,key,component=null){
 let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;
 const a=rows[i],b=rows[i+1],h=b.t-a.t,u=Math.max(0,Math.min(1,(t-a.t)/h)),v=j=>component===null?rows[j][key]:rows[j][key][component];
 const slope=j=>{if(j===0||j===rows.length-1)return 0;const h0=rows[j].t-rows[j-1].t,h1=rows[j+1].t-rows[j].t,d0=(v(j)-v(j-1))/h0,d1=(v(j+1)-v(j))/h1;if(d0*d1<=0)return 0;return 3*(h0+h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);};
 return(2*u**3-3*u*u+1)*v(i)+(u**3-2*u*u+u)*h*slope(i)+(-2*u**3+3*u*u)*v(i+1)+(u**3-u*u)*h*slope(i+1);
}
export function naginataPhase(name,time){const rows=NAGINATA_PROFILES[name].keys,first=rows[0],phase={};for(const key of Object.keys(first)){if(key==='t')continue;phase[key]=Array.isArray(first[key])?first[key].map((_,i)=>sample(rows,time,key,i)):sample(rows,time,key);}const foot=NAGINATA_PROFILES[name].footMotion;phase.footLiftR=foot?sample(foot,time,'lift'):0;phase.footAdvanceR=foot?sample(foot,time,'advance'):0;phase.rear=new Vector3().fromArray(phase.rear);phase.shaft=new Vector3().fromArray(phase.shaft).normalize();return phase;}
