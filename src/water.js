import {dryUniforms} from './water-uniforms.js';
import {DAY_SKY_YAW,SUN_DIRECTION} from './lighting.js';
import * as THREE from 'three';
import {DRY_LAND_GLSL} from './course-layout.js';
import {pondProfiles} from './ponds.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
const vertex=`uniform mat4 textureMatrix;varying vec4 mirrorUv;varying vec3 worldPoint;void main(){worldPoint=(modelMatrix*vec4(position,1.)).xyz;mirrorUv=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=DRY_LAND_GLSL+`
uniform sampler2D tDiffuse;uniform sampler2D skyMap;uniform float hasSky;uniform float skyRotation;uniform float skyIntensity;uniform vec3 sunDirection;uniform vec3 waterFog;uniform float time;uniform float reflected;uniform vec3 color;uniform vec4 pond;uniform float ocean;uniform float basinDepth;
varying vec4 mirrorUv;varying vec3 worldPoint;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float waves(vec2 p){return sin(p.x*.67+p.y*.21-time*.67)*.045+sin(p.x*.31-p.y*.84+time*.49)*.025+sin(p.x*2.3+p.y*1.77-time*1.4)*.007+sin(p.x*5.1-p.y*4.3+time*1.7)*.0008;}
void main(){
 vec2 p=worldPoint.xz;if(ocean<.5&&dryDistance(p)<0.)discard;float e=.055;vec3 n=normalize(vec3(waves(p-vec2(e,0.))-waves(p+vec2(e,0.)),e*2.,waves(p-vec2(0.,e))-waves(p+vec2(0.,e))));
 vec3 view=normalize(cameraPosition-worldPoint);float fresnel=.035+.965*pow(1.-max(dot(view,n),0.),5.);
 vec3 direction=reflect(-view,n);vec2 suv=vec2(fract(atan(direction.z,direction.x)/6.2831853+.5+skyRotation/6.2831853),asin(clamp(direction.y,-1.,1.))/3.14159265+.5);
 vec3 sky=hasSky>.5?texture2D(skyMap,suv).rgb*skyIntensity:vec3(.36,.54,.62);
 vec2 uv=mirrorUv.xy/max(.0001,mirrorUv.w);uv+=n.xz*.013;vec3 reflection=mix(sky,texture2D(tDiffuse,clamp(uv,.001,.999)).rgb,reflected);
 float ellipseRadius=length((p-pond.xy)/pond.zw),shore=1.-ellipseRadius;float inward=shore/max(.0001,length((p-pond.xy)/(pond.zw*pond.zw))/max(.0001,ellipseRadius));float depth=basinDepth*smoothstep(0.,8.,min(inward,dryDistance(p)));
 float coast=138.+sin(p.y*.014)*28.;float oceanShore=p.x-coast;depth=mix(depth,max(.1,abs(oceanShore)*.26),ocean);
 vec3 shallow=vec3(.09,.26,.20),deep=vec3(.022,.10,.115);vec3 body=mix(shallow,deep,1.-exp(-depth*.65));
 float caustic=pow(max(0.,sin(p.x*2.7+waves(p)*12.)*sin(p.y*2.3+time*.4)),7.);body+=vec3(.11,.16,.10)*caustic*exp(-depth*1.7)*(1.-smoothstep(.03,.25,length(fwidth(p))));
 vec3 c=mix(body,reflection,clamp(fresnel+.17,.16,.91));
 float glint=pow(max(dot(reflect(-sunDirection,n),view),0.),110.);float footprint=length(fwidth(p));glint*=1./(1.+footprint*16.);c+=glint*vec3(1.5,1.25,.90);
 float breakup=noise(p*.8+time*.025);float edge=1.-smoothstep(.0,.07,shore);float lap=sin(oceanShore*2.4-time*1.1+noise(p*.17)*2.);
 float foam=mix(edge*.14, smoothstep(.48,.9,lap)*(1.-smoothstep(0.,6.,oceanShore))*smoothstep(-2.,0.,oceanShore)*.5,ocean)*smoothstep(.25,.72,breakup);
 foam*=1./(1.+length(fwidth(p))*2.);c=mix(c,vec3(.62,.7,.63),foam);float fog=1.-exp(-length(cameraPosition-worldPoint)*.00065);c=mix(c,waterFog,fog);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
function createBasin(course,profile,skyUniforms,group){
 const shader={uniforms:{...dryUniforms(course),sunDirection:{value:new THREE.Vector3(...SUN_DIRECTION)},skyRotation:skyUniforms.skyRotation,skyIntensity:skyUniforms.skyIntensity,waterFog:skyUniforms.waterFog,tDiffuse:{value:null},textureMatrix:{value:null},color:{value:new THREE.Color()},skyMap:skyUniforms.skyMap,hasSky:skyUniforms.hasSky,time:skyUniforms.time,reflected:{value:1},pond:{value:new THREE.Vector4(...profile.basin)},basinDepth:{value:profile.depth},ocean:{value:0}},vertexShader:vertex,fragmentShader:fragment};
 const mesh=new Reflector(new THREE.CircleGeometry(1,128),{textureWidth:1024,textureHeight:1024,clipBias:.003,multisample:0,shader});
 for(const name of ['skyMap','hasSky','time','skyRotation','skyIntensity','waterFog'])mesh.material.uniforms[name]=skyUniforms[name];
 mesh.rotation.x=-Math.PI/2;mesh.scale.set(profile.basin[2],profile.basin[3],1);mesh.position.set(profile.basin[0],profile.surface,profile.basin[1]);mesh.userData.pondProfile=profile;mesh.material.side=THREE.DoubleSide;mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-1;mesh.material.polygonOffsetUnits=-4;
 const render=mesh.onBeforeRender;let frame=0;
 mesh.onBeforeRender=function(renderer,scene,camera){if(scene.overrideMaterial)return;frame++;const distance=camera.position.distanceTo(mesh.position);const visible=[];if(frame%3===1||distance<65){scene.traverse(o=>{if(o.visible&&(o!==mesh&&o.parent===group||o.isSkinnedMesh||o.isPoints||o.name==='Combat telegraphs')){visible.push(o);o.visible=false;}});render.call(this,renderer,scene,camera);for(const o of visible)o.visible=true;}};
 return mesh;
}
export function createOceanMaterial(uniforms){return new THREE.ShaderMaterial({uniforms:{...dryUniforms({}),sunDirection:{value:new THREE.Vector3(...SUN_DIRECTION)},skyRotation:{value:DAY_SKY_YAW},skyIntensity:{value:.76},waterFog:{value:new THREE.Color(.57,.66,.66)},...uniforms,tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},color:{value:new THREE.Color()},reflected:{value:0},pond:{value:new THREE.Vector4(0,0,1,1)},basinDepth:{value:1.8},ocean:{value:1}},vertexShader:vertex,fragmentShader:fragment});}


export function createPond(course,skyUniforms){const group=new THREE.Group();group.name='Course water';for(const profile of pondProfiles(course))group.add(createBasin(course,profile,skyUniforms,group));group.dispose=()=>group.children.forEach(mesh=>mesh.dispose());return group;}
