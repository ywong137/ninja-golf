// Regional surfaces retain the existing CC0 photo textures in linear color space.
// Fine stone uses triplanar mapping; larger grass/stone patches avoid obvious tiling.
export const LANDSCAPE_GLSL=`
uniform sampler2D regionalColor;
uniform float hasRegionalColor;
uniform vec4 regionalFrame;
uniform sampler2D landRockNormal;
vec3 geologyWeights(vec3 n){vec3 w=max(pow(abs(n),vec3(4.))-vec3(.015),vec3(0.));return w/max(.001,w.x+w.y+w.z);}
vec3 geologyRock(vec3 p,vec3 n){
 vec3 w=geologyWeights(n),s=sign(n+vec3(.00001)),rock=vec3(0.);
 vec2 ux=vec2(-p.z*s.x,p.y)/24.,uy=vec2(p.x,-p.z)/24.,uz=vec2(p.x*s.z,p.y)/24.;
 vec2 xx=dFdx(ux),xy=dFdy(ux),yx=dFdx(uy),yy=dFdy(uy),zx=dFdx(uz),zy=dFdy(uz);
 if(w.x>0.)rock+=groundSample(landRock,ux,xx,xy)*w.x;
 if(w.y>0.)rock+=groundSample(landRock,uy,yx,yy)*w.y;
 if(w.z>0.)rock+=groundSample(landRock,uz,zx,zy)*w.z;
 return rock;
}
vec3 regionalSurface(vec3 p,vec3 fallback,vec3 rock,float theme){
 if(hasRegionalColor<.5)return fallback;
 // The inner ring is invented terrain. Match imagery only after its heights
 // have converged to the surveyed grid, avoiding painted sea on raised banks.
 float outside=length(vec2(max(0.,abs(p.x)-375.),max(0.,max(-165.-p.z,p.z-courseShape.x-165.))));
 float amount=smoothstep(900.,2000.,outside)*.85;
 if(amount<.001)return fallback;
 vec3 photo=texture2D(regionalColor,p.xz*regionalFrame.zw+regionalFrame.xy).rgb;
 if(theme>1.5)photo*=.55;
 float mean=dot(textureLod(landRock,vec2(.5),16.).rgb,vec3(.2126,.7152,.0722));
 float detail=clamp(dot(rock,vec3(.2126,.7152,.0722))/max(.01,mean),.60,1.5);
 return mix(fallback,photo*mix(1.,detail,.55),amount);
}
vec3 landscapeAlbedo(vec3 p,vec3 n,float theme,out float rockMask){
 float slope=1.-clamp(n.y,0.,1.);
 float weather=groundNoise(p.xz*.0035),erosion=groundNoise(vec2(p.x*.009+p.z*.003,p.y*.022));
 float detail=groundNoise(p.xz*.032);
 vec3 cover=groundSample(landCliff,vec2(p.x,-p.z)/110.);
 vec3 rock=geologyRock(p,n);
 rockMask=smoothstep(.08,.40,slope+(weather-.5)*.10);
 vec3 meadow=cover*vec3(.20,.40,.22)*(.80+.28*weather);
 vec3 stone=rock*vec3(.12,.17,.14);
 if(theme>.5&&theme<1.5){
  meadow=cover*vec3(.43,.38,.30)*(.78+.22*weather);
  rockMask=smoothstep(.09,.37,slope+(erosion-.5)*.12+p.y*.00007);
  stone=rock*vec3(.15,.17,.18);
 }
 if(theme>1.5&&theme<2.5){
  // Shallow sediment bands follow elevation, with weathered breaks along the faces.
  float layers=groundNoise(vec2(p.y*.060+erosion*.65,p.x*.001+p.z*.001));
  float ledges=smoothstep(.35,.70,layers);
  vec3 sandstone=rock*mix(vec3(.50,.22,.095),vec3(.67,.35,.17),ledges);
  vec3 talus=texture2D(sandColor,p.xz/18.).rgb*vec3(.69,.43,.25);
  rockMask=smoothstep(.025,.17,slope+(erosion-.5)*.05);
  return regionalSurface(p,mix(talus,sandstone,rockMask)*(.86+.24*weather+.06*detail),rock,theme);
 }
 return regionalSurface(p,mix(meadow,stone,rockMask)*(.94+.12*detail),rock,theme);
}
vec3 landscapeNormal(vec3 p,vec3 n,float rockMask,sampler2D groundNormalSource){
 float amount=1.-smoothstep(1100.,3800.,distance(cameraPosition,p));
 if(amount<.001)return n;
 vec3 w=geologyWeights(n),s=sign(n+vec3(.00001));
 vec2 ux=vec2(-p.z*s.x,p.y)/24.,uy=vec2(p.x,-p.z)/24.,uz=vec2(p.x*s.z,p.y)/24.;
 vec2 xx=dFdx(ux),xy=dFdy(ux),yx=dFdx(uy),yy=dFdy(uy),zx=dFdx(uz),zy=dFdy(uz);
 vec2 a=vec2(0.),b=vec2(0.),c=vec2(0.);
 if(w.x>0.)a=groundSample(landRockNormal,ux,xx,xy).xy*2.-1.;
 if(w.y>0.)b=groundSample(landRockNormal,uy,yx,yy).xy*2.-1.;
 if(w.z>0.)c=groundSample(landRockNormal,uz,zx,zy).xy*2.-1.;
 vec3 stone=vec3(0.,a.y,-a.x*s.x)*w.x+vec3(b.x,0.,-b.y)*w.y+vec3(c.x*s.z,c.y,0.)*w.z;
 vec2 top=groundSample(groundNormalSource,vec2(p.x,-p.z)/18.).xy*2.-1.;
 vec3 detail=mix(vec3(top.x,0.,-top.y)*.17,stone*.30,rockMask);
 return normalize(n+detail*amount);
}
`;
