import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import viewData from './tree-views.json' with {type:'json'};
import {heightAt,lieAt,center,greenDistance,ellipse,random} from './course.js';
const templates=[],matrix=new THREE.Object3D();
const clock={value:0},eye={value:new THREE.Vector3()};
const NAMES=['coastal-pine','windswept-pine','garden-oak','garden-ash'];
export async function loadVegetation(){
 const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
 const assets=await Promise.all(NAMES.map(async name=>{const [g,map]=await Promise.all([loader.loadAsync(`${import.meta.env.BASE_URL}models/vegetation/${name}.glb`),textures.loadAsync(`${import.meta.env.BASE_URL}models/vegetation/${name}-views.webp`)]);map.colorSpace=THREE.SRGBColorSpace;return{branches:g.scene.getObjectByName('Branches'),leaves:g.scene.getObjectByName('Canopy'),map,...viewData[name]};}));templates.push(...assets);
}
function impostorMaterial(source){
 const mat=new THREE.MeshBasicMaterial({map:source.map,alphaTest:.18,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{
  s.uniforms.vegetationEye=eye;s.vertexShader='uniform vec3 vegetationEye;varying float treeRange;varying vec2 treeFrame;varying vec2 nextTreeFrame;varying float frameBlend;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`
    vec3 origin=instanceMatrix[3].xyz;vec3 toEye=vegetationEye-origin;treeRange=length(toEye.xz);
    float yaw=atan(instanceMatrix[2].x,instanceMatrix[2].z);
    float angle=mod(atan(toEye.x,toEye.z)-yaw+6.2831853,6.2831853);
    float index=angle/6.2831853*8.;float frame=floor(index);float nextFrame=mod(frame+1.,8.);frameBlend=smoothstep(.1,.9,fract(index));treeFrame=vec2(mod(frame,4.),1.-floor(frame/4.));nextTreeFrame=vec2(mod(nextFrame,4.),1.-floor(nextFrame/4.));
    vec3 right=normalize(vec3(toEye.z,0.,-toEye.x));float scale=length(instanceMatrix[1].xyz);
    vec4 mvPosition=modelViewMatrix*vec4(origin+right*position.x*scale+vec3(0.,position.y*scale,0.),1.);gl_Position=projectionMatrix*mvPosition;`);
  s.fragmentShader='varying float treeRange;varying vec2 treeFrame;varying vec2 nextTreeFrame;varying float frameBlend;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 a=texture2D(map,(vMapUv+treeFrame)/vec2(4.,2.));vec4 b=texture2D(map,(vMapUv+nextTreeFrame)/vec2(4.,2.));float coverage=mix(a.a,b.a,frameBlend);vec4 sampledDiffuseColor=vec4(mix(a.rgb*a.a,b.rgb*b.a,frameBlend)/max(.001,coverage),coverage);diffuseColor*=sampledDiffuseColor;');
  s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
    float fade=smoothstep(55.,75.,treeRange);float threshold=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));if(threshold>=fade)discard;`);
 };mat.customProgramCacheKey=()=> 'tree-impostor';return mat;
}
function animateMaterial(mat,near,leaf,depth=false){
 mat.onBeforeCompile=shader=>{
  shader.uniforms.vegetationTime=clock;shader.uniforms.vegetationEye=eye;
  shader.vertexShader='uniform float vegetationTime;uniform vec3 vegetationEye;varying float treeRange;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 treeOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    treeRange=distance(treeOrigin.xz,vegetationEye.xz);
    float flex=pow(clamp(position.y/15.,0.,1.),2.);
    float gust=sin(vegetationTime*.85+treeOrigin.x*.09+treeOrigin.z*.06);
    transformed.x+=flex*(gust*.12+sin(vegetationTime*2.1+position.y*2.+position.x)*${leaf?'.045':'.008'});
    transformed.z+=flex*cos(vegetationTime*.63+treeOrigin.z*.07)*.055;`);
  if(!depth){shader.fragmentShader='varying float treeRange;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
    float treeFade=smoothstep(55.,75.,treeRange);
    float threshold=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
    if(${near?'threshold<treeFade':'threshold>=treeFade'})discard;`);}
  if(leaf&&!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*.065;`);
 };
 mat.customProgramCacheKey=()=>`coastal-vegetation-${near}-${leaf}-${depth}`;
}
export class Vegetation{
 constructor(root,course,sites){
  this.groups=[];this.records=[];this.last=new THREE.Vector3(Infinity,0,0);const r=random(course.seed+342);const occupied=[];
  for(let i=0;i<(course.vegetationCount||850);i++){
   const z=-85+r()*(course.length+215),x=-265+r()*390,d=Math.abs(x-center(course,z));
   if(Math.abs(x+85)<18&&Math.abs(z-course.length-8)<18||d<course.width+15||greenDistance(course,x,z)<33||lieAt(course,x,z)==='Water'||heightAt(course,x,z)<4||ellipse(x,z,course.pond)<1.3||occupied.some(t=>Math.hypot(x-t.x,z-t.z)<6.5))continue;
   occupied.push({x,z});const type=course.conifersOnly?(r()<.65?0:1):r()<.60?(r()<.7?0:1):(r()<.65?2:3),scale=.62+r()*.65;
   const rec={x,z,y:heightAt(course,x,z)-.07,type,scale,angle:r()*Math.PI*2,tint:new THREE.Color().setHSL(.22+r()*.025,.08+r()*.1,.78+r()*.16)};this.records.push(rec);
   sites.push({id:`tree-${sites.length}`,kind:'tree',x,z,y:rec.y,height:scale*(type===0?9:6)});
  }
  const ground=[],uvs=[],ids=[];
  for(const t of this.records){const radius=(t.type<2?3.2:4.4)*t.scale,base=ground.length/3;for(let z=0;z<=4;z++)for(let x=0;x<=4;x++){const xx=t.x+(x/4-.5)*radius*2.5+radius*.3,zz=t.z+(z/4-.5)*radius*2.5+radius*.3;ground.push(xx,heightAt(course,xx,zz)+.035,zz);uvs.push(x/4,z/4);}for(let z=0;z<4;z++)for(let x=0;x<4;x++){const a=base+z*5+x;ids.push(a,a+5,a+1,a+1,a+5,a+6);}}
  const shadeGeometry=new THREE.BufferGeometry();shadeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ground,3));shadeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));shadeGeometry.setIndex(ids);
  const shadeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 v;void main(){float d=length(v-.5)*2.;if(d>1.)discard;float a=pow(1.-d,1.7)*.20;gl_FragColor=vec4(.035,.065,.023,a);}`});
  const shade=new THREE.Mesh(shadeGeometry,shadeMaterial);root.add(shade);
  for(let type=0;type<templates.length;type++){
   const source=templates[type],records=this.records.filter(t=>t.type===type);
   for(const leaf of [false,true]){
    const template=leaf?source.leaves:source.branches,geometry=template.geometry.clone();
    const mat=template.material.clone();mat.roughness=leaf?1:.9;if(leaf)mat.alphaTest=.4;mat.envMapIntensity=leaf?.12:.32;if(mat.map)mat.map.anisotropy=8;mat.alphaToCoverage=leaf;animateMaterial(mat,true,leaf);
    const mesh=new THREE.InstancedMesh(geometry,mat,records.length);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:mat.side});animateMaterial(mesh.customDepthMaterial,true,leaf,true);
    root.add(mesh);this.groups.push({mesh,near:true,leaf,records});
   }
   const geo=new THREE.PlaneGeometry(source.span,source.span);geo.translate(0,source.center,0);
   const mesh=new THREE.InstancedMesh(geo,impostorMaterial(source),records.length);mesh.frustumCulled=false;root.add(mesh);this.groups.push({mesh,near:false,records});
  }
 }
 update(time,camera){clock.value=time;eye.value.copy(camera);if(this.last.distanceToSquared(camera)<9)return;this.last.copy(camera);
  for(const {mesh,near,records}of this.groups){let n=0;for(const t of records){const d=Math.hypot(t.x-camera.x,t.z-camera.z);if(near?d>80:d<50)continue;matrix.position.set(t.x,t.y,t.z);matrix.rotation.set(0,t.angle,0);matrix.scale.setScalar(t.scale);matrix.updateMatrix();mesh.setMatrixAt(n,matrix.matrix);mesh.setColorAt(n,t.tint);n++;}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
}
