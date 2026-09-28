import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
// Usage: node tools/render-vice-president.mjs [candidate.glb] [output-prefix]
if(process.argv.includes('--help')){console.log('Usage: node tools/render-vice-president.mjs [candidate.glb] [output-prefix]\nRender three level-camera portraits in muted Chrome. Defaults: public/models/monk.glb, /tmp/vice-president-portrait. Vite must run on port 5173.');process.exit(0);}
const candidate=process.argv[2]||'public/models/monk.glb',out=process.argv[3]||'/tmp/vice-president-portrait';
if(!fs.existsSync(candidate))throw new Error(`Character model does not exist: ${candidate}`);
fs.mkdirSync(path.dirname(out),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
const page=await browser.newPage({viewport:{width:1800,height:900}});await page.route('**/models/monk.glb*',route=>route.fulfill({body:fs.readFileSync(candidate),contentType:'model/gltf-binary'}));
await page.route('**/@vite/client',route=>route.fulfill({body:'',contentType:'application/javascript'}));
await page.goto('http://localhost:5173/tests/rig-stage.html');
await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const {Warrior,loadWarriorAssets}=await import('/src/actors.js');const {WARRIORS}=await import('/src/warriors.js');const{awaitCharacterMaterials}=await import('/src/character-materials.js');await loadWarriorAssets();await awaitCharacterMaterials();const index=WARRIORS.findIndex(w=>w.model==='monk');const p=new Warrior(index);p.root.scale.setScalar(1);p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(WARRIORS[index].selectionClip,0);p.mixer.update(.1);p.weapon.visible=false;p.club.visible=false;p.root.updateMatrixWorld(true);
 const scene=new T.Scene();scene.background=new T.Color('#777c82');scene.add(p.root);scene.add(new T.HemisphereLight('#fff5e9','#77838b',1.8));const key=new T.DirectionalLight('#ffffff',2.6);key.position.set(-2,4,4);scene.add(key);const fill=new T.DirectionalLight('#d8e7ff',1);fill.position.set(3,2,-1);scene.add(fill);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1800,900);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);renderer.setScissorTest(true);
 const eyeR=p.bones.Bip01_REye.getWorldPosition(new T.Vector3()),eyeL=p.bones.Bip01_LEye.getWorldPosition(new T.Vector3()),eye=eyeR.clone().add(eyeL).multiplyScalar(.5),right=new T.Vector3(1,0,0),up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1),target=eye.clone().addScaledVector(up,-.014);for(let i=0;i<3;i++){const camera=new T.PerspectiveCamera(40,600/900,.01,20),angle=[0,.6,1.45][i];camera.up.copy(up);camera.position.copy(target).addScaledVector(right,Math.sin(angle)*.72).addScaledVector(forward,Math.cos(angle)*.72);camera.lookAt(target);renderer.setViewport(i*600,0,600,900);renderer.setScissor(i*600,0,600,900);renderer.render(scene,camera);}
 window.study={T,p,scene,renderer};
});await page.screenshot({path:out+'.png'});
console.log(out+'.png');
}finally{await browser.close();}
