import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
export { Effects } from './effects.js';
const templates=[];
const retargeted=new Map();
const motionSources=[];
const materials=new Map();
const geometries=new Map();
const q=new THREE.Quaternion();
const gripWorld=new THREE.Vector3(),shaftDirection=new THREE.Vector3(),axisY=new THREE.Vector3(0,1,0);
const swingShaft=[[0,[0,-.90,.60]],[.3,[.8,-.25,.5]],[.63,[.35,.86,-.40]],[.83,[.75,.25,.55]],[1.03,[.6,-.7,.55]],[1.133,[0,-.90,.60]],[1.3,[-.8,-.15,.45]],[1.63,[-.1,.7,-.7]],[2.17,[.25,.45,-.86]]];
export async function loadWarriorAssets(progress=()=>{}) {
  const loader=new GLTFLoader();let done=0;
  const urls=['ronin','shinobi','monk','warrior-motion','golf-motion'];
  const results=await Promise.all(urls.map(async name=>{const model=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);progress(++done,urls.length);return model;}));
  const clipNames=new Set(results.slice(3).flatMap(model=>model.animations.map(clip=>clip.name)));
  for(const name of ['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Golf_Address','Golf_Swing','Golf_Putt'])if(!clipNames.has(name))throw new Error(`Missing warrior animation: ${name}`);
  templates.push(...results.slice(0,3));motionSources.push(...results.slice(3));
  for(const model of templates)model.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat.map)mat.map.anisotropy=4;if(mat.normalMap)mat.normalMap.anisotropy=4;mat.envMapIntensity=.6;}}});
}
function mat(color,metal=0){const key=color+metal;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.28:.78,metalness:metal}));return materials.get(key);}
function part(parent,kind,color,x,y,z,sx,sy,sz,metal=0){if(!geometries.has(kind))geometries.set(kind,kind==='box'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,10));const mesh=new THREE.Mesh(geometries.get(kind),mat(color,metal));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;}
function clipsFor(index){
  if(retargeted.has(index))return retargeted.get(index);
  const target=templates[index].scene,clips=[];target.updateMatrixWorld(true);
  for(const source of motionSources){source.scene.updateMatrixWorld(true);
    for(const original of source.animations){const clip=original.clone();const tracks=[];
      for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),prop=track.name.slice(dot+1);const dst=target.getObjectByName(name),src=source.scene.getObjectByName(name);if(!dst||!src)continue;
        if(prop==='quaternion'){
          // Express source motion relative to its bind pose, then apply the target bind pose.
          const correction=dst.quaternion.clone().multiply(src.quaternion.clone().invert());
          for(let i=0;i<track.values.length;i+=4){q.fromArray(track.values,i).premultiply(correction).normalize().toArray(track.values,i);}tracks.push(track);
        }else if(prop==='position'&&(name==='pelvis'||name==='root')){
          const ratio=name==='pelvis'?dst.position.length()/Math.max(.001,src.position.length()):1;
          for(let i=0;i<track.values.length;i+=3){track.values[i]=dst.position.x+(track.values[i]-src.position.x)*ratio;track.values[i+1]=dst.position.y+(track.values[i+1]-src.position.y)*ratio;track.values[i+2]=dst.position.z+(track.values[i+2]-src.position.z)*ratio;}tracks.push(track);
        }
      }
      clip.tracks=tracks;clips.push(clip);
    }
  }
  retargeted.set(index,clips);return clips;
}
let katanaTemplate;
function katana(){
  if(katanaTemplate)return katanaTemplate.clone();
  const group=new THREE.Group();
  part(group,'cyl','#302a24',0,.02,0,.022,.23,.022);part(group,'cyl','#b49b60',0,.145,0,.063,.013,.063,.8);
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.16,0),new THREE.Vector3(0,.45,.009),new THREE.Vector3(0,.78,.037),new THREE.Vector3(0,1.03,.075)]);
  const vertices=[],indices=[];for(let i=0;i<=32;i++){const p=path.getPoint(i/32),width=.024*(i>29?(33-i)/4:1);for(const [x,z] of [[-width,0],[0,.009],[width,0],[0,-.004]])vertices.push(p.x+x,p.y,p.z+z);if(i<32)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const blade=new THREE.Mesh(g,mat('#d3d9d4',.95));blade.castShadow=true;group.add(blade);
  for(let i=0;i<7;i++){const band=part(group,'box','#9d8b63',0,-.065+i*.025,.022,.025,.012,.007);band.rotation.z=i%2?.5:-.5;}
  group.updateMatrixWorld(true);const pieces=[];
  for(const child of group.children){const geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geo.applyMatrix4(child.matrix);const values=[];const c=child.material.color;for(let i=0;i<geo.attributes.position.count;i++)values.push(c.r,c.g,c.b);geo.setAttribute('color',new THREE.Float32BufferAttribute(values,3));geo.deleteAttribute('uv');pieces.push(geo);}
  const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());group.clear();const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.8,roughness:.32}));mesh.castShadow=true;group.add(mesh);katanaTemplate=group;return group.clone();
}
export class Warrior {
  constructor(type=0,enemy=false){
    this.type=type;this.enemy=enemy;this.dead=0;this.root=new THREE.Group();const index=enemy?1:type;
    this.model=cloneSkeleton(templates[index].scene);this.root.add(this.model);this.root.scale.setScalar(enemy?1.1:1.1);
    this.bones={};this.model.traverse(o=>{if(o.isBone)this.bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(enemy){o.material=o.material.clone();if(/Woven|Silk/.test(o.material.name))o.material.color.set(type===2?'#342e40':'#23353a');if(/brass/i.test(o.material.name))o.material.color.set('#555b51');}}});
    this.mixer=new THREE.AnimationMixer(this.model);this.actions=new Map(clipsFor(index).map(c=>[c.name,this.mixer.clipAction(c)]));this.current='';this.oneShot=0;this.wasAttack=false;this.wasSwing=false;
    const hand=this.bones.hand_r;
    this.weapon=katana();this.weapon.position.set(0,.05,0);this.weapon.rotation.set(Math.PI/2,0,0);hand.add(this.weapon);
    if(type===2&&!enemy){this.weapon.scale.y=1.45;part(this.weapon,'cyl','#51402b',0,-.30,0,.022,.68,.022);}
    if(type===1&&!enemy){this.offhand=katana();this.offhand.scale.setScalar(.76);this.offhand.position.set(0,.05,0);this.offhand.rotation.set(Math.PI/2,0,0);this.bones.hand_l.add(this.offhand);}
    this.club=new THREE.Group();this.club.position.set(0,.04,0);this.root.add(this.club);
    part(this.club,'cyl','#252a27',0,.04,0,.018,.20,.018);part(this.club,'cyl','#b7c4c2',0,.60,0,.008,1.0,.008,.85);const head=part(this.club,'cyl','#3c4947',.047,1.12,0,.065,.07,.08,.8);head.rotation.z=-.15;this.club.visible=false;
    // A small bag and real club shafts retain the golf silhouette without obscuring the armor.
    const back=this.bones.spine_03;const bag=new THREE.Group();bag.position.set(.13,.03,-.18);bag.rotation.z=.22;back.add(bag);part(bag,'cyl','#4b4434',0,-.13,0,.083,.49,.083);for(let i=0;i<3;i++){part(bag,'cyl','#a5b1ad',-.045+i*.04,.18,0,.006,.39,.006,.6);part(bag,'box','#9ca9a5',-.025+i*.04,.37,0,.065,.03,.03,.75);}
    if(enemy)bag.visible=false;
    this.play('Idle_Loop',0);this.mixer.update(Math.random()*.7);
  }
  play(name,fade=.16,once=false,speed=1){const next=this.actions.get(name);if(!next)return;if(this.current===name&&!once)return;const previous=this.actions.get(this.current);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(speed);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(previous&&previous!==next){previous.fadeOut(fade);next.fadeIn(fade);}this.current=name;this.oneShot=once?next.getClip().duration/speed:0;}
  update(time,dt,{moving=false,sprinting=false,attack=0,golf=false,swing=0,putting=false,dodge=false}={}){
    this.weapon.visible=!golf;this.club.visible=golf;if(this.offhand)this.offhand.visible=!golf;
    if(this.dead>0){if(!this.deathStarted){this.deathStarted=true;this.play('Death01',.08,true,1.6);}this.mixer.update(dt);return;}
    this.oneShot=Math.max(0,this.oneShot-dt);
    if(swing>0&&!this.wasSwing)this.play(putting?'Golf_Putt':'Golf_Swing',.10,true,1);
    else if(attack>0&&!this.wasAttack)this.play('Sword_Attack',.07,true,2.2);
    else if(dodge&&!this.wasDodge)this.play('Roll',.06,true,1.4);
    else if(this.oneShot<=0)this.play(golf?'Golf_Address':moving?(sprinting?'Sprint_Loop':'Jog_Fwd_Loop'):this.enemy?'Sword_Idle':'Idle_Loop',.18,false,moving?(sprinting?1.15:1):1);
    this.wasAttack=attack>0;this.wasSwing=swing>0;this.wasDodge=dodge;this.mixer.update(dt);
    if(golf){
      this.root.updateMatrixWorld(true);this.bones.hand_r.getWorldPosition(gripWorld);this.root.worldToLocal(gripWorld);this.club.position.copy(gripWorld);
      shaftDirection.set(0,-.90,.60);
      if(this.current==='Golf_Swing'){
        const t=this.actions.get(this.current).time;let i=1;while(i<swingShaft.length-1&&t>swingShaft[i][0])i++;
        const a=swingShaft[i-1],b=swingShaft[i],f=THREE.MathUtils.clamp((t-a[0])/(b[0]-a[0]),0,1);shaftDirection.fromArray(a[1]).lerp(new THREE.Vector3(...b[1]),f);
      }
      this.club.quaternion.setFromUnitVectors(axisY,shaftDirection.normalize());
    }
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();if(this.enemy&&o.isMesh)o.material.dispose();});}
}
export class CrowdRenderer {
  constructor(scene){this.scene=scene;this.active=new Set();}
  update(enemies){const present=new Set(enemies);for(const e of this.active)if(!present.has(e)){this.scene.remove(e.root);e.dispose();this.active.delete(e);}for(const e of enemies)if(!this.active.has(e)){this.scene.add(e.root);this.active.add(e);}}
}
