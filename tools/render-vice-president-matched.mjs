#!/usr/bin/env node
// Render the current head through fitted reference cameras. No photograph is embedded.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
const {values}=parseArgs({options:{model:{type:'string'},fit:{type:'string'},output:{type:'string'},material:{type:'string',default:'original'},lighting:{type:'string',default:'portrait'},expression:{type:'string',default:'neutral'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/render-vice-president-matched.mjs --model MODEL.glb --fit CAMERA_FIT.json --output /tmp/prefix [--material original|unlit|clay|no-normal|no-ao] [--lighting portrait|rake] [--expression neutral|musou]\nRender one image per fitted reference camera in isolated muted Chrome. Reuse the baseline fit for before/after comparisons. Material modes affect only the native head. Musou applies the production facial pose while retaining the same head pose and camera.');process.exit(0);}
if(!values.model||!values.fit||!values.output)throw Error('Supply --model, --fit, and --output. See --help.');
if(!['original','unlit','clay','no-normal','no-ao'].includes(values.material))throw Error('Unknown --material. See --help.');
if(!['portrait','rake'].includes(values.lighting))throw Error('Use --lighting portrait or rake.');
if(!['neutral','musou'].includes(values.expression))throw Error('Use --expression neutral or musou.');
const fit=JSON.parse(fs.readFileSync(values.fit)),browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage();await page.route('**/models/monk.glb*',route=>route.fulfill({path:path.resolve(values.model)}));await page.route('**/@vite/client',route=>route.fulfill({body:'',contentType:'application/javascript'}));
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 await page.evaluate(async({materialMode,lighting,expression})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{WARRIORS}=await import('/src/warriors.js'),{awaitCharacterMaterials}=await import('/src/character-materials.js');await loadWarriorAssets();await awaitCharacterMaterials();
  const index=WARRIORS.findIndex(w=>w.model==='monk'),actor=new Warrior(index);actor.root.scale.setScalar(1);actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play(WARRIORS[index].selectionClip,0);actor.mixer.update(.1);actor.weapon.visible=false;actor.club.visible=false;actor.root.updateMatrixWorld(true);
  if(expression==='musou'){
   if(!actor.facialPose)throw Error('The Ethan actor has no production facial pose.');
   for(let frame=0;frame<90;frame++){actor.facialPose.restore();actor.facialPose.apply(1/60,{gazeYaw:0,gazePitch:0,exertion:1,musou:1});}
   actor.root.updateMatrixWorld(true);
  }
  actor.root.traverse(o=>{if(!o.isMesh)return;const change=mat=>{if(mat.name!=='m009_head'||materialMode==='original')return mat;if(materialMode==='unlit')return new T.MeshBasicMaterial({name:mat.name,map:mat.map,color:mat.color,side:mat.side});if(materialMode==='clay')return new T.MeshStandardMaterial({name:mat.name,color:'#b9b9b9',roughness:.8,metalness:0,side:mat.side});const copy=mat.clone();if(materialMode==='no-normal')copy.normalMap=null;if(materialMode==='no-ao')copy.aoMap=null;copy.needsUpdate=true;return copy;};o.material=Array.isArray(o.material)?o.material.map(change):change(o.material);});
  const scene=new T.Scene();scene.background=new T.Color('#777c82');scene.add(actor.root);scene.add(new T.HemisphereLight('#fff5e9','#77838b',lighting==='rake' ? .7 : 1.8));const key=new T.DirectionalLight('#ffffff',2.6);key.position.set(...(lighting==='rake'?[-4,2,1]:[-2,4,4]));scene.add(key);const fill=new T.DirectionalLight('#d8e7ff',lighting==='rake' ? .25 : 1);fill.position.set(3,2,-1);scene.add(fill);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);window.study={T,actor,scene,renderer};
 },{materialMode:values.material,lighting:values.lighting,expression:values.expression});
 const outputs=[];
 for(const photo of fit.photos){
  await page.setViewportSize({width:photo.width,height:photo.height});
  await page.evaluate(({photo,origin})=>{
   const {T,scene,renderer}=window.study,{best,width,height}=photo,camera=new T.PerspectiveCamera(),vector=new T.Vector3().fromArray(best.rotationVector),angle=vector.length();
   const R=new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromAxisAngle(vector.normalize(),angle)),t=new T.Vector3().fromArray(best.translation).sub(new T.Vector3().fromArray(origin).applyMatrix4(R));R.setPosition(t);
   camera.matrixWorld.copy(new T.Matrix4().makeScale(1,-1,-1).multiply(R).invert());camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);camera.updateMatrixWorld(true);
   const near=.01,far=30,f=best.focalPixels,cx=best.cameraMatrix[0][2],cy=best.cameraMatrix[1][2];camera.projectionMatrix.makePerspective(-cx*near/f,(width-cx)*near/f,cy*near/f,-(height-cy)*near/f,near,far);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
   renderer.setSize(width,height);renderer.render(scene,camera);
  },{photo,origin:fit.modelOrigin});
  const output=values.output+'-'+path.basename(photo.file,'.json')+'.png';await page.screenshot({path:output});outputs.push(output);
 }
 console.log(JSON.stringify({model:values.model,fit:values.fit,material:values.material,expression:values.expression,outputs}));
}finally{await browser.close();}
