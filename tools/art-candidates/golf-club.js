import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Club space: +Y runs from the hands to the head, +X points toward the toe,
// and -Z faces the shot. The head's origin remains the authored shaft endpoint.
const steel=new THREE.MeshStandardMaterial({color:'#bbc5ca',metalness:.88,roughness:.23});
const satin=new THREE.MeshStandardMaterial({color:'#d1d7d8',metalness:.78,roughness:.36});
const dark=new THREE.MeshStandardMaterial({color:'#171e25',metalness:.55,roughness:.29});
const rubber=new THREE.MeshStandardMaterial({color:'#242c2c',roughness:.9});
const scoring=new THREE.MeshStandardMaterial({color:'#414d54',metalness:.5,roughness:.52});
const accent=new THREE.MeshStandardMaterial({color:'#ba9763',metalness:.6,roughness:.32});
const cylinder=new THREE.CylinderGeometry(1,1,1,24);
const shaftGeometry=new THREE.CylinderGeometry(.58,1,1,24);
const templates=new Map();
let gripDetailGeometry;

function mesh(parent,geometry,material,name){
 const object=new THREE.Mesh(geometry,material);object.name=name;object.castShadow=true;parent.add(object);return object;
}

function outline(points){
 const shape=new THREE.Shape();
 const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),true,'centripetal');
 for(const [i,p]of curve.getPoints(64).entries())if(i===0)shape.moveTo(p.x,p.y);else shape.lineTo(p.x,p.y);
 shape.closePath();return shape;
}

function plate(parent,points,depth,z,material,name,bevel=.001){
 const geometry=new THREE.ExtrudeGeometry(points instanceof THREE.Shape?points:outline(points),{depth,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:8});
 geometry.translate(0,0,z-depth);return mesh(parent,geometry,material,name);
}

function roundedRectangle(left,bottom,width,height,radius){
 const right=left+width,top=bottom+height,s=new THREE.Shape();
 s.moveTo(left+radius,bottom);s.lineTo(right-radius,bottom);s.quadraticCurveTo(right,bottom,right,bottom+radius);
 s.lineTo(right,top-radius);s.quadraticCurveTo(right,top,right-radius,top);
 s.lineTo(left+radius,top);s.quadraticCurveTo(left,top,left,top-radius);
 s.lineTo(left,bottom+radius);s.quadraticCurveTo(left,bottom,left+radius,bottom);s.closePath();return s;
}

function grooves(parent,rows,z){
 const strips=rows.map(([y,left,right])=>new THREE.BoxGeometry(right-left,.0007,.00035).translate((left+right)/2,y,z));
 const joined=mergeGeometries(strips);strips.forEach(g=>g.dispose());mesh(parent,joined,scoring,'Face scoring');
}

function hosel(parent){
 const tube=mesh(parent,cylinder,steel,'Hosel');tube.position.set(0,-.014,-.004);tube.scale.set(.007,.052,.007);
 const ferrule=mesh(parent,cylinder,dark,'Ferrule');ferrule.position.set(0,-.045,-.001);ferrule.scale.set(.006,.018,.006);
}

function wood(kind){
 const head=new THREE.Group();head.name=kind==='wood'?'Fairway wood':'Driver';
 const crown=new THREE.SphereGeometry(1,32,20);
 const p=crown.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  p.setXYZ(i,.041+x*.060,y*.032+.003,Math.min(.010,z*.059-.039));
 }
 crown.computeVertexNormals();mesh(head,crown,dark,'Rounded crown');
 plate(head,[[-.012,-.013],[.006,-.023],[.073,-.022],[.096,-.007],[.092,.016],[.055,.026],[.009,.021]],.003,.013,satin,'Titanium face');
 grooves(head,[-.014,-.007,0,.007,.014].map(y=>[y,.012,.080-Math.abs(y)*.6]),.0142);
 const sole=new THREE.SphereGeometry(1,24,12);sole.scale(.050,.007,.042);sole.translate(.043,.027,-.037);mesh(head,sole,steel,'Sole weight');
 hosel(head);
 if(kind==='wood')head.scale.set(.85,.83,.82);
 return head;
}

