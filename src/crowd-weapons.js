import {InstancedMesh,Matrix4} from 'three';

// Keep each animated weapon as the authority for its transform and hit points.
// Only its repeated draw calls move to instances. Dying weapons retain their
// individual transparent materials, and portraits retain ordinary clipping.
export class CrowdWeapons {
 constructor(scene){this.scene=scene;this.batches=new Map();this.hidden=new Map();this.inverse=new Matrix4();this.matrix=new Matrix4();}
 restore(){for(const [mesh,visible]of this.hidden)mesh.visible=visible;this.hidden.clear();}
 update(actors,{enabled=true}={}){
  this.restore();for(const batch of this.batches.values())batch.sources.length=0;
  if(enabled)for(const actor of actors){
   if(actor.dead||!actor.root.visible)continue;
   for(const weapon of [actor.weapon,actor.offhand])if(weapon?.visible)weapon.traverseVisible(source=>{
    if(!source.isMesh||source.isSkinnedMesh)return;
    const materials=Array.isArray(source.material)?source.material:[source.material];
    if(materials.some(material=>material.transparent))return;
    const key=[source.geometry.uuid,...materials.map(material=>material.uuid),source.castShadow,source.receiveShadow,source.renderOrder,source.layers.mask].join(':');
    let batch=this.batches.get(key);
    if(!batch){
     const mesh=new InstancedMesh(source.geometry,source.material,128);mesh.name='Crowd weapon instances';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;mesh.count=0;
     batch={mesh,sources:[]};this.batches.set(key,batch);this.scene.add(mesh);
    }
    batch.sources.push(source);this.hidden.set(source,source.visible);source.visible=false;
   });
  }
  for(const batch of this.batches.values()){
   if(batch.sources.length>batch.mesh.instanceMatrix.count){
    const old=batch.mesh,mesh=new InstancedMesh(old.geometry,old.material,2**Math.ceil(Math.log2(batch.sources.length)));
    mesh.name=old.name;mesh.castShadow=old.castShadow;mesh.receiveShadow=old.receiveShadow;mesh.renderOrder=old.renderOrder;mesh.layers.mask=old.layers.mask;this.scene.remove(old);old.dispose();this.scene.add(mesh);batch.mesh=mesh;
   }
   batch.mesh.count=batch.sources.length;batch.mesh.visible=batch.sources.length>0;
  }
  if(!actors.length)this.dispose();
 }
 // Scene world matrices are current here, including this frame's hand motion.
 updateMatrices(){
  this.inverse.copy(this.scene.matrixWorld).invert();
  for(const {mesh,sources}of this.batches.values())if(sources.length){
   for(let i=0;i<sources.length;i++)mesh.setMatrixAt(i,this.matrix.multiplyMatrices(this.inverse,sources[i].matrixWorld));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.updateMatrixWorld(true);
  }
 }
 dispose(){this.restore();for(const {mesh}of this.batches.values()){this.scene.remove(mesh);mesh.dispose();}this.batches.clear();}
}
