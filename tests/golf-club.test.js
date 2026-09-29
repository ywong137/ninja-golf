import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CLUBS} from '../src/course.js';
import {CLUB_HEAD_SPECS,clubBodyOrientation,clubHeadKind,createGolfClub} from '../src/golf-club.js';

const codes=CLUBS.map(c=>c.short);
function meshes(root){const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;}
function close(actual,expected,tolerance=1e-8){assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);}
function capNormal(club){
 club.root.updateWorldMatrix(true,true);const face=club.body.getObjectByName(club.head.children[0].userData.strikingFace);
 const p=face.geometry.attributes.position,indices=face.geometry.index,count=indices?.count??p.count;
 for(let i=0;i<count;i+=3){
  const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,indices?indices.getX(i+j):i+j));
  const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
  if(normal.z<-.9999){vertices.forEach(v=>v.applyMatrix4(face.matrixWorld));return vertices[1].sub(vertices[0]).cross(vertices[2].sub(vertices[0])).normalize();}
 }
 throw new Error('No finite striking-face triangle found');
}

test('the eight club heads have distinct geometry, loft, and equipment details',()=>{
 assert.deepEqual(Object.keys(CLUB_HEAD_SPECS),codes);
 const signatures=[];
 for(const club of CLUBS){
  const equipment=createGolfClub(club.short),{head}=equipment,model=head.children[0];
  assert.equal(model.userData.clubShort,club.short);
  assert.equal(model.userData.faceLoftDegrees,club.loft);
  assert.equal(clubHeadKind(club.short),CLUB_HEAD_SPECS[club.short].kind);
  assert.ok(model.getObjectByName('Hosel'));assert.ok(model.getObjectByName('Ferrule'));assert.ok(model.getObjectByName('Face grooves'));
  for(const part of meshes(model))for(const value of part.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  assert.ok(size.x>.07&&size.x<.16);assert.ok(size.y>.025&&size.y<.16);assert.ok(size.z>.018&&size.z<.16);
  signatures.push(size.toArray().map(v=>v.toFixed(5)).join(','));
  if(club.short==='DR'||club.short==='3W')assert.ok(model.getObjectByName('Rounded crown'));
  else if(club.short==='PT')assert.ok(model.getObjectByName('Mallet back'));
  else assert.ok(model.getObjectByName('Recessed cavity'));
  close(capNormal(equipment).distanceTo(new THREE.Vector3(0,-Math.sin(club.loft*Math.PI/180),-Math.cos(club.loft*Math.PI/180))),0);
 }
 assert.equal(new Set(signatures).size,8,'every club must have a distinct head silhouette');
 assert.ok(createGolfClub('SW').head.getObjectByName('Broad sand sole'));
});

test('club switches reuse shared geometry without moving the dynamic mount',()=>{
 const first=createGolfClub(),second=createGolfClub();
 assert.notEqual(first.head.children[0],second.head.children[0]);
 const firstParts=meshes(first.root),secondParts=meshes(second.root);
 for(let i=0;i<firstParts.length;i++){assert.equal(firstParts[i].geometry,secondParts[i].geometry);assert.equal(firstParts[i].material,secondParts[i].material);}
 first.shaft.position.y=.501;first.shaft.scale.y=.722;first.head.position.set(.01,.862,-.02);first.head.rotation.set(.04,.8,-.03);
 const mount=[first.shaft.position.toArray(),first.shaft.scale.toArray(),first.head.position.toArray(),first.head.quaternion.toArray()];
 const driver=first.head.children[0];
 const bodyOrientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,-.8,.7));first.setBodyOrientation(bodyOrientation);
 for(const code of codes){first.setClub(code);assert.deepEqual([first.shaft.position.toArray(),first.shaft.scale.toArray(),first.head.position.toArray(),first.head.quaternion.toArray()],mount);}
 close(first.body.quaternion.angleTo(bodyOrientation),0);assert.deepEqual(first.neck.quaternion.toArray(),[0,0,0,1]);
 assert.equal(first.setClub('PT'),false);assert.equal(first.setClub('DR'),true);assert.equal(first.head.children[0],driver);
 first.head.children[0].position.x=1;close(second.head.children[0].position.x,0);
 assert.throws(()=>first.setClub('unknown'),/Unknown golf club/);assert.equal(first.root.userData.clubShort,'DR');assert.equal(first.head.children[0],driver);
 assert.throws(()=>first.setBodyOrientation(new THREE.Quaternion(0,0,0,2)),/unit Quaternion/);
});

