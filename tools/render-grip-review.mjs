import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const out='artifacts/grip-review';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1100}});await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');const {WARRIORS}=await import('/src/warriors.js');
  await loadWarriorAssets();
  const scene=new T.Scene();scene.background=new T.Color('#626c75');scene.add(new T.HemisphereLight('#fff7ed','#546572',2));
  const key=new T.DirectionalLight('#fff3df',3);scene.add(key,key.target);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1800,1100);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.localClippingEnabled=true;
  document.body.style.margin='0';document.body.replaceChildren(renderer.domElement);
  const label=document.createElement('div');label.style.cssText='position:absolute;inset:0;pointer-events:none;color:white;font:22px sans-serif';document.body.append(label);
  const heroes=WARRIORS.map((_,i)=>new Warrior(i));for(const p of heroes){p.root.scale.setScalar(1);scene.add(p.root);}
  const pose=(p,name,golf=false,time=0)=>{
   p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(name,0);p.actions.get(name).time=time;p.mixer.update(0);
   p.weapon.visible=!golf;p.club.visible=golf;if(p.offhand)p.offhand.visible=!golf;p.syncHeldObjects(undefined,golf);p.root.updateMatrixWorld(true);
  };
  window.review={T,scene,key,renderer,label,heroes,WARRIORS,pose};
 });
 for(let index=0;index<6;index++){
  const name=await page.evaluate(index=>{
   const {T,scene,key,renderer,label,heroes,WARRIORS,pose}=window.review,p=heroes[index],w=WARRIORS[index];
   heroes.forEach((h,i)=>h.root.visible=i===index);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);label.innerHTML='';
   const samples=[[w.selectionClip,false,'r','Selection · palm',0],[w.selectionClip,false,'r','Selection · back',Math.PI],[w.readyClip,false,p.offhand?'l':'r','Ready · '+(p.offhand?'left':'right'),0],[w.readyClip,false,(p.offhand||index===0||index===2)?'l':'r','Ready · supporting hand',.55],['Golf_Address',true,'r','Golf · right hand',0],['Golf_Address',true,'l','Golf · left hand',0]];
   samples.forEach(([clip,golf,side,title,angle],tile)=>{
    pose(p,clip,golf,.1);const held=golf?p.club:side==='l'&&p.offhand?p.offhand:p.weapon;
    const hand=p.bones['hand_'+side],center=hand.localToWorld(p.palmGrips[side].clone()),axis=p.shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion())).normalize();
    const forward=p.bones['middle_01_'+side].getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3()));forward.addScaledVector(axis,-forward.dot(axis)).normalize();const normal=new T.Vector3().crossVectors(axis,forward).normalize().multiplyScalar(side==='r'?1:-1);
    const planes=[new T.Plane().setFromNormalAndCoplanarPoint(axis.clone().negate(),center.clone().addScaledVector(axis,.067)),new T.Plane().setFromNormalAndCoplanarPoint(axis,center.clone().addScaledVector(axis,-.065))];
    const changed=[];held.traverse(o=>{if(!o.isMesh)return;const original=o.material,mats=(Array.isArray(original)?original:[original]).map(m=>{const c=m.clone();c.clippingPlanes=planes;return c;});o.material=Array.isArray(original)?mats:mats[0];changed.push([o,original,mats]);});
    const camera=new T.OrthographicCamera(-.15,.15,.1375,-.1375,.37,.85);camera.up.copy(axis);camera.position.copy(center).addScaledVector(normal,Math.cos(angle)*.60).addScaledVector(forward,Math.sin(angle)*.60).addScaledVector(axis,.09);camera.lookAt(center);
    key.position.copy(camera.position).addScaledVector(axis,.3);key.target.position.copy(center);
    const x=(tile%3)*600,y=(1-Math.floor(tile/3))*550;renderer.setViewport(x,y,600,550);renderer.setScissor(x,y,600,550);renderer.render(scene,camera);
    for(const [object,original,mats]of changed){object.material=original;mats.forEach(m=>m.dispose());}
    const text=document.createElement('span');text.textContent=w.name+' — '+title;text.style.cssText=`position:absolute;left:${x+15}px;top:${1100-y-550+15}px;background:#273039bb;padding:6px 10px`;label.append(text);
   });return w.model;
  },index);
  await page.screenshot({path:`${out}/${name}-hands.png`});
 }
 await page.evaluate(()=>{
  const{T,scene,key,renderer,label,heroes,WARRIORS,pose}=window.review;label.innerHTML='';renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
  heroes.forEach((p,index)=>{
   heroes.forEach((h,j)=>h.root.visible=j===index);pose(p,WARRIORS[index].selectionClip);
   const camera=new T.OrthographicCamera(-1.45,1.45,2.7,-.04,.01,30);camera.position.set(0,0,10);camera.lookAt(0,0,0);key.position.set(-3,5,7);key.target.position.set(0,1,0);
   const x=(index%3)*600,y=(1-Math.floor(index/3))*550;renderer.setViewport(x,y,600,550);renderer.setScissor(x,y,600,550);renderer.render(scene,camera);
   const text=document.createElement('span');text.textContent=WARRIORS[index].name;text.style.cssText=`position:absolute;left:${x+15}px;top:${1100-y-550+15}px;background:#273039bb;padding:6px 10px`;label.append(text);
  });
 });
 await page.screenshot({path:`${out}/selection-roster.png`});
 console.log(out);
}finally{await browser.close();}
