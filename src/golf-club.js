import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Shaft space: +Y runs toward the head. The socket stays on this axis.
// Body space: +Y points down, +X points toward the toe, and -Z faces the shot.
export const CLUB_HEAD_SPECS=Object.freeze(Object.fromEntries([
 ['DR','driver',16,1,1,1,5],['3W','wood',23,.84,.78,.72,5],
 ['5I','iron',32,.96,.93,.82,6],['7I','iron',40,1,1,.90,7],
 ['9I','iron',47,1.03,1.08,1,8],['PW','wedge',53,1.04,1.12,1.15,9],
 ['SW','wedge',62,1.08,1.20,1.42,10],['PT','putter',0,1,1,1,5],
].map(([short,kind,loft,width,height,depth,grooves])=>[short,Object.freeze({short,kind,loft,width,height,depth,grooves})])));

const steel=new THREE.MeshStandardMaterial({color:'#b9c3c9',metalness:.88,roughness:.24});
const satin=new THREE.MeshStandardMaterial({color:'#d0d7d9',metalness:.78,roughness:.34});
const dark=new THREE.MeshStandardMaterial({color:'#182029',metalness:.55,roughness:.28});
const graphite=new THREE.MeshStandardMaterial({color:'#273039',metalness:.45,roughness:.33});
const rubber=new THREE.MeshStandardMaterial({color:'#242a29',roughness:.90});
const scoring=new THREE.MeshStandardMaterial({color:'#424d54',metalness:.5,roughness:.52});
const faceScoring=scoring.clone();faceScoring.polygonOffset=true;faceScoring.polygonOffsetFactor=-1;faceScoring.polygonOffsetUnits=-1;
const accent=new THREE.MeshStandardMaterial({color:'#b39465',metalness:.6,roughness:.34});
const cylinder=new THREE.CylinderGeometry(1,1,1,20);
const shaftGeometry=new THREE.CylinderGeometry(.68,1,1,20);
const templates=new Map();
let gripDetailGeometry;

