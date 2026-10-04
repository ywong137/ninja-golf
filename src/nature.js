import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {heightAt,lieAt,fairwayDistance,greenDistance,random,routePoint} from './course.js';
import {bridgeDistance} from './course-layout.js';
import views from './nature-views.json' with {type:'json'};
import {TREE_DETAIL,foliageEye,treeTransition,treeImpostor,canopyShadowMaterial,leafTransmission,leafShadowCutoff} from './foliage-materials.js';
import {sceneryRockBounds,fitSceneryRock} from './scenery-rocks.js';
import {TREE_SPECIES,forestSpecies,selectForestSpecies} from './nature-species.js';
export {queueSceneryRock} from './scenery-rocks.js';
const ATLAS_REVISION='relit-tree-1';
const SOURCES=['forest-canopy','dry-tree','understory','fern','coastal-rock','desert-rock','sea-cliff','pine-open','pine-young','fir-layered','woody-scrub'];
const assets=new Map(),transform=new THREE.Object3D(),clock={value:0};
export async function loadNature(){
 const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
 await Promise.all(SOURCES.map(async name=>{
  const conifer=['pine-open','pine-young','fir-layered'].includes(name);
  const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}.glb`);model.scene.updateMatrixWorld(true);
  // The source needle alpha has soft coverage. A 0.45 cutoff erased it in
  // minified views. The custom shadow material below shares this same cutoff.
  const parts=[];model.scene.traverse(o=>{if(!o.isMesh)return;const material=o.material;if(conifer)material.vertexColors=false;material.metalness=0;material.roughness=Math.max(.75,material.roughness);material.envMapIntensity=.45;if(material.transparent){material.transparent=false;material.alphaTest=conifer?.18:.45;material.depthWrite=true;material.side=THREE.DoubleSide;}for(const key of ['map','normalMap','roughnessMap'])if(material[key])material[key].anisotropy=8;parts.push({lod:o.name.startsWith('LOD1')?1:0,geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),material});});
  let map,normalMap,shadowMap;if(views[name]){[map,normalMap,shadowMap]=await Promise.all(['views','normals','shadow'].map(kind=>textures.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}-${kind}.webp?v=${kind==='shadow'?'sun-47888':ATLAS_REVISION}`)));map.colorSpace=THREE.SRGBColorSpace;}
  assets.set(name,{parts,bounds:sceneryRockBounds(parts),map,normalMap,shadowMap,...views[name]});
 }));
}
function sway(material,foliage){
 material.onBeforeCompile=s=>{s.uniforms.natureTime=clock;s.vertexShader='uniform float natureTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float bend=pow(clamp(position.y/14.,0.,1.),2.);vec3 origin=instanceMatrix[3].xyz;
 transformed.x+=sin(natureTime*.9+origin.x*.1+origin.z*.07)*bend*.14;
 ${foliage?'transformed.x+=sin(natureTime*2.3+position.x*2.+position.y)*.025*bend;':''}`);};material.customProgramCacheKey=()=>`scanned-nature-${foliage}`;
}
// Tree placement follows authored fairway edges. Plants form groves and rock gardens.
export class NaturalLandscape{
 constructor(root,c,sites){
  this.records=[];this.groups=[];this.last=new THREE.Vector3(Infinity,0,0);const r=random(c.seed+2419),placements=new Map(),desert=c.theme==='desert',highland=c.theme==='highlands';
  const add=(name,x,z,scale=1,angle=r()*Math.PI*2,depth=0)=>{if(!placements.has(name))placements.set(name,[]);const rec={x,z,y:heightAt(c,x,z)-depth,scale,angle};placements.get(name).push(rec);return rec;};
  for(const rock of root.userData.sceneryRocks||[]){
   const source=assets.get(rock.source);if(!source)throw new Error(`Missing scenery scan ${rock.source}; await loadNature before building the course`);
   if(!placements.has(rock.source))placements.set(rock.source,[]);
   placements.get(rock.source).push(fitSceneryRock(rock,source.bounds));
  }
  delete root.userData.sceneryRocks;
  const safe=(x,z,margin=8)=>fairwayDistance(c,x,z)>margin&&greenDistance(c,x,z)>29&&bridgeDistance(c,x,z)>3&&lieAt(c,x,z)!=='Water'&&heightAt(c,x,z)>3.7&&!root.userData.pathContains?.(x,z,3)&&!(root.userData.landmarks||[]).some(b=>Math.abs(x-b.x)<b.halfWidth+7&&Math.abs(z-b.z)<b.halfDepth+7);
  const spacing=desert?15:highland?15:10,occupied=[];
  for(let i=0;i<900;i++){
   const x=-240+r()*365,z=-65+r()*(c.length+180);if(!safe(x,z,15)||occupied.some(t=>Math.hypot(t.x-x,t.z-z)<spacing))continue;
   // Open scenery windows preserve long views across the golf course.
   const patch=Math.sin(x*.035+1)*Math.cos(z*.023)+Math.sin(z*.041-x*.018)*.55;
   if(patch<(desert?.35:highland?.38:-.16))continue;
   const tree=selectForestSpecies(c.theme,r()),rec=add(tree,x,z,(desert?.62:.78)+r()*(desert?.6:.38));rec.species=tree;occupied.push(rec);this.records.push(rec);sites.push({id:`scan-tree-${sites.length}`,kind:'tree',x,z,y:rec.y,height:rec.scale*TREE_SPECIES[tree].height});
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
    if(!desert)add(highland?(j%4?'woody-scrub':'fern'):(j%4?'understory':'fern'),x,z,highland?.55+r()*.45:.5+r()*.55);
    else if(j%5===0)add('dry-tree',x,z,.22+r()*.17);
   }
  }
  // Low undergrowth sits within tree groves, not in the playable landing areas.
  for(const t of occupied)for(let j=0;j<(desert?1:3);j++){
   const a=r()*6.28,d=1.5+r()*3,x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d;if(!safe(x,z,5))continue;
   add(desert?'desert-rock':highland?'woody-scrub':j%2?'understory':'fern',x,z,desert?.2+r()*.25:.45+r()*.45);
  }
  // Ground silhouettes follow the scanned branches and the actual sun direction.
  for(const {name:tree} of forestSpecies(c.theme)){
  const source=assets.get(tree),shadowPositions=[],shadowUV=[],shadowIds=[],anchors=[];
  for(const rec of this.records.filter(rec=>rec.species===tree)){const view=Math.round(rec.angle/(Math.PI*2)*8)%8,[minX,minZ,maxX,maxZ]=source.shadowViews[view],base=shadowPositions.length/3;
   for(let j=0;j<=8;j++)for(let i=0;i<=8;i++){const x=rec.x+(minX+(maxX-minX)*i/8)*rec.scale,z=rec.z+(minZ+(maxZ-minZ)*j/8)*rec.scale;shadowPositions.push(x,heightAt(c,x,z)+.035,z);shadowUV.push((view%4+i/8)/4,(1-Math.floor(view/4)+1-j/8)/2);anchors.push(rec.x,rec.y,rec.z);}
   for(let j=0;j<8;j++)for(let i=0;i<8;i++){const n=base+j*9+i;shadowIds.push(n,n+9,n+1,n+1,n+9,n+10);}
  }
  const shadowGeo=new THREE.BufferGeometry();shadowGeo.setAttribute('position',new THREE.Float32BufferAttribute(shadowPositions,3));shadowGeo.setAttribute('uv',new THREE.Float32BufferAttribute(shadowUV,2));shadowGeo.setAttribute('treeAnchor',new THREE.Float32BufferAttribute(anchors,3));shadowGeo.setIndex(shadowIds);
  root.add(new THREE.Mesh(shadowGeo,canopyShadowMaterial(source.shadowMap,c.theme==='cyberpunk',TREE_SPECIES[tree]?.detail||TREE_DETAIL)));
  }
  for(const [name,records]of placements){
   const source=assets.get(name);if(!source)continue;const isTree=!!TREE_SPECIES[name],plant=isTree||name==='understory'||name==='fern'||name==='woody-scrub',detail=TREE_SPECIES[name]?.detail||TREE_DETAIL;
   for(const part of source.parts){
    const material=part.material.clone();if(c.theme==='cyberpunk')material.color.set('#a2c9da');else if(name==='desert-rock'&&!desert)material.color.set('#9faeae');
    if(plant){material.envMapIntensity=.85;sway(material,material.alphaTest>0);}if(isTree)treeTransition(material,part.lod,detail);if(plant&&material.alphaTest>0)leafTransmission(material);
    const mesh=new THREE.InstancedMesh(part.geometry.clone(),material,records.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    if(material.alphaTest>0){mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:THREE.DoubleSide});if(plant)sway(mesh.customDepthMaterial,true);if(isTree)treeTransition(mesh.customDepthMaterial,part.lod,detail);if(['pine-open','pine-young','fir-layered'].includes(name))leafShadowCutoff(mesh.customDepthMaterial,material.alphaTest);}
    root.add(mesh);this.groups.push({mesh,records,lod:part.lod,isTree,plant,detail,atlas:!!source.map});
   }
   if(source.map){const geo=new THREE.PlaneGeometry(source.span,source.span);geo.translate(0,source.center,0);const material=treeImpostor(source,{detail});if(c.theme==='cyberpunk')material.color.set('#a2c9da');const mesh=new THREE.InstancedMesh(geo,material,records.length);mesh.frustumCulled=false;root.add(mesh);this.groups.push({mesh,records,lod:2,isTree:true,detail,atlas:true});}
  }
 }
 update(time,camera){
  clock.value=time;foliageEye.value.copy(camera);if(this.last.distanceToSquared(camera)<.25)return;this.last.copy(camera);
  for(const {mesh,records,lod,isTree,plant,detail=TREE_DETAIL,atlas}of this.groups){let count=0;
   for(const rec of records){const d=Math.hypot(rec.x-camera.x,rec.z-camera.z,Math.max(0,camera.y-rec.y-5)),near=isTree?detail.nearEnd:plant?25:75,far=isTree?detail.farEnd:plant?110:1200;
    if(lod===0?d>=near:lod===1?(d<(isTree?detail.nearStart:near)||d>=far):d<detail.farStart)continue;
    if(lod===1&&isTree&&!atlas&&d>450)continue;
    transform.position.set(rec.x,rec.y,rec.z);transform.rotation.set(0,rec.angle,0);transform.scale.set(rec.scaleX??rec.scale,rec.scaleY??rec.scale,rec.scaleZ??rec.scale);transform.updateMatrix();mesh.setMatrixAt(count++,transform.matrix);
   }mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  }
 }
}

export function forestAtlasSource(theme){
 const source=assets.get('forest-canopy');
 return theme?{...source,species:forestSpecies(theme).map(entry=>({...entry,source:assets.get(entry.name)}))}:source;
}
