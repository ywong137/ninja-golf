import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,sampleMotion}=await import('/src/motion.js'),{attackDefinition}=await import('/src/combat.js');await loadWarriorAssets();const rows=[];
  for(const kind of ['light','heavy']){
   const p=new Warrior(2),definition=attackDefinition(kind,0,'naginata'),action={...definition,kind,step:0,token:1,time:0};
   for(let i=0;i<30;i++)p.update(i/60,1/60,{});p.update(1,0,{action});
   for(let f=0;f<=Math.ceil(definition.duration*120);f++){
    const t=Math.min(f/120,definition.duration-1e-6),dt=f?Math.min(1/120,definition.duration-(f-1)/120):0;action.time=t;p.update(1+t,dt,{action});p.root.updateMatrixWorld(true);
    const motion=sampleMotion(p.current,p.actions.get(p.current).time),q=p.root.getWorldQuaternion(new T.Quaternion()),point=n=>p.root.worldToLocal(p.bones[n].getWorldPosition(new T.Vector3()));
    const shaft=new T.Vector3(0,1,0).applyQuaternion(p.weapon.getWorldQuaternion(new T.Quaternion())).applyQuaternion(q.clone().invert());
    const expected=new T.Vector3(motion.tip[0]-motion.grip[0],motion.tip[2]-motion.grip[2],motion.grip[1]-motion.tip[1]).normalize();
    const row={kind,time:t,clip:p.current,nativeAttachment:!!motions[p.current].nativeAttachment,shaftError:shaft.angleTo(expected)*180/Math.PI,report:p.handGrip.report?structuredClone(p.handGrip.report):null,hands:{},feet:{r:point('foot_r').toArray(),l:point('foot_l').toArray()},pelvis:point('pelvis').toArray(),chest:point('spine_03').toArray()};
    for(const side of ['r','l']){const hand=p.bones['hand_'+side],palm=hand.localToWorld(p.palmGrips[side].clone()),handPoint=p.root.worldToLocal(palm.clone()),metacarpal=point('middle_01_'+side).sub(point('hand_'+side)).normalize(),forearm=point('hand_'+side).sub(point('lowerarm_'+side)).normalize();const target=side==='r'?motion.grip:(motion.secondaryGrip??motion.offGrip);
     row.hands[side]={palm:handPoint.toArray(),chestLocal:p.bones.spine_03.worldToLocal(palm.clone()).toArray(),wristDeviation:hand.quaternion.angleTo(p.neutralHandRotations[side])*180/Math.PI,metacarpalFlex:metacarpal.angleTo(forearm)*180/Math.PI,authoredGap:target?handPoint.distanceTo(new T.Vector3(target[0],target[2],-target[1])):null};}
    rows.push(row);
   }p.dispose();
  }return rows;
 });
 const output=process.argv[2]??'/tmp/ninja-naginata-runtime-before.json';fs.writeFileSync(output,JSON.stringify(rows,null,2));console.log(JSON.stringify({output,rows:rows.length,maxShaftError:Math.max(...rows.map(r=>r.shaftError)),maxPrimaryFlex:Math.max(...rows.map(r=>r.hands.r.metacarpalFlex)),maxSecondaryFlex:Math.max(...rows.map(r=>r.hands.l.metacarpalFlex)),maxLeftTargetGap:Math.max(...rows.map(r=>r.hands.l.authoredGap??0))}));
}finally{await browser.close();}
