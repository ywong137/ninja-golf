import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {heightAt,lieAt,fairwayDistance,greenDistance,random,routePoint} from './course.js';
import views from './nature-views.json' with {type:'json'};
const SOURCES=['forest-canopy','dry-tree','understory','fern','coastal-rock','desert-rock','sea-cliff'];
const assets=new Map(),transform=new THREE.Object3D(),eye={value:new THREE.Vector3()},clock={value:0};
export async function loadNature(){
 const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
 await Promise.all(SOURCES.map(async name=>{
  const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}.glb`);model.scene.updateMatrixWorld(true);
  const parts=[];model.scene.traverse(o=>{if(!o.isMesh)return;const material=o.material;material.metalness=0;material.roughness=Math.max(.75,material.roughness);material.envMapIntensity=.45;if(material.transparent){material.transparent=false;material.alphaTest=.45;material.depthWrite=true;material.side=THREE.DoubleSide;}for(const key of ['map','normalMap','roughnessMap'])if(material[key])material[key].anisotropy=8;parts.push({lod:o.name.startsWith('LOD1')?1:0,geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),material});});
  let map;if(views[name]){map=await textures.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}-views.webp`);map.colorSpace=THREE.SRGBColorSpace;}
  assets.set(name,{parts,map,...views[name]});
 }));
}
function sway(material,foliage){
 material.onBeforeCompile=s=>{s.uniforms.natureTime=clock;s.vertexShader='uniform float natureTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float bend=pow(clamp(position.y/14.,0.,1.),2.);vec3 origin=instanceMatrix[3].xyz;
 transformed.x+=sin(natureTime*.9+origin.x*.1+origin.z*.07)*bend*.14;
 ${foliage?'transformed.x+=sin(natureTime*2.3+position.x*2.+position.y)*.025*bend;':''}`);};material.customProgramCacheKey=()=>`scanned-nature-${foliage}`;
}
function billboard(source){
 const mat=new THREE.MeshBasicMaterial({map:source.map,alphaTest:.28,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{s.uniforms.natureEye=eye;s.vertexShader='uniform vec3 natureEye;varying vec2 atlasFrame;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`vec3 origin=instanceMatrix[3].xyz;vec3 delta=natureEye-origin;float yaw=atan(instanceMatrix[2].x,instanceMatrix[2].z);float a=mod(atan(delta.x,delta.z)-yaw+6.2831853,6.2831853);float frame=mod(floor(a/6.2831853*8.+.5),8.);atlasFrame=vec2(mod(frame,4.),1.-floor(frame/4.));vec3 right=normalize(vec3(delta.z,0.,-delta.x));float scale=length(instanceMatrix[1].xyz);vec4 mvPosition=modelViewMatrix*vec4(origin+right*position.x*scale+vec3(0.,position.y*scale,0.),1.);gl_Position=projectionMatrix*mvPosition;`);s.fragmentShader='varying vec2 atlasFrame;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','diffuseColor*=texture2D(map,(vMapUv+atlasFrame)/vec2(4.,2.));');};mat.customProgramCacheKey=()=> 'scanned-tree-atlas';return mat;
}
// Tree placement follows authored fairway edges. Plants form groves and rock gardens.
export class NaturalLandscape{
 constructor(root,c,sites){
  this.records=[];this.groups=[];this.last=new THREE.Vector3(Infinity,0,0);const r=random(c.seed+2419),placements=new Map(),desert=c.theme==='desert',highland=c.theme==='highlands';
  const add=(name,x,z,scale=1,angle=r()*Math.PI*2,depth=0)=>{if(!placements.has(name))placements.set(name,[]);const rec={x,z,y:heightAt(c,x,z)-depth,scale,angle};placements.get(name).push(rec);return rec;};
  const safe=(x,z,margin=8)=>fairwayDistance(c,x,z)>margin&&greenDistance(c,x,z)>29&&lieAt(c,x,z)!=='Water'&&heightAt(c,x,z)>3.7&&!(root.userData.landmarks||[]).some(b=>Math.abs(x-b.x)<b.halfWidth+7&&Math.abs(z-b.z)<b.halfDepth+7);
  const tree=desert?'dry-tree':'forest-canopy',spacing=desert?15:10,occupied=[];
  for(let i=0;i<900;i++){
   const x=-240+r()*365,z=-65+r()*(c.length+180);if(!safe(x,z,15)||occupied.some(t=>Math.hypot(t.x-x,t.z-z)<spacing))continue;
   // Open scenery windows preserve long views across the golf course.
   const patch=Math.sin(x*.035+1)*Math.cos(z*.023)+Math.sin(z*.041-x*.018)*.55;
   if(patch<(desert?.35:highland?.20:-.16))continue;
   const rec=add(tree,x,z,(desert?.62:.72)+r()*.6);occupied.push(rec);this.records.push(rec);sites.push({id:`scan-tree-${sites.length}`,kind:'tree',x,z,y:rec.y,height:rec.scale*(desert?7:14)});
  }
  // Scanned rock formations compose the coast and the long canyon walls.
  for(let i=0;i<38;i++){
   const z=-30+r()*(c.length+100),x=c.coastal!==false?130+Math.sin(z*.014)*28+r()*17:-145-r()*55;
   if(!safe(x,z,17))continue;
   add(desert?'desert-rock':'coastal-rock',x,z,2+r()*3,r()*6.28,1.0);
  }
  for(let i=0;i<12;i++){
   const z=-5+i*(c.length+90)/11,coastal=c.coastal!==false,x=desert?-210-r()*35:coastal?146+Math.sin(z*.014)*28:-180-r()*45;
   if(fairwayDistance(c,x,z)<30)continue;
   const angle=coastal?-Math.atan2(1,.392*Math.cos(z*.014)):r()*6.28;
   add(desert?'desert-rock':coastal?'sea-cliff':'coastal-rock',x,z,desert?7+r()*8:coastal?.8+r()*.4:4+r()*3,angle,coastal?6:3);
  }
  for(let station=0;station<20;station++){
   const p=routePoint(c,(station+.5)/20),side=station%2?1:-1,cx=p.x+p.tangentZ*side*(p.width+12),cz=p.z-p.tangentX*side*(p.width+12);
   if(!safe(cx,cz,5))continue;
   const rock=add(desert?'desert-rock':'coastal-rock',cx,cz,.40+r()*.65,r()*6.28,.15);sites.push({id:`scan-rock-${sites.length}`,kind:'rock',x:cx,z:cz,y:rock.y,height:rock.scale*3});
   for(let j=0;j<12;j++){
    const a=r()*6.28,d=2+r()*7,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!safe(x,z,3))continue;
    if(!desert)add(j%4?'understory':'fern',x,z,.5+r()*.55);
    else if(j%5===0)add('dry-tree',x,z,.22+r()*.17);
   }
  }
  // Low undergrowth sits within tree groves, not in the playable landing areas.
  for(const t of occupied)for(let j=0;j<(desert?1:3);j++){
   const a=r()*6.28,d=1.5+r()*3,x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d;if(!safe(x,z,5))continue;
   add(desert?'desert-rock':j%2?'understory':'fern',x,z,desert?.2+r()*.25:.45+r()*.45);
  }
  // A broad, soft canopy shadow remains visible beyond the local moving shadow map.
  const shadowPositions=[],shadowUV=[],shadowIds=[];
  for(const rec of this.records){const radius=(desert?2.1:4.8)*rec.scale,base=shadowPositions.length/3;
   for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){const x=rec.x+(i/4-.5)*radius*2.3+radius*.50,z=rec.z+(j/4-.5)*radius*2.3+radius*.50;shadowPositions.push(x,heightAt(c,x,z)+.045,z);shadowUV.push(i/4,j/4);}
   for(let j=0;j<4;j++)for(let i=0;i<4;i++){const n=base+j*5+i;shadowIds.push(n,n+5,n+1,n+1,n+5,n+6);}
  }
  const shadowGeo=new THREE.BufferGeometry();shadowGeo.setAttribute('position',new THREE.Float32BufferAttribute(shadowPositions,3));shadowGeo.setAttribute('uv',new THREE.Float32BufferAttribute(shadowUV,2));shadowGeo.setIndex(shadowIds);
  root.add(new THREE.Mesh(shadowGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;void main(){float d=length(v-.5)*2.;if(d>1.)discard;float a=pow(1.-d,1.35)*.23;gl_FragColor=vec4(.02,.035,.018,a);}'})));
  for(const [name,records]of placements){
   const source=assets.get(name);if(!source)continue;const isTree=name==='forest-canopy'||name==='dry-tree',plant=isTree||name==='understory'||name==='fern';
   for(const part of source.parts){
    const material=part.material.clone();if(c.theme==='cyberpunk')material.color.set('#a2c9da');else if(name==='desert-rock'&&!desert)material.color.set('#9faeae');
    if(plant)sway(material,material.alphaTest>0);
    const mesh=new THREE.InstancedMesh(part.geometry.clone(),material,records.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    if(material.alphaTest>0){mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:THREE.DoubleSide});if(plant)sway(mesh.customDepthMaterial,true);}
    root.add(mesh);this.groups.push({mesh,records,lod:part.lod,isTree,plant,atlas:!!source.map});
   }
   if(source.map){const geo=new THREE.PlaneGeometry(source.span,source.span);geo.translate(0,source.center,0);const mesh=new THREE.InstancedMesh(geo,billboard(source),records.length);mesh.frustumCulled=false;root.add(mesh);this.groups.push({mesh,records,lod:2,isTree:true,atlas:true});}
  }
 }
 update(time,camera){
  clock.value=time;eye.value.copy(camera);if(this.last.distanceToSquared(camera)<9)return;this.last.copy(camera);
  for(const {mesh,records,lod,isTree,plant,atlas}of this.groups){let count=0;
   for(const rec of records){const d=Math.hypot(rec.x-camera.x,rec.z-camera.z,Math.max(0,camera.y-rec.y-5)),near=isTree?36:plant?25:75,far=isTree?90:plant?110:1200;
    if(lod===0?d>=near:lod===1?(d<near||d>=far):d<far)continue;
    if(lod===1&&isTree&&!atlas&&d>450)continue;
    transform.position.set(rec.x,rec.y,rec.z);transform.rotation.set(0,rec.angle,0);transform.scale.setScalar(rec.scale);transform.updateMatrix();mesh.setMatrixAt(count++,transform.matrix);
   }mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  }
 }
}
