import * as THREE from 'three';
export class Effects {
  constructor(scene){this.scene=scene;this.items=[];this.geo=new THREE.SphereGeometry(1,5,4);this.mats=[new THREE.MeshBasicMaterial({color:'#f7d59a'}),new THREE.MeshBasicMaterial({color:'#d5e1cb'}),new THREE.MeshBasicMaterial({color:'#bb5261'})];}
  burst(position,count=12,power=4,kind=0){for(let i=0;i<count;i++){const m=new THREE.Mesh(this.geo,this.mats[kind]);m.position.copy(position);m.scale.setScalar(.035+Math.random()*.07);this.scene.add(m);this.items.push({m,v:new THREE.Vector3((Math.random()-.5)*power,Math.random()*power*.7,(Math.random()-.5)*power),life:.35+Math.random()*.45});}}
  slash(position,yaw,special=false){const g=new THREE.RingGeometry(special?2:1.4,special?6:3.8,40,1,0,Math.PI*1.5);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:special?'#efc875':'#eff4da',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));m.rotation.set(-Math.PI/2,.1,yaw);m.position.copy(position);m.position.y+=1;this.scene.add(m);this.items.push({m,life:.24,max:.24,ring:true});}
  update(dt){for(let i=this.items.length-1;i>=0;i--){const p=this.items[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.m);if(p.ring){p.m.geometry.dispose();p.m.material.dispose();}this.items.splice(i,1);continue;}if(p.ring){p.m.material.opacity=p.life/p.max*.8;p.m.scale.multiplyScalar(1+dt*2);}else{p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.multiplyScalar(1-dt*1.4);}}}
  clear(){for(const p of this.items){this.scene.remove(p.m);if(p.ring){p.m.geometry.dispose();p.m.material.dispose();}}this.items=[];}
}

