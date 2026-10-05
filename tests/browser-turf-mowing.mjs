import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await disableHmr(page);await page.goto(process.env.GAME_URL||'http://localhost:5173');
 await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const g=__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();
  const T=await import('/node_modules/three/build/three.module.js'),{TURF_MOWING_GLSL,mowingProfile}=await import('/src/turf-mowing.js'),{COURSE_SETS,fairwayDistance,routePoint}=await import('/src/course.js'),{FAIRWAY_GLSL,MAX_FAIRWAY_SEGMENTS}=await import('/src/course-layout.js');
  const renderer=g.renderer,scene=new T.Scene(),camera=new T.Camera(),quad=new T.Mesh(new T.PlaneGeometry(2,2));scene.add(quad);
  const vertexShader='varying vec2 sampleUV;void main(){sampleUV=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const target=new T.WebGLRenderTarget(64,1,{type:T.FloatType,depthBuffer:false});
  const u={routeCount:{value:0},routeSegments:{value:[]},routeWidths:{value:[]},points:{value:[]}};
  const routeMaterial=new T.ShaderMaterial({uniforms:u,vertexShader,fragmentShader:FAIRWAY_GLSL+'uniform vec2 points[64];varying vec2 sampleUV;void main(){vec3 frame;float distance=routeDistance(points[int(floor(sampleUV.x*64.))],frame);gl_FragColor=vec4(distance,frame);}',depthTest:false,depthWrite:false});quad.material=routeMaterial;
  const pixels=new Float32Array(64*4);let maxDistanceError=0,checked=0;
  for(const c of COURSE_SETS.flatMap(s=>s.holes)){
   const s=c.layout.segments;u.routeCount.value=s.length;u.routeSegments.value=Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new T.Vector4(...(s[i]?.slice(0,4)||[0,0,0,0])));u.routeWidths.value=Array.from({length:MAX_FAIRWAY_SEGMENTS},(_,i)=>new T.Vector2(...(s[i]?.slice(4)||[0,0])));
   const points=Array.from({length:64},(_,i)=>{const p=routePoint(c,(i%16)/15),offset=(Math.floor(i/16)-1.5)*(p.width+3);return new T.Vector2(p.x+p.tangentZ*offset,p.z-p.tangentX*offset);});u.points.value=points;
   renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,1,pixels);
   for(let i=0;i<64;i++){const error=Math.abs(pixels[i*4]-fairwayDistance(c,points[i].x,points[i].y));if(!Number.isFinite(error))throw Error('Non-finite GPU course distance');maxDistanceError=Math.max(maxDistanceError,error);checked++;}
  }
  const grainUniforms={mowingProfile:{value:new T.Vector4(0,5,.22,0)},origin:{value:new T.Vector2()},extent:{value:.1},view:{value:new T.Vector3(0,0,1)}};
  const grainMaterial=new T.ShaderMaterial({uniforms:grainUniforms,vertexShader,fragmentShader:TURF_MOWING_GLSL+'uniform vec2 origin;uniform float extent;uniform vec3 view;varying vec2 sampleUV;void main(){vec2 p=origin+(sampleUV-.5)*extent;vec2 grain=fairwayGrain(p,vec3(0.,1.,p.x),-20.);gl_FragColor=vec4(grainShade(grain,view,mowingProfile.z),grain,1.);}',depthTest:false,depthWrite:false});quad.material=grainMaterial;
  const sample=(x,z,viewZ=1,extent=.1)=>{grainUniforms.origin.value.set(x,z);grainUniforms.view.value.set(0,0,viewZ);grainUniforms.extent.value=extent;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,64,1,pixels);return pixels[32*4];};
  const shade={forward:sample(2.5,0),along:sample(2.5,80),adjacent:sample(7.5,0),reverse:sample(2.5,0,-1),unresolved:sample(2.5,0,1,640)};
  grainUniforms.mowingProfile.value.set(0,5,.2,1);shade.halfLeft=sample(-8,0);shade.halfRight=sample(8,0);
  const profiles=COURSE_SETS.flatMap(s=>s.holes).map(c=>mowingProfile(c).toArray());
  renderer.setRenderTarget(null);target.dispose();quad.geometry.dispose();routeMaterial.dispose();grainMaterial.dispose();return{checked,maxDistanceError,shade,profiles};
 });
 assert.equal(result.checked,36*64);assert.ok(result.maxDistanceError<.0003,JSON.stringify(result));
 const s=result.shade;assert.ok(s.forward<.85&&s.adjacent>1.15);assert.ok(Math.abs(s.forward-s.along)<1e-5,'Stripes must extend along the mowing direction');assert.ok(Math.abs(s.forward+s.reverse-2)<1e-5,'Opposite views must reverse grain contrast');assert.ok(Math.abs(s.unresolved-1)<1e-5,'Unresolved stripes must converge without aliasing');assert.ok(s.halfLeft>1.15&&s.halfRight<.85);
 assert.ok(result.profiles.every(p=>p.every(Number.isFinite)&&p[1]>1&&p[2]>0&&p[2]<.3));assert.deepEqual(errors,[]);console.log(JSON.stringify({...result,profiles:result.profiles.length,errors,muted:true},null,2));
}finally{await browser.close();}
