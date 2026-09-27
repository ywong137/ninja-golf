// Profiles keep the original [x,z,rx,rz] API. Contours never exceed its ellipse.
const profiles=new WeakMap();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function bunkerProfile(b){
 if(profiles.has(b))return profiles.get(b);
 let seed=2166136261;for(const value of b){seed=Math.imul(seed^Math.round(value*100),16777619)>>>0;}
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const profile=[random()*Math.PI*2,random()*Math.PI*2,.9+random()*.45,.16+random()*.12];profiles.set(b,profile);return profile;
}
export function bunkerRadius(angle,profile){return .84+.085*Math.sin(angle*3+profile[0])+.055*Math.sin(angle*5+profile[1])+.02*Math.cos(angle*8-profile[0]);}
export function bunkerDistance(x,z,b){const ux=(x-b[0])/b[2],uz=(z-b[1])/b[3],r=bunkerRadius(Math.atan2(uz,ux),bunkerProfile(b));return(Math.hypot(ux,uz)/r-1)*Math.min(b[2],b[3]);}
export function bunkerHeightOffset(x,z,b){
 const radius=Math.min(b[2],b[3]),reach=1+1.4/radius;
 if(Math.abs(x-b[0])>b[2]*reach||Math.abs(z-b[1])>b[3]*reach)return 0;
 const d=bunkerDistance(x,z,b),profile=bunkerProfile(b);
 // A broad floor rises into a steeper sand face, then a low rounded turf lip.
 const bowl=-profile[2]*(1-smooth(-radius*.62,.18,d));
 const lip=profile[3]*smooth(-.18,.18,d)*(1-smooth(.38,1.4,d));
 return bowl+lip;
}
export function bunkerOutline(b,count=96,offset=0){const profile=bunkerProfile(b),scale=1+offset/Math.min(b[2],b[3]);return Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count,r=bunkerRadius(a,profile)*scale;return[b[0]+Math.cos(a)*b[2]*r,b[1]+Math.sin(a)*b[3]*r];});}
// Profiles are uploaded from CPU, avoiding platform-dependent sine hashes.
export const BUNKER_GLSL=`
float bunkerRadius(float angle,vec4 profile){return .84+.085*sin(angle*3.+profile.x)+.055*sin(angle*5.+profile.y)+.02*cos(angle*8.-profile.x);}
float bunkerDistance(vec2 p,vec4 basin,vec4 profile){vec2 u=(p-basin.xy)/basin.zw;float angle=dot(u,u)<.00000001?0.:atan(u.y,u.x);return(length(u)/bunkerRadius(angle,profile)-1.)*min(basin.z,basin.w);}
`;
