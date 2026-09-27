import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try {
 const page=await browser.newPage();await page.goto('http://localhost:5173/tools/tree-bake.html');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(1024,1024);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),light=new T.DirectionalLight('#ffedd0',3);light.position.set(-100,95,-100);scene.add(light,new T.HemisphereLight('#d7e6e4','#777a49',.8));
  const {HDRLoader}=await import('/node_modules/three/examples/jsm/loaders/HDRLoader.js');const hdr=await new HDRLoader().loadAsync('/textures/coastal-sky.hdr');const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=.52;
  const output=[];
  for(const name of ['coastal-pine','windswept-pine','garden-oak','garden-ash']){
   const model=(await new GLTFLoader().loadAsync('/models/vegetation/'+name+'.glb')).scene;model.traverse(o=>{if(o.isMesh&&o.material.alphaTest>0)o.material.alphaTest=.4;});scene.add(model);model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),span=Math.max(size.y,Math.hypot(size.x,size.z))*1.06;
   const camera=new T.OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,100);const atlas=document.createElement('canvas');atlas.width=4096;atlas.height=2048;const ctx=atlas.getContext('2d');
   for(let view=0;view<8;view++){const angle=view*Math.PI/4;camera.position.set(Math.sin(angle)*35,center.y,Math.cos(angle)*35);camera.lookAt(0,center.y,0);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,(view%4)*1024,Math.floor(view/4)*1024);}
   const blob=await new Promise(resolve=>atlas.toBlob(resolve,'image/webp',.92));output.push({name,span,center:center.y,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});scene.remove(model);
  }
  renderer.dispose();return output;
 });
 const metadata={};for(const {name,span,center,bytes}of result){writeFileSync(`public/models/vegetation/${name}-views.webp`,Buffer.from(bytes));metadata[name]={span,center};console.log(name,bytes.length);}writeFileSync('src/tree-views.json',JSON.stringify(metadata));
}finally{await browser.close();}
