import {Plane,Vector3} from 'three';

// A weapon or garment may share its material with scenery or an enemy.
// Substitute a cached material on the occluder; never change the shared original.
export class PortraitCutaway {
  constructor(){this.plane=new Plane();this.direction=new Vector3();this.point=new Vector3();this.variants=new WeakMap();}
  clipped(material){
    if(!material||material.isShaderMaterial)return material;
    let variant=this.variants.get(material);
    if(!variant){
      variant=material.clone();
      variant.onBeforeCompile=material.onBeforeCompile;
      variant.customProgramCacheKey=material.customProgramCacheKey;
      this.variants.set(material,variant);
      material.addEventListener('dispose',()=>{variant.dispose();this.variants.delete(material);});
    }
    variant.clippingPlanes=[...(material.clippingPlanes??[]),this.plane];
    return variant;
  }
  withClippedScenery(renderer,camera,focus,roots,operation){
    this.direction.subVectors(focus,camera.position).normalize();
    this.point.copy(focus).addScaledVector(this.direction,.28);
    this.plane.setFromNormalAndCoplanarPoint(this.direction,this.point);
    const saved=new Map(),enabled=renderer.localClippingEnabled;
    for(const root of roots)root.traverseVisible(object=>{
      if(!object.isMesh||saved.has(object))return;
      saved.set(object,object.material);
      object.material=Array.isArray(object.material)?object.material.map(m=>this.clipped(m)):this.clipped(object.material);
    });
    renderer.localClippingEnabled=true;
    try{return operation();}
    finally{for(const [object,material]of saved)object.material=material;renderer.localClippingEnabled=enabled;}
  }
}
