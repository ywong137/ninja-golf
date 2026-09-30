import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium}from'playwright';import{disableHmr}from'../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});try{const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');const rows=await page.evaluate(async()=>{
const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,combatMotionName}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();const rows=[];
for(const hero of [0,1,2,3,4,5])for(const kind of ['yaw','light','idle','spin-light','spin-idle'])for(const hz of [120,240,480]){
 const p=new Warrior(hero),dt=1/hz,speed=5.3*WARRIORS[hero].speed,previous={},row={hero,kind,hz,ankle:0,knee:0,hip:0,chest:0,head:0,headHipYaw:0,worst:{}};
 const duration=kind.endsWith('light')?motions[combatMotionName(WARRIORS[hero],'light',0)].duration:1;
 for(let i=0;i<(kind==='yaw'?4:1.4)*hz;i++){
  const t=i/hz,yaw=kind==='yaw'?Math.max(0,Math.min(t,2.5)-.5)*10:kind.startsWith('spin-')?Math.max(0,Math.min(t,1)-.5)*10:0;p.root.rotation.y=yaw;
  const angle=3*Math.PI/4,travel=new T.Vector3(Math.sin(angle+yaw),0,Math.cos(angle+yaw));if(t<1||kind==='yaw')p.root.position.addScaledVector(travel,speed*dt);
  p.update(t,dt,{moving:t<1||kind==='yaw',moveSpeed:t<1||kind==='yaw'?speed:0,focused:true,moveAngle:angle,action:kind.endsWith('light')&&t>=1?{token:1,kind:'light',step:0,time:t-1,duration}:null,groundHeight:()=>0});p.root.updateMatrixWorld(true);
  const b=p.bones,points={ankle:b.foot_r.getWorldPosition(new T.Vector3()),knee:b.calf_r.getWorldPosition(new T.Vector3())},qs={hip:b.spine_01.getWorldQuaternion(new T.Quaternion()).normalize(),chest:b.spine_03.getWorldQuaternion(new T.Quaternion()).normalize(),head:b.Head.getWorldQuaternion(new T.Quaternion()).normalize()};
  const yawOf=(name,q)=>{const v=new T.Vector3(0,0,1).applyQuaternion(q.clone().multiply(p.runFootwork.bodyFrames[name].clone().invert()));return Math.atan2(v.x,v.z);};const relative=yawOf('Head',qs.head)-yawOf('spine_01',qs.hip);row.headHipYaw=Math.max(row.headHipYaw,Math.abs(Math.atan2(Math.sin(relative),Math.cos(relative))));
  for(const[k,v]of Object.entries({...points,...qs})){if(t>.9&&previous[k]){const d=(v.isQuaternion?v.angleTo(previous[k]):v.distanceTo(previous[k]))/dt;if(d>row[k]){row[k]=d;row.worst[k]=t;}}previous[k]=v;}
 }
 rows.push(row);p.dispose();
}return rows;});fs.writeFileSync('/tmp/ninja-run-boundaries.json',JSON.stringify(rows,null,2));for(const row of rows)if(row.kind==='yaw')assert.ok(row.headHipYaw<100*Math.PI/180,JSON.stringify(row));for(let i=0;i<rows.length;i+=3)for(const key of ['ankle','knee','hip','chest','head'])assert.ok(rows[i+2][key]<rows[i+1][key]*1.2,JSON.stringify({coarse:rows[i+1],fine:rows[i+2],key}));console.log('Run exits and fast root turns: '+rows.length+' cases passed.');}finally{await browser.close();}
