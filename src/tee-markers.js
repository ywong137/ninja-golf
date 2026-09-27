import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,ellipse,routePoint} from './course.js';
import {courseSurfaceHeight} from './terrain.js';
const surface=(course,x,z)=>courseSurfaceHeight(course,x,z,heightAt,ellipse);

export const TEE_MARKER_SIZE=Object.freeze({width:.24,height:.19,depth:.18,spacing:3.4});
const FINISHES={
 japanese:{body:'#5a5c55',inset:'#873e32',trim:'#bca777',metalness:.04,roughness:.82},
 highlands:{body:'#92958d',inset:'#405971',trim:'#bcc0b7',metalness:.02,roughness:.88},
 desert:{body:'#aa8260',inset:'#b87932',trim:'#8a6241',metalness:.02,roughness:.9},
 cyberpunk:{body:'#333d45',inset:'#72bcb8',trim:'#7e8e97',metalness:.72,roughness:.36},
};
export function teeMarkerFrames(course){
 const route=routePoint(course,0),forward=new THREE.Vector3(route.tangentX,0,route.tangentZ).normalize();
 return [-1,1].map(side=>{
  const x=side*TEE_MARKER_SIZE.spacing*forward.z,z=-side*TEE_MARKER_SIZE.spacing*forward.x;
  const dx=(surface(course,x+.12,z)-surface(course,x-.12,z))/.24,dz=(surface(course,x,z+.12)-surface(course,x,z-.12))/.24;
  const up=new THREE.Vector3(-dx,1,-dz).normalize(),tangent=forward.clone().projectOnPlane(up).normalize(),right=new THREE.Vector3().crossVectors(up,tangent);
  const matrix=new THREE.Matrix4().makeBasis(right,up,tangent);matrix.setPosition(x,surface(course,x,z)-.006,z);
  return matrix;
 });
}

// Adds three material draws and one merged contact-occlusion draw. World cleanup owns their geometry/material disposal;
// the supplied stone textures stay shared and are never modified or disposed here.
export function buildTeeMarkers(root,course,{stoneColor=null,stoneNormal=null}={}){
 const finish=FINISHES[course.theme]||FINISHES.japanese,city=course.theme==='cyberpunk';
 const body=new THREE.MeshStandardMaterial({name:'Tee marker body',color:finish.body,map:city?null:stoneColor,normalMap:city?null:stoneNormal,normalScale:new THREE.Vector2(.16,.16),metalness:finish.metalness,roughness:finish.roughness});
 const inset=new THREE.MeshStandardMaterial({name:'Tee marker enamel',color:finish.inset,metalness:.08,roughness:.48,emissive:city?finish.inset:'#000000',emissiveIntensity:city?.08:0});
 const trim=new THREE.MeshStandardMaterial({name:'Tee marker rim',color:finish.trim,metalness:city?.8:.5,roughness:.43});
 const parts=[[],[],[]],frames=teeMarkerFrames(course),{width,height,depth}=TEE_MARKER_SIZE;
 for(const frame of frames){
  const shell=new RoundedBoxGeometry(width,height,depth,3,.045);shell.translate(0,height/2,0);parts[0].push(shell.applyMatrix4(frame));
  const disk=new THREE.CircleGeometry(.0415,24);disk.rotateY(Math.PI);disk.translate(0,.105,-depth/2-.001);parts[1].push(disk.applyMatrix4(frame));
  const rim=new THREE.TorusGeometry(.045,.0025,6,24);rim.translate(0,.105,-depth/2-.0015);parts[2].push(rim.applyMatrix4(frame));
  const chevron=new THREE.Shape();chevron.moveTo(-.012,-.004);chevron.lineTo(0,.011);chevron.lineTo(.012,-.004);chevron.lineTo(0,.001);chevron.closePath();
  const emblem=new THREE.ShapeGeometry(chevron);emblem.rotateY(Math.PI);emblem.translate(0,.105,-depth/2-.002);parts[2].push(emblem.applyMatrix4(frame));
 }
 const group=new THREE.Group();group.name='Tee markers';
 for(const [i,material]of [body,inset,trim].entries()){
  const geometry=mergeGeometries(parts[i]);parts[i].forEach(part=>part.dispose());
  if(!geometry)throw new Error('Could not merge tee marker geometry.');
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 // A small terrain-conforming contact footprint compensates for the world's
 // shadow bias, which is intentionally sized for much larger trees and actors.
 const contactPositions=[],contactUV=[],contactIndices=[];
 for(const frame of frames){const base=contactPositions.length/3;for(let j=0;j<=2;j++)for(let i=0;i<=2;i++){
  const p=new THREE.Vector3((i/2-.5)*.34,0,(j/2-.5)*.28).applyMatrix4(frame);contactPositions.push(p.x,surface(course,p.x,p.z)+.003,p.z);contactUV.push(i/2,j/2);
 }for(let j=0;j<2;j++)for(let i=0;i<2;i++){const a=base+j*3+i;contactIndices.push(a,a+3,a+1,a+1,a+3,a+4);}}
 const contactGeometry=new THREE.BufferGeometry();contactGeometry.setAttribute('position',new THREE.Float32BufferAttribute(contactPositions,3));contactGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(contactUV,2));contactGeometry.setIndex(contactIndices);
 const contactMaterial=new THREE.ShaderMaterial({name:'Tee marker contact',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  vertexShader:'varying vec2 localUV;void main(){localUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 localUV;void main(){vec2 p=abs((localUV-.5)*vec2(.34,.28))-vec2(.075,.035);float d=length(max(p,0.))-.025;float a=(1.-smoothstep(-.012,.040,d))*.26;if(a<.003)discard;gl_FragColor=vec4(.01,.014,.008,a);}'});
 const contact=new THREE.Mesh(contactGeometry,contactMaterial);contact.name='Tee marker contact';group.add(contact);
 group.userData.frames=frames;root.add(group);return group;
}
