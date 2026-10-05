import {Vector4} from 'three';

// angle, pass width in metres, grain contrast, pattern (stripes / half / cross).
export function mowingProfile(course){
 const angle=Math.atan2(course.greenX,course.length),variation=(course.seed%5-2)*.045;
 const profile={
  japanese:[angle+.38+variation,5.6,.22,0],
  highlands:[angle,7.,.20,1],
  desert:[angle-.48+variation,6.2,.23,2],
  cyberpunk:[angle+Math.PI/4,4.8,.25,2]
 }[course.theme];
 if(!profile)throw new Error(`No mowing profile for course theme: ${course.theme}`);
 return new Vector4(...profile);
}

export const TURF_MOWING_GLSL=`
uniform vec4 mowingProfile;
// Fade unresolved bands instead of producing distant moire or crawling lines.
float mowingBand(float across,float width){
 float coordinate=across/width;
 float footprint=fwidth(coordinate);
 float transition=max(.07,footprint*1.57);
 float band=smoothstep(-transition,transition,sin(coordinate*3.14159265))*2.-1.;
 return band*(1.-smoothstep(.35,1.2,footprint));
}
vec2 mowingAxis(float angle){return vec2(sin(angle),cos(angle));}
vec2 stripGrain(vec2 p,vec2 axis,float width){
 // Passes run along the grain; alternating bands lie ACROSS that direction.
 return axis*mowingBand(dot(p,vec2(axis.y,-axis.x)),width);
}
vec2 fairwayGrain(vec2 p,vec3 frame,float edge){
 vec2 axis=mowingAxis(mowingProfile.x);
 vec2 grain=stripGrain(p,axis,mowingProfile.y);
 if(mowingProfile.w>.5&&mowingProfile.w<1.5){
  // The nearest authored route supplies each branch's actual centre and direction.
  grain=frame.xy*(smoothstep(-.45,.45,frame.z)*2.-1.);
 }else if(mowingProfile.w>1.5){
  vec2 crossAxis=vec2(axis.y,-axis.x);
  grain=grain*.72+stripGrain(p,crossAxis,mowingProfile.y)*.28;
 }
 // Continuous cleanup passes follow the fairway perimeter.
 float cleanup=smoothstep(-2.2,-1.1,edge);
 return mix(grain,frame.xy*.45,cleanup);
}
float grainShade(vec2 grain,vec3 view,float strength){
 // Grass bent toward the viewer looks darker; the opposite view reverses it.
 return 1.-strength*dot(grain,view.xz);
}
`;
