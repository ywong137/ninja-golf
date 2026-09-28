import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {measureGripSurface} from '../tools/grip-contact.mjs';

function inspect(geometry,localPoint,transform=false){
 const surface=geometry.index?geometry.toNonIndexed():geometry;
 surface.userData.fittingParts=[{start:0,count:surface.attributes.position.count}];
 const held=new T.Group();held.add(new T.Mesh(surface));
 if(transform){held.position.set(4,2,-7);held.rotation.set(.7,-.3,1.1);held.scale.setScalar(1.1);}
 held.updateMatrixWorld(true);
 const worldPoint=held.localToWorld(localPoint.clone());
 const skin={matrixWorld:new T.Matrix4(),skeleton:{update(){}},getVertexPosition(_i,out){return out.copy(worldPoint);}};
 return measureGripSurface([{mesh:skin,index:0,group:'index'}],held,.016);
}

test('The hand check detects a finger through an actual guard mesh',()=>{
 const guard=new T.BoxGeometry(.15,.02,.05).translate(0,.155,0);
 for(const transformed of [false,true]){
  const result=inspect(guard,new T.Vector3(.025,.155,.018),transformed);
  assert.ok(result.fittingPenetration>.006&&result.fittingPenetration<.008);
  assert.equal(result.fittingVertices,1);
 }
 const below=inspect(guard,new T.Vector3(.025,.12,.018));
 assert.equal(below.fittingPenetration,0);
});

test('An end-ring opening is free space, but its metal blocks a finger',()=>{
 const ring=new T.TorusGeometry(.024,.004,12,32).rotateX(Math.PI/2);
 assert.equal(inspect(ring,new T.Vector3(0,0,0)).fittingPenetration,0);
 assert.ok(inspect(ring,new T.Vector3(.024,0,0)).fittingPenetration>.003);
});