function mesh(parent,geometry,material,name){
 const object=new THREE.Mesh(geometry,material);object.name=name;object.castShadow=true;parent.add(object);return object;
}
function outline(points){
 const shape=new THREE.Shape(),curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),true,'centripetal');
 for(const[i,p]of curve.getPoints(48).entries())if(i===0)shape.moveTo(p.x,p.y);else shape.lineTo(p.x,p.y);
 shape.closePath();return shape;
}
function plate(parent,shape,depth,frontZ,material,name,bevel=.001){
 const geometry=new THREE.ExtrudeGeometry(shape instanceof THREE.Shape?shape:outline(shape),{depth,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:8});
 geometry.translate(0,0,frontZ);return mesh(parent,geometry,material,name);
}
function roundedRectangle(left,bottom,width,height,radius){
 const right=left+width,top=bottom+height,s=new THREE.Shape();
 s.moveTo(left+radius,bottom);s.lineTo(right-radius,bottom);s.quadraticCurveTo(right,bottom,right,bottom+radius);
 s.lineTo(right,top-radius);s.quadraticCurveTo(right,top,right-radius,top);
 s.lineTo(left+radius,top);s.quadraticCurveTo(left,top,left,top-radius);
 s.lineTo(left,bottom+radius);s.quadraticCurveTo(left,bottom,left+radius,bottom);s.closePath();return s;
}
function grooves(parent,rows,z){
 const strips=rows.map(([y,left,right])=>new THREE.BoxGeometry(right-left,.00065,.00030).translate((left+right)/2,y,z)),joined=mergeGeometries(strips);
 strips.forEach(g=>g.dispose());mesh(parent,joined,faceScoring,'Face grooves');
}
function hosel(parent){
 const tube=mesh(parent,cylinder,steel,'Hosel');tube.position.set(0,-.0231,0);tube.scale.set(.007,.046,.007);
 const ferrule=mesh(parent,cylinder,dark,'Ferrule');ferrule.position.set(0,-.0541,0);ferrule.scale.set(.006,.016,.006);
}
function trimSole(shape,faceName,leadingEdgeOffset=.0002){
 shape.updateMatrixWorld(true);
 const face=shape.getObjectByName(faceName),positions=face.geometry.attributes.position,normals=face.geometry.attributes.normal;
 const point=new THREE.Vector3();let leadingEdge=-Infinity;
 for(let i=0;i<positions.count;i++)if(normals.getZ(i)<-.9999){point.fromBufferAttribute(positions,i).applyMatrix4(face.matrixWorld);leadingEdge=Math.max(leadingEdge,point.y);}
 if(!Number.isFinite(leadingEdge))throw new Error(`Cannot find the flat striking cap for ${faceName}.`);
 const frontNormal=new THREE.Vector3(0,0,-1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(face.matrixWorld)).normalize();
 const frontOffset=frontNormal.dot(point);
 const plane=leadingEdge+leadingEdgeOffset;
 shape.traverse(part=>{
  if(!part.isMesh)return;
  const p=part.geometry.attributes.position,inverse=part.matrixWorld.clone().invert();let changed=false;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);
   if(point.y>plane){
    point.y=plane;
    // Keep the tapered sole behind the unchanged striking plane. A Y-only
    // projection of a lofted bevel can otherwise push it into the ball.
    const protrusion=frontNormal.dot(point)-frontOffset;
    if(protrusion>0)point.z-=protrusion/frontNormal.z;
    point.applyMatrix4(inverse);p.setXYZ(i,point.x,point.y,point.z);changed=true;
   }
  }
  if(changed){p.needsUpdate=true;part.geometry.computeVertexNormals();part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();}
 });
 shape.userData.solePlaneY=plane;shape.userData.frontLeadingEdgeY=leadingEdge;
}
function wood(spec){
 const head=new THREE.Group();head.name=spec.kind==='wood'?'Fairway wood head':'Driver head';
 // Preserve wood dimensions while compensating for its unequal Y/Z scale.
 const loft=Math.atan(Math.tan(THREE.MathUtils.degToRad(spec.loft))*spec.height/spec.depth);
 const crown=new THREE.SphereGeometry(1,28,16),p=crown.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const yy=y*.032+.003,front=.006/Math.cos(loft)-Math.tan(loft)*yy;p.setXYZ(i,.041+x*.060,yy,Math.max(front,z*.059+.039));}
 crown.computeVertexNormals();mesh(head,crown,dark,'Rounded crown');
 const face=new THREE.Group();face.name='Lofted face';face.rotation.x=-loft;head.add(face);
 plate(face,[[-.012,-.013],[.006,-.023],[.073,-.022],[.096,-.007],[.092,.016],[.055,.026],[.009,.021]],.014,-.009,satin,'Titanium face');
 grooves(face,[-.014,-.007,0,.007,.014].map(y=>[y,.012,.080-Math.abs(y)*.6]),-.00985);
 const sole=new THREE.SphereGeometry(1,20,10);sole.scale(.050,.006,.042);sole.translate(.043,.027,.038);mesh(head,sole,steel,'Sole weight');
 const sight=mesh(head,new THREE.BoxGeometry(.0014,.0005,.017),satin,'Crown aim mark');sight.position.set(.042,-.030,.027);
 head.scale.set(spec.width,spec.height,spec.depth);
 if(spec.short==='3W')trimSole(head,'Titanium face',.006);
 return head;
}
function iron(spec){
 const head=new THREE.Group();head.name=spec.kind==='wedge'?'Wedge head':'Cavity-back iron head';
 const face=new THREE.Group();face.name='Lofted face';face.rotation.x=-THREE.MathUtils.degToRad(spec.loft);head.add(face);
 const perimeter=[[-.009,-.004],[.009,-.026],[.056,-.037],[.082,-.032],[.092,-.015],[.090,.017],[.015,.018]];
 const body=plate(face,perimeter,.011*spec.depth,-.008,steel,'Forged blade',.0015);body.scale.set(spec.width,spec.height,1);
 const rimShape=outline(perimeter),pocket=outline([[.010,-.003],[.024,-.020],[.067,-.025],[.078,-.011],[.076,.007],[.023,.009]]);
 rimShape.holes.push(new THREE.Path(pocket.getPoints()));
 const rim=plate(face,rimShape,.002,.003*spec.depth,steel,'Cavity rim',.0006);rim.scale.set(spec.width,spec.height,1);
 const floor=plate(face,[[.010,-.003],[.024,-.020],[.067,-.025],[.078,-.011],[.076,.007],[.023,.009]],.0006,.003*spec.depth,dark,'Recessed cavity',.0003);floor.scale.set(spec.width,spec.height,1);
 const badge=plate(face,[[.030,-.005],[.043,-.013],[.065,-.013],[.064,-.003],[.041,.001]],.0005,.004*spec.depth,accent,'Cavity badge',.0003);badge.scale.set(spec.width,spec.height,1);
 const rows=Array.from({length:spec.grooves},(_,i)=>{const y=-.021+i*.034/(spec.grooves-1);return[y*spec.height,(.018+(y<-.013?.009:0))*spec.width,.076*spec.width];});grooves(face,rows,-.00935);
 if(spec.kind==='wedge'){
  const sole=new THREE.SphereGeometry(1,18,8);sole.scale(.039*spec.width,.004*spec.depth,.008*spec.depth);sole.translate(.049,.015*spec.height,.002);mesh(face,sole,satin,spec.short==='SW'?'Broad sand sole':'Wedge sole');
 }
 trimSole(head,'Forged blade');return head;
}
function putter(){
 const head=new THREE.Group();head.name='Mallet putter head';
 plate(head,roundedRectangle(-.023,-.015,.114,.029,.004),.022,-.008,steel,'Putter face',.0014);
 plate(head,roundedRectangle(-.017,-.013,.100,.025,.004),.038,.012,dark,'Mallet back',.0018);
 grooves(head,[-.008,-.004,0,.004,.008].map(y=>[y,-.013,.080]),-.00995);
 const insert=plate(head,roundedRectangle(-.007,-.010,.082,.020,.002),.0006,-.0098,satin,'Face insert',.0002);insert.position.z=-.0001;
 const sight=mesh(head,new THREE.BoxGeometry(.0018,.0005,.034),satin,'Alignment line');sight.position.set(.034,-.015,.030);
 return head;
}
function specification(short){const spec=CLUB_HEAD_SPECS[short];if(!spec)throw new RangeError(`Unknown golf club ${short}. Choose DR,3W,5I,7I,9I,PW,SW,PT.`);return spec;}
function template(short){
 if(!templates.has(short)){
  const spec=specification(short),shape=spec.kind==='driver'||spec.kind==='wood'?wood(spec):spec.kind==='putter'?putter():iron(spec);
  const head=new THREE.Group();head.name=shape.name;
  const body=new THREE.Group();body.name='Golf club body';body.add(shape);head.add(body);
  const neck=new THREE.Group();neck.name='Golf club neck';hosel(neck);head.add(neck);
  head.userData={clubShort:short,clubKind:spec.kind,faceLoftDegrees:spec.loft,strikingFace:spec.kind==='driver'||spec.kind==='wood'?'Titanium face':spec.kind==='putter'?'Face insert':'Forged blade'};
  templates.set(short,head);
 }
 return templates.get(short);
}
export function clubHeadKind(short='DR'){return specification(short).kind;}

