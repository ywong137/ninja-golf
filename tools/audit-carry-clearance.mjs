// Inspect the complete stride without a renderer. Clearance uses deformed leg
// vertices and the actual curved blade profile, expanded by its half-width.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {disableHmr} from './disable-hmr.mjs';
const args=process.argv.slice(2),check=args.includes('--check');
if(args.includes('--help')){console.log('node tools/audit-carry-clearance.mjs [OUTPUT.json] [--check]\nChecks deformed leg surfaces, blade/handle clearance, and forearm rotation during running and sprinting. No renderer or audio.');process.exit(0);}
if(args.some(a=>a.startsWith('--')&&a!=='--check')||args.filter(a=>a!=='--check').length>1)throw Error('Invalid options. See --help.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{BLADE_PROFILES}=await import('/src/weapons.js');await loadWarriorAssets();
  const results=[],V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
  for(let hero=0;hero<6;hero++){
   const p=new Warrior(hero),surfaces=[];
   p.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,indices=[];
    for(let i=0;i<joints.count;i++){let leg=0;for(let j=0;j<4;j++)if(/^(thigh|calf|foot|ball)_/.test(mesh.skeleton.bones[joints.getComponent(i,j)].name))leg+=weights.getComponent(i,j);if(leg>.5)indices.push(i);}
    if(indices.length)surfaces.push({mesh,indices});
   });
   const r={hero,minHandleLeg:Infinity,minBladeLeg:Infinity,minButtHeight:Infinity,maxForearmRoll:0,maxRollStep:0,worst:null},prior={};
   for(let f=0;f<180;f++){
    p.update(f/120,1/120,{moving:true,moveSpeed:f<90?5.6:8.6,sprinting:f>=90,groundHeight:()=>0});if(f<24)continue;p.root.updateMatrixWorld(true);
    for(const side of p.offhand?['r','l']:['r']){
     const w=side==='r'?p.weapon:p.offhand,profile=BLADE_PROFILES[w.userData.kind],pole=['naginata','lancer'].includes(w.userData.kind),bottom=pole?-.885:.17-profile.grip;
     const line=new T.Line3(new T.Vector3(0,bottom,0),new T.Vector3(0,.17,0));
     r.minButtHeight=Math.min(r.minButtHeight,w.localToWorld(new T.Vector3(0,bottom,0)).y);
     const lower=p.bones['lowerarm_'+side],axis=p.bones['hand_'+side].position.clone().normalize(),relative=p.selectionArmRest[side].lower.clone().invert().multiply(lower.quaternion).normalize();
     const angle=2*Math.atan2(relative.x*axis.x+relative.y*axis.y+relative.z*axis.z,relative.w),roll=Math.atan2(Math.sin(angle),Math.cos(angle));
     r.maxForearmRoll=Math.max(r.maxForearmRoll,Math.abs(roll)*180/Math.PI);
     if(prior[side]!==undefined)r.maxRollStep=Math.max(r.maxRollStep,Math.abs(Math.atan2(Math.sin(roll-prior[side]),Math.cos(roll-prior[side])))*180/Math.PI);prior[side]=roll;
     const inverse=w.matrixWorld.clone().invert(),scale=w.getWorldScale(V()).x,point=V(),nearest=V(),blade=new T.Line3();
     for(const {mesh,indices}of surfaces){mesh.skeleton.update();const matrix=inverse.clone().multiply(mesh.matrixWorld);
      for(const index of indices){point.fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,point);point.applyMatrix4(matrix);
       line.closestPointToPoint(point,true,nearest);const handleGap=(point.distanceTo(nearest)-.020)*scale;
       if(handleGap<r.minHandleLeg){r.minHandleLeg=handleGap;r.worst={side,frame:f,part:'handle'};}
       // A capsule around each blade section is conservative: it includes the
       // full width on both axes, so positive values prove separation.
       for(let s=0;s<16;s++){const a=s/16,b=(s+1)/16;blade.start.set(-profile.curve*a*a,.17+profile.length*a,0);blade.end.set(-profile.curve*b*b,.17+profile.length*b,0);blade.closestPointToPoint(point,true,nearest);r.minBladeLeg=Math.min(r.minBladeLeg,(point.distanceTo(nearest)-profile.width*.5)*scale);}
      }
     }
    }
   }
   results.push(r);p.dispose();
  }
  return results;
 });
 const path=args.find(a=>a!=='--check')||'/tmp/ninja-carry-clearance.json';writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(check)for(const r of report){
  assert.ok(r.minHandleLeg>.01&&r.minBladeLeg>.05,`Weapon intersects the stride: ${JSON.stringify(r)}`);
  assert.ok(r.minButtHeight>.15,`Handle strikes the ground: ${JSON.stringify(r)}`);
  assert.ok(r.maxForearmRoll<=90.0001&&r.maxRollStep<6,`Unnatural forearm rotation: ${JSON.stringify(r)}`);
 }
}finally{await browser.close();}
