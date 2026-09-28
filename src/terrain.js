import {pondUniforms} from './water-uniforms.js';
import {pondProfiles,basinDistance} from './ponds.js';
import * as THREE from 'three';
import {LANDSCAPE_GLSL} from './landscape-material.js';
import {BUNKER_GLSL,bunkerProfile} from './bunkers.js';
import {fairwayPrimitives,dryLandDistance,FAIRWAY_GLSL,MAX_FAIRWAY_SEGMENTS,MAX_WATERS,DRY_LAND_GLSL} from './course-layout.js';
// Course boundaries use the same analytic shapes as lieAt. They stay crisp at any mesh resolution.
export function courseMaterial(c, textures, distant=false) {
  const mat=new THREE.MeshStandardMaterial({map:textures.grassColor,normalMap:textures.grassNormal,normalScale:new THREE.Vector2(.36,.36),roughness:.96});
  mat.onBeforeCompile=shader=>{
    const routes=fairwayPrimitives(c);
    Object.assign(shader.uniforms,{...pondUniforms(c),routeCount:{value:routes.length},routeSegments:{value:Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new THREE.Vector4(...(routes[i]?.slice(0,4)||[9999,9999,9999,9999])))},routeWidths:{value:Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new THREE.Vector2(...(routes[i]?.slice(4)||[0,0])))},courseWeave:{value:c.weave||0},courseCoastal:{value:c.coastal===false?0:1},courseTheme:{value:({japanese:0,highlands:1,desert:2,cyberpunk:3})[c.theme]||0},courseShape:{value:new THREE.Vector4(c.length,c.bend,c.greenX,c.width)},landRock:{value:textures.rockColor},landCliff:{value:textures.cliffColor},landRockNormal:{value:textures.rockNormal},landCliffNormal:{value:textures.cliffNormal},bunkerProfiles:{value:Array.from({length:4},(_,i)=>new THREE.Vector4(...(c.bunkers[i]?bunkerProfile(c.bunkers[i]):[0,0,1,0])))},turfColor:{value:textures.turfColor},turfNormal:{value:textures.turfNormal},turfRoughness:{value:textures.turfRoughness},sandColor:{value:textures.sandColor},sandNormal:{value:textures.sandNormal},bunkers:{value:[...c.bunkers.map(b=>new THREE.Vector4(...b)),...Array.from({length:4-c.bunkers.length},()=>new THREE.Vector4(9999,9999,1,1))]}});
    shader.vertexShader='varying vec3 terrainPosition;varying vec3 terrainSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition=(modelMatrix*vec4(position,1.)).xyz;terrainSlope=normal;');
    shader.fragmentShader=FAIRWAY_GLSL+BUNKER_GLSL+DRY_LAND_GLSL+`uniform int pondCount;uniform vec4 shoreBasins[${MAX_WATERS}];uniform float shoreLevels[${MAX_WATERS}];uniform vec4 shoreShapes[${MAX_WATERS}];
varying vec3 terrainPosition;varying vec3 terrainSlope;uniform sampler2D landRock;uniform sampler2D landCliff;uniform vec4 bunkerProfiles[4];uniform sampler2D sandColor;uniform sampler2D sandNormal;uniform sampler2D turfColor;uniform sampler2D turfNormal;uniform sampler2D turfRoughness;uniform vec4 bunkers[4];uniform vec4 courseShape;uniform float courseWeave;uniform float courseCoastal;uniform float courseTheme;
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
      // Quarter-turn each patch. Translation alone preserves the source's long
      // directional grain. Rotate encoded normal XY back into the ground frame.
      vec3 grassPatch(sampler2D source,vec2 uv,vec2 cell,vec2 dx,vec2 dy,bool normalData){
       float turn=floor(groundHash(cell+41.7)*4.);
       vec2 axis=turn<.5?vec2(1,0):turn<1.5?vec2(0,1):turn<2.5?vec2(-1,0):vec2(0,-1);
       mat2 rotation=mat2(axis.x,-axis.y,axis.y,axis.x);
       vec2 offset=vec2(groundHash(cell),groundHash(cell+19.1))*7.;
       vec3 value=textureGrad(source,rotation*uv+offset,rotation*dx,rotation*dy).rgb;
       if(normalData)value.xy=transpose(rotation)*(value.xy*2.-1.)*.5+.5;
       return value;
      }
      vec3 grassSample(sampler2D source,vec2 uv,vec2 dx,vec2 dy,bool normalData){
       vec2 cell=floor(uv),f=fract(uv);f=f*f*(3.-2.*f);
       vec4 weights=vec4((1.-f.x)*(1.-f.y),f.x*(1.-f.y),(1.-f.x)*f.y,f.x*f.y);
       vec3 value=grassPatch(source,uv,cell,dx,dy,normalData)*weights.x
        +grassPatch(source,uv,cell+vec2(1,0),dx,dy,normalData)*weights.y
        +grassPatch(source,uv,cell+vec2(0,1),dx,dy,normalData)*weights.z
        +grassPatch(source,uv,cell+vec2(1,1),dx,dy,normalData)*weights.w;
       // Preserve source contrast where patches overlap; plain bilinear blending
       // otherwise reveals its lattice as alternating sharp and blurred regions.
       vec3 mean=textureLod(source,vec2(.5),16.).rgb;if(normalData)mean.xy=vec2(.5);
       vec3 result=clamp(mean+(value-mean)*inversesqrt(dot(weights,weights)),0.,1.);
       if(normalData)result.z=value.z;
       // Merge blade-scale contrast as its screen footprint becomes too small.
       // This suppresses coherent aerial grain without blurring close turf.
       float resolved=1.-smoothstep(.008,.05,max(length(dx),length(dy)));
       return mix(mean,result,resolved);
      }
      `+(distant?LANDSCAPE_GLSL:'')+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 p=terrainPosition.xz;
      vec2 grassUV=p/2.7,grassDx=dFdx(grassUV),grassDy=dFdy(grassUV);
      float sandMask=0.,turfLip=0.,shortGrass=0.,green=0.,beach=0.,turfCondition=0.,desertSoil=0.,turfResolved=0.;vec2 turfUV=p/1.4;
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
      float mowing=1.-.032*stripe*dot(viewDirection,mowingDirection);
      vec2 greenDirection=vec2(cos(mowingAngle+.7),sin(mowingAngle+.7));
      float greenStripe=smoothstep(-.2,.2,sin(dot(p,greenDirection)*3.14159265/1.7))*2.-1.;
      turfUV=p/mix(mix(1.4,1.1,tee),.46,green);
      // Retain the source blade colour and mute saturation without a strong blue tint.
      vec3 cut=texture2D(turfColor,turfUV).rgb*vec3(.66,.76,.94);
      turfResolved=1.-smoothstep(.008,.05,max(length(dFdx(turfUV)),length(dFdy(turfUV))));
      cut=mix(cut,vec3(dot(cut,vec3(.2126,.7152,.0722))),.12);
      vec3 putting=cut*vec3(1.18,1.10,1.12)*(1.-.023*greenStripe*dot(viewDirection,greenDirection));
      // Broad moisture and growth variation sits beneath the photographic blade detail.
      // Domain warping prevents a visible square noise grid at aerial distances.
      vec2 conditionUV=p+courseShape.zx*.19;
      float broadGrowth=groundNoise(conditionUV*.031);
      vec2 warped=conditionUV+vec2(broadGrowth,groundNoise(conditionUV*.043+13.))*12.;
      turfCondition=(groundNoise(warped*.072)-.5)*.72+(groundNoise(warped*.23)-.5)*.28;
      float dryPatch=smoothstep(.06,.34,turfCondition)*(1.-green*.75);
      cut*=mowing*(.98+turfCondition*.29);
      cut=mix(cut,cut*vec3(1.12,1.015,.86),dryPatch*.44);
      putting*=.995+turfCondition*.065;
      // Randomized source offsets break the fixed 2.7m grass pattern. Color and
      // normals use the same coordinates, preserving the photographed blade detail.
      vec3 roughSample=grassSample(map,grassUV,grassDx,grassDy,false);
      // Broader photographed growth patches remain visible from survey height
      // after individual blades merge. Their scale is independent of the fine cut.
      vec3 broadRough=groundSample(map,p/18.,grassDx*.15,grassDy*.15);
      float roughMean=dot(textureLod(map,vec2(.5),16.).rgb,vec3(.299,.587,.114));
      float broadCondition=clamp(dot(broadRough,vec3(.299,.587,.114))/max(.02,roughMean),.55,1.6);
      roughSample*=.55+.45*broadCondition;
      float detail=clamp(dot(roughSample,vec3(.299,.587,.114))*6.3,.50,1.4);
      vec3 rough=mix(vec3(.080,.135,.038),vec3(.115,.172,.060),groundNoise(p*.06))*detail;
      if(courseTheme>.5&&courseTheme<1.5){rough=mix(vec3(.16,.16,.07),vec3(.22,.17,.16),groundNoise(p*.035))*detail;cut*=vec3(1.13,1.02,.92);}
      if(courseTheme>2.5){rough=mix(vec3(.04,.060,.032),vec3(.068,.085,.045),groundNoise(p*.04))*detail;cut*=vec3(.68,.88,.92);putting*=vec3(.80,.96,1.04);}
      if(courseTheme<1.5)rough=mix(rough,roughSample*vec3(.8,1.1,.64),.27);
      vec3 firstCutColor=mix(rough,roughSample*vec3(.60,1.18,.43),.58);
      if(courseTheme>1.5&&courseTheme<2.5){
       // Irrigated turf grades into dry grass before the surrounding mineral soil.
       // The worn fringe lies outside the analytic fairway boundary used by golf.
       float wear=groundNoise(p*.32)+groundNoise(p*.083)*.65;
       float fringe=1.-smoothstep(2.3,7.0,edge+(wear-.825)*2.1);
       desertSoil=1.-fringe;
       vec3 soil=groundSample(sandColor,p/4.8)*mix(vec3(.65,.49,.35),vec3(.81,.64,.46),groundNoise(p*.055));
       vec3 dryGrass=roughSample*vec3(1.10,.98,.67)*(.94+groundNoise(p*.19)*.12);
       rough=mix(soil,dryGrass,fringe*.72);
       firstCutColor=roughSample*vec3(.68,1.10,.46);
       cut*=vec3(1.06,1.10,.92);
      }
      rough=mix(rough,firstCutColor,firstCut);
      vec3 grass=mix(rough,cut,shortGrass);grass=mix(grass,putting,green);
      float macro=.945+.075*groundNoise(p*.045)+.035*groundNoise(p*.22);
      vec3 sand=texture2D(sandColor,p/4.).rgb*.81;
      float rake=.96+.04*sin(p.x*21.+sin(p.y*.3)*3.);sand*=rake;
      float coast=138.+sin(p.y*.014)*28.;beach=courseCoastal*smoothstep(coast-12.,coast-2.,p.x);
      diffuseColor.rgb=mix(grass*macro*(1.-turfLip*.10),sand,max(sandMask,beach));
      // Exposed mineral soil and a damp margin make the waterline readable at eye level.
      float bankDistance=1000000.,bankLevel=0.;
      for(int i=0;i<${MAX_WATERS};i++){if(i>=pondCount)break;vec4 b=shoreBasins[i];float metric=shoreDistance(p,b,shoreShapes[i]);float d=max(metric,-dryDistance(p));if(d<bankDistance){bankDistance=d;bankLevel=shoreLevels[i];}}
      float waterlineNoise=groundNoise(p*1.7)*.28+groundNoise(p*.35)*.45;
      float shoreSoil=(1.-smoothstep(.7,2.1,bankDistance+waterlineNoise))*(1.-smoothstep(.55,1.25,abs(terrainPosition.y-bankLevel)));
      if(shoreSoil>.001){vec3 shoreColor=texture2D(sandColor,p/2.3).rgb*mix(vec3(.33,.32,.27),vec3(.57,.47,.34),step(1.5,courseTheme)*(1.-step(2.5,courseTheme)));
      float damp=(1.-smoothstep(-.15,.9,bankDistance+waterlineNoise))*.4;
      diffuseColor.rgb=mix(diffuseColor.rgb,shoreColor*(1.-damp),shoreSoil);}

      ${distant?`}if(landBlend>0.&&courseTheme<2.5){vec3 land=landscapeAlbedo(terrainPosition,normalize(terrainSlope),courseTheme,rockMask);diffuseColor.rgb=mix(diffuseColor.rgb,land,landBlend);}`:''}`);

    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      float roughnessFactor=.96;
      ${distant?'if(landBlend<1.){':''}
      float turfRough=texture2D(turfRoughness,turfUV).r;
      // Keep the photographed roughness spread. Unresolved blades converge to a
      // dry broad response instead of leaving subpixel specular variation.
      float cutRough=clamp(.64+.32*turfRough+turfCondition*.09,.78,.95);
      float greenRough=clamp(.69+.23*turfRough+turfCondition*.035,.79,.93);
      roughnessFactor=mix(.97,mix(.89+turfCondition*.06,cutRough,turfResolved),shortGrass);
      roughnessFactor=mix(roughnessFactor,mix(.86,greenRough,turfResolved),green);
      roughnessFactor=mix(roughnessFactor,.97,max(sandMask,beach));
      ${distant?'}roughnessFactor=mix(roughnessFactor,.96,landBlend);':''}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      ${distant?'if(landBlend<1.){':''}
      vec3 gn=grassSample(normalMap,grassUV,grassDx,grassDy,true).xyz*2.-1.;gn.xy*=normalScale;
      if(courseTheme>1.5&&courseTheme<2.5){vec3 soilNormal=groundSample(sandNormal,p/4.8).xyz*2.-1.;soilNormal.xy*=.22;gn=mix(gn,soilNormal,desertSoil);}
      vec3 tn=texture2D(turfNormal,turfUV).xyz*2.-1.;
      tn.xy*=mix(.26,.085,green)*turfResolved;
      tn=normalize(tn);
      vec3 sn=texture2D(sandNormal,p/4.).xyz*2.-1.;sn.xy*=normalScale;
      vec3 terrainNormal=mix(mix(gn,tn,shortGrass),sn,max(sandMask,beach));
      normal=normalize(mix(normal,normalize(tbn*terrainNormal),${distant?'1.-landBlend':'1.'}));
      ${distant?'}if(landBlend>0.&&courseTheme<2.5){vec3 farNormal=landscapeNormal(terrainPosition,normalize(terrainSlope),rockMask);normal=normalize(mix(normal,mat3(viewMatrix)*farNormal,landBlend));}':''}`);

  };
  mat.customProgramCacheKey=()=>`course-ground-turf-response-v14-organic-shore-${distant}`;
  return mat;
}

function courseGrid(c){const extent=c.length+330,nz=Math.round(extent/3);return{extent,nz,dz:extent/nz};}
function courseCellDetail(c,cx,cz,ellipse){
 if(c.bunkers.some(b=>ellipse(cx,cz,b)<1.3))return 6;
 let detail=Math.hypot(cx-c.greenX,cz-c.length)<26?3:1;
 for(const p of pondProfiles(c)){
  const distance=basinDistance(cx,cz,p.basin);if(distance>=p.bankWidth+2)continue;
  if(Math.abs(Math.max(distance,-dryLandDistance(c,cx,cz)))<3)return 6;
  detail=3;
 }
 return detail;
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
