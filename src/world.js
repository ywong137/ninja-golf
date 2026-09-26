import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { heightAt, lieAt, center, greenDistance, ellipse, smooth, random } from './course.js';

const UP = new THREE.Vector3(0,1,0);
const obj = new THREE.Object3D();
const color = new THREE.Color();
function material(hex, roughness=.9, metalness=0) { return new THREE.MeshStandardMaterial({color:hex,roughness,metalness}); }
function addMesh(g, geo, mat, x,y,z, sx=1,sy=1,sz=1) {
  const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function groundTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(512,512), r=random(61);
  for(let i=0;i<pixels.data.length;i+=4){const v=175+r()*75;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0); const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(140,180);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
export class World {
  constructor(scene, renderer) {
    this.scene=scene;this.renderer=renderer;this.root=new THREE.Group();scene.add(this.root);
    scene.background=new THREE.Color('#9fbfc2');scene.fog=new THREE.FogExp2('#b9ccc5',.0009);
    const sky=new Sky();sky.scale.setScalar(20000);scene.add(sky);
    const sun=new THREE.Vector3(-.65,.42,-.68).normalize();const u=sky.material.uniforms;
    u.turbidity.value=3.5;u.rayleigh.value=1.7;u.mieCoefficient.value=.004;u.mieDirectionalG.value=.83;u.sunPosition.value.copy(sun);
    this.sun=new THREE.DirectionalLight('#ffedd0',3.0);this.sun.position.copy(sun).multiplyScalar(150);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:400});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.08;this.sun.shadow.radius=3;
    scene.add(this.sun,this.sun.target);scene.add(new THREE.HemisphereLight('#d7e6e4','#777a49',.8));
    const env=new THREE.PMREMGenerator(renderer);this.environment=env.fromScene(sky,.04,1,30000);scene.environment=this.environment.texture;scene.environmentIntensity=.18;env.dispose();
    this.detail=groundTexture();this.leafTexture=this.makeLeafTexture();this.shared=[];
    this.waterMaterial=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},sun:{value:sun},fogColor:{value:new THREE.Color('#b9ccc5')}},
      vertexShader:`varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`uniform float time; uniform vec3 sun; uniform vec3 fogColor; varying vec3 vWorld;
      float wave(vec2 p){return sin(p.x*.14+time*.8)*.5+sin(p.y*.21+time*.6)*.27+sin(p.x*.55+p.y*.32-time*1.2)*.11+sin(p.x*1.5-p.y*.8+time)*.035;}
      void main(){vec2 p=vWorld.xz; float h=wave(p);vec3 n=normalize(vec3(wave(p-vec2(.1,0.))-wave(p+vec2(.1,0.)),.8,wave(p-vec2(0.,.1))-wave(p+vec2(0.,.1)))); vec3 v=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(v,n),0.),3.);float spec=pow(max(dot(reflect(-sun,n),v),0.),120.); vec3 c=mix(vec3(.055,.22,.23),vec3(.40,.61,.61),fres);c+=spec*vec3(1.,.82,.55)*2.;c+=h*.017;float fog=1.-exp(-length(cameraPosition-vWorld)*.00075);gl_FragColor=vec4(mix(c,fogColor,fog),1.); #include <tonemapping_fragment> #include <colorspace_fragment> }`.replace(' #include','\n#include').replace(' #include','\n#include').replace(' }','\n}'),
    });
    this.ocean=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000),this.waterMaterial);this.ocean.rotation.x=-Math.PI/2;this.ocean.position.y=-1.1;scene.add(this.ocean);
    this.makeMountains();
  }
  makeMountains(){
    const geo=new THREE.PlaneGeometry(5200,2100,170,75);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    for(let i=0;i<p.count;i++) {const x=p.getX(i),z=p.getZ(i);const peaks=Math.pow(Math.max(0,1-Math.abs(z)/1100),1.4);const h=(220+170*Math.sin(x*.002+1)+95*Math.sin(x*.007)+30*Math.sin(x*.022+z*.015))*peaks; p.setY(i,h);color.set(h>365?'#b9c6bf':'#526e67');color.multiplyScalar(.86+.16*Math.sin(x*.02+z*.019));colors.push(color.r,color.g,color.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));m.position.set(-400,-30,1900);this.scene.add(m);
  }
  clear(){
    const materials=new Set(),geos=new Set();this.root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material&&o.material!==this.waterMaterial)materials.add(o.material);});
    this.root.clear();geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  build(course) {
    this.clear();this.course=course;const c=course,r=random(c.seed);const extent=c.length+330;
    const geo=new THREE.PlaneGeometry(750,extent,250,Math.round(extent/3));geo.rotateX(-Math.PI/2);geo.translate(0,0,c.length/2);
    const p=geo.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),y=heightAt(c,x,z);p.setY(i,y);
      const lie=lieAt(c,x,z),stripe=Math.floor((z+x*.3)/11)%2===0;
      if(lie==='Fairway'||lie==='Tee')color.set(stripe?'#71904a':'#668642');
      else if(lie==='Green')color.set(stripe?'#92a55a':'#8da157');
      else if(lie==='Bunker')color.set('#d6c399');
      else if(y<1)color.set('#7f8370');
      else color.set('#6a7542');
      const variation=.94+.06*Math.sin(x*.3+z*.21)+r()*.055; color.multiplyScalar(variation);colors.push(color.r,color.g,color.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:this.detail,roughness:1}));terrain.receiveShadow=true;this.root.add(terrain);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(1,80),this.waterMaterial);pond.rotation.x=-Math.PI/2;pond.scale.set(c.pond[2]*1.035,c.pond[3]*1.035,1);pond.position.set(c.pond[0],3.1,c.pond[1]);this.root.add(pond);
    this.makeTrees(r);this.makeRocks(r);this.makeGrass(r);this.makeBuildings();this.makeFlag();this.makePath();this.makePetals(r);
    const teeMat=material('#ece0c4');for(const x of [-3.4,3.4]){const m=addMesh(this.root,new THREE.BoxGeometry(.45,.35,.45),teeMat,x,heightAt(c,x,0)+.17,0);m.rotation.y=.25;}
  }
  makeLeafTexture(){
    const cv=document.createElement('canvas');cv.width=cv.height=256;const ctx=cv.getContext('2d'),r=random(129);
    // Individual leaves form an irregular silhouette; alpha testing keeps each card opaque and sortable.
    for(let j=0;j<1700;j++) {const a=r()*Math.PI*2,rad=Math.sqrt(r()),x=128+Math.cos(a)*rad*112,y=128+Math.sin(a)*rad*94;
      if(r()>.8&&rad>.72)continue;const light=Math.round(80+r()*136+(128-y)*.19);ctx.fillStyle=`rgb(${light},${light},${Math.round(light*.88)})`;ctx.beginPath();ctx.ellipse(x,y,2+r()*5,1+r()*2.3,r()*Math.PI,0,Math.PI*2);ctx.fill();}
    const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  makeTrees(r){
    const c=this.course,trees=[];
    for(let i=0;i<800;i++) {const z=-95+r()*(c.length+230),x=-280+r()*440;const d=Math.abs(x-center(c,z));
      if(d<c.width+19||greenDistance(c,x,z)<36||lieAt(c,x,z)==='Water'||heightAt(c,x,z)<4||ellipse(x,z,c.pond)<1.25)continue;
      trees.push({x,z,y:heightAt(c,x,z),size:7+r()*12,angle:r()*6.28,pink:r()<.055});
    }
    const trunkGeo=new THREE.CylinderGeometry(.18,.42,1,7);
    const planes=[];for(let i=0;i<3;i++){const p=new THREE.PlaneGeometry(2,2);p.rotateY(i*Math.PI/3);p.rotateX(.15);planes.push(p);}const leafGeo=mergeGeometries(planes);planes.forEach(p=>p.dispose());
    const trunks=new THREE.InstancedMesh(trunkGeo,material('#514436'),trees.length*5);
    const leafMat=new THREE.MeshStandardMaterial({color:'#bac395',map:this.leafTexture,alphaTest:.5,side:THREE.DoubleSide,roughness:1});
    const foliage=new THREE.InstancedMesh(leafGeo,leafMat,trees.length*11);
    let ti=0,li=0;
    for(const t of trees){
      obj.position.set(t.x,t.y+t.size*.34,t.z);obj.rotation.set(0,t.angle,.045);obj.scale.set(t.size*.10,t.size*.68,t.size*.10);obj.updateMatrix();trunks.setMatrixAt(ti++,obj.matrix);
      for(let j=0;j<4;j++) {const a=t.angle+j*1.8;obj.position.set(t.x+Math.cos(a)*t.size*.11,t.y+t.size*(.46+j*.05),t.z+Math.sin(a)*t.size*.11);obj.rotation.set(Math.cos(a)*.6,a,Math.sin(a)*.6);obj.scale.set(t.size*.048,t.size*.39,t.size*.048);obj.updateMatrix();trunks.setMatrixAt(ti++,obj.matrix);}
      for(let j=0;j<11;j++) {const a=t.angle+j*2.4,rr=j===10?0:t.size*(.12+r()*.24);obj.position.set(t.x+Math.cos(a)*rr,t.y+t.size*(.55+(j%4)*.105),t.z+Math.sin(a)*rr);obj.rotation.set((r()-.5)*.6,r()*6.28,(r()-.5)*.3);const sz=t.size*(.20+r()*.095);obj.scale.set(sz,sz*(.60+r()*.25),sz);obj.updateMatrix();foliage.setMatrixAt(li,obj.matrix);color.set(t.pink?(j%2?'#e9b7bc':'#f4d4c8'):(j%3===0?'#67774a':j%3===1?'#a5a46a':'#81935e'));foliage.setColorAt(li++,color);}
    }
    trunks.count=ti;foliage.count=li;trunks.castShadow=true;foliage.castShadow=true;foliage.receiveShadow=true;this.root.add(trunks,foliage);
  }
  makeGrass(r){
    const c=this.course;const geo=new THREE.PlaneGeometry(.085,.64,1,3);geo.translate(0,.29,0);const gp=geo.attributes.position;for(let i=0;i<gp.count;i++){gp.setZ(i,Math.pow(Math.max(0,gp.getY(i)),2)*.35);}geo.computeVertexNormals();
    const grassMat=material('#8b9057');grassMat.side=THREE.DoubleSide;const grass=new THREE.InstancedMesh(geo,grassMat,14500);let n=0;
    for(let i=0;i<21000&&n<14500;i++){const z=-38+r()*(c.length+80),x=-88+r()*205;const lie=lieAt(c,x,z);if(lie!=='Rough'||ellipse(x,z,c.pond)<1.12)continue;
      obj.position.set(x,heightAt(c,x,z),z);obj.rotation.set(.1+r()*.2,r()*6.28,0);const s=.3+r()*.8;obj.scale.set(s,s,s);obj.updateMatrix();grass.setMatrixAt(n,obj.matrix);color.set(i%4===0?'#b1a572':'#84904b');color.multiplyScalar(.8+r()*.3);grass.setColorAt(n++,color);}
    grass.count=n;this.root.add(grass);
  }
  makeRocks(r){
    const geo=new THREE.DodecahedronGeometry(1,0);const rocks=new THREE.InstancedMesh(geo,material('#777d70'),260);let n=0;
    for(let i=0;i<260;i++){const z=-90+r()*(this.course.length+240),x=i<195?125+Math.sin(z*.014)*28+r()*28:-65-r()*75;const s=1+r()*6;obj.position.set(x,heightAt(this.course,x,z)-s*.25,z);obj.rotation.set(r(),r(),r());obj.scale.set(s,s*.7,s*.8);obj.updateMatrix();rocks.setMatrixAt(n++,obj.matrix);}
    rocks.castShadow=true;rocks.receiveShadow=true;this.root.add(rocks);
  }
  makeBuildings(){
    const c=this.course;const red=material('#873e2b'),dark=material('#253b39'),wood=material('#5e4230'),cream=material('#dbcbab'),gold=material('#b29a59',.5,.35);
    const box=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
    const torii=new THREE.Group();torii.position.set(-13,heightAt(c,-13,-8),-8);torii.rotation.y=-.3;
    for(const x of [-4,4]){addMesh(torii,cyl,red,x,4.2,0,.36,8.4,.36);addMesh(torii,cyl,dark,x,.45,0,.47,.9,.47);}
    addMesh(torii,box,red,0,6.4,0,10,.4,.5);addMesh(torii,box,red,0,8.25,0,11.8,.48,.8);addMesh(torii,box,dark,0,8.6,0,12.5,.27,1);addMesh(torii,box,gold,0,7.5,-.08,.9,1.2,.25);this.root.add(torii);
    const temple=new THREE.Group();temple.position.set(-77,heightAt(c,-77,c.length-33),c.length-33);temple.rotation.y=.35;
    addMesh(temple,box,material('#94938a'),0,.7,0,20,1.4,15);
    for(let level=0;level<3;level++){const y=1.4+level*5.2,w=16-level*3;
      addMesh(temple,box,cream,0,y+2,0,w,4,w*.72);
      for(const x of [-1,1])for(const z of [-1,1])addMesh(temple,box,red,x*(w/2-.25),y+2,z*w*.35,.45,4.6,.45);
      for(let x=-w/2+1;x<w/2;x+=2.1)addMesh(temple,box,wood,x,y+2,-w*.365,.11,3,.15);
      const roof=new THREE.ConeGeometry(w*.88,3.2,4,1);roof.rotateY(Math.PI/4);addMesh(temple,roof,dark,0,y+5.05,0,1,1,.79);
      addMesh(temple,box,red,0,y+3.9,0,w+2,.25,w*.72+2);
    }
    addMesh(temple,new THREE.ConeGeometry(.55,4.5,8),gold,0,20.2,0);this.root.add(temple);
    // Stone lanterns beside the tee and the green.
    for(const [x,z] of [[-8,8],[8,8],[c.greenX-24,c.length-10]]){const y=heightAt(c,x,z),stone=material('#999787');addMesh(this.root,cyl,stone,x,y+1,z,.35,2,.35);addMesh(this.root,box,stone,x,y+2,z,1,.8,1);addMesh(this.root,new THREE.ConeGeometry(1, .65,4),dark,x,y+2.65,z);}
  }
  makeFlag(){
    const c=this.course,x=c.greenX,z=c.length,y=heightAt(c,x,z);this.cup=new THREE.Vector3(x,y,z);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.22,32),new THREE.MeshBasicMaterial({color:'#17231b'}));hole.rotation.x=-Math.PI/2;hole.position.set(x,y+.024,z);this.root.add(hole);
    addMesh(this.root,new THREE.CylinderGeometry(.04,.04,4.8,8),material('#ebe5d2',.4,.3),x,y+2.4,z);
    const fg=new THREE.PlaneGeometry(1.7,1,14,8);fg.translate(.85,0,0);this.flag=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({color:'#b94938',side:THREE.DoubleSide,roughness:.8}));this.flag.position.set(x,y+4.1,z);this.root.add(this.flag);
  }
  makePath(){
    const c=this.course,vertices=[],colors=[];
    for(let i=0;i<=140;i++){const z=-24+(c.length+58)*i/140,x=center(c,z)-c.width-10;
      for(const side of [-1,1]) {const xx=x+side*1.4;vertices.push(xx,heightAt(c,xx,z)+.065,z);colors.push(.48,.46,.36);}}
    const indices=[];for(let i=0;i<140;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));m.receiveShadow=true;this.root.add(m);
  }
  makePetals(r){
    const positions=[];for(let i=0;i<170;i++)positions.push(-70+r()*140,10+r()*35,-20+r()*100);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const m=new THREE.PointsMaterial({color:'#f4d3c9',size:.16,transparent:true,opacity:.8});this.petals=new THREE.Points(g,m);this.root.add(this.petals);
  }
  update(time,dt,focus){
    this.waterMaterial.uniforms.time.value=time;
    if(this.flag){const p=this.flag.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*3-time*4)*x*.13);}p.needsUpdate=true;this.flag.geometry.computeVertexNormals();}
    if(this.petals){const p=this.petals.geometry.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+dt*.6);p.setY(i,p.getY(i)-dt*.16);if(p.getY(i)<6)p.setY(i,38);if(p.getX(i)>95)p.setX(i,-75);}p.needsUpdate=true;}
    if(focus){this.sun.target.position.copy(focus);this.sun.position.copy(focus).add(new THREE.Vector3(-100,95,-100));this.sun.target.updateMatrixWorld();}
  }
}
