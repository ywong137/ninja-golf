/** Regenerate shadow atlases only. Sun direction points from the ground toward the sun. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SUN_DIRECTION} from '../src/lighting.js';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('node tools/bake-tree-shadows.mjs [--sun X Y Z] [--url http://localhost:5173]\nDefault: use the shared game sun direction.');process.exit(0);}
let sun=[...SUN_DIRECTION],url='http://localhost:5173';
while(args.length){const option=args.shift();if(option==='--sun')sun=args.splice(0,3).map(Number);else if(option==='--url'&&args[0])url=args.shift();else throw new Error(`Unknown or incomplete option: ${option}. Use --help.`);}
if(sun.length!==3||!sun.every(Number.isFinite)||sun[1]<=0)throw new Error('Pass --sun X Y Z with positive Y.');
const length=Math.hypot(...sun);if(Math.abs(length-1)>.00001)throw new Error('Sun direction must be normalized.');
if(!/^https?:\/\//.test(url))throw new Error('Pass an HTTP(S) URL after --url.');
const folder='public/models/nature',metadataPath='src/nature-views.json',before=JSON.parse(readFileSync(metadataPath,'utf8'));
const names=Object.keys(before).filter(name=>before[name].shadowViews);
assert.equal(names.length,5,'Expected exactly five tree shadow atlases');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const protectedFiles=readdirSync(folder).filter(name=>!names.some(tree=>name===tree+'-shadow.webp')).map(name=>folder+'/'+name);
const hashes=new Map(protectedFiles.map(file=>[file,hash(file)]));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto(url+'/tools/tree-bake.html');
 const results=await page.evaluate(async({names,sun})=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setClearColor(0,0);renderer.outputColorSpace=T.LinearSRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),output=[],projection=new T.Vector2(-sun[0]/sun[1],-sun[2]/sun[1]);
  for(const name of names){
   const model=(await new GLTFLoader().loadAsync('/models/nature/'+name+'.glb')).scene,meshes=[];
   model.traverse(o=>{if(!o.isMesh)return;if(o.name.startsWith('LOD1')){o.visible=false;return;}meshes.push(o);const original=o.material;
    o.material=new T.ShaderMaterial({side:T.DoubleSide,depthTest:false,depthWrite:false,uniforms:{map:{value:original.map},cutoff:{value:Math.max(.4,original.alphaTest||0)},projection:{value:projection}},vertexShader:'uniform vec2 projection;varying vec2 vUv;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);p.xz+=p.y*projection;p.y=0.;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'uniform sampler2D map;uniform float cutoff;varying vec2 vUv;void main(){if(texture2D(map,vUv).a<cutoff)discard;gl_FragColor=vec4(1.);}'});
   });scene.add(model);
   const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;const context=atlas.getContext('2d'),shadowViews=[],coverage=[];
   for(let view=0;view<8;view++){
    model.rotation.y=view*Math.PI/4;model.updateMatrixWorld(true);const b=new T.Box2(),v=new T.Vector3();
    for(const o of meshes){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);b.expandByPoint(new T.Vector2(v.x+v.y*projection.x,v.z+v.y*projection.y));}}b.expandByScalar(.6);
    const w=b.max.x-b.min.x,h=b.max.y-b.min.y,cx=(b.min.x+b.max.x)/2,cz=(b.min.y+b.max.y)/2,camera=new T.OrthographicCamera(-w/2,w/2,h/2,-h/2,.1,100);camera.position.set(cx,40,cz);camera.up.set(0,0,-1);camera.lookAt(cx,0,cz);renderer.render(scene,camera);
    context.drawImage(renderer.domElement,(view%4)*512,Math.floor(view/4)*512);shadowViews.push([b.min.x,b.min.y,b.max.x,b.max.y]);
    const pixels=context.getImageData((view%4)*512,Math.floor(view/4)*512,512,512).data;let occupied=0,border=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>127){occupied++;const p=(i-3)/4,x=p%512,y=Math.floor(p/512);if(x===0||x===511||y===0||y===511)border++;}coverage.push({occupied,border});
   }
   const blob=await new Promise(resolve=>atlas.toBlob(resolve,'image/webp',.96));if(!blob||blob.type!=='image/webp')throw new Error('WebP encoding failed: '+name);
   output.push({name,shadowViews,coverage,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});scene.remove(model);for(const o of meshes){o.geometry.dispose();o.material.dispose();}
  }
  renderer.dispose();return output;
 },{names,sun});
 assert.deepEqual(errors,[],'Browser errors');
 const updated=structuredClone(before);
 for(const result of results){assert.equal(result.shadowViews.length,8);for(const view of result.coverage){assert.ok(view.occupied>1000,'Empty shadow view');assert.equal(view.border,0,'Clipped shadow view');}for(const bounds of result.shadowViews)assert.ok(bounds.every(Number.isFinite)&&bounds[2]>bounds[0]&&bounds[3]>bounds[1]);updated[result.name].shadowViews=result.shadowViews;}
 // Validate everything before writing any shipping output.
 for(const [file,digest]of hashes)assert.equal(hash(file),digest,'Unrelated asset changed: '+file);
 for(const result of results){writeFileSync(`${folder}/${result.name}-shadow.webp`,Buffer.from(result.bytes));console.log(JSON.stringify({name:result.name,bytes:result.bytes.length,coverage:result.coverage}));}
 writeFileSync(metadataPath,JSON.stringify(updated));
 for(const name of names){const a={...before[name]},b={...updated[name]};delete a.shadowViews;delete b.shadowViews;assert.deepEqual(a,b);}
 for(const [file,digest]of hashes)assert.equal(hash(file),digest,'Unrelated asset changed: '+file);
 console.log(JSON.stringify({sun,protectedAssets:hashes.size,atlases:results.length}));
}finally{await browser.close();}