test('the grip and unit shaft retain the existing animated length contract',()=>{
 const {root,shaft,head}=createGolfClub(),grip=root.getObjectByName('Golf club grip');
 shaft.geometry.computeBoundingBox();close(shaft.geometry.boundingBox.max.y-shaft.geometry.boundingBox.min.y,1);
 close(grip.position.y-grip.scale.y/2,-.06);close(grip.position.y+grip.scale.y/2,.20);close(shaft.position.y-shaft.scale.y/2,.14);close(shaft.position.y+shaft.scale.y/2,head.position.y);
 const length=.955;shaft.scale.y=length-.14;shaft.position.y=.14+shaft.scale.y/2;head.position.y=length;
 close(shaft.position.y-shaft.scale.y/2,.14);close(shaft.position.y+shaft.scale.y/2,head.position.y);
});

test('body calibration gives the actual face its intended world loft without changing the shaft',()=>{
 const root=new THREE.Group();root.rotation.y=1.1;root.scale.setScalar(1.1);
 const actualFrame=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.8,-.7)),original=actualFrame.toArray(),bodyOrientation=clubBodyOrientation(actualFrame);
 for(const spec of CLUBS){
  const equipment=createGolfClub(spec.short);root.add(equipment.root);equipment.root.quaternion.copy(actualFrame);equipment.setBodyOrientation(bodyOrientation);
  const desired=new THREE.Vector3(-Math.cos(spec.loft*Math.PI/180),Math.sin(spec.loft*Math.PI/180),0).applyQuaternion(root.quaternion);
  close(capNormal(equipment).distanceTo(desired),0);
  const bodyDown=new THREE.Vector3(0,1,0).applyQuaternion(equipment.body.getWorldQuaternion(new THREE.Quaternion()));close(bodyDown.distanceTo(new THREE.Vector3(0,-1,0)),0);
  const hosel=equipment.neck.getObjectByName('Hosel'),shaft=equipment.shaft;
  close(new THREE.Vector3(0,1,0).applyQuaternion(hosel.getWorldQuaternion(new THREE.Quaternion())).distanceTo(new THREE.Vector3(0,1,0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()))),0);
  root.remove(equipment.root);
 }
 assert.deepEqual(actualFrame.toArray(),original);close(clubBodyOrientation(actualFrame).angleTo(bodyOrientation),0);
 assert.throws(()=>clubBodyOrientation(new THREE.Quaternion(0,0,0,2)),/unit Quaternion/);
});

test('iron and wedge rear vertices stay above the level sole without clipping the front cap',()=>{
 for(const code of ['5I','7I','9I','PW','SW']){
  const equipment=createGolfClub(code),shape=equipment.body.children[0],plane=shape.userData.solePlaneY,leading=shape.userData.frontLeadingEdgeY;
  close(plane-leading,.0002);equipment.root.updateMatrixWorld(true);
  const face=equipment.body.getObjectByName('Forged blade'),faceInverse=face.matrixWorld.clone().invert(),facePositions=face.geometry.attributes.position,faceNormals=face.geometry.attributes.normal;
  let frontZ=Infinity;for(let i=0;i<facePositions.count;i++)if(faceNormals.getZ(i)<-.9999)frontZ=Math.min(frontZ,facePositions.getZ(i));
  let maximum=-Infinity,capMaximum=-Infinity;
  for(const part of meshes(equipment.body)){
   const p=part.geometry.attributes.position,n=part.geometry.attributes.normal;
   for(let i=0;i<p.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);maximum=Math.max(maximum,point.y-equipment.head.position.y);
    // ExtrudeGeometry keeps the original flat caps in its first group. The
    // tapered bevel can also become coplanar after the sole correction.
    if(part.name==='Forged blade'&&i<part.geometry.groups[0].count&&n.getZ(i)<-.9999)capMaximum=Math.max(capMaximum,point.y-equipment.head.position.y);
    assert.ok(point.clone().applyMatrix4(faceInverse).z>=frontZ-1e-7,`${code} ${part.name} protrudes through its striking plane`);
   }
  }
  close(maximum,plane,1e-7);close(capMaximum,leading,1e-7);
 }
});
