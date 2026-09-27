import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {weaponSteel as steel,weaponEdge as edge,weaponBrass,weaponCord,weaponGrip,enamelMaterial} from './weapon-materials.js';
const cache=new Map();
const fittings=new THREE.MeshStandardMaterial({vertexColors:true,map:weaponBrass.map,roughnessMap:weaponBrass.roughnessMap,metalness:.55,roughness:.48});
export const BLADE_PROFILES={odachi:{length:1.40,width:.104,curve:.16,grip:.34},twin:{length:.94,width:.13,curve:.12,grip:.25},naginata:{length:1.10,width:.143,curve:.22,grip:.48},scout:{length:.48,width:.035,curve:.035,grip:.20},guard:{length:.79,width:.045,curve:.06,grip:.27},lancer:{length:.39,width:.05,curve:.025,grip:.50},skirmisher:{length:.25,width:.038,curve:.01,grip:.15}};
export function bladeGeometry(profile){
  const positions=[],uvs=[],groups=[];const segments=48;
  const section=(i,side)=>{const t=i/segments,tip=Math.max(.015,Math.min(1,(1-t)/.10)),w=profile.width*.5*(1-t*.20)*tip,z=Math.min(.0045,profile.width*.045)*(.9-t*.35)*tip;const cross=[[-w,-z],[-w,z],[w*.65,z],[w,0],[w*.65,-z]][side];return [profile.curve*t*t+cross[0],.17+t*profile.length,cross[1]];};
  const triangle=(a,b,c,ta,tb,tc)=>{positions.push(...a,...b,...c);uvs.push(...ta,...tb,...tc);};
  // Separate strip vertices keep flat faces and sharpened bevels physically distinct.
  for(const sides of [[0,1,4],[2,3]]){const start=positions.length/3;for(const side of sides)for(let i=0;i<segments;i++){
    const next=(side+1)%5,a=section(i,side),b=section(i,next),c=section(i+1,side),d=section(i+1,next),v=i/segments,w=(i+1)/segments;
    triangle(a,b,c,[0,v],[1,v],[0,w]);triangle(b,d,c,[1,v],[1,w],[0,w]);
  }if(groups.length===0)for(const i of [0,segments])for(let side=1;side<4;side++){const order=i===0?[0,side+1,side]:[0,side,side+1];triangle(...order.map(s=>section(i,s)),[0,0],[1,0],[1,1]);}groups.push([start,positions.length/3-start,groups.length]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));groups.forEach(v=>g.addGroup(...v));g.computeVertexNormals();g.computeBoundingBox();return g;
}
function cordGeometry(bottom,top,radius=.020){
 const positions=[],uvs=[],turns=(top-bottom)/.047,steps=Math.ceil(turns*24);
 for(const direction of [-1,1])for(let i=0;i<steps;i++){
  const vertex=(t,offset)=>{const a=t*turns*Math.PI*2*direction;return [Math.cos(a)*radius,bottom+t*(top-bottom)+offset,Math.sin(a)*radius];};
  const a=i/steps,b=(i+1)/steps;
  for(const [t,o,u,v]of [[a,-.005,0,a*turns],[b,-.005,0,b*turns],[a,.005,1,a*turns],[b,-.005,0,b*turns],[b,.005,1,b*turns],[a,.005,1,a*turns]]){positions.push(...vertex(t,o));uvs.push(u,v);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
function ringGeometry(){
 const positions=[],uvs=[],normals=[],groups=[],cy=.34,segments=128;
 const section=[[.34,-.008],[.34,.008],[.354,.012],[.414,.012],[.44,0],[.414,-.012],[.354,-.012]];
 for(const sides of [[0,1,2,5,6],[3,4]]){const start=positions.length/3;for(const side of sides)for(let i=0;i<segments;i++){
  const point=(n,s)=>{const angle=n/segments*Math.PI*2,[r,z]=section[s];return [Math.cos(angle)*r,cy+Math.sin(angle)*r,z];};
  for(const [n,s]of [[i,side],[i,(side+1)%section.length],[i+1,side],[i+1,side],[i,(side+1)%section.length],[i+1,(side+1)%section.length]]){positions.push(...point(n,s));uvs.push(n/segments,s/section.length);const next=(side+1)%section.length,dr=section[next][0]-section[side][0],dz=section[next][1]-section[side][1],length=Math.hypot(dr,dz),angle=n/segments*Math.PI*2;normals.push(-dz/length*Math.cos(angle),-dz/length*Math.sin(angle),dr/length);}
 }groups.push([start,positions.length/3-start,groups.length]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));groups.forEach(v=>g.addGroup(...v));return g;
}
function batchSpecial(group){
 // Decorative pieces share one draw per material, regardless of rib/wrap count.
 const batches=new Map();group.updateMatrixWorld(true);
 for(const part of [...group.children]){if(!part.isMesh||Array.isArray(part.material))continue;const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);const row=batches.get(part.material)||{geometries:[],names:[]};row.geometries.push(g);row.names.push(part.name);batches.set(part.material,row);group.remove(part);part.geometry.dispose();}
 for(const [material,row]of batches){const geometry=mergeGeometries(row.geometries);row.geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=row.names.includes('Wrapped hand grip')?'Wrapped hand grip':material.name;mesh.castShadow=true;group.add(mesh);}
}
export const SPECIAL_WEAPON_KINDS=['fan','ring','sickle'];
function specialWeapon(kind){
  const group=new THREE.Group();group.name=`${kind} weapon`;
  const palette={fan:'#a9475d',ring:'#736094',sickle:'#375e50'};
  const enamel=enamelMaterial(palette[kind]),gold=weaponBrass,grip=weaponGrip;
  const mesh=(geometry,material,name)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;group.add(m);return m;};
  const rod=(a,b,r,material,name)=>{const delta=new THREE.Vector3().subVectors(b,a);const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),material,name);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
  const shapeMesh=(points,material,name,depth=.012)=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.003,bevelSize:.004,bevelSegments:3,curveSegments:48,steps:1});geometry.translate(0,0,-depth/2);return mesh(geometry,material,name);};
  // Every class has a real narrow handle centered at the measured finger grip.
  rod(new THREE.Vector3(0,-.14,0),new THREE.Vector3(0,.19,0),.017,grip,'Wrapped hand grip');
  mesh(cordGeometry(-.13,.17),weaponCord,'Crossed cord binding');
  for(const y of [-.14,.18]){const cap=mesh(new THREE.CylinderGeometry(.022,.022,.012,20),gold,'Grip ferrule');cap.position.y=y;}
  if(kind==='fan'){
    const points=[[0,.14]],r=.63;
    for(let i=0;i<=16;i++){const a=-1.05+i/16*2.1;points.push([Math.sin(a)*r,.14+Math.cos(a)*r]);}
    const leafPositions=[],leafUV=[];for(let i=1;i<points.length-1;i++){for(const [x,y,z]of [[0,.14,0],[...points[i+1],(i+1)%2?.009:-.009],[...points[i],i%2?.009:-.009]]){leafPositions.push(x,y,z);leafUV.push(x+.6,y);}}
    const leaves=new THREE.BufferGeometry();leaves.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));leaves.setAttribute('uv',new THREE.Float32BufferAttribute(leafUV,2));leaves.computeVertexNormals();mesh(leaves,enamel,'Pleated crimson fan leaves');
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
    mesh(ringGeometry(),[steel,edge],'Forged ring and honed bevel');
    for(const z of [-.013,.013]){const trim=mesh(new THREE.TorusGeometry(.373,.0025,6,128),gold,'Recessed ring inlay');trim.position.set(0,.34,z);}
    for(const sign of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(sign*.31,.62);shape.quadraticCurveTo(sign*.47,.67,sign*.56,.74);shape.quadraticCurveTo(sign*.49,.52,sign*.41,.39);shape.quadraticCurveTo(sign*.37,.50,sign*.31,.62);
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.010,bevelEnabled:true,bevelThickness:.003,bevelSize:.004,bevelSegments:3,curveSegments:32});geometry.translate(0,0,-.005);mesh(geometry,steel,'Swept crescent wing');
    }
    rod(new THREE.Vector3(0,.14,0),new THREE.Vector3(-.19,.035,0),.012,gold,'Grip brace');rod(new THREE.Vector3(0,.14,0),new THREE.Vector3(.19,.035,0),.012,gold,'Grip brace');
    group.userData.tip=[.03,.81,0];
  }else{
    rod(new THREE.Vector3(0,.12,0),new THREE.Vector3(0,.58,0),.023,enamel,'Sickle haft');
    const hook=new THREE.Shape();hook.moveTo(-.025,.57);hook.quadraticCurveTo(.05,.68,.24,.68);hook.quadraticCurveTo(.43,.67,.51,.46);hook.quadraticCurveTo(.57,.23,.39,.08);hook.quadraticCurveTo(.48,.34,.32,.46);hook.quadraticCurveTo(.17,.53,.025,.48);hook.closePath();
    const hookGeometry=new THREE.ExtrudeGeometry(hook,{depth:.010,bevelEnabled:true,bevelThickness:.004,bevelSize:.006,bevelSegments:3,curveSegments:48});hookGeometry.translate(0,0,-.005);mesh(hookGeometry,[steel,edge],'Forged hooked sickle');
    const bevel=new THREE.Shape();bevel.moveTo(.025,.48);bevel.quadraticCurveTo(.17,.53,.32,.46);bevel.quadraticCurveTo(.48,.34,.39,.08);bevel.quadraticCurveTo(.50,.32,.345,.475);bevel.quadraticCurveTo(.17,.552,.025,.50);bevel.closePath();
    for(const z of [-.0093,.0093]){const sharp=new THREE.ShapeGeometry(bevel,48);sharp.translate(0,0,z);if(z<0){const index=sharp.index.array;for(let i=0;i<index.length;i+=3){const swap=index[i+1];index[i+1]=index[i+2];index[i+2]=swap;}sharp.computeVertexNormals();}mesh(sharp,edge,'Polished inner cutting bevel');}
    const fitting=mesh(new THREE.BoxGeometry(.085,.07,.04),gold,'Sickle collar');fitting.position.set(0,.53,0);
    group.userData.tip=[.45,.17,0];
  }
  batchSpecial(group);group.userData.kind=kind;group.userData.grip=[0,0,0];return group;
}
export function createWeapon(kind='odachi'){
  if(cache.has(kind))return cache.get(kind).clone();if(SPECIAL_WEAPON_KINDS.includes(kind)){const weapon=specialWeapon(kind);cache.set(kind,weapon);return weapon.clone();}const p=BLADE_PROFILES[kind];if(!p)throw new Error(`Unknown weapon kind: ${kind}`);const group=new THREE.Group(),pieces=[];
  const add=(geo,color,x,y,z,sx=1,sy=1,sz=1)=>{const g=geo.index?geo.toNonIndexed():geo.clone();g.scale(sx,sy,sz);g.translate(x,y,z);const c=new THREE.Color(color),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));pieces.push(g);geo.dispose();};
  const pole=kind==='naginata'||kind==='lancer';
  const hero=['odachi','twin','naginata'].includes(kind);
  if(hero){const core=new THREE.Mesh(new THREE.CylinderGeometry(.017,.019,pole?1.05:p.grip,16),weaponGrip);core.name='Wrapped hand grip';core.position.y=pole?-.36:.17-p.grip/2;core.castShadow=true;group.add(core);}
  else add(new THREE.CylinderGeometry(.017,.019,pole?1.05:p.grip,12),'#252b30',0,pole?-.36:.17-p.grip/2,0);
  add(new THREE.CylinderGeometry(.07,.07,.018,8),'#ae8240',0,.155,0,1.1,1,.7);
  add(new THREE.BoxGeometry(.065,.055,.025),'#b18b49',0,.192,0);
  for(let i=0;i<(hero?2:9);i++){const y=.13-i*(Math.min(p.grip,.40)-.06)/(hero?1:8);add(new THREE.TorusGeometry(.019,.0025,4,12).rotateX(Math.PI/2),'#b79a67',0,y,0,1,1,1);}
  const hardware=new THREE.Mesh(mergeGeometries(pieces),fittings);pieces.forEach(g=>g.dispose());hardware.castShadow=true;group.add(hardware);
  if(['odachi','twin','naginata'].includes(kind)){const cord=new THREE.Mesh(cordGeometry(.17-Math.min(p.grip,.40),.12),weaponCord);cord.name='Woven handle binding';cord.castShadow=true;group.add(cord);}
  const blade=new THREE.Mesh(bladeGeometry(p),[steel,edge]);blade.name='Flat steel blade';blade.castShadow=true;group.add(blade);
  group.userData.tip=[p.curve,.17+p.length,0];group.userData.kind=kind;cache.set(kind,group);return group.clone();
}
