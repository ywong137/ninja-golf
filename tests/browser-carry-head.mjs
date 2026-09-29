// Check the feared weapon/head overlap from oblique review images against the
// actual deformed head surface throughout both lateral runs and their blends.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{BLADE_PROFILES}=await import('/src/weapons.js');await loadWarriorAssets();const reports=[];
  for(let hero=0;hero<6;hero++){
   const p=new Warrior(hero),surfaces=[];p.model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;const {skinIndex:ids,skinWeight:weights}=mesh.geometry.attributes,indices=[];
    for(let i=0;i<ids.count;i++){let head=0;for(let k=0;k<4;k++)if(/Head|Eye|neck/i.test(mesh.skeleton.bones[ids.getComponent(i,k)].name))head+=weights.getComponent(i,k);if(head>.75)indices.push(i);}
    if(indices.length)surfaces.push({mesh,indices});
   });
   const result={hero,minBladeHead:Infinity,minGuardHead:Infinity,minHandleHead:Infinity,vertices:surfaces.reduce((sum,s)=>sum+s.indices.length,0)};
   for(const angle of [Math.PI/2,-Math.PI/2,Math.PI/4,-Math.PI/4]){
    for(let i=0;i<30;i++)p.update(i/60,1/60,{moving:true,focused:true,moveSpeed:5.3,moveAngle:angle,groundHeight:()=>0});
    for(let i=0;i<24;i++){
     p.runPhase=i/24;p.update(i/24,0,{moving:true,focused:true,moveSpeed:5.3,moveAngle:angle,groundHeight:()=>0});p.root.updateMatrixWorld(true);
     for(const w of [p.weapon,p.offhand].filter(Boolean)){
      const profile=BLADE_PROFILES[w.userData.kind],inverse=w.matrixWorld.clone().invert(),scale=w.getWorldScale(new T.Vector3()).x,point=new T.Vector3(),near=new T.Vector3(),guard=new T.Vector3(0,.155,0);
      const handle=new T.Line3(new T.Vector3(0,w.userData.kind==='naginata'?-.885:.17-profile.grip,0),new T.Vector3(0,.17,0));
      const sections=Array.from({length:16},(_,s)=>{const a=s/16,b=(s+1)/16;return new T.Line3(new T.Vector3(-profile.curve*a*a,.17+profile.length*a,0),new T.Vector3(-profile.curve*b*b,.17+profile.length*b,0));});
      for(const {mesh,indices}of surfaces){mesh.skeleton.update();const matrix=inverse.clone().multiply(mesh.matrixWorld);
       for(const v of indices){point.copy(mesh.getVertexPosition(v,new T.Vector3())).applyMatrix4(matrix);
        result.minGuardHead=Math.min(result.minGuardHead,(point.distanceTo(guard)-.12)*scale);
        handle.closestPointToPoint(point,true,near);result.minHandleHead=Math.min(result.minHandleHead,(point.distanceTo(near)-.022)*scale);
        for(const section of sections){section.closestPointToPoint(point,true,near);result.minBladeHead=Math.min(result.minBladeHead,(point.distanceTo(near)-profile.width*.5)*scale);}
       }
      }
     }
    }
   }
   reports.push(result);p.dispose();
  }return reports;
 });console.log(JSON.stringify(reports,null,2));for(const r of reports){assert.ok(r.vertices>100);assert.ok(Math.min(r.minBladeHead,r.minGuardHead,r.minHandleHead)>.02,JSON.stringify(r));}
}finally{await browser.close();}
