import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node tests/browser-architecture.mjs [--baseline | --after]\n--baseline: capture HEAD architecture and save fixed cameras.\n--after: capture current architecture with those exact cameras and compare runtime counts.\nDefault: capture current code without a baseline dependency. Outputs: /tmp/ninja-architecture-{before,after,current}/');process.exit(0);}
assert.ok(args.length<=1&&args.every(a=>['--baseline','--after'].includes(a)),'Use --help for supported arguments');
const baseline=args.includes('--baseline'),after=args.includes('--after'),label=baseline?'before':after?'after':'current',directory=`/tmp/ninja-architecture-${label}`,manifestFile='/tmp/ninja-architecture-cameras.json';
if(baseline&&fs.existsSync(manifestFile))throw Error(`Baseline already exists: ${manifestFile}. Preserve or rename it before creating another baseline.`);
if(after&&!fs.existsSync(manifestFile))throw Error('Run --baseline before requesting a matched --after capture.');
fs.mkdirSync(directory,{recursive:true});
const baselineManifest=after?JSON.parse(fs.readFileSync(manifestFile)):null,revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});await disableHmr(page);
 await page.addInitScript(()=>{window.addEventListener('error',e=>window.__architectureFailure=e.message);window.addEventListener('unhandledrejection',e=>window.__architectureFailure=String(e.reason));let state=194732;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};});
 // Read-only instrumentation identifies the real static batches produced by each builder.
 // It changes no geometry or materials, and works for both historical and current modules.
 for(const [file,builder]of [['architecture.js','buildArchitecture'],['course-themes.js','buildThemeScenery'],...(baseline?[['world.js',null],['course-path.js',null]]:[])]){
  const source=baseline?execFileSync('git',['show',`${revision}:src/${file}`],{encoding:'utf8'}):fs.readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  let instrumented=source;
  if(builder){instrumented=instrumented.replace(`export function ${builder}(`,`function captureOriginal_${builder}(`);assert.notEqual(instrumented,source,`Cannot instrument ${builder}`);instrumented+=`\nexport function ${builder}(...args){const root=args[0],before=new Set(root.children);const result=captureOriginal_${builder}(...args);for(const child of root.children)if(!before.has(child))child.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)o.userData.captureArchitectureBuilder='${builder}';});return result;}\n`;}
  instrumented=instrumented.replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'));
  const currentSource=fs.readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  await page.route(`**/src/${file}*`,async route=>{
   // Preserve Vite's exact dependency URLs, including HMR timestamps. Bare raw imports
   // can otherwise instantiate a second, unloaded nature-asset module.
   const response=await route.fetch(),transformed=await response.text(),imports=text=>[...text.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)].map(m=>m[2]);
   const original=imports(currentSource),resolved=imports(transformed).filter(s=>!s.includes('/@vite/'));
   assert.equal(original.length,resolved.length,`Vite import map changed for ${file}`);const urls=new Map(original.map((name,i)=>[name,resolved[i]]));
   const body=instrumented.replace(/\bfrom\s*(['"])([^'"]+)\1/g,(match,quote,specifier)=>{if(!urls.has(specifier))throw Error(`No Vite dependency mapping for ${file}: ${specifier}`);return `from ${JSON.stringify(urls.get(specifier))}`;});
   await route.fulfill({contentType:'application/javascript',body});
  });
 }
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest||window.__architectureFailure||document.body.textContent.includes('The course could not load.'),null,{timeout:120000});assert.equal(await page.evaluate(()=>window.__architectureFailure||null),null,'Game initialization failed');assert.deepEqual(errors,[],'Boot errors');await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.addStyleTag({content:'#app > :not(#game){visibility:hidden!important}'});
 await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();g.time=12.5;g.renderer.setPixelRatio(1);g.renderer.setSize(1440,1000);g.rendering.resize();window.architectureTextureState=new Map([...g.world.textureCache].map(([name,t])=>[name,{repeat:t.repeat.toArray(),wrapS:t.wrapS,wrapT:t.wrapT}]));});
 const reports=[],manifest={revision,viewport:[1440,1000],themes:[]};
 for(let theme=0;theme<4;theme++){
  const setup=await page.evaluate(async({theme,saved})=>{
   const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js');g.clearEnemies();g.crowd.update([]);g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.mode='game';g.ui.showScreen('game');g.phase='combat';g.paused=true;g.audio.pause();g.time=12.5;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.trail.visible=false;g.puttingGuide.hide?.();g.portraitLights.visible=false;
   const records=g.world.root.userData.buildingObstacles,ids=['jp-pagoda-foundation','highlands-0-tower-left','desert-0-body','cyberpunk-0-podium'],body=records.find(o=>o.id===ids[theme]);if(!body)throw Error(`Missing architecture capture anchor ${ids[theme]}`);
   const prefix=theme===0?'jp-pagoda':`${g.course.theme}-0-`,group=records.filter(o=>o.id.startsWith(prefix)),minX=Math.min(...group.map(o=>o.x-(o.halfWidth??o.radius))),maxX=Math.max(...group.map(o=>o.x+(o.halfWidth??o.radius))),minZ=Math.min(...group.map(o=>o.z-(o.halfDepth??o.radius))),maxZ=Math.max(...group.map(o=>o.z+(o.halfDepth??o.radius))),base=heightAt(g.course,body.x,body.z),top=Math.max(...group.map(o=>o.maxY)),width=maxX-minX,height=top-base,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
   let hero,wallCamera,wallLook;
   if(theme===0||theme===2){hero=[body.x+body.halfWidth+1.1,heightAt(g.course,body.x+body.halfWidth+1.1,body.z),body.z];wallCamera=[hero[0]+7,hero[1]+2.8,hero[2]-4];wallLook=[hero[0]-2,hero[1]+1.8,hero[2]];}
   else if(theme===1){hero=[body.x+body.halfWidth+1.1,heightAt(g.course,body.x+body.halfWidth+1.1,body.z),body.z];wallCamera=[hero[0]+6,hero[1]+2.8,hero[2]-6];wallLook=[hero[0]-1.7,hero[1]+2,hero[2]];}
   else{hero=[body.x+3,heightAt(g.course,body.x+3,body.z-body.halfDepth-1.4),body.z-body.halfDepth-1.4];wallCamera=[hero[0]+3,hero[1]+2.8,hero[2]-8];wallLook=[hero[0]-1,hero[1]+1.7,hero[2]+2];}
   const distance=Math.max(width,height)*1.35,front={camera:[cx+width*.22,base+height*.44,minZ-distance],look:[cx,base+height*.44,cz],fov:48};
   const views={wall:{camera:wallCamera,look:wallLook,fov:48},front,aerial:{camera:[cx+width*.45,top+Math.max(25,width),cz-8],look:[cx,base+3,cz],fov:48}};
   if(theme===3){const path=g.world.root.getObjectByName('Course path'),p=path?.geometry.attributes.position;let closest=null,best=Infinity;if(p)for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);path.localToWorld(v);const d=Math.hypot(v.x-body.x,v.z-(body.z-body.halfDepth));if(d<best){best=d;closest=v;}}const mx=(body.x+(closest?.x??body.x))/2,mz=(body.z-body.halfDepth+(closest?.z??body.z-30))/2;views.context={camera:[mx+38,base+35,mz-48],look:[mx,base+3,mz],fov:54};}
   const spec=saved||{theme,anchor:body.id,body:{x:body.x,z:body.z,halfWidth:body.halfWidth,halfDepth:body.halfDepth},hero,views};
   if(saved&&(saved.body.x!==body.x||saved.body.z!==body.z))throw Error('Building placement changed; matched cameras no longer target the same site');
   if(theme===0)spec.views.entrance={camera:[body.x+7,base+7,body.z-20],look:[body.x,base+1.8,body.z-10.6],fov:58};
   g.player.root.position.fromArray(spec.hero);g.player.root.rotation.y=Math.PI;g.player.root.visible=true;g.player.update(12.5,0,{});g.player.root.updateMatrixWorld(true);window.architectureCapture={spec,body};return spec;
  },{theme,saved:baselineManifest?.themes[theme]});
  manifest.themes.push(setup);const views=[];
  for(const [view,spec]of Object.entries(setup.views)){
   const metrics=await page.evaluate(async({spec,view})=>{
    const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js');g.camera.fov=spec.fov;g.camera.updateProjectionMatrix();g.camera.position.fromArray(spec.camera);g.camera.lookAt(new T.Vector3().fromArray(spec.look));g.camera.updateMatrixWorld(true);g.world.update(12.5,0,g.player.root.position,g.camera.position);g.rendering.render('high');g.rendering.render('high');
    const materials=new Map(),builders={},scene={meshes:0,triangles:0};g.world.root.traverse(o=>{if(!o.isMesh)return;const triangles=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);scene.meshes++;scene.triangles+=triangles;const tag=o.userData.captureArchitectureBuilder;if(tag){const row=builders[tag]??={meshes:0,triangles:0,materials:[]};row.meshes++;row.triangles+=triangles;for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.set(m.uuid,m);if(!row.materials.includes(m.uuid))row.materials.push(m.uuid);}}});
    const textureChanges=[];for(const [name,t]of g.world.textureCache){const before=window.architectureTextureState.get(name);if(t.repeat.x!==1||t.repeat.y!==1||before&&(before.repeat[0]!==t.repeat.x||before.repeat[1]!==t.repeat.y||before.wrapS!==t.wrapS||before.wrapT!==t.wrapT))textureChanges.push(name);}
    const head=g.player.bones.Head.getWorldPosition(new T.Vector3()),ndc=head.clone().project(g.camera),visible=g.player.root.visible&&g.player.root.parent===g.scene&&Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&ndc.z>-1&&ndc.z<1;
    let occluded=false;if(view==='wall'){const blockers=[];g.world.root.traverse(o=>{if(o.isMesh&&o.userData.captureArchitectureBuilder)blockers.push(o);});const origin=g.camera.position.clone(),target=head.clone().add({x:0,y:.13,z:0}),ray=new T.Raycaster(origin,target.clone().sub(origin).normalize(),0,origin.distanceTo(target)-.12);occluded=ray.intersectObjects(blockers,false).some(hit=>hit.object.visible);}
    const architecture={meshes:Object.values(builders).reduce((n,b)=>n+b.meshes,0),triangles:Object.values(builders).reduce((n,b)=>n+b.triangles,0),materials:materials.size,builders:Object.fromEntries(Object.entries(builders).map(([name,row])=>[name,{...row,materials:row.materials.length}])),surfaces:[...materials.values()].map(m=>({name:m.name,type:m.type,roughness:m.roughness,metalness:m.metalness,map:m.map?.name||m.map?.image?.currentSrc?.split('/').at(-1)||null,normalScale:m.normalScale?.toArray()}))};
    const ground=g.world.root.userData.architectureGround??null;
    return {view,architecture,scene,render:{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles},textureChanges,hero:{visible,occluded,ndc:ndc.toArray(),position:g.player.root.position.toArray()},ground};
   },{spec,view});
   assert.deepEqual(metrics.textureChanges,[],`Shared texture settings changed on theme ${theme}`);if(view==='wall'){assert.equal(metrics.hero.visible,true,`Hero missing from theme ${theme} wall frame`);assert.equal(metrics.hero.occluded,false,`Hero hidden behind world geometry on theme ${theme}`);}assert.ok(metrics.architecture.triangles>0&&metrics.architecture.materials>0);
   await page.screenshot({path:`${directory}/${theme}-${view}.png`});views.push(metrics);
  }
  reports.push({theme,anchor:setup.anchor,views});
 }
 assert.deepEqual(errors,[],'Browser or shader errors occurred');
 const report={revision,label,cameras:manifest.themes,reports};fs.writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));if(baseline)fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
 if(after){const before=JSON.parse(fs.readFileSync('/tmp/ninja-architecture-before/report.json'));report.comparison=reports.map((r,i)=>{const a=r.views[0].architecture,b=before.reports[i].views[0].architecture;return {theme:r.theme,triangles:a.triangles-b.triangles,materials:a.materials-b.materials,meshes:a.meshes-b.meshes};});for(const d of report.comparison){assert.ok(d.materials<=1,`Architecture material budget exceeded: ${JSON.stringify(d)}`);if(d.theme===3)assert.ok(d.triangles<=20000,`Captured city architecture triangle budget exceeded: ${JSON.stringify(d)}`);}fs.writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.comparison,null,2));}
 console.log(`${label} architecture captures saved to ${directory}. Runtime checks passed; images still require visual review.`);
}finally{await browser.close();}
