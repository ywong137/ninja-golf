import {shorelinePoint} from './shoreline.js';
import * as THREE from 'three';
import {DAY_SKY_YAW,SUN_DIRECTION} from './lighting.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {loadRegionalTerrain} from './regional-terrain.js';
import {createPond,createOceanMaterial} from './water.js';
import { NaturalLandscape,forestAtlasSource,queueSceneryRock } from './nature.js';
import {buildDistantForest} from './distant-forest.js';
import {buildDistantCity} from './distant-city.js';
import {SceneryCollision} from './scenery-collision.js';
import {BuildingNavigation} from './building-navigation.js';
import {buildArchitectureGround} from './architecture-ground.js';
import {buildBridges} from './bridges.js';
import {landscapeHorizon} from './landscape-horizon.js';
import {createTerrainSurfaceSampler} from './terrain-surface.js';
import {buildArchitecture} from './architecture.js';
import {courseMaterial,courseGeometry} from './terrain.js';
import {createCoursePath} from './course-path.js';
import {buildTeeMarkers} from './tee-markers.js';
import {buildThemeScenery,buildFairwayCover,THEME_LIGHTS} from './course-themes.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { heightAt, lieAt, routePoint, waterBasins, waterSurfaceAt, ellipse, smooth, random } from './course.js';

