import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {COURSE_BOUNDS,random} from './course.js';
import {landscapeHeight} from './regional-terrain.js';
import {scaleBoxUV} from './architecture-uv.js';

export const DISTANT_CITY_LIMITS={buildings:280,triangles:18000,batches:2,clearance:45};
export function distantCityPlacements(course,region){
 if(course.theme!=='cyberpunk')return[];
 const r=random(course.seed+719483),records=[],centerZ=(COURSE_BOUNDS.minZ+course.length+COURSE_BOUNDS.endMargin)/2;
 const halfX=(COURSE_BOUNDS.maxX-COURSE_BOUNDS.minX)/2,halfZ=(course.length+COURSE_BOUNDS.endMargin-COURSE_BOUNDS.minZ)/2;
 for(let band=0;band<3;band++){
  const districts=[18,14,10][band];
  for(let district=0;district<districts;district++){
   const angle=(district+.15+r()*.5)/districts*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
   const edge=Math.min(halfX/Math.max(.0001,Math.abs(dx)),halfZ/Math.max(.0001,Math.abs(dz)));
   const offset=[220,650,1280][band]+r()*[100,210,330][band],cx=dx*(edge+offset),cz=centerZ+dz*(edge+offset),yaw=(Math.floor(r()*4)*Math.PI/2)+(r()-.5)*.16;
   const count=band===0?6:5;
   for(let i=0;i<count;i++){
    const width=band===0?18+r()*22:24+r()*35,depth=band===0?16+r()*21:22+r()*36;
    const u=(i%3-1)*[48,75,105][band]+(r()-.5)*12,v=(Math.floor(i/3)-.5)*[53,82,120][band];
    const x=cx+Math.cos(yaw)*u+Math.sin(yaw)*v,z=cz-Math.sin(yaw)*u+Math.cos(yaw)*v;
    const extentX=(Math.abs(Math.cos(yaw))*width+Math.abs(Math.sin(yaw))*depth)/2,extentZ=(Math.abs(Math.sin(yaw))*width+Math.abs(Math.cos(yaw))*depth)/2;
    const margin=DISTANT_CITY_LIMITS.clearance;
    if(x+extentX>COURSE_BOUNDS.minX-margin&&x-extentX<COURSE_BOUNDS.maxX+margin&&z+extentZ>COURSE_BOUNDS.minZ-margin&&z-extentZ<course.length+COURSE_BOUNDS.endMargin+margin)continue;
    const samples=[];for(const sx of [-extentX,extentX])for(const sz of [-extentZ,extentZ])samples.push(landscapeHeight(course,region,x+sx,z+sz));
    const bottom=Math.min(...samples)-2,base=Math.max(...samples)+.3;
    const height=[16,42,95][band]+r()*[36,90,160][band],form=(district+i*3+band)%5;
    records.push({x,z,bottom,base,width,depth,height,yaw,band,district,form,tone:r()});
   }
  }
 }
 return records;
}

