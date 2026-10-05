import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
const names=process.argv.slice(2);const selected=names.length?names:['forest-canopy','dry-tree'];
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try {
 const page=await browser.newPage();await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto((process.env.GAME_URL||'http://localhost:5173')+'/tools/tree-bake.html');await page.addScriptTag({type:'importmap',content:JSON.stringify({imports:{three:'/node_modules/three/build/three.module.js'}})});
 const result=await page.evaluate(async(selected)=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {foliageAlphaCutoff}=await import('/src/foliage-materials.js');
  const {SUN_DIRECTION}=await import('/src/lighting.js'),shadowSlope=new T.Vector2(-SUN_DIRECTION[0]/SUN_DIRECTION[1],-SUN_DIRECTION[2]/SUN_DIRECTION[1]);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),output=[],angles=8,elevations=[0,Math.PI/6,Math.PI/3];
  const encode=async(canvas,type='image/webp',quality=.96)=>Array.from(new Uint8Array(await(await new Promise(resolve=>canvas.toBlob(resolve,type,quality))).arrayBuffer()));
  for(const name of selected){
   const model=(await new GLTFLoader().loadAsync('/models/nature/'+name+'.glb')).scene,meshes=[];model.traverse(o=>{if(!o.isMesh)return;if(o.name.startsWith('LOD1')){o.visible=false;return;}meshes.push(o);const original=o.material;o.userData.albedo=new T.MeshBasicMaterial({map:original.map,color:original.color,alphaTest:original.transparent?foliageAlphaCutoff(name):original.alphaTest,side:T.DoubleSide});o.userData.normals=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{map:{value:original.map},cutoff:{value:original.transparent?foliageAlphaCutoff(name):original.alphaTest}},vertexShader:'varying vec2 vUv;varying vec3 n;void main(){vUv=uv;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D map;uniform float cutoff;varying vec2 vUv;varying vec3 n;void main(){if(texture2D(map,vUv).a<cutoff)discard;gl_FragColor=vec4(normalize(n)*(gl_FrontFacing?.5:-.5)+.5,1.);}'});});scene.add(model);model.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),span=size.length()*1.04;
   const camera=new T.OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,100),atlases={};
   for(const mode of ['albedo','normals']){
    const atlas=document.createElement('canvas');atlas.width=angles*512;atlas.height=elevations.length*512;const ctx=atlas.getContext('2d');meshes.forEach(o=>o.material=o.userData[mode]);renderer.outputColorSpace=mode==='albedo'?T.SRGBColorSpace:T.LinearSRGBColorSpace;
    for(let row=0;row<elevations.length;row++)for(let view=0;view<angles;view++){const angle=view*Math.PI*2/angles,elevation=elevations[row];camera.position.set(Math.sin(angle)*Math.cos(elevation)*40,center.y+Math.sin(elevation)*40,Math.cos(angle)*Math.cos(elevation)*40);camera.lookAt(0,center.y,0);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,view*512,row*512);}
    atlases[mode]=await encode(atlas);
   }
   // Project the actual crown and trunk onto the ground under the game's fixed sun.
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
 },selected);
 const metadata=JSON.parse(readFileSync('src/nature-views.json','utf8'));for(const {name,albedo,normals,shadow,...data}of result){for(const [kind,bytes]of Object.entries({views:albedo,normals,shadow})){writeFileSync(`public/models/nature/${name}-${kind}.webp`,Buffer.from(bytes));console.log(name,kind,bytes.length);}metadata[name]=data;}writeFileSync('src/nature-views.json',JSON.stringify(metadata));
}finally{await browser.close();}
