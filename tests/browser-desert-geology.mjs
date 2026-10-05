import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
// GAME_URL selects the development server. All browser audio stays muted.
const out=new URL('file:///private/tmp/ninja-desert-geology/');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.addInitScript(()=>localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0})));await page.goto(process.env.GAME_URL||'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(async()=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.enabled=false;g.audio.pause();g.time=120;g.renderer.setPixelRatio(1);g.rendering.resize();await(await import('/src/nature.js')).loadNature('desert');g.setCourse(2);});
 const rows=[];
 for(let hole=0;hole<9;hole++){
  const row=await page.evaluate(async hole=>{
   const g=__golfTest,{heightAt,fairwayDistance,greenDistance,lieAt}=await import('/src/course.js'),{bridgeDistance}=await import('/src/course-layout.js'),{bunkerDistance}=await import('/src/bunkers.js');g.loadHole(hole);await g.world.waitForAssets();g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;
   const groups=g.world.vegetation.groups.filter(x=>x.name==='desert-boulders'),records=groups.filter(x=>x.lod===0).flatMap(x=>x.records),obstacles=g.world.vegetation.rockObstacles.filter(o=>o.id.startsWith('rock:desert-boulders:'));
   const check=(ok,message)=>{if(!ok)throw Error(g.course.name+': '+message);};check(groups.length===4,'Missing distinct forms or LODs');check(obstacles.length===records.length,'Wrong solid count');check(records.length>12&&records.length<=150,'Wrong formation count');let points=0,approaches=0;
   const bounds=new Map();for(const group of groups){group.mesh.geometry.computeBoundingBox();const form=group.records[0].rockForm,b=group.mesh.geometry.boundingBox;if(bounds.has(form))bounds.get(form).union(b);else bounds.set(form,b.clone());check(group.records.every(r=>r.rockForm===form),'A group renders the wrong rock form');}
   for(const [i,r] of records.entries()){
    const b=bounds.get(r.rockForm),nx=Math.ceil((b.max.x-b.min.x)*r.scale/2),nz=Math.ceil((b.max.z-b.min.z)*r.scale/2),co=Math.cos(r.angle),si=Math.sin(r.angle);
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
     const dx=(b.min.x+(b.max.x-b.min.x)*ix/nx)*r.scale,dz=(b.min.z+(b.max.z-b.min.z)*iz/nz)*r.scale,x=r.x+co*dx+si*dz,z=r.z-si*dx+co*dz;
     check(fairwayDistance(g.course,x,z)>=5&&greenDistance(g.course,x,z)>=27,'Rock crosses golf clearance');check(lieAt(g.course,x,z)!=='Water'&&!g.world.root.userData.pathContains?.(x,z,1.4)&&bridgeDistance(g.course,x,z)>=2&&!g.course.bunkers.some(b=>bunkerDistance(x,z,b)<1.5),'Rock crosses a hazard or route');check(!(g.world.root.userData.landmarks||[]).some(b=>Math.abs(x-b.x)<b.halfWidth+3&&Math.abs(z-b.z)<b.halfDepth+3),'Rock crosses a building');check(r.y+b.min.y*r.scale<heightAt(g.course,x,z),'Rock underside floats');points++;
    }
    const bx=(b.max.x+b.min.x)*r.scale*.5,bz=(b.max.z+b.min.z)*r.scale*.5,ox=r.x+co*bx+si*bz,oz=r.z-si*bx+co*bz,obstacle=obstacles.find(o=>Math.hypot(o.x-ox,o.z-oz)<.001);check(obstacle,'No matching solid');
    const extent=Math.hypot(obstacle.halfWidth,obstacle.halfDepth)+3;
    for(let k=0;k<8;k++){
     const angle=k*Math.PI/4,x=obstacle.x+Math.sin(angle)*extent,z=obstacle.z+Math.cos(angle)*extent,from={x,z,y:heightAt(g.course,x,z)};
     if(g.world.collision.blocked(from,.4)||lieAt(g.course,x,z)==='Water')continue;
     const to={x:obstacle.x,z:obstacle.z,y:from.y};g.world.collision.slide(to,.38,from);check(!g.world.collision.blocked(to,.379),'Movement ends inside a rock');approaches++;
    }
   }
   const plants=g.world.vegetation.groups.filter(x=>x.lod===0&&(x.isTree||x.plant)).flatMap(x=>x.records);for(const p of plants)for(const r of records){const b=bounds.get(r.rockForm),dx=p.x-r.x,dz=p.z-r.z,x=Math.cos(r.angle)*dx-Math.sin(r.angle)*dz,z=Math.sin(r.angle)*dx+Math.cos(r.angle)*dz;check(!(x>b.min.x*r.scale&&x<b.max.x*r.scale&&z>b.min.z*r.scale&&z<b.max.z*r.scale),'Plant grows inside a boulder');}
   return{hole,name:g.course.name,rocks:records.length,points,approaches,forms:[...bounds.keys()]};
  },hole);rows.push(row);console.log(row);
 }
 fs.writeFileSync(new URL('report.json',out),JSON.stringify({rows,errors,muted:true},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
