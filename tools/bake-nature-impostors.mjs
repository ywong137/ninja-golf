import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node tools/bake-nature-impostors.mjs [--tile-size=128|256|512] [--occlusion] [MODEL ...]\nBakes albedo, normal and ground-shadow atlases from existing GLBs. GAME_URL selects the dev server.');process.exit(0);}
const option=args.find(a=>a.startsWith('--tile-size=')),tileSize=option?Number(option.split('=')[1]):512;
if(![128,256,512].includes(tileSize)||args.some(a=>a.startsWith('--')&&a!==option&&a!=='--occlusion'))throw new Error('Use --tile-size=128, 256, or 512. See --help.');
const occlusion=args.includes('--occlusion'),names=args.filter(a=>a!==option&&a!=='--occlusion'),selected=names.length?names:['forest-canopy','dry-tree'];
if(selected.some(name=>!/^[-a-z0-9]+$/.test(name)))throw new Error('Model names must contain lowercase letters, digits, or hyphens.');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto((process.env.GAME_URL||'http://localhost:5173')+'/tools/tree-bake.html');await page.addScriptTag({type:'importmap',content:JSON.stringify({imports:{three:'/node_modules/three/build/three.module.js'}})});
 const result=await page.evaluate(async({selected,tileSize,occlusion})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {foliageAlphaCutoff}=await import('/src/foliage-materials.js');
  const {SUN_DIRECTION}=await import('/src/lighting.js'),shadowSlope=new T.Vector2(-SUN_DIRECTION[0]/SUN_DIRECTION[1],-SUN_DIRECTION[2]/SUN_DIRECTION[1]);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(tileSize,tileSize);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  renderer.shadowMap.enabled=occlusion;renderer.shadowMap.type=T.PCFShadowMap;
  const light=new T.DirectionalLight(0xffffff,1);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0001;
  const scene=new T.Scene();if(occlusion){scene.add(light,light.target);}
  const output=[],angles=8,elevations=[0,Math.PI/6,Math.PI/3];
  const encode=async(canvas,type='image/webp',quality=.96)=>Array.from(new Uint8Array(await(await new Promise(resolve=>canvas.toBlob(resolve,type,quality))).arrayBuffer()));
  for(const name of selected){
   renderer.setSize(tileSize,tileSize);
   const model=(await new GLTFLoader().loadAsync('/models/nature/'+name+'.glb')).scene,meshes=[];model.traverse(o=>{if(!o.isMesh)return;if(o.name.startsWith('LOD1')){o.visible=false;return;}meshes.push(o);const original=o.material;o.userData.albedo=new T.MeshBasicMaterial({map:original.map,color:original.color,alphaTest:original.transparent?foliageAlphaCutoff(name):original.alphaTest,side:T.DoubleSide});// Keep the source normal maps: leaf cards alone have flat plane normals.
   const normals=original.clone();normals.transparent=false;normals.alphaTest=o.userData.albedo.alphaTest;normals.side=T.DoubleSide;
   normals.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', 'gl_FragColor=vec4(inverseTransformDirection(normal,viewMatrix)*.5+.5,diffuseColor.a);');};
   normals.customProgramCacheKey=()=> 'world-normal-atlas-v1';o.userData.normals=normals;
   if(occlusion){
    const previous=o.userData.albedo,albedo=original.clone();albedo.transparent=false;albedo.side=T.DoubleSide;albedo.alphaTest=previous.alphaTest;previous.dispose();
    albedo.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>').replace('#include <opaque_fragment>', 'gl_FragColor=vec4(diffuseColor.rgb*(.18+.82*getShadowMask()),diffuseColor.a);');};
    albedo.customProgramCacheKey=()=> 'ambient-visibility-albedo-v1';o.userData.albedo=albedo;o.castShadow=true;o.receiveShadow=true;
   }});scene.add(model);model.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),span=size.length()*1.04;
   if(occlusion){light.target.position.set(0,center.y,0);const s=light.shadow.camera;s.left=s.bottom=-span*.6;s.right=s.top=span*.6;s.near=.1;s.far=span*6;s.updateProjectionMatrix();}
   const camera=new T.OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,100),atlases={};
   for(const mode of ['albedo','normals']){
    const atlas=document.createElement('canvas');atlas.width=angles*tileSize;atlas.height=elevations.length*tileSize;const ctx=atlas.getContext('2d');meshes.forEach(o=>o.material=o.userData[mode]);renderer.outputColorSpace=mode==='albedo'?T.SRGBColorSpace:T.LinearSRGBColorSpace;
    for(let row=0;row<elevations.length;row++)for(let view=0;view<angles;view++){const angle=view*Math.PI*2/angles,elevation=elevations[row];camera.position.set(Math.sin(angle)*Math.cos(elevation)*40,center.y+Math.sin(elevation)*40,Math.cos(angle)*Math.cos(elevation)*40);camera.lookAt(0,center.y,0);
     if(mode==='albedo'&&occlusion){
      // Average unoccluded light directions in linear space. This adds cavity
      // darkness without baking a fixed sun direction into every rotated shrub.
      const samples=18,sum=new Float32Array(tileSize*tileSize*4),sampleCanvas=document.createElement('canvas');sampleCanvas.width=sampleCanvas.height=tileSize;const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
      for(let i=0;i<samples;i++){
       const y=(i+.5)/samples,azimuth=i*2.399963229728653,radius=Math.sqrt(1-y*y);
       light.position.set(Math.cos(azimuth)*radius*span*3,center.y+y*span*3,Math.sin(azimuth)*radius*span*3);renderer.render(scene,camera);sampleContext.clearRect(0,0,tileSize,tileSize);sampleContext.drawImage(renderer.domElement,0,0);const rgba=sampleContext.getImageData(0,0,tileSize,tileSize).data;
       for(let p=0;p<rgba.length;p+=4){for(let k=0;k<3;k++){const v=rgba[p+k]/255;sum[p+k]+=v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}sum[p+3]+=rgba[p+3];}
      }
      const result=sampleContext.createImageData(tileSize,tileSize);for(let p=0;p<sum.length;p+=4){for(let k=0;k<3;k++){const v=sum[p+k]/samples;result.data[p+k]=255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055);}result.data[p+3]=sum[p+3]/samples;}ctx.putImageData(result,view*tileSize,row*tileSize);
     }else{renderer.render(scene,camera);ctx.drawImage(renderer.domElement,view*tileSize,row*tileSize);} }
    atlases[mode]=await encode(atlas);
   }
   // Project the actual crown and trunk onto the ground under the game's fixed sun.
   renderer.setSize(512,512);
   const shadowAtlas=document.createElement('canvas');shadowAtlas.width=2048;shadowAtlas.height=1024;const context=shadowAtlas.getContext('2d'),shadowViews=[];
   renderer.outputColorSpace=T.LinearSRGBColorSpace;
   for(const o of meshes){const original=o.userData.albedo;o.material=new T.ShaderMaterial({side:T.DoubleSide,depthTest:false,depthWrite:false,uniforms:{map:{value:original.map},cutoff:{value:original.alphaTest},shadowSlope:{value:shadowSlope}},vertexShader:'uniform vec2 shadowSlope;varying vec2 vUv;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);p.xz+=p.y*shadowSlope;p.y=0.;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'uniform sampler2D map;uniform float cutoff;varying vec2 vUv;void main(){if(texture2D(map,vUv).a<cutoff)discard;gl_FragColor=vec4(1.);}'});}
   for(let view=0;view<angles;view++){
    model.rotation.y=view*Math.PI*2/angles;model.updateMatrixWorld(true);const b=new T.Box2();for(const o of meshes){const pos=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);b.expandByPoint(new T.Vector2(v.x+v.y*shadowSlope.x,v.z+v.y*shadowSlope.y));}}b.expandByScalar(.6);
    const w=b.max.x-b.min.x,h=b.max.y-b.min.y,cx=(b.min.x+b.max.x)/2,cz=(b.min.y+b.max.y)/2;const shadowCamera=new T.OrthographicCamera(-w/2,w/2,h/2,-h/2,.1,100);shadowCamera.position.set(cx,40,cz);shadowCamera.up.set(0,0,-1);shadowCamera.lookAt(cx,0,cz);renderer.render(scene,shadowCamera);context.drawImage(renderer.domElement,(view%4)*512,Math.floor(view/4)*512);shadowViews.push([b.min.x,b.min.y,b.max.x,b.max.y]);
   }
   output.push({name,span,center:center.y,columns:angles,rows:elevations.length,elevations,shadowViews,...atlases,shadow:await encode(shadowAtlas)});scene.remove(model);meshes.forEach(o=>{o.geometry.dispose();o.material.dispose();o.userData.albedo.dispose();o.userData.normals.dispose();});
  }
  renderer.dispose();return output;
 },{selected,tileSize,occlusion});
 if(errors.length)throw new Error('Atlas baking failed: '+errors.join('\n'));
 const metadata=JSON.parse(readFileSync('src/nature-views.json','utf8'));for(const {name,albedo,normals,shadow,...data}of result){for(const [kind,bytes]of Object.entries({views:albedo,normals,shadow})){writeFileSync(`public/models/nature/${name}-${kind}.webp`,Buffer.from(bytes));console.log(name,kind,bytes.length);}metadata[name]=data;}writeFileSync('src/nature-views.json',JSON.stringify(metadata));
}finally{await browser.close();}
