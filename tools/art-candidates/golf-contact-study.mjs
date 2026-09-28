import * as T from 'three';
import {createGolfClub} from './golf-club.js';
// Offline contact study. This module does not fit a character or enter the game bundle.
// Art dimensions, in metres. These are design targets, not equipment certification.
export const GOLF_DESIGN_TARGETS={
 DR:{buttToSocket:1.143,lie:58.5,loft:10.5,tee:.020},
 '3W':{buttToSocket:1.067,lie:59,loft:15},
 '5I':{buttToSocket:.965,lie:61,loft:27},
 '7I':{buttToSocket:.940,lie:62,loft:34},
 '9I':{buttToSocket:.914,lie:63,loft:42},
 PW:{buttToSocket:.902,lie:64,loft:46},
 SW:{buttToSocket:.889,lie:64,loft:56},
 PT:{buttToSocket:.864,lie:70,loft:3},
};
export const STUDY_BALL_RADIUS=.021335;
export function createGolfContactStudy(short){
 const spec=GOLF_DESIGN_TARGETS[short];if(!spec)throw Error('Unknown club '+short);
 const {root,shaft,head,setKind}=createGolfClub();setKind(short);
 const body=head.children[0],removed=[];
 body.traverse(o=>{if(['Hosel','Ferrule'].includes(o.name))removed.push(o);if(o.name==='Forged blade')o.parent.rotation.x=0;});
 removed.forEach(o=>o.removeFromParent());
 const pitched=new T.Group();head.clear();head.add(pitched);pitched.add(body);
 pitched.rotation.x=-spec.loft*Math.PI/180;
 const socket=spec.buttToSocket-.060;head.position.y=socket;
 head.rotation.z=(90-spec.lie)*Math.PI/180;
 shaft.scale.y=socket-.14;shaft.position.y=.14+shaft.scale.y*.5;
 const hose=new T.Mesh(new T.CylinderGeometry(.006,.007,.042,20),new T.MeshStandardMaterial({color:'#bac1c5',metalness:.85,roughness:.3}));hose.position.y=socket-.014;root.add(hose);
 root.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),Math.PI).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-(90-spec.lie)*Math.PI/180));
 root.updateMatrixWorld(true);
 const frontName=short==='PT'?'Putter face':['DR','3W'].includes(short)?'Titanium face':'Forged blade';
 const front=body.getObjectByName(frontName),frontPosition=front.geometry.attributes.position;
 const frontMaxZ=Math.max(...Array.from({length:frontPosition.count},(_,i)=>frontPosition.getZ(i))),headInverse=head.matrixWorld.clone().invert();
 const frontInHead=headInverse.clone().multiply(front.matrixWorld),frontPoints=[];
 const frontIndex=front.geometry.index,frontTriangles=[];
 for(let i=0;i<(frontIndex?frontIndex.count:frontPosition.count);i+=3){const ids=[0,1,2].map(k=>frontIndex?frontIndex.getX(i+k):i+k);if(ids.every(j=>Math.abs(frontPosition.getZ(j)-frontMaxZ)<1e-6))frontTriangles.push(ids);}
 for(let i=0;i<frontPosition.count;i++)if(Math.abs(frontPosition.getZ(i)-frontMaxZ)<1e-6)frontPoints.push(new T.Vector3().fromBufferAttribute(frontPosition,i).applyMatrix4(frontInHead));
 // A thick rectangular back cannot hang beneath a lofted wedge's leading edge.
 // Shape the sole in head space after loft, while leaving the front plane intact.
 if(!['DR','PT'].includes(short)){
  const soleLimit=Math.max(...frontPoints.map(p=>p.y))+.0003;
  body.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry=mesh.geometry.clone();const a=mesh.geometry.attributes.position,toHead=headInverse.clone().multiply(mesh.matrixWorld),fromHead=toHead.clone().invert();
   for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(toHead);if(p.y>soleLimit){p.y=soleLimit;p.applyMatrix4(fromHead);a.setXYZ(i,p.x,p.y,p.z);}}
   mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  });
 }
 root.position.y=.002-new T.Box3().setFromObject(head,true).min.y;root.updateMatrixWorld(true);
 const faceName=short==='PT'?'Putter face':['DR','3W'].includes(short)?'Titanium face':'Forged blade';
 const face=body.getObjectByName(faceName),a=face.geometry.attributes.position;
 const triangles=frontTriangles.map(ids=>new T.Triangle(...ids.map(i=>face.localToWorld(new T.Vector3().fromBufferAttribute(a,i)))));
 if(!triangles.length)throw Error('No finite front triangles for '+short);
 const normal=new T.Vector3(0,0,-1).applyQuaternion(pitched.getWorldQuaternion(new T.Quaternion()));
 // Reflection on the template flips the cap into the physical front; pitched owns the loft.
 const plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,triangles[0].a);
 const box=new T.Box3().setFromPoints(triangles.flatMap(t=>[t.a,t.b,t.c]));
 const contact=new T.Vector3((box.min.x+box.max.x)/2,STUDY_BALL_RADIUS+(spec.tee??0)-STUDY_BALL_RADIUS*normal.y,0);
 contact.z=-(plane.constant+normal.x*contact.x+normal.y*contact.y)/normal.z;
 const ball=contact.clone().addScaledVector(normal,STUDY_BALL_RADIUS);
 const gap=Math.min(...triangles.map(t=>t.closestPointToPoint(contact,new T.Vector3()).distanceTo(contact)));
 const nearest=Math.min(...triangles.map(t=>t.closestPointToPoint(ball,new T.Vector3()).distanceTo(ball)))-STUDY_BALL_RADIUS;
 const report={short,...spec,shaftSocketDistance:socket,gripWorld:root.position.toArray(),facePoint:root.worldToLocal(contact.clone()).toArray(),faceNormal:normal.clone().applyQuaternion(root.quaternion.clone().invert()).toArray(),ballWorld:ball.toArray(),sole:new T.Box3().setFromObject(head,true).min.y,facePlaneError:gap,ballFaceGap:nearest,faceTriangles:triangles.length};
 if(gap>1e-6||Math.abs(nearest)>1e-6)throw Error(short+' misses its finite face.');
 // +Y points toward the head. The trailing left palm sits below the lead right palm.
 const markers={primaryPalm:[0,0,0],secondaryPalm:[0,.09,0],shaftSocket:[0,socket,0],facePoint:report.facePoint,faceNormal:report.faceNormal};
 return{root,head,ball,contact,normal,markers,report};
}
