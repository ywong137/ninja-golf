import * as THREE from 'three';
import {LANDSCAPE_GLSL} from './landscape-material.js';
import {BUNKER_GLSL,bunkerProfile} from './bunkers.js';
import {fairwayPrimitives,FAIRWAY_GLSL,MAX_FAIRWAY_SEGMENTS,waterBasins} from './course-layout.js';
// Course boundaries use the same analytic shapes as lieAt. They stay crisp at any mesh resolution.
export function courseMaterial(c, textures, distant=false) {
  const mat=new THREE.MeshStandardMaterial({map:textures.grassColor,normalMap:textures.grassNormal,normalScale:new THREE.Vector2(.36,.36),roughness:.96});
  mat.onBeforeCompile=shader=>{
    const routes=fairwayPrimitives(c);
    Object.assign(shader.uniforms,{routeCount:{value:routes.length},routeSegments:{value:Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new THREE.Vector4(...(routes[i]?.slice(0,4)||[9999,9999,9999,9999])))},routeWidths:{value:Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new THREE.Vector2(...(routes[i]?.slice(4)||[0,0])))},courseWeave:{value:c.weave||0},courseCoastal:{value:c.coastal===false?0:1},courseTheme:{value:({japanese:0,highlands:1,desert:2,cyberpunk:3})[c.theme]||0},courseShape:{value:new THREE.Vector4(c.length,c.bend,c.greenX,c.width)},landRock:{value:textures.rockColor},landCliff:{value:textures.cliffColor},landRockNormal:{value:textures.rockNormal},landCliffNormal:{value:textures.cliffNormal},bunkerProfiles:{value:Array.from({length:4},(_,i)=>new THREE.Vector4(...(c.bunkers[i]?bunkerProfile(c.bunkers[i]):[0,0,1,0])))},turfColor:{value:textures.turfColor},turfNormal:{value:textures.turfNormal},turfRoughness:{value:textures.turfRoughness},sandColor:{value:textures.sandColor},sandNormal:{value:textures.sandNormal},bunkers:{value:[...c.bunkers.map(b=>new THREE.Vector4(...b)),...Array.from({length:4-c.bunkers.length},()=>new THREE.Vector4(9999,9999,1,1))]}});
    shader.vertexShader='varying vec3 terrainPosition;varying vec3 terrainSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition=(modelMatrix*vec4(position,1.)).xyz;terrainSlope=normal;');
    shader.fragmentShader=FAIRWAY_GLSL+BUNKER_GLSL+`varying vec3 terrainPosition;varying vec3 terrainSlope;uniform sampler2D landRock;uniform sampler2D landCliff;uniform vec4 bunkerProfiles[4];uniform sampler2D sandColor;uniform sampler2D sandNormal;uniform sampler2D turfColor;uniform sampler2D turfNormal;uniform sampler2D turfRoughness;uniform vec4 bunkers[4];uniform vec4 courseShape;uniform float courseWeave;uniform float courseCoastal;uniform float courseTheme;
      float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}
      vec3 groundSample(sampler2D source,vec2 uv,vec2 dx,vec2 dy){
       vec2 cell=floor(uv),f=fract(uv);f=f*f*(3.-2.*f);
       vec2 a=vec2(groundHash(cell),groundHash(cell+19.1))*7.;
       vec2 b=vec2(groundHash(cell+vec2(1,0)),groundHash(cell+vec2(1,0)+19.1))*7.;
       vec2 c=vec2(groundHash(cell+vec2(0,1)),groundHash(cell+vec2(0,1)+19.1))*7.;
       vec2 d=vec2(groundHash(cell+vec2(1,1)),groundHash(cell+vec2(1,1)+19.1))*7.;
       return mix(mix(textureGrad(source,uv+a,dx,dy).rgb,textureGrad(source,uv+b,dx,dy).rgb,f.x),mix(textureGrad(source,uv+c,dx,dy).rgb,textureGrad(source,uv+d,dx,dy).rgb,f.x),f.y);
      }
      vec3 groundSample(sampler2D source,vec2 uv){return groundSample(source,uv,dFdx(uv),dFdy(uv));}
      `+(distant?LANDSCAPE_GLSL:'')+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 p=terrainPosition.xz;
      float sandMask=0.,turfLip=0.,shortGrass=0.,green=0.,beach=0.;vec2 turfUV=p/1.4;
      ${distant?`float outerDistance=length(vec2(max(0.,abs(p.x)-375.),max(0.,max(-165.-p.y,p.y-courseShape.x-165.))));float landBlend=courseTheme>2.5?0.:smoothstep(50.,850.,outerDistance);float rockMask=0.;if(landBlend<1.){`:''}
      for(int i=0;i<4;i++){float bd=bunkerDistance(p,bunkers[i],bunkerProfiles[i]);sandMask=max(sandMask,1.-smoothstep(-.10,.10,bd));turfLip=max(turfLip,smoothstep(-.10,.10,bd)*(1.-smoothstep(.4,1.4,bd)));}
      float edge=routeDistance(p);
      float fairway=1.-smoothstep(-.2,.2,edge);
      float firstCut=1.-smoothstep(1.8,2.4,edge);
      float greenDistance=length(vec2((p.x-courseShape.z)/1.05,p.y-courseShape.x));
      green=1.-smoothstep(16.85,17.15,greenDistance);float collar=1.-smoothstep(18.3,18.8,greenDistance);
      float tee=(1.-smoothstep(4.9,5.1,abs(p.x)))*(1.-smoothstep(6.9,7.1,abs(p.y)));
      fairway=max(fairway,tee);shortGrass=max(fairway,collar);
      float mowingAngle=atan(courseShape.z,courseShape.x)+.42;
      vec2 mowingDirection=vec2(sin(mowingAngle),cos(mowingAngle));
      vec2 viewDirection=normalize(cameraPosition.xz-p+vec2(.001));
      float stripe=smoothstep(-.16,.16,sin(dot(p,mowingDirection)*3.14159265/5.5))*2.-1.;
      if(courseTheme>.5&&courseTheme<1.5)stripe=tanh((p.x-courseShape.z*p.y/courseShape.x)*.35);
      float mowing=1.-.055*stripe*dot(viewDirection,mowingDirection);
      vec2 greenDirection=vec2(cos(mowingAngle+.7),sin(mowingAngle+.7));
      float greenStripe=smoothstep(-.2,.2,sin(dot(p,greenDirection)*3.14159265/1.7))*2.-1.;
      turfUV=p/mix(mix(1.4,1.1,tee),.46,green);
      vec3 cut=texture2D(turfColor,turfUV).rgb*vec3(.75,.92,1.4);
      cut=mix(cut,vec3(dot(cut,vec3(.2126,.7152,.0722))),.12);
      vec3 putting=cut*vec3(1.18,1.10,1.12)*(1.-.023*greenStripe*dot(viewDirection,greenDirection));
      cut*=mowing;
      vec3 rough=mix(vec3(.080,.135,.038),vec3(.115,.172,.060),groundNoise(p*.06));
      if(courseTheme>.5&&courseTheme<1.5){rough=mix(vec3(.16,.16,.07),vec3(.22,.17,.16),groundNoise(p*.035));cut*=vec3(1.13,1.02,.92);}
      if(courseTheme>1.5&&courseTheme<2.5){rough=mix(texture2D(sandColor,p/7.).rgb,texture2D(sandColor,mat2(.8,-.6,.6,.8)*p/13.).rgb,.45)*vec3(.72,.53,.37);cut*=vec3(1.06,1.10,.92);}
      if(courseTheme>2.5){rough=mix(vec3(.04,.060,.032),vec3(.068,.085,.045),groundNoise(p*.04));cut*=vec3(.68,.88,.92);putting*=vec3(.80,.96,1.04);}
      vec2 grassUV=p/2.7;float tileMix=smoothstep(.2,.8,groundNoise(p*.021));vec3 roughSample=mix(texture2D(map,grassUV).rgb,texture2D(map,grassUV+vec2(.37,.61)).rgb,tileMix);
      float detail=clamp(dot(roughSample,vec3(.299,.587,.114))*6.3,.50,1.4);
      rough=mix(rough,vec3(.090,.175,.046),firstCut)*detail;
      if(courseTheme<1.5)rough=mix(rough,texture2D(map,p/6.).rgb*vec3(.8,1.1,.64),.27);
      vec3 grass=mix(rough,cut,shortGrass);grass=mix(grass,putting,green);
      float macro=.945+.075*groundNoise(p*.045)+.035*groundNoise(p*.22);
      vec3 sand=texture2D(sandColor,p/4.).rgb*.81;
      float rake=.96+.04*sin(p.x*21.+sin(p.y*.3)*3.);sand*=rake;
      float coast=138.+sin(p.y*.014)*28.;beach=courseCoastal*smoothstep(coast-12.,coast-2.,p.x);
      diffuseColor.rgb=mix(grass*macro*(1.-turfLip*.10),sand,max(sandMask,beach));
      ${distant?`}if(landBlend>0.&&courseTheme<2.5){vec3 land=landscapeAlbedo(terrainPosition,normalize(terrainSlope),courseTheme,rockMask);diffuseColor.rgb=mix(diffuseColor.rgb,land,landBlend);}`:''}`);

    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      float roughnessFactor=.96;
      ${distant?'if(landBlend<1.){':''}
      float turfRough=texture2D(turfRoughness,turfUV).r;
      roughnessFactor=mix(.97,mix(.82,.96,turfRough),shortGrass);
      roughnessFactor=mix(roughnessFactor,mix(.80,.91,turfRough),green);
      roughnessFactor=mix(roughnessFactor,.97,max(sandMask,beach));
      ${distant?'}roughnessFactor=mix(roughnessFactor,.96,landBlend);':''}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      ${distant?'if(landBlend<1.){':''}
      vec3 gn=texture2D(normalMap,p/2.7).xyz*2.-1.;gn.xy*=normalScale;
      vec3 tn=texture2D(turfNormal,turfUV).xyz*2.-1.;tn.xy*=mix(.15,.045,green);
      vec3 sn=texture2D(sandNormal,p/4.).xyz*2.-1.;sn.xy*=normalScale;
      vec3 terrainNormal=mix(mix(gn,tn,shortGrass),sn,max(sandMask,beach));
      normal=normalize(mix(normal,normalize(tbn*terrainNormal),${distant?'1.-landBlend':'1.'}));
      ${distant?'}if(landBlend>0.&&courseTheme<2.5){vec3 farNormal=landscapeNormal(terrainPosition,normalize(terrainSlope),rockMask);normal=normalize(mix(normal,mat3(viewMatrix)*farNormal,landBlend));}':''}`);

  };
  mat.customProgramCacheKey=()=>`course-ground-authored-v6-${distant}`;
  return mat;
}

