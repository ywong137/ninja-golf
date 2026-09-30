import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
const rows=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{measureLegAnatomy}=await import('/src/leg-anatomy.js'),{WARRIORS}=await import('/src/warriors.js');const {runSupportPoint}=await import('/tools/run-contact-measurement.mjs');await loadWarriorAssets();const rows=[];
 function distance(a,b,c,d){const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B;let s=den>1e-12?T.MathUtils.clamp((B*E-C*D)/den,0,1):0,t=(B*s+E)/C;if(t<0){t=0;s=T.MathUtils.clamp(-D/A,0,1)}else if(t>1){t=1;s=T.MathUtils.clamp((B-D)/A,0,1)}return a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));}
 for(let hero=0;hero<6;hero++)for(const stagger of [0,.5])for(const [from,to,ramp] of [[90,135,.5],[0,135,0],[135,90,.5],[90,-90,0]]){const degrees=from;
  const p=new Warrior(hero),speed=5.3*WARRIORS[hero].speed;p.runPhase=stagger;let angle=degrees*Math.PI/180,travel=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
  const row={hero:WARRIORS[hero].model,stagger,from,to,ramp,shin:Infinity,thigh:Infinity,drift:0,hip:0,ankle:0,reach:0,shortReleases:0,loadedHip:0,worst:{}};const holds={};
  for(let i=0;i<360;i++){const blend=ramp===0?(i/120>=1?1:0):T.MathUtils.clamp((i/120-1)/ramp,0,1);angle=(from+(to-from)*blend)*Math.PI/180;travel.set(Math.sin(angle),0,Math.cos(angle));p.root.position.addScaledVector(travel,speed/120);p.update(i/120,1/120,{moving:true,focused:true,moveAngle:angle,moveSpeed:speed,groundHeight:()=>0});p.root.updateMatrixWorld(true);if(i<40)continue;
   const points={};for(const side of ['r','l']){const b=p.bones,hip=b['thigh_'+side].getWorldPosition(new T.Vector3()),knee=b['calf_'+side].getWorldPosition(new T.Vector3()),ankle=b['foot_'+side].getWorldPosition(new T.Vector3()),phase=(p.runPhase+(side==='r'?0:.5))%1;points[side]={hip,knee,ankle};const plan=p.runFootwork.turnPlanner?.feet[side];if(plan?.releaseType==='reach'&&Math.abs(plan.support-phase)<1e-8&&phase<.1)row.shortReleases++;
    const contact=runSupportPoint(p,side);if(contact.loaded){if(holds[side]?.id!==contact.id)holds[side]={id:contact.id,p:contact.point.clone()};row.drift=Math.max(row.drift,contact.point.distanceTo(holds[side].p));}else holds[side]=null;
    const m=measureLegAnatomy(p.runFootwork.anatomy[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]);if(Math.abs(m.hipTwist)>row.hip){row.hip=Math.abs(m.hipTwist);row.worst.hip={phase,side,angle:angle*180/Math.PI,time:i/120,heading:(p.runFootwork.turnPlanner?.localHeading??0)*180/Math.PI,width:p.runFootwork.turnPlanner?.width(side),m,hip:hip.toArray(),knee:knee.toArray(),ankle:ankle.toArray()};}row.ankle=Math.max(row.ankle,Math.abs(m.ankleTwist));if(p.runFootwork.gaitContacts?.stance[side]??phase<.28)row.loadedHip=Math.max(row.loadedHip,Math.abs(m.hipTwist));row.reach=Math.max(row.reach,hip.distanceTo(ankle)/(hip.distanceTo(knee)+knee.distanceTo(ankle)));
   }const{r,l}=points;for(const[key,v]of [['shin',distance(r.knee,r.ankle,l.knee,l.ankle)],['thigh',distance(r.hip.clone().lerp(r.knee,.25),r.knee,l.hip.clone().lerp(l.knee,.25),l.knee)]])if(v<row[key]){row[key]=v;row.worst[key]={phase:p.runPhase,r:r.ankle.toArray(),l:l.ankle.toArray()};}
  }rows.push(row);p.dispose();
 }return rows;
});fs.writeFileSync('/tmp/ninja-run-turn-anatomy.json',JSON.stringify(rows,null,2));assert.equal(rows.length,48);
for(const row of rows){
 assert.ok(row.shortReleases<=1,JSON.stringify(row));
 assert.ok(row.shin>.08&&row.thigh>.15,JSON.stringify(row));
 assert.ok(row.drift<.035&&row.loadedHip<30&&row.hip<35&&row.ankle<20,JSON.stringify(row));
}
console.log(JSON.stringify({cases:rows.length,...Object.fromEntries(['hip','loadedHip','ankle','drift'].map(k=>[k,Math.max(...rows.map(r=>r[k]))]))}));}finally{await browser.close();}
