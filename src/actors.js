import * as THREE from 'three';
const materials=new Map(),geometries=new Map();
function mat(c,metal=0){const k=c+metal;if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color:c,roughness:metal?.4:.83,metalness:metal}));return materials.get(k);}
function geo(kind){if(!geometries.has(kind))geometries.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='sphere'?new THREE.SphereGeometry(1,10,8):kind==='cone'?new THREE.ConeGeometry(1,1,8):new THREE.CylinderGeometry(1,1,1,8));return geometries.get(kind);}
function part(parent,kind,c,x,y,z,sx,sy,sz,metal=0){const m=new THREE.Mesh(geo(kind),mat(c,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
export class Warrior {
  constructor(type=0,enemy=false){
    this.root=new THREE.Group();this.body=new THREE.Group();this.root.add(this.body);this.enemy=enemy;this.type=type;
    const cloth=enemy?(type===2?'#574a55':'#293b40'):type===0?'#9e3a2d':type===1?'#344e57':'#c49b4b';
    const armor=enemy?'#31373a':type===0?'#373b36':type===1?'#20363e':'#4c4430';
    const gold=enemy?'#77766a':'#c4a66a',skin='#c5a180';
    const torso=part(this.body,'box',cloth,0,1.32,0,.64,.74,.37);torso.rotation.z=.02;
    part(this.body,'box',armor,0,1.4,.2,.58,.53,.08);
    for(let i=0;i<4;i++)part(this.body,'box',gold,0,1.19+i*.11,.25,.48,.018,.026,.4);
    part(this.body,'box','#292e29',0,.98,0,.73,.14,.43);part(this.body,'box',gold,0,.98,.245,.12,.12,.055,.4);
    for(const side of [-1,1]){
      const skirt=part(this.body,'box',armor,side*.25,.81,0,.28,.37,.47);skirt.rotation.z=side*.15;
      for(let i=0;i<3;i++)part(skirt,'box',gold,0,-.33+i*.3,.52,.82,.05,.04);
    }
    part(this.body,'cyl',skin,0,1.81,0,.125,.17,.125);
    part(this.body,'sphere',enemy?'#28353a':skin,0,2.01,0,.23,.28,.21);
    part(this.body,'box',enemy?'#101d22':'#4a302b',0,2.04,.19,.31,.052,.036);
    for(const s of [-1,1])part(this.body,'box',enemy?'#d8c9aa':'#e8decb',s*.078,2.05,.212,.06,.02,.017);
    if(type===0&&!enemy){
      part(this.body,'sphere',armor,0,2.19,-.016,.27,.2,.25);part(this.body,'box',armor,0,2.13,.16,.61,.08,.24);
      for(const s of [-1,1]){const horn=part(this.body,'cone',gold,s*.19,2.37,.13,.075,.5,.07,.6);horn.rotation.z=-s*.45;}
      part(this.body,'box',armor,0,1.94,-.2,.52,.34,.13);
    } else if(type===2&&!enemy){part(this.body,'cone','#ab9462',0,2.26,0,.48,.25,.48);}
    else {part(this.body,'box',cloth,0,2.14,0,.46,.09,.43);const tail=part(this.body,'box',cloth,.14,1.97,-.31,.14,.4,.035);tail.rotation.x=.4;}
    this.arms=[];this.legs=[];
    for(const s of [-1,1]){
      const arm=new THREE.Group();arm.position.set(s*.4,1.59,0);this.body.add(arm);
      part(arm,'box',cloth,0,-.23,0,.22,.5,.25);part(arm,'box',armor,0,-.025,0,.31,.22,.36);
      part(arm,'box',armor,0,-.47,.04,.21,.27,.23);part(arm,'sphere',enemy?'#333a35':skin,0,-.65,.06,.1,.12,.11);this.arms.push(arm);
      const leg=new THREE.Group();leg.position.set(s*.2,.85,0);this.root.add(leg);
      part(leg,'box',cloth,0,-.21,0,.28,.46,.31);part(leg,'box',armor,0,-.55,0,.21,.34,.24);
      part(leg,'box','#242927',0,-.76,.08,.23,.14,.39);this.legs.push(leg);
    }
    this.sword=new THREE.Group();this.arms[1].add(this.sword);this.sword.position.set(0,-.65,.1);this.sword.rotation.x=-Math.PI/2;
    const length=type===2&&!enemy?1.9:1.25;
    part(this.sword,'cyl','#322c29',0,.02,0,.045,.32,.045);part(this.sword,'box',gold,0,.21,0,.21,.048,.15,.6);
    part(this.sword,'box','#dbe5dd',0,.22+length/2,0,.055,length,.085,.85);const tip=part(this.sword,'cone','#dbe5dd',0,.22+length+.09,0,.04,.18,.055,.85);
    tip.rotation.z=-.14;
    if(type===1&&!enemy){this.offhand=this.sword.clone(true);this.arms[0].add(this.offhand);this.offhand.scale.setScalar(.78);}
    this.club=new THREE.Group();this.arms[1].add(this.club);this.club.position.set(0,-.62,.1);this.club.rotation.x=-Math.PI/2;
    part(this.club,'cyl','#b9c6c3',0,.58,0,.018,1.4,.018,.7);part(this.club,'box','#313e3c',.11,1.3,0,.26,.14,.16,.7);
    this.club.visible=false;
    // A compact club bag makes the silhouette part golfer, part warrior.
    const bag=part(this.body,'cyl','#4c5140',-.14,1.35,-.38,.18,.86,.18);bag.rotation.z=-.2;
    for(let i=0;i<3;i++){part(this.body,'cyl','#aaa99a',-.29+i*.12,1.93,-.37,.014,.75,.014,.5);part(this.body,'box','#bcbeb1',-.25+i*.12,2.29,-.37,.11,.06,.07,.6);}
    this.root.scale.setScalar(enemy?1.02:1.1);this.phase=Math.random()*6;this.dead=0;
  }
  update(time,dt,{moving=false,sprinting=false,attack=0,golf=false,swing=0}={}){
    this.sword.visible=!golf;this.club.visible=golf;if(this.offhand)this.offhand.visible=!golf;
    const cycle=time*(sprinting?14:10)+this.phase,amount=moving?.72:0;
    this.legs[0].rotation.x=Math.sin(cycle)*amount;this.legs[1].rotation.x=-Math.sin(cycle)*amount;
    this.body.position.y=moving?Math.abs(Math.sin(cycle))*.055:Math.sin(time*2+this.phase)*.012;
    this.body.rotation.y=attack>0?Math.sin(attack*Math.PI*2)*1.1:0;
    this.arms[0].rotation.set(moving?-Math.sin(cycle)*.45:0,0,.1);
    this.arms[1].rotation.set(moving?Math.sin(cycle)*.45:0,0,-.14);
    if(attack>0){this.arms[1].rotation.x=-1.2;this.arms[1].rotation.z=-.5-Math.sin(attack*Math.PI)*1.4;this.arms[0].rotation.x=-.65;}
    if(golf){this.arms[1].rotation.x=-.4;this.arms[0].rotation.x=-.42;if(swing>0){this.arms[1].rotation.z=-Math.sin(swing*Math.PI)*2;this.body.rotation.y=Math.sin(swing*Math.PI)*.8;}}
    if(this.dead>0){this.root.rotation.z=Math.min(Math.PI/2,this.dead*3);this.root.position.y-=dt*1.2;this.root.scale.multiplyScalar(Math.max(.1,1-dt*.9));}
  }
}
export class Effects {
  constructor(scene){this.scene=scene;this.items=[];this.geo=new THREE.SphereGeometry(1,5,4);this.mats=[new THREE.MeshBasicMaterial({color:'#f7d59a'}),new THREE.MeshBasicMaterial({color:'#d5e1cb'}),new THREE.MeshBasicMaterial({color:'#bb5261'})];}
  burst(position,count=12,power=4,kind=0){for(let i=0;i<count;i++){const m=new THREE.Mesh(this.geo,this.mats[kind]);m.position.copy(position);m.scale.setScalar(.035+Math.random()*.07);this.scene.add(m);this.items.push({m,v:new THREE.Vector3((Math.random()-.5)*power,Math.random()*power*.7,(Math.random()-.5)*power),life:.35+Math.random()*.45});}}
  slash(position,yaw,special=false){const g=new THREE.RingGeometry(special?2:1.4,special?6:3.8,40,1,0,Math.PI*1.5);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:special?'#efc875':'#eff4da',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));m.rotation.set(-Math.PI/2,.1,yaw);m.position.copy(position);m.position.y+=1;this.scene.add(m);this.items.push({m,life:.24,max:.24,ring:true});}
  update(dt){for(let i=this.items.length-1;i>=0;i--){const p=this.items[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.m);if(p.ring){p.m.geometry.dispose();p.m.material.dispose();}this.items.splice(i,1);continue;}if(p.ring){p.m.material.opacity=p.life/p.max*.8;p.m.scale.multiplyScalar(1+dt*2);}else{p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.multiplyScalar(1-dt*1.4);}}}
  clear(){for(const p of this.items){this.scene.remove(p.m);if(p.ring){p.m.geometry.dispose();p.m.material.dispose();}}this.items=[];}
}

// Share one draw call per geometry/material across the entire enemy crowd.
// Each warrior keeps its articulated transform hierarchy for animation and combat.
export class CrowdRenderer {
  constructor(scene){this.scene=scene;this.batches=new Map();}
  update(enemies){
    for(const batch of this.batches.values())batch.count=0;
    for(const enemy of enemies){enemy.root.updateMatrixWorld(true);enemy.root.traverseVisible(part=>{if(!part.isMesh)return;const key=part.geometry.uuid+part.material.uuid;let batch=this.batches.get(key);if(!batch){const mesh=new THREE.InstancedMesh(part.geometry,part.material,2048);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.frustumCulled=false;this.scene.add(mesh);batch={mesh,count:0};this.batches.set(key,batch);}if(batch.count<2048)batch.mesh.setMatrixAt(batch.count++,part.matrixWorld);});}
    for(const {mesh,count} of this.batches.values()){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}
  }
}
