import fs from 'node:fs';
import {chromium} from 'playwright';
import path from 'node:path';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{output:{type:'string',default:'artifacts/reviews/blade-direction/report.json'},url:{type:'string',default:'http://localhost:5174'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/audit-blade-direction.mjs [--output REPORT.json] [--url http://localhost:5174]\nMeasures active strike windows in a muted browser. Covering hands are marked inactive. This diagnostic does not approve animation quality.');process.exit(0);}
const out=values.output;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.goto(values.url.replace(/\/$/,'')+'/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {motions,combatMotionName,sampleMotion}=await import('/src/motion.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {attackDefinition}=await import('/src/combat.js');
  const {withMotionTiming}=await import('/src/attack-timing.js');
  await loadWarriorAssets();const rows=[];
  for(let hero=0;hero<WARRIORS.length;hero++){
   const w=WARRIORS[hero],a=new Warrior(hero);
   for(const kind of ['light','heavy','musou'])for(let step=0;step<(kind==='musou'?1:kind==='light'?(w.lightComboLength??4):4);step++){
    const name=combatMotionName(w,kind,step),motion=motions[name],definition=withMotionTiming(attackDefinition(kind,step,w.combatStyle),motion);
    a.handGrip.restore();a.mixer.stopAllAction();a.current='';a.play(name,0,true);a.handGrip.engage(!!motion.twoHanded,0);a.mixer.update(0);
    const frame=t=>{
     a.handGrip.restore();a.actions.get(name).time=t;a.mixer.update(0);a.syncHeldObjects(sampleMotion(name,t));a.root.updateMatrixWorld(true);
     return [a.weapon,...(a.offhand?[a.offhand]:[])].map(o=>{
      const q=o.getWorldQuaternion(new T.Quaternion()),tip=new T.Vector3().fromArray(o.userData.tip),grip=o.userData.primaryGrip;
      tip.lerp(new T.Vector3(0,grip,0),.2);
      return {p:o.localToWorld(tip),edge:new T.Vector3(1,0,0).applyQuaternion(q),shaft:new T.Vector3(0,1,0).applyQuaternion(q),flat:new T.Vector3(0,0,1).applyQuaternion(q)};
     });
    };
    for(let impact=0;impact<definition.hits.length;impact++){
     const t=definition.hits[impact]/definition.duration*motion.duration,span=.045/definition.duration*motion.duration,stats=[];
     for(let k=0;k<=12;k++){
      const now=Math.max(.005,Math.min(motion.duration-.005,t-span+2*span*k/12)),dt=.002;
      const prev=frame(now-dt),curr=frame(now),next=frame(now+dt);
      for(let side=0;side<curr.length;side++){
       const f=curr[side],v=next[side].p.clone().sub(prev[side].p).divideScalar(2*dt),speed=v.length();
       const across=v.clone().addScaledVector(f.shaft,-v.dot(f.shaft)),transverse=across.length();if(transverse<.08)continue;
       across.normalize();stats.push({time:now,hand:side?'left':'right',speed,transverse,edge:across.dot(f.edge),flat:Math.abs(across.dot(f.flat)),flatSigned:across.dot(f.flat),thrust:Math.abs(v.dot(f.shaft))/Math.max(.001,speed)});
      }
     }
     for(const hand of ['right',...(a.offhand?['left']:[])]){
      const values=stats.filter(x=>x.hand===hand),total=values.reduce((s,x)=>s+x.transverse,0);if(!total)continue;
      const average=key=>values.reduce((s,x)=>s+x[key]*x.transverse,0)/total;
      const signed=average('edge'),edge=values.reduce((s,x)=>s+(w.weaponKind==='jian'?Math.abs(x.edge):x.edge)*x.transverse,0)/total;
      rows.push({active:!motion.impactHands||motion.impactHands[impact]===(hand==='right'?'r':'l'),hero:w.model,kind,step,clip:name,impact,hand,time:t,edge,signedEdge:signed,flat:average('flat'),flatSigned:average('flatSigned'),thrust:average('thrust'),maximumSpeed:Math.max(...values.map(x=>x.speed)),native:!!motion.nativeAttachment,samples:values});
     }
    }
   }a.dispose();
  }
  return {rows};
 });
 report.errors=errors;report.generatedAt=new Date().toISOString();report.notes='Diagnostic only. Review meaningful cutting intervals visually; thrusts and inactive offhands need separate interpretation.';
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify({rows:report.rows.length,errors,worst:report.rows.filter(r=>r.active&&r.flat>.65&&r.maximumSpeed>1&&r.thrust<.7).sort((a,b)=>b.flat-a.flat).map(({samples,...r})=>r)},null,2));
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
