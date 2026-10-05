import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const [url='http://localhost:5184/',out='/private/tmp/ninja-desert-planting']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const report={muted:true,holes:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await disableHmr(page);await page.addInitScript(()=>localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0})));
 await page.goto(url);await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.evaluate(async()=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.paused=true;await (await import('/src/nature.js')).loadNature('desert');g.setCourse(2);});
 for(let hole=0;hole<9;hole++){
  const result=await page.evaluate(async hole=>{
   const g=__golfTest,{fairwayDistance,greenDistance,lieAt}=await import('/src/course.js'),{bunkerDistance}=await import('/src/bunkers.js'),{bridgeDistance}=await import('/src/course-layout.js');
   g.loadHole(hole);await g.world.waitForAssets();const c=g.course,land=g.world.vegetation;
   const check=(value,message)=>{if(!value)throw Error(`Hole ${hole+1}: ${message}`);};
   const targets=land.groups.filter(p=>p.lod===0&&(p.solidTree||p.name==='desert-scrub'));
   let cactusCount=0,shrubs=0,collisionApproaches=0,clearance=Infinity;
   for(const group of targets){
    const geo=group.mesh.geometry;geo.computeBoundingBox();const box=geo.boundingBox;
    for(const attr of Object.values(geo.attributes))check(attr.array.every(Number.isFinite),'Non-finite plant geometry');
    if(group.name==='desert-scrub'){
     const material=group.mesh.material;check(material.map&&material.normalMap&&material.roughnessMap,'Shrub lost a surface texture');
     check(material.alphaTest>0&&group.mesh.customDepthMaterial.alphaTest===material.alphaTest,'Shrub shadow does not match the cutout');
     const image=material.map.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     let clear=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>240)solid++;}check(clear>pixels.length*.05&&solid>pixels.length*.01,'Shrub opacity is empty or missing');
    }
    for(const record of group.records){
     group.solidTree?cactusCount++:shrubs++;
     // Sample the full projected bounds, not just the placement point.
     for(const xx of [box.min.x,0,box.max.x])for(const zz of [box.min.z,0,box.max.z]){
      const x=record.x+(xx*Math.cos(record.angle)+zz*Math.sin(record.angle))*record.scale,z=record.z+(-xx*Math.sin(record.angle)+zz*Math.cos(record.angle))*record.scale;
      const d=fairwayDistance(c,x,z);clearance=Math.min(clearance,d);check(d>0,`${group.name} overlaps the fairway`);check(greenDistance(c,x,z)>20,'Plant overlaps the green');check(lieAt(c,x,z)!=='Water','Plant overlaps water');check(!g.world.root.userData.pathContains?.(x,z,.1),'Plant overlaps the path');check(bridgeDistance(c,x,z)>0,'Plant overlaps a bridge');check(c.bunkers.every(b=>bunkerDistance(x,z,b)>0),'Plant overlaps a bunker');
     }
     if(group.solidTree){
      const site=g.world.ambushSites.find(s=>s.kind==='tree'&&Math.hypot(s.x-record.x,s.z-record.z)<.01);check(site?.radius>0,'Cactus has no collision/spawn anchor');
      // Rock gardens can occupy one side. Start from a valid player position.
      const start=Array.from({length:8},(_,i)=>({x:record.x+Math.sin(i*Math.PI/4)*3,y:record.y+.1,z:record.z+Math.cos(i*Math.PI/4)*3})).find(p=>!g.world.collision.blocked(p,.38,1.8));
      if(start){const end={x:record.x,y:record.y+.1,z:record.z};check(!g.world.collision.segmentClear(start,end,.38,1.8),'Travel crosses the cactus trunk');g.world.collision.slide(end,.38,start,1.8);check(!g.world.collision.blocked(end,.38,1.8),'Travel remains inside a cactus');collisionApproaches++;}
     }
    }
   }
   check(cactusCount>20&&shrubs>100,'Missing desert planting');check(collisionApproaches>20,'Too few clear approaches tested');
   g.camera.position.set(58,42,-42);g.camera.lookAt(0,5,135);g.world.update(120,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);
   const near=land.groups.filter(p=>p.name==='desert-scrub'&&p.lod===0),far=land.groups.filter(p=>p.name==='desert-scrub'&&p.lod===1);check(near.length===1&&far.length===1,'Missing shrub distance level');
   return{hole:hole+1,cacti:cactusCount,shrubs,collisionApproaches,minFairwayClearance:clearance,visibleShrubs:near[0].mesh.count+far[0].mesh.count,triangles:g.renderer.info.render.triangles};
  },hole);report.holes.push(result);console.log(result);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