const obj = new THREE.Object3D();
const SUN_OFFSET=new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(170);
const color = new THREE.Color();
function material(hex, roughness=.9, metalness=0) { return new THREE.MeshStandardMaterial({color:hex,roughness,metalness}); }
function addMesh(g, geo, mat, x,y,z, sx=1,sy=1,sz=1) {
  const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
export class World {
  constructor(scene, renderer) {
    this.scene=scene;this.renderer=renderer;this.root=new THREE.Group();scene.add(this.root);
    scene.background=new THREE.Color('#9fbfc2');scene.fog=new THREE.FogExp2('#b4c3bd',.00030);
    const sky=new Sky();this.sky=sky;sky.scale.setScalar(20000);scene.add(sky);
    this.nightSky=new THREE.Mesh(new THREE.SphereGeometry(2400,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 skyDirection;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 n=normalize(skyDirection);float h=max(n.y,0.);vec3 col=mix(vec3(.065,.07,.16),vec3(.006,.012,.036),smoothstep(0.,.8,h));
      vec2 uv=vec2(atan(n.z,n.x)*.15915,asin(n.y)*.3183)*900.;vec2 cell=floor(uv);float star=step(.996,hash(cell))*(1.-smoothstep(.04,.21,length(fract(uv)-.5)))*smoothstep(0.,.18,h);
      float cloud=sin(n.x*13.+n.z*4.)*sin(n.z*19.-n.y*9.);col+=vec3(.025,.012,.045)*pow(max(0.,cloud),3.)*(1.-h);col+=star*vec3(.7,.8,1.);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}));this.nightSky.visible=false;this.nightSky.renderOrder=-100;scene.add(this.nightSky);
    const sun=SUN_OFFSET.clone().normalize();const u=sky.material.uniforms;
    u.turbidity.value=3.5;u.rayleigh.value=1.7;u.mieCoefficient.value=.004;u.mieDirectionalG.value=.83;u.sunPosition.value.copy(sun);
    this.sun=new THREE.DirectionalLight('#ffedd0',3.0);this.sun.position.copy(sun).multiplyScalar(150);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:400});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.08;this.sun.shadow.radius=3;
    scene.add(this.sun,this.sun.target);this.hemisphere=new THREE.HemisphereLight('#d7e6e4','#777a49',.8);scene.add(this.hemisphere);
    const env=new THREE.PMREMGenerator(renderer);this.environment=env.fromScene(sky,.04,1,30000);scene.environment=this.environment.texture;scene.environmentIntensity=.18;env.dispose();
    this.textureCache=new Map();this.texturePromises=[];this.shared=[];this.grassColor=this.texture('grass-color-2k.jpg',true);this.grassNormal=this.texture('grass-normal-2k.jpg');this.sandColor=this.texture('sand-color-2k.jpg',true);this.sandNormal=this.texture('sand-normal-2k.jpg');
    this.turfColor=this.texture('turf-color-2k.jpg',true);this.turfNormal=this.texture('turf-normal-2k.jpg');this.turfRoughness=this.texture('turf-roughness-2k.jpg');
    this.pathColor=this.texture('path-color-2k.jpg',true);this.pathNormal=this.texture('path-normal-2k.jpg');this.pathRoughness=this.texture('path-roughness-2k.jpg');
    this.waterMaterial=createOceanMaterial({time:{value:0},skyMap:{value:null},hasSky:{value:0}});
    this.ocean=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000),this.waterMaterial);this.ocean.rotation.x=-Math.PI/2;this.ocean.position.y=-1.1;scene.add(this.ocean);
    this.rockColor=this.texture('rock-color-2k.jpg',true);this.cliffColor=this.texture('cliff-color.jpg',true);this.rockNormal=this.texture('rock-normal-2k.jpg');this.cliffNormal=this.texture('cliff-normal.jpg');
    this.terrainReady=loadRegionalTerrain(import.meta.env.BASE_URL).then(regions=>{this.regions=regions;if(this.course){this.buildHorizon(this.course);this.distantForest=buildDistantForest(this.root,this.course,this.regions[this.course.theme],forestAtlasSource(this.course.theme),this.horizonHeight);}}).catch(error=>console.warn('Regional terrain unavailable; using the course outskirts.',error));
    this.ready=new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}textures/coastal-sky.hdr`).then(texture=>{texture.mapping=THREE.EquirectangularReflectionMapping;sky.visible=false;this.coastalSky=texture;scene.background=texture;scene.backgroundIntensity=.78;scene.backgroundRotation.y=DAY_SKY_YAW;const pmrem=new THREE.PMREMGenerator(renderer);this.environment.dispose();this.environment=pmrem.fromEquirectangular(texture);scene.environment=this.environment.texture;scene.environmentIntensity=.52;scene.environmentRotation.y=DAY_SKY_YAW;pmrem.dispose();this.waterMaterial.uniforms.skyMap.value=texture;this.waterMaterial.uniforms.hasSky.value=1;this.applyTheme(this.course);}).catch(error=>console.warn('Photographic sky unavailable; using atmospheric sky.',error));
    this.nightReady=new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}textures/city-night.hdr`).then(texture=>{texture.mapping=THREE.EquirectangularReflectionMapping;this.citySky=texture;const pmrem=new THREE.PMREMGenerator(renderer);this.nightEnvironment=pmrem.fromEquirectangular(texture);pmrem.dispose();this.applyTheme(this.course);}).catch(error=>console.warn('City sky unavailable; using the night atmosphere.',error));
  }
  texture(file,srgb=false){
    if(this.textureCache.has(file))return this.textureCache.get(file);
    let loaded;const ready=new Promise(resolve=>loaded=resolve);this.texturePromises.push(ready);const t=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${file}`,loaded,undefined,error=>{console.warn(`Surface texture unavailable: ${file}`,error);loaded();});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(srgb)t.colorSpace=THREE.SRGBColorSpace;this.textureCache.set(file,t);return t;
  }
  waitForAssets(){return Promise.all([this.ready,this.nightReady,this.terrainReady,...this.texturePromises]);}
  buildHorizon(c){
    this.distantCity?.dispose();this.distantCity=null;
    if(this.horizon){this.root.remove(this.horizon);this.horizon.geometry.dispose();this.horizon.material.dispose();}
    this.horizon=new THREE.Mesh(landscapeHorizon(c,this.regions?.[c.theme]),courseMaterial(c,this,true));this.horizon.receiveShadow=true;this.root.add(this.horizon);this.horizonHeight=(c.theme==='japanese'||c.theme==='highlands')?createTerrainSurfaceSampler(this.horizon.geometry):null;
    this.distantCity=buildDistantCity(this.root,c,this.regions?.[c.theme]);
  }
  applyTheme(c){
    const theme=c?.theme||'japanese',t=THEME_LIGHTS[theme];
    this.scene.background=theme==='cyberpunk'?new THREE.Color(t.sky):(this.coastalSky||new THREE.Color(t.sky));
    this.scene.environment=theme==='cyberpunk'&&this.nightEnvironment?this.nightEnvironment.texture:this.environment.texture;
    this.sky.visible=theme!=='cyberpunk'&&!this.coastalSky;this.nightSky.visible=theme==='cyberpunk';
    this.scene.backgroundIntensity=theme==='cyberpunk'?.02:theme==='highlands'?.63:theme==='desert'?.94:.78;this.scene.backgroundRotation.y=theme==='cyberpunk'?4.5:DAY_SKY_YAW;
    this.scene.fog.color.set(t.fog);this.scene.fog.density=theme==='cyberpunk'?.0006:theme==='highlands'?.00014:theme==='desert'?.00013:.00022;
    this.sun.color.set(t.sun);this.sun.intensity=t.intensity;
    this.hemisphere.color.set(t.fill);this.hemisphere.groundColor.set(t.ground);this.hemisphere.intensity=t.ambient;
    this.scene.environmentIntensity=theme==='cyberpunk'?.4:theme==='highlands'?.32:.52;
    this.ocean.visible=c?.coastal!==false;
    this.scene.environmentRotation.y=this.scene.backgroundRotation.y;this.waterMaterial.uniforms.skyRotation.value=this.scene.backgroundRotation.y;this.waterMaterial.uniforms.skyIntensity.value=this.scene.backgroundIntensity;this.waterMaterial.uniforms.waterFog.value.copy(this.scene.fog.color);this.waterMaterial.uniforms.skyMap.value=theme==='cyberpunk'?this.citySky:this.coastalSky;this.waterMaterial.uniforms.hasSky.value=this.waterMaterial.uniforms.skyMap.value?1:0;
  }
  terrainMaterial(c){return courseMaterial(c,this);}
  clear(){
    this.pond?.dispose();
    const materials=new Set(),geos=new Set();this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geos.add(o.geometry);if(o.customDepthMaterial)materials.add(o.customDepthMaterial);if(o.material&&o.material!==this.waterMaterial)materials.add(o.material);});
    this.root.clear();this.collision=new SceneryCollision();this.buildingNavigation=null;this.path=null;this.distantCity=null;this.horizon=null;this.horizonHeight=null;this.root.userData.landmarks=[];this.root.userData.buildingObstacles=[];this.root.userData.pathContains=null;delete this.root.userData.architectureGround;delete this.root.userData.sceneryRocks;geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  build(course) {
    this.clear();this.ambushSites=[];this.course=course;this.applyTheme(course);const c=course,r=random(c.seed),preview=routePoint(c,.35);this.previewShadowFocus=new THREE.Vector3(preview.x,heightAt(c,preview.x,preview.z),preview.z);
    const geo=courseGeometry(c,heightAt,ellipse);
    const terrain=new THREE.Mesh(geo,this.terrainMaterial(c));terrain.receiveShadow=true;this.root.add(terrain);this.buildHorizon(c);
    this.pond=createPond(c,this.waterMaterial.uniforms);this.root.add(this.pond);this.makePath();
    if(c.theme==='japanese'||!c.theme){this.makeBuildings();this.makeAmbushGardens();}else buildThemeScenery(this.root,c,this.ambushSites,{rock:this.rockColor,normal:this.rockNormal});
    buildFairwayCover(this.root,c,this.ambushSites,{color:this.rockColor,normal:this.rockNormal});
    buildArchitectureGround(this.root,c,this.path,this.ambushSites);
    this.vegetation=new NaturalLandscape(this.root,c,this.ambushSites);this.distantForest=buildDistantForest(this.root,c,this.regions?.[c.theme],forestAtlasSource(c.theme),this.horizonHeight);this.makeGrass(r);buildBridges(this.root,c,{color:this.texture('bark-color.jpg',true),normal:this.texture('bark-normal.jpg')});this.collision=new SceneryCollision(this.ambushSites,this.root.userData.buildingObstacles);this.buildingNavigation=new BuildingNavigation(c,this.collision);this.makeFlag();this.makePetals(r);this.makeBirds();
    buildTeeMarkers(this.root,c,{stoneColor:this.rockColor,stoneNormal:this.rockNormal});
  }
  makeGrass(r){
    const vertices=[],colors=[],indices=[];
    for(let blade=0;blade<6;blade++){
      const angle=blade*2.4,h=.045+r()*.09,cx=(r()-.5)*.20,cz=(r()-.5)*.20,base=vertices.length/3;
      for(const [side,y,bend] of [[-1,0,0],[1,0,0],[-.65,h*.65,.008],[.65,h*.65,.008],[0,h,.024]]){
        vertices.push(cx+Math.cos(angle)*side*.0035+Math.sin(angle)*bend,y,cz+Math.sin(angle)*side*.0035-Math.cos(angle)*bend);
        color.set(y===0?'#415324':'#758a45');colors.push(color.r,color.g,color.b);
      }
      indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,emissive:'#253414',emissiveIntensity:.18});
    this.grassTime={value:0};this.grassFocus={value:new THREE.Vector3()};
    mat.onBeforeCompile=s=>{s.uniforms.grassTime=this.grassTime;s.uniforms.grassFocus=this.grassFocus;s.vertexShader='uniform float grassTime;uniform vec3 grassFocus;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 origin=instanceMatrix[3].xyz;float fade=1.-smoothstep(22.,29.,distance(origin.xz,grassFocus.xz));
      transformed.y*=fade;transformed.x+=sin(grassTime*1.7+origin.x*.4+origin.z*.2)*position.y*.22*fade;`);};mat.customProgramCacheKey=()=> 'coastal-grass';
    this.grass=new THREE.InstancedMesh(geo,mat,15000);this.grass.receiveShadow=true;this.grass.frustumCulled=false;this.grassAnchor=new THREE.Vector2(Infinity,Infinity);this.root.add(this.grass);this.updateGrass(new THREE.Vector3(0,0,0));
  }
  updateGrass(focus){
    if(!this.grass)return;
    const x0=Math.floor(focus.x/5)*5,z0=Math.floor(focus.z/5)*5;
    // Compare cell identities: a cell corner can be more than 5 m from its origin.
    if(this.grassAnchor.x===x0&&this.grassAnchor.y===z0)return;
    this.grassAnchor.set(x0,z0);let n=0;
    for(let z=z0-30;z<z0+30;z+=.5)for(let x=x0-30;x<x0+30;x+=.5){
      const hash=Math.sin(x*127.1+z*311.7)*43758.5453,j=hash-Math.floor(hash),xx=x+j*.45,zz=z+(1-j)*.45;
      if(this.course.theme==='desert'||this.course.theme==='cyberpunk'||lieAt(this.course,xx,zz)!=='Rough'||heightAt(this.course,xx,zz)<3.5||this.root.userData.pathContains?.(xx,zz,.2))continue;
      obj.position.set(xx,heightAt(this.course,xx,zz)-.025,zz);obj.rotation.set(0,j*6.28,0);const scale=.65+j*.6;obj.scale.set(scale,scale,scale);obj.updateMatrix();this.grass.setMatrixAt(n++,obj.matrix);
    }
    this.grass.count=n;this.grass.instanceMatrix.needsUpdate=true;
  }
  makeBuildings(){buildArchitecture(this.root,this.course,{color:this.texture('rock-color-2k.jpg',true),normal:this.texture('rock-normal-2k.jpg')});}
  makeAmbushGardens(){
    const firstChild=this.root.children.length;
    const c=this.course,stone=new THREE.MeshStandardMaterial({color:'#a5a59a',map:this.texture('rock-color-2k.jpg',true),normalMap:this.texture('rock-normal-2k.jpg'),roughness:.9});
    const dark=material('#35443c'),bronze=material('#7c765b',.4,.6),box=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
    const rockGeo=new THREE.IcosahedronGeometry(1,2);
    const register=(kind,x,z,height=0,radius)=>this.ambushSites.push({id:`${kind}-${this.ambushSites.length}`,kind,x,z,y:kind==='water'?waterSurfaceAt(c,x,z):heightAt(c,x,z),height,radius,fairway:lieAt(c,x,z)==='Fairway'});
    // Boundary pairs frame the walk. Alternating fairway islands create interior ambush locations.
    const locations=[];
    for(let station=0;station<12;station++)for(const side of [-1,1]){const p=routePoint(c,(station+.5)/12);locations.push({station,side,z:p.z-p.tangentX*side*(p.width+7),x:p.x+p.tangentZ*side*(p.width+7),interior:false,angle:Math.atan2(p.tangentX,p.tangentZ)});}
    for(let n=0;n<4;n++){const p=routePoint(c,.17+n*.2),side=n%2?-1:1;locations.push({station:n+1,side,z:p.z-p.tangentX*side*p.width*.48,x:p.x+p.tangentZ*side*p.width*.48,interior:true,angle:Math.atan2(p.tangentX,p.tangentZ)});}
    for(const {station,side,x,z,interior,angle} of locations){
      if(['Water','Green','Bunker'].includes(lieAt(c,x,z))||this.root.userData.pathContains?.(x,z,1.7))continue;
      const y=heightAt(c,x,z),g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;this.root.add(g);
      if(interior){addMesh(g,cyl,stone,0,.04,0,2.1,.08,2.1);for(let j=0;j<12;j++){const a=j*Math.PI/6;addMesh(g,rockGeo,stone,Math.cos(a)*2.05,.10,Math.sin(a)*2.05,.17,.12,.15);}}
      addMesh(g,box,stone,0,.14,0,1.6,.28,1.6);addMesh(g,cyl,stone,0,.75,0,.26,1.1,.26);addMesh(g,box,stone,0,1.43,0,.93,.23,.93);
      for(const xx of [-.32,.32])for(const zz of [-.32,.32])addMesh(g,box,stone,xx,1.78,zz,.15,.6,.15);
      addMesh(g,cyl,bronze,0,1.65,0,.15,.15,.15);
      const levels=station%3===1?3:1;
      for(let l=0;l<levels;l++){const roof=new THREE.ConeGeometry(1-l*.15,.45,4);roof.rotateY(Math.PI/4);addMesh(g,roof,dark,0,2.17+l*.54,0);if(l<levels-1)addMesh(g,box,stone,0,2.4+l*.54,0,.55,.45,.55);}
      addMesh(g,new THREE.SphereGeometry(.13,12,8),stone,0,2.48+(levels-1)*.54,0);
      register(levels>1?'pagoda':'lantern',x,z,2.5);
      if(station%2===0)for(let j=0;j<3;j++){const rx=x+side*(2.1+j*.9),rz=z+1.1-j*1.3,ry=heightAt(c,rx,rz),size=j===0?1.2:.6+j*.14;queueSceneryRock(this.root,{x:rx,z:rz,y:ry,height:size*.8,radius:size,angle:angle+.7*j+station*.37,burial:.14+j*.035});register('rock',rx,rz,size*.8,Math.min(1.15,size*.65));}
    }
    // Merge static garden props by material so each course adds three draw calls.
    const props=this.root.children.slice(firstChild),batches=new Map(),originals=new Set();
    for(const prop of props){prop.updateMatrixWorld(true);prop.traverse(o=>{if(!o.isMesh)return;const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geometry);originals.add(o.geometry);});this.root.remove(prop);}
    for(const [mat,geometries]of batches){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);}originals.forEach(g=>g.dispose());
    for(const b of c.bunkers)for(const side of [-1,1])register('sand',b[0]+side*b[2]*.45,b[1]);
    for(const pond of waterBasins(c))for(let i=0;i<10;i++){const a=i*Math.PI*2/10;const [sx,sz]=shorelinePoint(pond,a),x=pond[0]+(sx-pond[0])*.92,z=pond[1]+(sz-pond[1])*.92;if(lieAt(c,x,z)==='Water')register('water',x,z);}
  }
  makeFlag(){
    const c=this.course,x=c.greenX,z=c.length,y=heightAt(c,x,z);this.cup=new THREE.Vector3(x,y,z);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.22,32),new THREE.MeshBasicMaterial({color:'#17231b'}));hole.rotation.x=-Math.PI/2;hole.position.set(x,y+.024,z);this.root.add(hole);
    addMesh(this.root,new THREE.CylinderGeometry(.04,.04,4.8,8),material('#ebe5d2',.4,.3),x,y+2.4,z);
    const fg=new THREE.PlaneGeometry(1.7,1,14,8);fg.translate(.85,0,0);this.flag=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({color:'#b94938',side:THREE.DoubleSide,roughness:.8}));this.flag.position.set(x,y+4.1,z);this.root.add(this.flag);
  }
  makePath(){const mesh=createCoursePath(this.course,this);this.path=mesh;this.root.add(mesh);this.root.userData.pathContains=mesh.userData.contains;}
  makeBirds(){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.32,-.13,0,-.35,.13,0,-.35, -.08,0,.1,-.85,.09,-.06,-.45,0,-.26, .08,0,.1,.45,0,-.26,.85,.09,-.06],3));geo.computeVertexNormals();
    const mat=new THREE.MeshBasicMaterial({color:'#d1d4c8',side:THREE.DoubleSide});this.birdTime={value:0};mat.onBeforeCompile=s=>{s.uniforms.birdTime=this.birdTime;s.vertexShader='uniform float birdTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float phase=instanceMatrix[3].y;transformed.y+=abs(position.x)*sin(birdTime*4.+phase)*.27;`);};mat.customProgramCacheKey=()=> 'coastal-gulls';
    this.birds=new THREE.InstancedMesh(geo,mat,9);this.birds.frustumCulled=false;this.root.add(this.birds);
  }
  makePetals(r){
    if(!this.airborneMap){const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);this.airborneMap=new THREE.CanvasTexture(canvas);}
    const positions=[],city=this.course.theme==='cyberpunk';this.petalFloor=[];
    for(let i=0;i<110;i++){const x=-70+r()*140,z=-20+r()*100,floor=heightAt(this.course,x,z)+.4;positions.push(x,floor+.5+r()*5,z);this.petalFloor.push(floor);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const m=new THREE.PointsMaterial({map:this.airborneMap,color:city?'#7bf5f5':this.course.theme==='desert'?'#e8c997':'#e4dfcb',size:city?.10:.045,transparent:true,depthWrite:false,opacity:city?.55:.32});this.petals=new THREE.Points(g,m);this.root.add(this.petals);
  }
  update(time,dt,focus,camera){
    const lightingFocus=focus||this.previewShadowFocus;this.vegetation?.update(time,camera||lightingFocus,lightingFocus);
    this.waterMaterial.uniforms.time.value=time;if(this.grassTime)this.grassTime.value=time;if(focus)this.grassFocus?.value.copy(focus);
    if(this.birds){this.birdTime.value=time;for(let i=0;i<9;i++){const a=time*.035+i*.52;obj.position.set(110+Math.sin(a)*65,28+i%3*7+Math.sin(a*2)*3,this.course.length*.55+Math.cos(a)*120);obj.rotation.set(0,Math.atan2(Math.cos(a)*65,-Math.sin(a)*120),Math.sin(a)*.1);obj.scale.setScalar(.9+i%3*.15);obj.updateMatrix();this.birds.setMatrixAt(i,obj.matrix);}this.birds.instanceMatrix.needsUpdate=true;}
    if(this.flag){const p=this.flag.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*3-time*4)*x*.13);}p.needsUpdate=true;this.flag.geometry.computeVertexNormals();}
    if(this.petals){const p=this.petals.geometry.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+dt*.24);p.setY(i,p.getY(i)-dt*.05);if(p.getY(i)<this.petalFloor[i])p.setY(i,this.petalFloor[i]+5);if(p.getX(i)>95){p.setX(i,-75);this.petalFloor[i]=heightAt(this.course,-75,p.getZ(i))+.4;p.setY(i,this.petalFloor[i]+3);}}p.needsUpdate=true;}
    if(focus)this.updateGrass(focus);if(lightingFocus){this.sun.target.position.copy(lightingFocus);this.sun.position.copy(lightingFocus).add(SUN_OFFSET);this.sun.target.updateMatrixWorld();}
  }
}