function iron(wedge){
 const head=new THREE.Group();head.name=wedge?'Wedge':'Cavity-back iron';
 const face=new THREE.Group();face.rotation.x=wedge?-.26:-.10;head.add(face);
 const perimeter=[[-.009,-.004],[.009,-.026],[.056,-.037],[.082,-.032],[.092,-.015],[.090,.017],[.015,.018]];
 plate(face,perimeter,.013,.008,steel,'Forged blade',.002);
 plate(face,[[.006,-.004],[.023,-.022],[.069,-.026],[.079,-.013],[.077,.008],[.020,.009]],.002,-.007,dark,'Recessed cavity',.001);
 plate(face,[[.027,-.004],[.040,-.013],[.066,-.013],[.064,-.001],[.040,.001]],.001,-.009,accent,'Cavity badge',.0004);
 grooves(face,[-.019,-.013,-.007,-.001,.005,.011].map(y=>[y,.017+(y<-.013?.008:0),.076]),.0102);
 hosel(head);return head;
}

function putter(){
 const head=new THREE.Group();head.name='Mallet putter';
 plate(head,roundedRectangle(-.023,-.015,.114,.029,.004),.026,.005,steel,'Putter face',.0015);
 plate(head,roundedRectangle(-.017,-.013,.100,.025,.004),.035,-.021,dark,'Putter back',.002);
 grooves(head,[-.008,-.004,0,.004,.008].map(y=>[y,-.013,.080]),.007);
 const sight=mesh(head,new THREE.BoxGeometry(.002,.0005,.030),satin,'Alignment line');sight.position.set(.034,-.016,-.028);
 hosel(head);return head;
}

function template(kind){
 if(!templates.has(kind)){
  const head=kind==='driver'||kind==='wood'?wood(kind):kind==='putter'?putter():iron(kind==='wedge');
  head.scale.z*=-1;templates.set(kind,head);
 }
 return templates.get(kind);
}

export function clubHeadKind(short='DR'){
 if(short==='PT')return 'putter';if(short==='PW'||short==='SW')return 'wedge';if(short.endsWith('I'))return 'iron';if(short.endsWith('W'))return 'wood';return 'driver';
}

// Set one fixed head-to-shaft rotation from the actual impact pose. Older golf
// clips authored the shaft but left its roll inherited from the sword grip.
// Sample the bone tracks without moving the actor or changing a wrist.
export function clubHeadRoll(hand,root,clip,gripFrame,contactTime=1.4){
 const chain=[];
 for(let bone=hand;bone&&bone!==root;bone=bone.parent)chain.push(bone);
 const rotation=new THREE.Quaternion();
 for(const bone of chain.reverse()){
  const track=clip.tracks.find(track=>track.name===bone.name+'.quaternion');
  rotation.multiply(track?new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(contactTime)):bone.quaternion);
 }
 rotation.multiply(gripFrame);
 const forward=new THREE.Vector3(-1,0,0).applyQuaternion(rotation.invert());
 return Math.atan2(-forward.x,-forward.z);
}

export function createGolfClub(){
 const root=new THREE.Group();root.name='Golf club';
 const grip=mesh(root,cylinder,rubber,'Golf club grip');grip.position.y=.045;grip.scale.set(.012,.21,.012);
 if(!gripDetailGeometry){
  const rings=[];
  for(let i=0;i<18;i++){
   const ring=new THREE.TorusGeometry(.012,.00025,4,24);ring.rotateX(Math.PI/2);ring.translate(0,-.052+i*.011,0);rings.push(ring);
  }
  gripDetailGeometry=mergeGeometries(rings);rings.forEach(g=>g.dispose());
 }
 mesh(root,gripDetailGeometry,scoring,'Grip channels');
 const shaft=mesh(root,shaftGeometry,steel,'Golf club shaft');shaft.position.y=.63;shaft.scale.set(.005,.98,.005);
 const head=new THREE.Group();head.name='Golf club head';head.position.y=1.12;root.add(head);
 let activeKind=null;
 const setKind=short=>{
  const kind=clubHeadKind(short);if(kind===activeKind)return;
  head.clear();head.add(template(kind).clone(true));activeKind=kind;root.userData.clubKind=kind;
 };
 setKind('DR');return{root,shaft,head,setKind};
}