function courseGrid(c){const extent=c.length+330,nz=Math.round(extent/3);return{extent,nz,dz:extent/nz};}
function courseCellDetail(c,cx,cz,ellipse){
 if(c.bunkers.some(b=>ellipse(cx,cz,b)<1.3))return 6;
 return waterBasins(c).some(e=>ellipse(cx,cz,e)<1.35)||Math.hypot(cx-c.greenX,cz-c.length)<26?3:1;
}
// Samples the triangles actually drawn, including the hazard subdivisions. This
// avoids a mesh-wide raycast for a foot, path vertex, or other ground attachment.
export function courseSurfaceHeight(c,x,z,heightAt,ellipse){
 const {nz,dz}=courseGrid(c),ix=Math.floor((x+375)/3),iz=Math.floor((z+165)/dz);
 if(ix<0||ix>=250||iz<0||iz>=nz)return heightAt(c,x,z);
 const x0=-375+ix*3,z0=-165+iz*dz,n=courseCellDetail(c,x0+1.5,z0+dz*.5,ellipse);
 const u=(x-x0)/3*n,v=(z-z0)/dz*n,cellX=Math.min(n-1,Math.floor(u)),cellZ=Math.min(n-1,Math.floor(v)),fx=u-cellX,fz=v-cellZ;
 const xa=x0+cellX/n*3,za=z0+cellZ/n*dz,xb=xa+3/n,zb=za+dz/n;
 const h10=heightAt(c,xb,za),h01=heightAt(c,xa,zb);
 if(fx+fz<=1){const h00=heightAt(c,xa,za);return h00+(h10-h00)*fx+(h01-h00)*fz;}
 const h11=heightAt(c,xb,zb);return h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz);
}
export function courseGeometry(c,heightAt,ellipse){
 const vertices=[],normals=[],uv=[],indices=[],{extent,nz,dz}=courseGrid(c);
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<250;ix++){
  const x0=-375+ix*3,z0=-165+iz*dz,cx=x0+1.5,cz=z0+dz*.5;
  const n=courseCellDetail(c,cx,cz,ellipse),base=vertices.length/3;
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=x0+x/n*3,pz=z0+z/n*dz;vertices.push(px,heightAt(c,px,pz),pz);const nx=heightAt(c,px-.15,pz)-heightAt(c,px+.15,pz),ny=.3,nzz=heightAt(c,px,pz-.15)-heightAt(c,px,pz+.15),len=Math.hypot(nx,ny,nzz);normals.push(nx/len,ny/len,nzz/len);uv.push((px+375)/750,(pz+extent/2-c.length/2)/extent);}
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=base+z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);return geo;
}
