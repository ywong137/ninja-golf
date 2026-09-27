import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const cache=new Map();
const steel=new THREE.MeshStandardMaterial({color:'#aebfc4',metalness:1,roughness:.24});
const edge=new THREE.MeshStandardMaterial({color:'#f0f3f2',metalness:.95,roughness:.13});
const fittings=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.38});
export const BLADE_PROFILES={odachi:{length:1.40,width:.16,curve:.16,grip:.34},twin:{length:.94,width:.13,curve:.12,grip:.25},naginata:{length:1.10,width:.22,curve:.22,grip:.48},scout:{length:.48,width:.035,curve:.035,grip:.20},guard:{length:.79,width:.045,curve:.06,grip:.27},lancer:{length:.39,width:.05,curve:.025,grip:.50},skirmisher:{length:.25,width:.038,curve:.01,grip:.15}};
export function bladeGeometry(profile){
  const positions=[],indices=[],groups=[];const N=32;
  // Wide flat faces, a narrow sharpened bevel, and a blunt back. Width greatly exceeds thickness.
  for(let i=0;i<=N;i++){const t=i/N,y=.17+t*profile.length,curve=profile.curve*t*t;const tip=Math.max(.015,Math.min(1,(1-t)/.10)),w=profile.width*.5*(1-t*.20)*tip;const z=Math.min(.007,profile.width*.045)*(.9-t*.35)*tip;
    for(const [x,depth]of [[-w,-z],[-w,z],[w*.65,z],[w,0],[w*.65,-z]])positions.push(curve+x,y,depth);
  }
  for(const sides of [[0,1,4],[2,3]]){const start=indices.length;for(const side of sides)for(let i=0;i<N;i++){const a=i*5+side,b=i*5+(side+1)%5;indices.push(a,b,a+5,b,b+5,a+5);}groups.push([start,indices.length-start,groups.length]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);groups.forEach(v=>g.addGroup(...v));g.computeVertexNormals();g.computeBoundingBox();return g;
}
export const SPECIAL_WEAPON_KINDS=['fan','ring','sickle'];
function specialWeapon(kind){
  const group=new THREE.Group();group.name=`${kind} weapon`;
  const palette={fan:'#a9475d',ring:'#736094',sickle:'#375e50'};
  const enamel=new THREE.MeshStandardMaterial({color:palette[kind],metalness:.35,roughness:.34,side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:'#bea16c',metalness:.85,roughness:.26});
  const grip=new THREE.MeshStandardMaterial({color:'#25252b',roughness:.7});
  const mesh=(geometry,material,name)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;group.add(m);return m;};
  const rod=(a,b,r,material,name)=>{const delta=new THREE.Vector3().subVectors(b,a);const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),material,name);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
  const shapeMesh=(points,material,name,depth=.012)=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,steps:1});geometry.translate(0,0,-depth/2);return mesh(geometry,material,name);};
  // Every class has a real narrow handle centered at the measured finger grip.
  rod(new THREE.Vector3(0,-.14,0),new THREE.Vector3(0,.19,0),.017,grip,'Wrapped hand grip');
  for(let i=0;i<7;i++){const wrap=mesh(new THREE.TorusGeometry(.019,.002,4,12),gold,'Grip binding');wrap.rotation.x=Math.PI/2;wrap.position.y=-.11+i*.041;}
  if(kind==='fan'){
    const points=[[0,.14]],r=.63;
    for(let i=0;i<=16;i++){const a=-1.05+i/16*2.1;points.push([Math.sin(a)*r,.14+Math.cos(a)*r]);}
    shapeMesh(points,enamel,'Crimson fan leaves');
    for(let i=0;i<=8;i++){
      const a=-1.05+i/8*2.1,x=Math.sin(a)*r,y=.14+Math.cos(a)*r;
      rod(new THREE.Vector3(0,.14,.012),new THREE.Vector3(x,y,.012),.008,gold,'Fan rib');
      const next=a+.065,prev=a-.065;
      shapeMesh([[Math.sin(prev)*(r-.055),.14+Math.cos(prev)*(r-.055)],[Math.sin(a)*(r+.09),.14+Math.cos(a)*(r+.09)],[Math.sin(next)*(r-.055),.14+Math.cos(next)*(r-.055)]],edge,'Fan cutting tooth',.010);
    }
    const pivot=mesh(new THREE.SphereGeometry(.037,12,8),gold,'Fan pivot');pivot.position.y=.14;
    group.userData.tip=[0,.86,0];
  }else if(kind==='ring'){
    // The crescent surrounds an open center; its lower spine houses the grip bar.
    const shape=new THREE.Shape(),outer=.44,inner=.34,cy=.34;
    shape.absarc(0,cy,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,cy,inner,0,Math.PI*2,true);shape.holes.push(hole);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelThickness:.004,bevelSize:.012,bevelSegments:2,curveSegments:64});geometry.translate(0,0,-.007);mesh(geometry,steel,'Crescent ring edge');
    const trim=mesh(new THREE.TorusGeometry(inner+.014,.008,6,64),gold,'Inner ring inlay');trim.position.y=cy;
    for(const sign of [-1,1])shapeMesh([[sign*.31,.62],[sign*.56,.74],[sign*.41,.39]],enamel,'Crescent wing',.014);
    rod(new THREE.Vector3(0,.14,0),new THREE.Vector3(-.19,.035,0),.012,gold,'Grip brace');rod(new THREE.Vector3(0,.14,0),new THREE.Vector3(.19,.035,0),.012,gold,'Grip brace');
    group.userData.tip=[.03,.81,0];
  }else{
    rod(new THREE.Vector3(0,.12,0),new THREE.Vector3(0,.58,0),.023,enamel,'Sickle haft');
    shapeMesh([[-.025,.57],[.08,.67],[.24,.68],[.43,.58],[.53,.39],[.48,.19],[.39,.08],[.41,.30],[.32,.46],[.17,.50],[.025,.48]],steel,'Hooked sickle blade',.018);
    shapeMesh([[.04,.59],[.19,.59],[.34,.49],[.43,.33],[.39,.12],[.48,.21],[.53,.39],[.43,.58],[.24,.68],[.08,.67]],edge,'Sickle sharpened crescent',.019);
    const fitting=mesh(new THREE.BoxGeometry(.085,.07,.04),gold,'Sickle collar');fitting.position.set(0,.53,0);
    group.userData.tip=[.45,.17,0];
  }
  group.userData.kind=kind;group.userData.grip=[0,0,0];return group;
}
export function createWeapon(kind='odachi'){
  if(cache.has(kind))return cache.get(kind).clone();if(SPECIAL_WEAPON_KINDS.includes(kind)){const weapon=specialWeapon(kind);cache.set(kind,weapon);return weapon.clone();}const p=BLADE_PROFILES[kind];if(!p)throw new Error(`Unknown weapon kind: ${kind}`);const group=new THREE.Group(),pieces=[];
  const add=(geo,color,x,y,z,sx=1,sy=1,sz=1)=>{const g=geo.index?geo.toNonIndexed():geo.clone();g.scale(sx,sy,sz);g.translate(x,y,z);const c=new THREE.Color(color),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.deleteAttribute('uv');pieces.push(g);geo.dispose();};
  const pole=kind==='naginata'||kind==='lancer';
  add(new THREE.CylinderGeometry(.017,.019,pole?1.05:p.grip,12),'#252b30',0,pole?-.36:.17-p.grip/2,0);
  add(new THREE.CylinderGeometry(.07,.07,.018,8),'#ae8240',0,.155,0,1.1,1,.7);
  add(new THREE.BoxGeometry(.065,.055,.025),'#b18b49',0,.192,0);
  for(let i=0;i<9;i++){const y=.13-i*(Math.min(p.grip,.40)-.06)/8;add(new THREE.TorusGeometry(.019,.0025,4,12).rotateX(Math.PI/2),'#b79a67',0,y,0,1,1,1);}
  const hardware=new THREE.Mesh(mergeGeometries(pieces),fittings);pieces.forEach(g=>g.dispose());hardware.castShadow=true;group.add(hardware);
  const blade=new THREE.Mesh(bladeGeometry(p),[steel,edge]);blade.name='Flat steel blade';blade.castShadow=true;group.add(blade);
  group.userData.tip=[p.curve,.17+p.length,0];group.userData.kind=kind;cache.set(kind,group);return group.clone();
}
