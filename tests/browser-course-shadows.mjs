import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const output='/tmp/ninja-course-shadows';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const measurements=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{SUN_DIRECTION}=await import('/src/lighting.js'),{canopyShadowMaterial,foliageEye,TREE_DETAIL}=await import('/src/foliage-materials.js'),{TREE_SPECIES}=await import('/src/nature-species.js');
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.pause();await g.world.waitForAssets();
  if(!g.world.sun.isSunLight)throw Error('The course must use camera-fitted sunlight.');
  const renderer=g.renderer,scene=new T.Scene(),sun=g.world.sun.clone(),size=640;
  const target=new T.WebGLRenderTarget(size,size,{type:T.FloatType}),pixels=new Float32Array(size*size*4);
  const saved={target:renderer.getRenderTarget(),tone:renderer.toneMapping,eye:foliageEye.value.clone()};
  renderer.toneMapping=T.NoToneMapping;scene.add(sun,new T.HemisphereLight(0xffffff,0x555555,.5));scene.background=new T.Color(0xffffff);
  const floor=new T.Mesh(new T.PlaneGeometry(2000,2000),new T.MeshStandardMaterial({color:0xaaaaaa,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const caster=new T.Mesh(new T.BoxGeometry(2,12,2),new T.MeshStandardMaterial({color:0xaaaaaa}));caster.castShadow=true;caster.position.y=6;scene.add(caster);
  const camera=new T.PerspectiveCamera(48,1,.4,1000);camera.up.set(0,0,-1);
  const mean=(position)=>{const ndc=position.clone().project(camera),cx=Math.round((ndc.x*.5+.5)*size),cy=Math.round((ndc.y*.5+.5)*size);let total=0;for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){const i=(y*size+x)*4;total+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;}return total/9;};
  const shadowPoint=new T.Vector3(-SUN_DIRECTION[0]/SUN_DIRECTION[1]*6,0,-SUN_DIRECTION[2]/SUN_DIRECTION[1]*6),rows=[];
  try{
   // The same real caster must shade receivers in both cascades, after a long
   // camera translation, and with the off-centre portrait projection in use.
   for(const [height,offset,portrait]of [[20,0,false],[90,0,false],[200,0,false],[250,0,false],[90,450,false],[20,450,true]]){
    caster.position.x=offset;floor.position.x=offset;camera.position.set(offset,height,0);camera.lookAt(offset,0,0);
    if(portrait)camera.setViewOffset(1280,640,320,0,640,640);else camera.clearViewOffset();camera.updateMatrixWorld(true);
    renderer.setRenderTarget(target);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
    const shadow=mean(shadowPoint.clone().add(new T.Vector3(offset,0,0))),lit=mean(new T.Vector3(offset-4,0,-4));
    rows.push({height,offset,portrait,shadow,lit,ratio:shadow/lit,cascades:sun.shadow.getViewportCount(),map:[sun.shadow.map.width,sun.shadow.map.height]});
   }
   // Measure the actual canopy shader at each species' transition endpoints.
   const map=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);map.needsUpdate=true;
   const canopyScene=new T.Scene();canopyScene.background=new T.Color(0xffffff);const quad=new T.PlaneGeometry(2,2);
   quad.setAttribute('treeAnchor',new T.Float32BufferAttribute(Array(quad.attributes.position.count).fill([0,12,0]).flat(),3));
   const canopyCamera=new T.OrthographicCamera(-1,1,1,-1,.1,10);canopyCamera.position.z=2;canopyCamera.updateMatrixWorld();
   const fades=[];
   for(const [name,{detail=TREE_DETAIL}]of Object.entries(TREE_SPECIES)){
    const material=canopyShadowMaterial(map,false,detail),mesh=new T.Mesh(quad,material);canopyScene.add(mesh);const levels=[];
    for(const t of [0,.5,1]){
     // A high survey camera must use the same vertical term as tree geometry.
     foliageEye.value.set(0,17+detail.farStart+(detail.farEnd-detail.farStart)*t,0);
     renderer.render(canopyScene,canopyCamera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);const i=(320*size+320)*4;levels.push(pixels[i]);
    }
    fades.push({name,levels});canopyScene.remove(mesh);material.dispose();
   }
   quad.dispose();map.dispose();return{rows,fades};
  }finally{
   renderer.setRenderTarget(saved.target);renderer.toneMapping=saved.tone;foliageEye.value.copy(saved.eye);sun.dispose();floor.geometry.dispose();floor.material.dispose();caster.geometry.dispose();caster.material.dispose();target.dispose();
  }
 });
 for(const row of measurements.rows){assert.equal(row.cascades,2);assert.deepEqual(row.map,[4096,2048]);assert.ok(row.lit>.15&&row.ratio<.65,`Sun shadow missing: ${JSON.stringify(row)}`);}
 for(const {name,levels:[near,mid,far]}of measurements.fades){assert.ok(near>.99&&mid<near-.1&&far<mid-.1,`Canopy shadow does not follow the geometry fade: ${name}`);}
 await page.addStyleTag({content:'#app > :not(#game){visibility:hidden!important}'});
 const views=[];
 for(let theme=0;theme<4;theme++){
  const view=await page.evaluate(async theme=>{
   const g=window.__golfTest,{heightAt}=await import('/src/course.js');g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;g.portraitLights.visible=false;
   const site=g.world.root.userData.landmarks[0],y=heightAt(g.course,site.x,site.z);g.camera.clearViewOffset();g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(site.x+48,y+20,site.z+55);g.camera.lookAt(site.x+8,y+4,site.z+8);
   g.world.update(12.5,0,g.player.root.position,g.camera.position);g.rendering.render('balanced');g.rendering.render('balanced');
   const anchors=[];g.world.root.traverse(o=>{if(o.geometry?.attributes.treeAnchor)anchors.push(o.geometry.attributes.treeAnchor.itemSize);});
   return{theme,site,camera:g.camera.position.toArray(),hero:g.player.root.position.toArray(),direction:g.world.sun.position.toArray(),anchors,calls:g.renderer.info.render.calls};
  },theme);
  assert.ok(view.anchors.every(size=>size===3));views.push(view);await page.screenshot({path:`${output}/${theme}-landmark.png`});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({measurements,views,errors},null,2));console.log(JSON.stringify(measurements,null,2));
 console.log('Near and far sunlight, translated and portrait cameras, canopy transitions, and four course landmarks passed.');
}finally{await browser.close();}
