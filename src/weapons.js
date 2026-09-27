import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const cache=new Map();
const steel=new THREE.MeshStandardMaterial({color:'#aebfc4',metalness:1,roughness:.24});
const edge=new THREE.MeshStandardMaterial({color:'#f0f3f2',metalness:.95,roughness:.13});
const fittings=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.38});
export const BLADE_PROFILES={odachi:{length:1.40,width:.16,curve:.16,grip:.34},twin:{length:.94,width:.13,curve:.12,grip:.25},naginata:{length:1.10,width:.22,curve:.22,grip:.48},scout:{length:.64,width:.095,curve:.06,grip:.20},guard:{length:1.12,width:.18,curve:.13,grip:.31},lancer:{length:.72,width:.16,curve:.14,grip:.50},skirmisher:{length:.34,width:.10,curve:.025,grip:.15}};
export function bladeGeometry(profile){
  const positions=[],indices=[],groups=[];const N=32;
  // Wide flat faces, a narrow sharpened bevel, and a blunt back. Width greatly exceeds thickness.
  for(let i=0;i<=N;i++){const t=i/N,y=.17+t*profile.length,curve=profile.curve*t*t;const tip=Math.max(.015,Math.min(1,(1-t)/.10)),w=profile.width*.5*(1-t*.20)*tip;const z=.007*(.9-t*.35)*tip;
    for(const [x,depth]of [[-w,-z],[-w,z],[w*.65,z],[w,0],[w*.65,-z]])positions.push(curve+x,y,depth);
  }
  for(const sides of [[0,1,4],[2,3]]){const start=indices.length;for(const side of sides)for(let i=0;i<N;i++){const a=i*5+side,b=i*5+(side+1)%5;indices.push(a,b,a+5,b,b+5,a+5);}groups.push([start,indices.length-start,groups.length]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);groups.forEach(v=>g.addGroup(...v));g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function createWeapon(kind='odachi'){
  if(cache.has(kind))return cache.get(kind).clone();const p=BLADE_PROFILES[kind],group=new THREE.Group(),pieces=[];
  const add=(geo,color,x,y,z,sx=1,sy=1,sz=1)=>{const g=geo.index?geo.toNonIndexed():geo.clone();g.scale(sx,sy,sz);g.translate(x,y,z);const c=new THREE.Color(color),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.deleteAttribute('uv');pieces.push(g);geo.dispose();};
  const pole=kind==='naginata'||kind==='lancer';
  add(new THREE.CylinderGeometry(.022,.025,pole?1.05:p.grip,12),'#252b30',0,pole?-.36:.17-p.grip/2,0);
  add(new THREE.CylinderGeometry(.07,.07,.018,8),'#ae8240',0,.155,0,1.1,1,.7);
  add(new THREE.BoxGeometry(.065,.055,.025),'#b18b49',0,.192,0);
  for(let i=0;i<9;i++){const y=.11-i*.028;add(new THREE.TorusGeometry(.024,.0035,4,12).rotateX(Math.PI/2),'#b79a67',0,y,0,1,1,1);}
  const hardware=new THREE.Mesh(mergeGeometries(pieces),fittings);pieces.forEach(g=>g.dispose());hardware.castShadow=true;group.add(hardware);
  const blade=new THREE.Mesh(bladeGeometry(p),[steel,edge]);blade.name='Flat steel blade';blade.castShadow=true;group.add(blade);
  group.userData.tip=[p.curve,.17+p.length,0];group.userData.kind=kind;cache.set(kind,group);return group.clone();
}
