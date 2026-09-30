import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';import{disableHmr}from'../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});try{const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');const rows=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();const rows=[];
 for(const [from,to,ramp] of [[135,135,0],[90,135,.5],[0,135,0],[90,-90,0]])for(const rate of [60,120,240,480]){
  const p=new Warrior(0),dt=1/rate,row={from,to,ramp,rate,ankle:0,toe:0,knee:0,pelvis:0,shoe:0,hip:0,minHeight:Infinity,maxDrop:0,worst:{}},previous={};
  for(let i=0;i<3*rate;i++){
   const time=i/rate,blend=ramp===0?(time>=1?1:0):T.MathUtils.clamp((time-1)/ramp,0,1),angle=(from+(to-from)*blend)*Math.PI/180;
   p.root.position.addScaledVector(new T.Vector3(Math.sin(angle),0,Math.cos(angle)),5.3*dt);p.update(time,dt,{moving:true,focused:true,moveAngle:angle,moveSpeed:5.3,groundHeight:()=>0});p.root.updateMatrixWorld(true);
   if(i<rate/2)continue;
   for(const side of ['r','l']){
    const b=p.bones,ankle=b['foot_'+side].getWorldPosition(new T.Vector3()),toe=b['ball_'+side].getWorldPosition(new T.Vector3()),knee=b['calf_'+side].getWorldPosition(new T.Vector3()),pelvis=b.pelvis.getWorldPosition(new T.Vector3()),shoe=b['foot_'+side].getWorldQuaternion(new T.Quaternion()).normalize(),hip=b.pelvis.getWorldQuaternion(new T.Quaternion()).normalize();
    row.minHeight=Math.min(row.minHeight,pelvis.y);row.maxDrop=Math.max(row.maxDrop,-(p.runFootwork.turnPlanner?.lower??0));
    if(previous[side])for(const[k,v]of Object.entries({ankle:ankle.distanceTo(previous[side].ankle)/dt,toe:toe.distanceTo(previous[side].toe)/dt,knee:knee.distanceTo(previous[side].knee)/dt,pelvis:Math.abs(pelvis.y-previous[side].pelvis.y)/dt,shoe:shoe.angleTo(previous[side].shoe)/dt,hip:hip.angleTo(previous[side].hip)/dt})){if(v>row[k]){row[k]=v;row.worst[k]={time,phase:p.runPhase,side,support:p.runFootwork.turnPlanner?.feet[side].support};}}
    previous[side]={ankle,toe,knee,pelvis,shoe,hip};
   }
  }rows.push(row);p.dispose();
 }
 // A paused animation seek must not reuse another phase's world anchors.
 for(let hero=0;hero<6;hero++){
  const p=new Warrior(hero),options={moving:true,focused:true,moveAngle:Math.PI*.75,moveSpeed:5.3};
  for(let i=0;i<60;i++)p.update(i/60,1/60,options);
  const capture=phase=>{p.runPhase=phase;p.update(1,0,options);p.root.updateMatrixWorld(true);return ['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'].flatMap(n=>[...p.bones[n].getWorldPosition(new T.Vector3()).toArray(),...p.bones[n].getWorldQuaternion(new T.Quaternion()).toArray()]);};
  const first=capture(.73);capture(.11);const repeated=capture(.73);
  if(Math.max(...first.map((v,i)=>Math.abs(v-repeated[i])))>1e-5)throw Error('Static run seek depends on the previous phase: hero '+hero);
  p.dispose();
 }
 return rows;
});fs.writeFileSync('/tmp/ninja-run-turn-continuity.json',JSON.stringify(rows,null,2));for(let i=0;i<rows.length;i+=4){
 const coarse=rows[i+2],fine=rows[i+3];
 for(const key of ['ankle','toe','knee','shoe','hip']){assert.ok(coarse[key]<rows[i+1][key]*1.3,JSON.stringify({coarse,previous:rows[i+1],key}));assert.ok(fine[key]<coarse[key]*1.15,JSON.stringify({coarse,fine,key}));}
 assert.ok(fine.pelvis<coarse.pelvis*1.35,JSON.stringify({coarse,fine}));
 assert.ok(fine.minHeight>.70&&fine.maxDrop<.006,JSON.stringify(fine));
}
console.log('Turn continuity: '+rows.length+' cases, with 240/480 Hz convergence.');}finally{await browser.close();}
