import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const args=process.argv.slice(2);
if(args.includes('--help')){console.log('node tools/audit-weapon-roll.mjs [--output /tmp/ninja-weapon-roll.json]\nMeasures shaft movement and blade roll separately through all hero attacks. Uses a muted browser without WebGL.');process.exit(0);}
if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('Invalid arguments. Use --help.');
const output=args[1]||'/tmp/ninja-weapon-roll.json';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {motions,combatMotionName}=await import('/src/motion.js');await loadWarriorAssets();
  const cases=[...Array.from({length:4},(_,i)=>['light',i]),...Array.from({length:4},(_,i)=>['heavy',i]),['musou',0]],rows=[];
  const sample=(held,hand)=>({q:held.quaternion.clone(),axis:new T.Vector3(0,1,0).applyQuaternion(held.quaternion),face:new T.Vector3(0,0,1).applyQuaternion(held.quaternion),hand:hand.getWorldQuaternion(new T.Quaternion())});
  for(let hero=0;hero<WARRIORS.length;hero++)for(const [kind,step]of cases){
   const p=new Warrior(hero),name=combatMotionName(WARRIORS[hero],kind,step),duration=motions[name].duration;
   for(let i=0;i<30;i++)p.update(i/60,1/60,{});
   const previous={},sides=p.offhand?['r','l']:['r'];
   const stats=Object.fromEntries(sides.map(side=>[side,{hero,name,side,maxRoll:0,maxAxis:0,maxRotation:0,maxWrist:0,worst:null}]));
   for(let frame=0;frame<=Math.ceil(duration*240);frame++){
    const t=Math.min(duration,frame/240);p.update(2+t,1/240,{action:{kind,step,token:1,time:t,duration}});p.root.updateMatrixWorld(true);
    for(const side of sides){
     const held=side==='r'?p.weapon:p.offhand,now=sample(held,p.bones['hand_'+side]),before=previous[side],stat=stats[side];
     if(before&&t>.08){
      const transport=new T.Quaternion().setFromUnitVectors(before.axis,now.axis),face=before.face.clone().applyQuaternion(transport);
      const roll=Math.atan2(new T.Vector3().crossVectors(face,now.face).dot(now.axis),face.dot(now.face))*180/Math.PI;
      const axis=before.axis.angleTo(now.axis)*180/Math.PI,rotation=before.q.angleTo(now.q)*180/Math.PI,wrist=before.hand.angleTo(now.hand)*180/Math.PI;
      if(Math.abs(roll)>stat.maxRoll){stat.maxRoll=Math.abs(roll);stat.worst={t,roll,axis,rotation,wrist,axisBefore:before.axis.toArray(),axisAfter:now.axis.toArray()};}
      stat.maxAxis=Math.max(stat.maxAxis,axis);stat.maxRotation=Math.max(stat.maxRotation,rotation);stat.maxWrist=Math.max(stat.maxWrist,wrist);
     }
     previous[side]=now;
    }
   }
   rows.push(...Object.values(stats));p.dispose();
  }
  return rows;
 });
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.toSorted((a,b)=>b.maxRoll-a.maxRoll).slice(0,12),null,2));console.log('Saved',output);
}finally{await browser.close();}
