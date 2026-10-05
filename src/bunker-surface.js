// Fine sand uses its measured two-metre scan scale. Rake grooves affect only
// shading; the analytic bunker boundary, lie, and collision surface stay intact.
export const BUNKER_SURFACE_GLSL=`
uniform sampler2D bunkerColor;
uniform sampler2D bunkerNormal;
vec2 bunkerRakeSlope(vec2 p,vec4 frame,float edge,float up,out float passColor){
 vec2 across=frame.zw,along=vec2(-across.y,across.x),local=p-frame.xy;
 float sweep=dot(local,along),track=dot(local,across)+.09*sin(sweep*.5);
 vec2 gradient=across+along*(.045*cos(sweep*.5));
 float toothPhase=track*6.2831853/.035,passPhase=track*6.2831853/.62;
 // Suppress subpixel grooves before they alias during camera motion.
 float teeth=1.-smoothstep(1.2,3.1,fwidth(toothPhase));
 float passes=1.-smoothstep(1.2,3.1,fwidth(passPhase));
 float floorMask=(1.-smoothstep(-1.1,-.15,edge))*smoothstep(.77,.96,up);
 passColor=1.+.025*cos(passPhase)*passes*floorMask;
 return gradient*(.16*sin(toothPhase)*teeth+.032*sin(passPhase)*passes)*floorMask;
}
`;
