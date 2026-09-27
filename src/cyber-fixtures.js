import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const CYBER_FIXTURES=Object.freeze({
 bollard:Object.freeze({height:1.55,width:.64,depth:.58,radius:.46}),
 cover:Object.freeze({height:1.50,width:1.24,depth:.70,radius:.75}),
});
const batches=new WeakMap();
function stateFor(root){
 let state=batches.get(root);if(state&&(!state.meshes[0]||state.meshes[0].parent===root))return state;
 const shell=new THREE.MeshStandardMaterial({color:'#26303b',metalness:.58,roughness:.54});shell.name='Fixture powder-coated steel';
 const trim=new THREE.MeshStandardMaterial({color:'#829099',metalness:.72,roughness:.38});trim.name='Fixture brushed hardware';
 const light=new THREE.MeshStandardMaterial({color:'#bfdfdf',emissive:'#68b6c2',emissiveIntensity:.45,roughness:.62,metalness:.05});light.name='Fixture recessed diffuser';
 state={materials:[shell,trim,light],pending:[[],[],[]],meshes:[null,null,null]};batches.set(root,state);return state;
}
// Beveled shell dimensions include the bevel, preserving published collision bounds.
function chamferedBox(width,height,depth,bevel=.025){
 const shape=new THREE.Shape(),w=width/2-bevel,h=height/2-bevel;
 shape.moveTo(-w,-h);shape.lineTo(w,-h);shape.lineTo(w,h);shape.lineTo(-w,h);shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-bevel*2,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});geometry.translate(0,0,-depth/2+bevel);geometry.clearGroups();return geometry;
}
export function queueCyberFixture(root,{x,y,z,kind='bollard',yaw=0}){
 const spec=CYBER_FIXTURES[kind];if(!spec)throw Error(`Unknown cyber fixture: ${kind}`);
 const state=stateFor(root),matrix=new THREE.Matrix4().makeRotationY(yaw);matrix.setPosition(x,y,z);
 const add=(g,material,px,py,pz)=>{const geometry=g.index?g.toNonIndexed():g;geometry.translate(px,py,pz).applyMatrix4(matrix);state.pending[material].push(geometry);if(geometry!==g)g.dispose();};
 const box=(material,px,py,pz,w,h,d,bevel=0)=>add(bevel?chamferedBox(w,h,d,bevel):new THREE.BoxGeometry(w,h,d),material,px,py,pz);
 const {width:w,depth:d,height:h}=spec;
 box(0,0,.025,0,w,.15,d,.022); // Buried plinth, with the top above ground.
 box(1,0,.115,0,w-.07,.045,d-.07,.012);
 box(0,0,(h+.18)/2,0,w-.14,h-.18,d-.14,.035);
 box(1,0,h-.045,0,w-.06,.09,d-.06,.02);
 const panelH=kind==='cover'?.39:.36,panelW=w-.24,panelY=h-.40,panelZ=(d-.14)/2;
 for(const side of [-1,1]){
  box(1,0,panelY,side*(panelZ+.015),panelW+.065,panelH+.065,.025,.008);
  box(0,0,panelY,side*(panelZ+.033),panelW+.025,panelH+.025,.015);
  box(2,0,panelY,side*(panelZ+.044),panelW-.025,panelH-.025,.008);
  // Narrow protective louvers shade the diffuser without a bright exposed cap.
  for(const offset of [-.10,0,.10])box(0,0,panelY+offset,side*(panelZ+.061),panelW+.04,.018,.035);
  box(1,0,.48,side*(panelZ+.006),w-.26,.36,.016,.007);
  box(0,0,.48,side*(panelZ+.017),w-.30,.32,.014);
  for(const offset of [-.085,-.025,.035,.095])box(1,0,.48+offset,side*(panelZ+.025),w-.36,.012,.008);
 }
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const fastener=new THREE.CylinderGeometry(.022,.022,.012,6);add(fastener,1,sx*(w/2-.055),.154,sz*(d/2-.055));
 }
 (root.userData.cyberFixtures??=[]).push({kind,x,y,z,yaw,...spec});
 return spec;
}
// Both theme builders append to the same three static batches on this root.
export function flushCyberFixtures(root){
 const state=batches.get(root);if(!state)return;
 for(let i=0;i<3;i++){
  const pending=state.pending[i];if(!pending.length)continue;
  const mesh=state.meshes[i],parts=mesh?[mesh.geometry,...pending]:pending,geometry=mergeGeometries(parts);if(!geometry)throw Error('Cyber fixture geometry attributes do not match');
  for(const part of parts)part.dispose();state.pending[i]=[];
  if(mesh)mesh.geometry=geometry;else{const created=new THREE.Mesh(geometry,state.materials[i]);created.name='Cyber course fixtures';created.castShadow=i!==2;created.receiveShadow=true;created.userData.cyberFixtureBatch=true;created.userData.architectureTheme='cyberpunk';root.add(created);state.meshes[i]=created;}
 }
}
