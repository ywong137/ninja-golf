import * as THREE from 'three';
export const TREE_DETAIL={nearStart:34,nearEnd:36,farStart:108,farEnd:112};
export const foliageEye={value:new THREE.Vector3()},shadowFocus={value:new THREE.Vector3()};
const fadeDeclarations='uniform vec3 natureEye;varying float natureDistance;';
const fadeVertex='vec3 treeOrigin=instanceMatrix[3].xyz;natureDistance=length(vec3(treeOrigin.x-natureEye.x,max(0.,natureEye.y-treeOrigin.y-5.),treeOrigin.z-natureEye.z));';
function fadeFragment(lod,detail=TREE_DETAIL){return `float nearMix=smoothstep(${detail.nearStart.toFixed(1)},${detail.nearEnd.toFixed(1)},natureDistance),farMix=smoothstep(${detail.farStart.toFixed(1)},${detail.farEnd.toFixed(1)},natureDistance);float screenNoise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);float low=${lod===0?'0.':lod===1?'1.-nearMix':'1.-farMix'},high=${lod===0?'1.-nearMix':lod===1?'1.-farMix':'1.'};if(screenNoise<low||screenNoise>=high)discard;`;}
export function treeTransition(material,lod,detail=TREE_DETAIL){
 const before=material.onBeforeCompile,cache=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{before?.(shader);shader.uniforms.natureEye=foliageEye;shader.vertexShader=fadeDeclarations+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n${fadeVertex}`);shader.fragmentShader='varying float natureDistance;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\n${fadeFragment(lod,detail)}`);};
 material.alphaToCoverage=true;material.customProgramCacheKey=()=>`${cache}-tree-fade-${lod}-${Object.values(detail).join("-")}`;
}
export function treeImpostor(source,{nearFade=true,detail=TREE_DETAIL}={}){
 const material=new THREE.MeshStandardMaterial({map:source.map,alphaTest:.25,side:THREE.DoubleSide,roughness:.92,metalness:0,envMapIntensity:.45,alphaToCoverage:true});
 material.onBeforeCompile=shader=>{
  shader.uniforms.natureEye=foliageEye;shader.uniforms.treeNormalAtlas={value:source.normalMap};shader.uniforms.treeCenterHeight={value:source.center};
  shader.vertexShader=fadeDeclarations+'uniform float treeCenterHeight;varying vec4 treeFrames;varying vec2 treeBlend;varying vec2 treeYaw;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   ${fadeVertex}
   vec3 origin=instanceMatrix[3].xyz;float scale=length(instanceMatrix[1].xyz);vec3 treeCenter=origin+vec3(0.,treeCenterHeight,0.)*scale;
   vec3 delta=natureEye-treeCenter;float yaw=atan(instanceMatrix[2].x,instanceMatrix[2].z);treeYaw=vec2(cos(yaw),sin(yaw));
   float azimuth=mod(atan(delta.x,delta.z)-yaw+12.5663706,6.2831853)/6.2831853*8.;float elevation=clamp(atan(delta.y,length(delta.xz))/.523598776,0.,2.);
   treeFrames=vec4(floor(azimuth),mod(floor(azimuth)+1.,8.),floor(elevation),min(2.,floor(elevation)+1.));treeBlend=vec2(fract(azimuth),fract(elevation));
   vec3 forward=normalize(delta),right=length(delta.xz)>.001?normalize(vec3(delta.z,0.,-delta.x)):vec3(1.,0.,0.),up=cross(forward,right);
   vec4 natureWorldPosition=vec4(treeCenter+(right*position.x+up*(position.y-treeCenterHeight))*scale,1.);
   vec4 mvPosition=modelViewMatrix*natureWorldPosition;gl_Position=projectionMatrix*mvPosition;`);
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','vec4 worldPosition=modelMatrix*natureWorldPosition;');
  shader.fragmentShader=`uniform sampler2D treeNormalAtlas;varying vec4 treeFrames;varying vec2 treeBlend;varying vec2 treeYaw;varying float natureDistance;
   vec2 treeUV(vec2 uv,float column,float row){return (clamp(uv,vec2(.001),vec2(.999))+vec2(column,2.-row))/vec2(8.,3.);}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 uv00=treeUV(vMapUv,treeFrames.x,treeFrames.z),uv10=treeUV(vMapUv,treeFrames.y,treeFrames.z),uv01=treeUV(vMapUv,treeFrames.x,treeFrames.w),uv11=treeUV(vMapUv,treeFrames.y,treeFrames.w);
   vec4 a00=texture2D(map,uv00),a10=texture2D(map,uv10),a01=texture2D(map,uv01),a11=texture2D(map,uv11);
   vec4 weights=vec4((1.-treeBlend.x)*(1.-treeBlend.y),treeBlend.x*(1.-treeBlend.y),(1.-treeBlend.x)*treeBlend.y,treeBlend.x*treeBlend.y)*vec4(a00.a,a10.a,a01.a,a11.a);
   float coverage=dot(weights,vec4(1.));vec3 albedo=(a00.rgb*weights.x+a10.rgb*weights.y+a01.rgb*weights.z+a11.rgb*weights.w)/max(.001,coverage);
   diffuseColor*=vec4(albedo,coverage);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\n${nearFade?fadeFragment(2,detail):''}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   vec3 sourceNormal=(texture2D(treeNormalAtlas,uv00).rgb*weights.x+texture2D(treeNormalAtlas,uv10).rgb*weights.y+texture2D(treeNormalAtlas,uv01).rgb*weights.z+texture2D(treeNormalAtlas,uv11).rgb*weights.w)/max(.001,coverage)*2.-1.;
   vec3 worldNormal=vec3(sourceNormal.x*treeYaw.x+sourceNormal.z*treeYaw.y,sourceNormal.y,-sourceNormal.x*treeYaw.y+sourceNormal.z*treeYaw.x);
   normal=normalize(mat3(viewMatrix)*worldNormal);`);
 };
 material.customProgramCacheKey=()=> `relit-multi-elevation-tree-v2-${nearFade}-${Object.values(detail).join("-")}`;return material;
}
export function canopyShadowMaterial(map,night=false){
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:map},shadowFocus,opacity:{value:night?.24:.40}},vertexShader:`uniform vec3 shadowFocus;attribute vec2 treeAnchor;varying vec2 vUv;varying float strength;void main(){vUv=uv;strength=smoothstep(34.,62.,distance(treeAnchor,shadowFocus.xz));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D map;uniform float opacity;varying vec2 vUv;varying float strength;void main(){vec2 pixel=vec2(1./2048.,1./1024.);float a=texture2D(map,vUv).a*.4;for(int i=0;i<4;i++){vec2 d=vec2(i<2?-1.:1.,i==0||i==2?-1.:1.);a+=texture2D(map,vUv+pixel*d*1.2).a*.15;}a*=opacity*strength;if(a<.005)discard;gl_FragColor=vec4(.015,.021,.009,a);}`});
}