// Convert a sampled actor-local club frame into the fixed body mount. The
// straight neck stays in the shaft frame; the body sole stays level at contact.
export function clubBodyOrientation(clubRotation){
 if(!clubRotation?.isQuaternion||!clubRotation.toArray().every(Number.isFinite)||Math.abs(clubRotation.lengthSq()-1)>1e-5)throw new TypeError('Golf club contact rotation must be a finite unit Quaternion.');
 const desired=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(0,-1,0),new THREE.Vector3(1,0,0)));
 return clubRotation.clone().invert().multiply(desired).normalize();
}

export function createGolfClub(short='DR'){
 specification(short);const root=new THREE.Group();root.name='Golf club';
 const grip=mesh(root,cylinder,rubber,'Golf club grip');grip.position.y=.045;grip.scale.set(.012,.21,.012);
 if(!gripDetailGeometry){const rings=[];for(let i=0;i<18;i++){const ring=new THREE.TorusGeometry(.012,.00025,4,20);ring.rotateX(Math.PI/2);ring.translate(0,-.052+i*.011,0);rings.push(ring);}gripDetailGeometry=mergeGeometries(rings);rings.forEach(g=>g.dispose());}
 mesh(root,gripDetailGeometry,scoring,'Grip channels');
 const shaft=mesh(root,shaftGeometry,steel,'Golf club shaft');shaft.position.y=.63;shaft.scale.set(.005,.98,.005);
 const head=new THREE.Group();head.name='Golf club head';head.position.y=1.12;root.add(head);
 const instances=new Map(),bodyOrientation=new THREE.Quaternion();let activeShort=null,body=null,neck=null;
 function setClub(next){const spec=specification(next);if(activeShort===next)return false;if(!instances.has(next))instances.set(next,template(next).clone(true));head.clear();head.add(instances.get(next));body=head.getObjectByName('Golf club body');neck=head.getObjectByName('Golf club neck');body.quaternion.copy(bodyOrientation);shaft.material=spec.kind==='driver'||spec.kind==='wood'?graphite:steel;activeShort=next;root.userData.clubShort=next;root.userData.clubKind=spec.kind;head.userData.clubShort=next;return true;}
 function setBodyOrientation(rotation){
  if(!rotation?.isQuaternion||!rotation.toArray().every(Number.isFinite)||Math.abs(rotation.lengthSq()-1)>1e-5)throw new TypeError('Golf club body orientation must be a finite unit Quaternion.');
  bodyOrientation.copy(rotation).normalize();body.quaternion.copy(bodyOrientation);
 }
 setClub(short);return{root,shaft,head,setClub,setBodyOrientation,get body(){return body;},get neck(){return neck;}};
}
