import * as THREE from 'three';
import {heightAt,ellipse,lieAt,fairwayDistance} from './course.js';
import {courseSurfaceHeight} from './terrain.js';
export function createCoursePath(c,textures){
 const route=c.layout.route,stations=route.map((p,i)=>{
  const a=route[Math.max(0,i-1)],b=route[Math.min(route.length-1,i+1)];
  const before=new THREE.Vector2(p[0]-a[0],p[1]-a[1]).normalize(),after=new THREE.Vector2(b[0]-p[0],b[1]-p[1]).normalize();
  const tangent=before.clone().add(after).normalize(),miter=Math.min(1.6,1/Math.max(.1,tangent.dot(i?before:after))),offset=(p[2]+9)*miter;
  return new THREE.Vector3(p[0]-tangent.y*offset,0,p[1]+tangent.x*offset);
 });
 const curve=new THREE.CatmullRomCurve3(stations,false,'centripetal'),length=curve.getLength(),steps=Math.ceil(length/.65);
 const vertices=[],uvs=[],coverage=[],indices=[],cross=[-1.30,-1.05,0,1.05,1.30],points=[],occupiedRows=new Set();
 for(let i=0;i<=steps;i++){
  const center=curve.getPointAt(i/steps),tangent=curve.getTangentAt(i/steps),distance=i/steps*length;
  for(let j=0;j<cross.length;j++){
   const side=cross[j]*(1+.025*Math.sin(distance*.43+c.seed)),x=center.x-tangent.z*side,z=center.z+tangent.x*side;
   vertices.push(x,courseSurfaceHeight(c,x,z,heightAt,ellipse)+.028,z);uvs.push(side/2.5,distance/2.5);coverage.push(j===0||j===cross.length-1?0:1);points.push([x,z]);
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<cross.length-1;j++){
  const a=i*cross.length+j,b=a+cross.length,ids=[a,a+1,b,b+1];
  if(ids.some(k=>['Water','Green','Tee','Bunker'].includes(lieAt(c,...points[k]))||fairwayDistance(c,...points[k])<1))continue;
  const upward=(a,b,c)=>(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
  // Very tight fictional routes can pinch an offset path. End its strip there.
  if(upward(points[a],points[a+1],points[b])<=.00001||upward(points[a+1],points[b+1],points[b])<=.00001)continue;
  occupiedRows.add(i);occupiedRows.add(i+1);
  indices.push(a,a+1,b,a+1,b+1,b);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('pathCoverage',new THREE.Float32BufferAttribute(coverage,1));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({map:textures.pathColor||textures.rockColor||null,normalMap:textures.pathNormal||null,roughnessMap:textures.pathRoughness||null,normalScale:new THREE.Vector2(.32,.32),color:c.theme==='cyberpunk'?'#606f7a':c.theme==='desert'?'#d3b68d':c.theme==='highlands'?'#bcb6a6':'#d3cec1',roughness:.97,transparent:true,depthWrite:false});
 material.onBeforeCompile=s=>{s.vertexShader='attribute float pathCoverage;varying float pathEdge;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npathEdge=pathCoverage;');s.fragmentShader='varying float pathEdge;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=smoothstep(0.,.88,pathEdge);if(diffuseColor.a<.005)discard;');};material.customProgramCacheKey=()=> 'textured-course-path-v1';
 const cells=new Map();
 for(const row of occupiedRows){const point=points[row*cross.length+2],key=`${Math.floor(point[0]/5)},${Math.floor(point[1]/5)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(point);}
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Course path';mesh.receiveShadow=true;
 mesh.userData.contains=(x,z,margin=0)=>{const radius=1.4+margin,reach=Math.ceil(radius/5),cx=Math.floor(x/5),cz=Math.floor(z/5);for(let iz=cz-reach;iz<=cz+reach;iz++)for(let ix=cx-reach;ix<=cx+reach;ix++)for(const p of cells.get(`${ix},${iz}`)||[])if((p[0]-x)**2+(p[1]-z)**2<radius*radius)return true;return false;};
 return mesh;
}
