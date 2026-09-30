import * as T from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {CharacterShowcase} from '../src/character-showcase.js';

// Offline geometry sampling. Do not run this skin scan in the render loop.
export function measureShowcaseBounds(actor,{rate=60}={}){
  const preview=new CharacterShowcase(actor),bounds=new T.Box3(),point=new T.Vector3(),meshBounds=new T.Box3();
  const inverse=new T.Matrix4(),matrix=new T.Matrix4();let samples=0;
  let points=[];
  const reduce=()=>{
    const hull=new ConvexHull().setFromPoints(points),vertices=new Set();
    for(const face of hull.faces){let edge=face.edge;do{vertices.add(edge.head());edge=edge.next;}while(edge!==face.edge);}
    points=[...vertices].map(v=>v.point);
  };
  try{
    while(preview.clock.cycle===0){
      actor.root.updateMatrixWorld(true);inverse.copy(actor.root.matrixWorld).invert();
      if(preview.clock.opacity>.01)actor.root.traverseVisible(mesh=>{
        if(!mesh.isMesh)return;
        mesh.skeleton?.update();matrix.multiplyMatrices(inverse,mesh.matrixWorld);meshBounds.makeEmpty();
        for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          mesh.getVertexPosition(i,point).applyMatrix4(matrix);meshBounds.expandByPoint(point);
        }
        if(meshBounds.isEmpty())return;
        bounds.union(meshBounds);
        for(let i=0;i<8;i++)points.push(new T.Vector3(i&1?meshBounds.max.x:meshBounds.min.x,i&2?meshBounds.max.y:meshBounds.min.y,i&4?meshBounds.max.z:meshBounds.min.z));
      });
      samples++;if(samples%60===0)reduce();preview.update(1/rate);
    }
    reduce();return{min:bounds.min.toArray(),max:bounds.max.toArray(),hull:points.map(p=>p.toArray()),samples,rate};
  }finally{preview.dispose();}
}
