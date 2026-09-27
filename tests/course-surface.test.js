import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {courseGeometry,courseSurfaceHeight} from '../src/terrain.js';
import {COURSE_SETS,heightAt,ellipse,routePoint} from '../src/course.js';
test('constant-time course attachment heights match actual fairway, rough, green and bunker triangles',()=>{
 for(const set of COURSE_SETS){const c=set.holes[0],geo=courseGeometry(c,heightAt,ellipse),mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
  const points=[[-140,42],[140,97],[0,-8],[c.greenX+3.27,c.length-2.23],...c.bunkers.flatMap(b=>[[b[0],b[1]],[b[0]+b[2]*.82,b[1]+.71]])];
  for(const t of [.1,.4,.8]){const p=routePoint(c,t);points.push([p.x+.27,p.z+.36]);}
  for(const[x,z]of points){ray.set(new THREE.Vector3(x,500,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(courseSurfaceHeight(c,x,z,heightAt,ellipse)-hit.point.y)<.00005);}
  geo.dispose();mesh.material.dispose();
 }
});
