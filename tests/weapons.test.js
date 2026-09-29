import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWeapon,bladeGeometry,BLADE_PROFILES} from '../src/weapons.js';

test('Weapon refinements preserve reach and bounded rendering cost',()=>{
 const tips={fan:[0,.86,0],ring:[.03,.81,0],sickle:[.45,.17,0]};
 for(const kind of ['odachi','twin','naginata','jian','dao','wakizashi','fan','ring','sickle','scout','guard','lancer','skirmisher']){
  const weapon=createWeapon(kind),profile=BLADE_PROFILES[kind];
  assert.deepEqual(weapon.position.toArray(),[0,0,0]);assert.deepEqual(weapon.userData.tip,tips[kind]||[0-profile.curve,.17+profile.length,0]);
  let draws=0,triangles=0;weapon.traverse(mesh=>{if(!mesh.isMesh)return;draws+=Array.isArray(mesh.material)?mesh.geometry.groups.length:1;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;for(const attribute of ['position','normal'])assert.ok([...mesh.geometry.attributes[attribute].array].every(Number.isFinite),`${kind}: finite ${attribute}`);});
  assert.ok(draws<=7,`${kind}: too many material draws`);assert.ok(triangles<10000,`${kind}: excessive decorative geometry`);
 }
});

test('Curved blades sweep away from their leading cutting edge and their trail marker matches the mesh',()=>{
 for(const kind of ['odachi','twin','naginata','dao','wakizashi','scout','guard','lancer','skirmisher']){
  const weapon=createWeapon(kind),blade=weapon.getObjectByName('Flat steel blade').geometry,p=blade.attributes.position,n=blade.attributes.normal,sections=new Map();
  for(let i=0;i<p.count;i++){
   const y=p.getY(i),row=sections.get(y)??{min:Infinity,max:-Infinity};row.min=Math.min(row.min,p.getX(i));row.max=Math.max(row.max,p.getX(i));sections.set(y,row);
  }
  const rows=[...sections].sort(([a],[b])=>a-b),centers=rows.map(([,r])=>(r.min+r.max)/2);
  for(let i=1;i<centers.length;i++)assert.ok(centers[i]<centers[i-1],`${kind}: curvature hooks toward the cutting edge`);
  const edge=blade.groups.find(g=>g.materialIndex===1);let edgeX=0;for(let i=edge.start;i<edge.start+edge.count;i++)edgeX+=n.getX(i);
  assert.ok(edgeX>0,`${kind}: cutting bevel must lead toward +X`);
  const tip=weapon.userData.tip;assert.ok(Math.abs(tip[0]-centers.at(-1))<1e-6&&Math.abs(tip[1]-rows.at(-1)[0])<1e-6,`${kind}: effects tip leaves the actual blade`);
 }
 const straight=bladeGeometry(BLADE_PROFILES.jian).boundingBox;assert.ok(Math.abs(straight.min.x+straight.max.x)<1e-8,'The straight, double-edged jian stays symmetric');
});

test('Forged faces point outward and retain distinct sharpened bevels',()=>{
 const blade=bladeGeometry(BLADE_PROFILES.odachi),normal=blade.getAttribute('normal');
 assert.equal(blade.groups.length,2);assert.ok([...normal.array].filter((v,i)=>i%3===2&&v>.97).length>100,'Front face stays flat');assert.ok([...normal.array].filter((v,i)=>i%3===2&&v<-.97).length>100,'Back face stays flat');
 const ring=createWeapon('ring').getObjectByName('Forged ring and honed bevel').geometry,p=ring.getAttribute('position'),n=ring.getAttribute('normal');let front=0,back=0;
 for(let i=0;i<p.count;i++){if(p.getZ(i)>.0119&&n.getZ(i)>.99)front++;if(p.getZ(i)<-.0119&&n.getZ(i)<-.99)back++;}
 assert.ok(front>100&&back>100,'Both ring faces have outward winding');
});

test('Steel has surface variation and grip cord remains nonmetallic',()=>{
 const weapon=createWeapon('fan'),materials=[];weapon.traverse(o=>{if(o.isMesh)materials.push(...(Array.isArray(o.material)?o.material:[o.material]));});
 const cord=materials.find(m=>m.name==='Woven grip cord');assert.equal(cord.metalness,0);assert.ok(cord.roughness>.8);
 const steel=createWeapon('odachi').getObjectByName('Flat steel blade').material[0],pixels=steel.roughnessMap.image.data;
 assert.ok(new Set(pixels).size>8,'Brushed steel roughness varies across its surface');assert.ok(steel.map,'Surface wear must appear on actual material');
});
