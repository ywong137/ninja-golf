import * as T from 'three';
import records from './showcase-bounds.json';

const back=new T.Vector3(.05,.06,1).normalize();
const right=new T.Vector3(0,1,0).cross(back).normalize(),up=back.clone().cross(right);
const center=new T.Vector3(),relative=new T.Vector3(),worldPoint=new T.Vector3(),scale=new T.Vector3();
const hulls=new Map();

export function showcaseBounds(model){
  const record=records.heroes[model];
  if(!record)throw Error('Missing full preview bounds for '+model+'. Run tools/bake-showcase-bounds.mjs.');
  return new T.Box3(new T.Vector3().fromArray(record.min),new T.Vector3().fromArray(record.max));
}

export function frameSelection(camera,root,model,rect,width,height,target,look){
  const bounds=showcaseBounds(model);root.updateWorldMatrix(true,false);
  bounds.getCenter(center).applyMatrix4(root.matrixWorld);
  if(!hulls.has(model))hulls.set(model,records.heroes[model].hull.map(p=>new T.Vector3().fromArray(p)));
  root.getWorldScale(scale);const padding=records.padding*Math.max(scale.x,scale.y,scale.z);
  const tanY=Math.tan(T.MathUtils.degToRad(camera.fov/2)),tanX=tanY*width/height;
  const halfX=tanX*Math.max(1,rect.width-24)/width,halfY=tanY*Math.max(1,rect.height-24)/height;
  let distance=1;
  for(const point of hulls.get(model)){
    worldPoint.copy(point).applyMatrix4(root.matrixWorld);relative.copy(worldPoint).sub(center);const depth=relative.dot(back);
    distance=Math.max(distance,depth+Math.abs(relative.dot(right))/halfX+padding*Math.hypot(1,1/halfX),depth+Math.abs(relative.dot(up))/halfY+padding*Math.hypot(1,1/halfY));
  }
  look.copy(center);target.copy(center).addScaledVector(back,distance);
  // An off-axis frustum puts the hero in the portrait area without looking
  // away from them. One complete-loop envelope prevents camera pumping.
  const x=2*(rect.left+rect.width/2)/width-1,y=1-2*(rect.top+rect.height/2)/height;
  camera.setViewOffset(width,height,-x*width/2,y*height/2,width,height);
  return distance;
}
