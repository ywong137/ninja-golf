import {Plane,Vector3} from 'three';

// The musou portrait uses a close camera that can enter branches or scenery.
// Clip foreground scenery for this render only. Retain the hero and shadows.
export class PortraitCutaway {
  constructor(){this.plane=new Plane();this.direction=new Vector3();this.point=new Vector3();}
  withClippedScenery(renderer,camera,focus,roots,operation){
    this.direction.subVectors(focus,camera.position).normalize();
    this.point.copy(focus).addScaledVector(this.direction,.28);
    this.plane.setFromNormalAndCoplanarPoint(this.direction,this.point);
    const saved=new Map(),enabled=renderer.localClippingEnabled;
    for(const root of roots)root.traverseVisible(object=>{
      if(!object.isMesh)return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        // Water and distant shadow decals use custom shaders, outside the portrait.
        if(!material||material.isShaderMaterial||saved.has(material))continue;
        saved.set(material,material.clippingPlanes);
        material.clippingPlanes=[...(material.clippingPlanes??[]),this.plane];
      }
    });
    renderer.localClippingEnabled=true;
    try{return operation();}
    finally{
      for(const [material,planes]of saved)material.clippingPlanes=planes;
      renderer.localClippingEnabled=enabled;
    }
  }
}
