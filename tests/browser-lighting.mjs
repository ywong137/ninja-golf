import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{SUN_DIRECTION}=await import('/src/lighting.js'),{leafTransmission}=await import('/src/foliage-materials.js'),g=window.__golfTest;
  g.frame=()=>{};g.paused=true;g.audio.pause();await g.world.waitForAssets();
  const renderer=g.renderer,size=128,target=new T.WebGLRenderTarget(size,size,{type:T.FloatType}),pixels=new Float32Array(size*size*4);
  renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(target);
  const sun=new T.Vector3(...SUN_DIRECTION),camera=new T.PerspectiveCamera(16,1,.1,100);camera.lookAt(sun);camera.updateMatrixWorld(true);
  const registration=[];
  for(let theme=0;theme<3;theme++){
   g.setCourse(theme);await g.world.waitForAssets();const scene=new T.Scene();scene.background=g.scene.background;scene.backgroundRotation.copy(g.scene.backgroundRotation);scene.backgroundIntensity=1;
   renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
   let peak=0;for(let i=0;i<pixels.length;i+=4)peak=Math.max(peak,pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722);
   let x=0,y=0,weight=0;for(let i=0;i<pixels.length;i+=4){const l=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;if(l<peak*.1)continue;const p=i/4;x+=(p%size+.5)*l;y+=(Math.floor(p/size)+.5)*l;weight+=l;}
   const light=g.world.sun.position.clone().sub(g.world.sun.target.position).normalize();
   registration.push({theme,peak,offset:Math.hypot(x/weight-size/2,y/weight-size/2),lightAgreement:light.dot(sun),waterAgreement:g.world.waterMaterial.uniforms.sunDirection.value.dot(sun)});
  }
  // Backlit leaves brighten under direct light, but a real shadow still blocks it.
  const scene=new T.Scene();scene.background=new T.Color(0);camera.position.set(0,0,4);camera.lookAt(0,0,0);camera.fov=40;camera.updateProjectionMatrix();
  const material=new T.MeshStandardMaterial({color:'#458331',side:T.DoubleSide,roughness:.9}),plane=new T.Mesh(new T.PlaneGeometry(3,3),material);plane.receiveShadow=true;scene.add(plane);
  const light=new T.DirectionalLight(0xffffff,2);light.position.set(0,0,-5);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:10});scene.add(light,light.target);
  const blocker=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:0,side:T.DoubleSide}));blocker.position.z=-1;blocker.castShadow=true;blocker.visible=false;scene.add(blocker);
  const sample=()=>{renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);let sum=0;for(let y=58;y<70;y++)for(let x=58;x<70;x++){const i=(y*size+x)*4;sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;}return sum/144;};
  const opaque=sample();leafTransmission(material);material.needsUpdate=true;const transmitted=sample();blocker.visible=true;const shadowed=sample();
  renderer.setRenderTarget(null);target.dispose();return{registration,leaf:{opaque,transmitted,shadowed}};
 });
 for(const r of result.registration){assert.ok(r.peak>10,JSON.stringify(r));assert.ok(r.offset<2,`Rendered HDR sun misses the directional sun: ${JSON.stringify(r)}`);assert.ok(r.lightAgreement>.999999&&r.waterAgreement>.999999);}
 assert.ok(result.leaf.transmitted>result.leaf.opaque+.015,JSON.stringify(result.leaf));assert.ok(result.leaf.shadowed<result.leaf.transmitted*.2,JSON.stringify(result.leaf));
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));console.log('Rendered sky/sun registration and shadow-respecting leaf transmission passed.');
}finally{await browser.close();}
