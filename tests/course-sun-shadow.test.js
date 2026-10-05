import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {SunLight} from 'three/addons/lights/SunLight.js';
import {CourseSunShadow} from '../src/course-sun-shadow.js';
import {SUN_DIRECTION} from '../src/lighting.js';

function sceneShadow(custom=true){
 const light=new SunLight();light.position.fromArray(SUN_DIRECTION);light.updateMatrixWorld(true);
 if(custom)light.shadow=new CourseSunShadow();
 light.shadow.mapSize.set(2048,2048);light.shadow.camera.far=280;
 return light;
}

test('close sunlight resolves a shoe without enlarging the shadow atlas',()=>{
 const view=new PerspectiveCamera(48,1.6,.4,6500);view.position.set(5,10,12);view.lookAt(2,8,5);view.updateMatrixWorld(true);
 const old=sceneShadow(false),current=sceneShadow();old.shadow.updateMatrices(old,view);current.shadow.updateMatrices(current,view);
 const width=light=>light.shadow.getCamera(0).right-light.shadow.getCamera(0).left;
 const texel=width(current)/current.shadow.mapSize.x;
 assert.ok(texel<.03,`Near texel covers ${texel} metres`);
 assert.ok(width(old)/width(current)>3,'The close cascade must retain substantially more detail.');
 assert.equal(current.shadow.getViewportCount(),2);
 assert.deepEqual(current.shadow.mapSize.toArray(),old.shadow.mapSize.toArray());
});

test('both shadow cascades cover the full course range and their shared boundary',()=>{
 const light=sceneShadow(),shadow=light.shadow;
 for(const [height,offset,portrait]of [[3,0,false],[20,0,false],[90,0,false],[250,0,false],[90,450,false],[3,450,true]]){
  const view=new PerspectiveCamera(48,1.6,.4,6500);view.position.set(offset+5,height,12);view.lookAt(offset,0,0);
  if(portrait)view.setViewOffset(1440,900,440,0,1000,900);
  view.updateMatrixWorld(true);shadow.updateMatrices(light,view);
  for(const depth of [.4,1,10,20,22,24,26,30,70,100,200,280])for(const x of [-1,0,1])for(const y of [-1,0,1]){
   const point=new Vector3(x,y,-1).applyMatrix4(view.projectionMatrixInverse).multiplyScalar(depth/view.near).applyMatrix4(view.matrixWorld);
   const cascade=depth<shadow._cascadeData[0].y?0:1;
   const projected=point.clone().applyMatrix4(shadow.getCamera(cascade).matrixWorldInverse).applyMatrix4(shadow.getCamera(cascade).projectionMatrix);
   assert.ok(Math.max(Math.abs(projected.x),Math.abs(projected.y),Math.abs(projected.z))<=1.000001,`Uncovered receiver: ${JSON.stringify({height,offset,portrait,depth,x,y,cascade,projected})}`);
  }
  assert.ok(shadow._cascadeData[1].x<shadow._cascadeData[0].y,'Cascades must overlap for the soft boundary.');
 }
});

test('cloned sun retains the course shadow fitting policy',()=>{
 const light=sceneShadow(),clone=light.clone();
 assert.ok(clone.shadow instanceof CourseSunShadow);
 assert.equal(clone.shadow.camera.far,280);
 assert.deepEqual(clone.shadow.mapSize.toArray(),[2048,2048]);
});