export function buildDistantCity(root,course,region){
 const records=distantCityPlacements(course,region);if(!records.length)return null;
 const group=new THREE.Group();group.name='Distant city districts';const bodies=[];
 const palette=['#192632','#24303b','#303943','#1a2938','#31373b'];
 const emit=(geometry,list,color,x,y,z,yaw=0,seed=0,facade=false)=>{
  const count=geometry.attributes.position.count,wall=new Float32Array(count),seeds=new Float32Array(count);for(let i=0;i<count;i++){wall[i]=facade&&Math.abs(geometry.attributes.normal.getY(i))<.01?1:0;seeds[i]=seed;}geometry.setAttribute('cityWall',new THREE.BufferAttribute(wall,1));geometry.setAttribute('citySeed',new THREE.BufferAttribute(seeds,1));
  geometry.rotateY(yaw).translate(x,y,z);const colors=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));list.push(geometry);
 };
 const body=(p,w,h,d,y,offsetX=0,offsetZ=0)=>{const x=p.x+Math.cos(p.yaw)*offsetX+Math.sin(p.yaw)*offsetZ,z=p.z-Math.sin(p.yaw)*offsetX+Math.cos(p.yaw)*offsetZ;emit(scaleBoxUV(new THREE.BoxGeometry(w,h,d),w,h,d,1).toNonIndexed(),bodies,new THREE.Color(palette[(p.district+p.form)%palette.length]).multiplyScalar(.75+p.tone*.2),x,y,z,p.yaw,p.district*3+p.tone*37,true);};
 for(const p of records){
  body(p,p.width,p.base-p.bottom,p.depth,(p.base+p.bottom)/2);
  const h=p.height,w=p.width,d=p.depth;
  if(p.form===0){body(p,w,h*.62,d,p.base+h*.31);body(p,w*.68,h*.38,d*.7,p.base+h*.81,0,d*.07);body(p,w*.24,4,d*.28,p.base+h+2);}
  else if(p.form===1){body(p,w*.58,h,d,p.base+h/2,-w*.15);body(p,w*.35,h*.57,d*.82,p.base+h*.285,w*.31);}
  else if(p.form===2){body(p,w,h*.8,d,p.base+h*.4);const cap=new THREE.CylinderGeometry(w*.26,w*.42,h*.2,6,1,false);cap.scale(1,1,d/w);emit(cap.toNonIndexed(),bodies,new THREE.Color(palette[p.district%palette.length]),p.x,p.base+h*.9,p.z,p.yaw);}
  else if(p.form===3){body(p,w,h*.44,d,p.base+h*.22);body(p,w*.86,h*.18,d*.8,p.base+h*.53);body(p,w*.66,h*.16,d*.67,p.base+h*.70);body(p,w*.45,h*.22,d*.5,p.base+h*.89);}
  else{body(p,w,h,d*.6,p.base+h/2);body(p,w*.4,5,d*.35,p.base+h+2.5,w*.2);}
 }

 const make=(geometries,material,name)=>{const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);return mesh;};
 const bodyMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:.12,emissive:'#101824',emissiveIntensity:.14});
 bodyMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float cityWall;attribute float citySeed;varying vec2 cityUv;varying float facadeWall;varying float facadeSeed;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityUv=uv;facadeWall=cityWall;facadeSeed=citySeed;');
  shader.fragmentShader=`varying vec2 cityUv;varying float facadeWall;varying float facadeSeed;
float cityHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float style=mod(floor(facadeSeed),3.);
 vec2 grid=cityUv/vec2(2.5+fract(facadeSeed*.13)*1.2,3.2+fract(facadeSeed*.31)*.6);
 vec2 cell=floor(grid),f=fract(grid),aa=max(fwidth(grid),vec2(.0005));
 float sideGap=style<.5?.12:style<1.5?.22:.055;
 float paneX=smoothstep(sideGap-aa.x,sideGap+aa.x,f.x)*(1.-smoothstep(1.-sideGap-aa.x,1.-sideGap+aa.x,f.x));
 float paneY=smoothstep(.20-aa.y,.20+aa.y,f.y)*(1.-smoothstep(.79-aa.y,.79+aa.y,f.y));
 float windowMask=paneX*paneY*facadeWall;
 float room=cityHash(cell+facadeSeed*19.7);
 float occupied=step(.89,room)*(1.-step(.85,cityHash(vec2(cell.y,facadeSeed))));
 vec3 glass=mix(vec3(.008,.016,.023),vec3(.025,.036,.045),cityHash(cell+facadeSeed));
 float floorBand=1.-smoothstep(.03,.06,min(f.y,1.-f.y));
 diffuseColor.rgb*=1.-floorBand*.18*facadeWall;
 diffuseColor.rgb=mix(diffuseColor.rgb,glass,windowMask*.82);
 `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.4,windowMask);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
 vec3 roomLight=mix(vec3(.19,.28,.34),vec3(.42,.31,.19),step(.65,fract(facadeSeed*.17)));
 totalEmissiveRadiance+=roomLight*windowMask*occupied*.25;
 `);
 };
 bodyMaterial.customProgramCacheKey=()=> 'distant-city-facades-v1';
 make(bodies,bodyMaterial,'Distant city silhouettes');

 // This affects the visible panorama only. HDR reflections and lighting stay unchanged.
 const hazeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,uniforms:{hazeColor:{value:new THREE.Color('#172342')}},vertexShader:'varying vec3 hazeWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);hazeWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:`varying vec3 hazeWorld;uniform vec3 hazeColor;
 void main(){float elevation=normalize(hazeWorld-cameraPosition).y;float opacity=1.-smoothstep(.018,.32,elevation);gl_FragColor=vec4(hazeColor,opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const haze=new THREE.Mesh(new THREE.SphereGeometry(4900,32,20),hazeMaterial);haze.position.z=course.length/2;haze.name='City horizon haze';haze.renderOrder=-20;group.add(haze);
 group.userData.records=records;group.userData.triangles=group.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
 root.add(group);
 return{group,records,dispose(){root.remove(group);for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}group.clear();}};
}
