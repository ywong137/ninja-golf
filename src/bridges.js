import * as THREE from 'three';
import {heightAt} from './course.js';
// Decks make the shared dry walking corridors visible over the water.
export function buildBridges(root,c,textures){
 if(!c.layout.bridges.length)return;
 const cyber=c.theme==='cyberpunk',box=new THREE.BoxGeometry(1,1,1),transform=new THREE.Object3D();
 const wood=new THREE.MeshStandardMaterial({color:cyber?'#23333d':'#847058',map:textures.color,normalMap:textures.normal,normalScale:new THREE.Vector2(.3,.3),roughness:.86});
 const rail=new THREE.MeshStandardMaterial({color:cyber?'#53ced0':'#635744',roughness:cyber?.4:.8,metalness:cyber?.5:0,emissive:cyber?'#237979':'#000000',emissiveIntensity:.3});
 const batches=[[],[]],emit=(type,x,y,z,sx,sy,sz,angle)=>{transform.position.set(x,y,z);transform.rotation.set(0,angle,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();batches[type].push(transform.matrix.clone());};
 for(const path of c.layout.bridges)for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length/.9),angle=Math.atan2(dx,dz),sideX=dz/length,sideZ=-dx/length,width=Math.min(a[2],b[2])*1.55;
  for(let j=0;j<count;j++){
   const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t,y=heightAt(c,x,z)+.11;
   emit(0,x,y,z,width,.16,length/count-.035,angle);
   for(const side of [-1,1]){
    const xx=x+sideX*width*.49*side,zz=z+sideZ*width*.49*side;
    emit(1,xx,y+1.0,zz,.10,.12,length/count+.025,angle);
    if(j%7===0){emit(1,xx,y+.5,zz,.14,1.12,.14,angle);const h=Math.max(.4,y-2.7);emit(0,xx,y-h*.5,zz,.25,h,.25,angle);}
   }
  }
 }
 for(let i=0;i<2;i++){const mesh=new THREE.InstancedMesh(box.clone(),i?rail:wood,batches[i].length);batches[i].forEach((matrix,j)=>mesh.setMatrixAt(j,matrix));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 box.dispose();
}
