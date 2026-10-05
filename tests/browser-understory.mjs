import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const out=process.argv[3]||'/private/tmp/ninja-understory';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.addInitScript(()=>localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0})));
 await page.goto(process.argv[2]||'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest&&!document.querySelector('#asset-curtain'),{},{timeout:120000});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(()=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.enabled=false;g.audio.pause();});
 const holes=[];
 for(const theme of [1,2]){
  await page.evaluate(async theme=>{const {loadNature}=await import('/src/nature.js');await loadNature(theme===1?'highlands':'desert');__golfTest.setCourse(theme);},theme);
  for(let hole=0;hole<9;hole++){
   const row=await page.evaluate(async hole=>{
    const g=__golfTest,{heightAt,ellipse,COURSE_BOUNDS}=await import('/src/course.js'),{createCourseSurfaceSampler}=await import('/src/terrain.js');
    const start=performance.now();g.loadHole(hole);await g.world.waitForAssets();const c=g.course,ground=createCourseSurfaceSampler(c,heightAt,ellipse),sample=(x,z)=>g.world.horizonHeight?.(x,z)??ground(x,z),u=g.world.distantUnderstory;
    const errors=[];for(const p of u.records){if(Math.abs(sample(p.x,p.z)-p.y-.045)>1e-6)errors.push('floating');if(p.x>COURSE_BOUNDS.minX-65&&p.x<COURSE_BOUNDS.maxX+65&&p.z>COURSE_BOUNDS.minZ-65&&p.z<c.length+COURSE_BOUNDS.endMargin+65)errors.push('inside play');}
    return{theme:c.theme,hole,plants:u.records.length,draws:u.meshes.length+u.shadows.length,loadMs:performance.now()-start,errors};
   },hole);assert.ok(row.plants>1000);assert.ok(row.draws<=4);assert.deepEqual(row.errors,[]);holes.push(row);
  }
 }
 const levels=[];
 for(const name of ['desert-scrub','woody-scrub'])for(const stage of ['near','mid','fade','far']){
  const result=await page.evaluate(async({name,stage})=>{
   const T=await import('/node_modules/three/build/three.module.js'),{SHRUB_DETAIL}=await import('/src/landscape-understory.js'),g=__golfTest,v=g.world.vegetation,group=v.groups.find(p=>p.name===name&&p.lod===0),p=group.records[0],d=SHRUB_DETAIL[name],distance={near:10,mid:(d.nearEnd+d.farStart)/2,fade:(d.farStart+d.farEnd)/2,far:d.farEnd+30}[stage];
   g.camera.position.set(p.x,p.y+1,p.z-distance);g.camera.lookAt(p.x,p.y+1,p.z);g.world.update(120,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);const active=new Set(),m=new T.Matrix4();
   for(const group of v.groups.filter(q=>q.name===name))for(let i=0;i<group.mesh.count;i++){group.mesh.getMatrixAt(i,m);if(Math.abs(m.elements[12]-p.x)<.001&&Math.abs(m.elements[14]-p.z)<.001)active.add(group.lod);}
   return{name,stage,distance,active:[...active].sort()};
  },{name,stage});assert.deepEqual(result.active,{near:[0],mid:[1],fade:[1,2],far:[2]}[stage]);levels.push(result);
 }
 const cleanup=await page.evaluate(()=>{const w=__golfTest.world,old=[...w.distantUnderstory.meshes,...w.distantUnderstory.shadows];let disposed=0;for(const m of old)m.material.addEventListener('dispose',()=>disposed++);const n=w.root.children.length,records=JSON.stringify(w.distantUnderstory.records);w.buildHorizon(w.course);return{disposed,expected:old.length,removed:old.every(m=>m.parent===null),stableCount:w.root.children.length===n,samePlants:records===JSON.stringify(w.distantUnderstory.records)};});assert.equal(cleanup.disposed,cleanup.expected);assert.ok(cleanup.removed&&cleanup.stableCount&&cleanup.samePlants);
 assert.deepEqual(errors,[]);const report={holes,levels,cleanup,errors,muted:true};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
