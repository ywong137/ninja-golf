// Shared polar shorelines retain the authored basin envelope and hazard anchors.
// Two unequal inlets and broad shoulders create coves, not high-frequency noise.
const TAU=Math.PI*2;
const fract=x=>x-Math.floor(x);
const profiles=new WeakMap();
export function shorelineProfile(b,island=false){
 let pair=profiles.get(b);if(pair?.[island?1:0])return pair[island?1:0];
 if(!pair){pair=[];profiles.set(b,pair);}
 if(b.shoreline)return pair[island?1:0]=[...b.shoreline,island?1:0];
 const seed=b[0]*.017+b[1]*.013+b[2]*.071+b[3]*.037;
 return pair[island?1:0]=[fract(seed*.618033989)*TAU,fract(seed*.414213562+.27)*TAU,fract(seed*.732050808+.53)*TAU,island?1:0];
}
export function shorelineRadius(angle,profile){
 const [p,q,c,island]=profile,v=Math.max(0,Math.cos(angle-c)),w=Math.max(0,Math.cos(angle-c-Math.PI-.35*Math.sin(p)));
 return island?1.21+.055*Math.cos(angle-p)+.035*Math.cos(2*angle-q)-.11*v**4:.91+.04*Math.cos(angle-p)+.045*Math.cos(2*angle-q)-.28*v**4-.18*w**8;
}
function radiusDerivative(a,p){const v=Math.max(0,Math.cos(a-p[2])),secondary=a-p[2]-Math.PI-.35*Math.sin(p[0]),w=Math.max(0,Math.cos(secondary));return p[3]?-.055*Math.sin(a-p[0])-.07*Math.sin(2*a-p[1])+.44*v**3*Math.sin(a-p[2]):-.04*Math.sin(a-p[0])-.09*Math.sin(2*a-p[1])+1.12*v**3*Math.sin(a-p[2])+1.44*w**7*Math.sin(secondary);}
export function shorelineDistance(x,z,b,island=false){
 const qx=(x-b[0])/b[2],qz=(z-b[1])/b[3],rho=Math.hypot(qx,qz),profile=shorelineProfile(b,island);
 if(rho<1e-7)return -Math.min(b[2],b[3])*.75;
 const a=Math.atan2(qz,qx),radius=shorelineRadius(a,profile),derivative=radiusDerivative(a,profile);
 const denominator=rho*Math.max(.45,rho),gx=(qx/rho+derivative*qz/denominator)/b[2],gz=(qz/rho-derivative*qx/denominator)/b[3];
 const distance=(rho-radius)/Math.max(.0001,Math.hypot(gx,gz)),t=Math.min(1,rho/.45),blend=t*t*(3-2*t);
 // First-order contour distance is local. Blend its deep interior to a bowl
 // instead of letting the polar angular derivative create a shallow center spike.
 return -Math.min(b[2],b[3])*.75*(1-blend)+distance*blend;
}
export function shorelinePoint(b,angle,island=false){const r=shorelineRadius(angle,shorelineProfile(b,island));return[b[0]+Math.cos(angle)*b[2]*r,b[1]+Math.sin(angle)*b[3]*r];}
export function shorelineOutline(b,island=false,count=192){return Array.from({length:count},(_,i)=>shorelinePoint(b,i/count*TAU,island));}
export const SHORELINE_GLSL=`
float shoreRadius(float a,vec4 s){float v=max(0.,cos(a-s.z)),w=max(0.,cos(a-s.z-3.14159265359-.35*sin(s.x)));return s.w>.5?1.21+.055*cos(a-s.x)+.035*cos(2.*a-s.y)-.11*v*v*v*v:.91+.04*cos(a-s.x)+.045*cos(2.*a-s.y)-.28*v*v*v*v-.18*w*w*w*w*w*w*w*w;}
float shoreDerivative(float a,vec4 s){float v=max(0.,cos(a-s.z)),secondary=a-s.z-3.14159265359-.35*sin(s.x),w=max(0.,cos(secondary));return s.w>.5?-.055*sin(a-s.x)-.07*sin(2.*a-s.y)+.44*v*v*v*sin(a-s.z):-.04*sin(a-s.x)-.09*sin(2.*a-s.y)+1.12*v*v*v*sin(a-s.z)+1.44*w*w*w*w*w*w*w*sin(secondary);}
float shoreDistance(vec2 p,vec4 b,vec4 s){vec2 q=(p-b.xy)/b.zw;float rho=length(q);if(rho<.0000001)return -min(b.z,b.w)*.75;float a=atan(q.y,q.x),r=shoreRadius(a,s),dr=shoreDerivative(a,s);vec2 gradient=(q/rho+dr*vec2(q.y,-q.x)/(rho*max(.45,rho)))/b.zw;float distance=(rho-r)/max(.0001,length(gradient));return mix(-min(b.z,b.w)*.75,distance,smoothstep(0.,.45,rho));}
`;
