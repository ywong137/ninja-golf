import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
if(process.env.NINJA_ENEMY_MODEL_DIR)await page.route('**/models/enemy-*.glb?*',r=>r.fulfill({path:process.env.NINJA_ENEMY_MODEL_DIR+'/'+new URL(r.request().url()).pathname.split('/').at(-1)}));
await page.goto((process.env.NINJA_BASE_URL??'http://localhost:5173')+'/tests/rig-stage.html');
const rows=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadInitialWarriorAssets}=await import('/src/actors.js'),{calibrateLegAnatomy,measureLegAnatomy}=await import('/tools/native-leg-anatomy.mjs'),{ENEMY_TYPES}=await import('/src/combat.js');await loadInitialWarriorAssets();const {enemyEmergenceFrame}=await import('/src/enemy-emergence.js'),{ENEMY_APPEARANCES}=await import('/src/enemy-appearances.js');const emergenceOptions={duration:.85,kind:'lantern'},emergenceDuration=enemyEmergenceFrame(0,emergenceOptions).duration,rows=[];
 for(let family=0;family<ENEMY_APPEARANCES.length;family++)for(let role=0;role<4;role++)for(const rate of [40,60,120])for(const direction of [1,-1]){
  const p=new Warrior(role,true,{family,palette:role}),saved=[];for(const[bone,rest]of p.golfRestPose)if(bone.isBone){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}p.root.updateMatrixWorld(true);
  const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(p.bones['thigh_'+s],p.bones['calf_'+s],p.bones['foot_'+s])]));for(const[b,pos,q,sc]of saved){b.position.copy(pos);b.quaternion.copy(q);b.scale.copy(sc);}
  const row={family,role,rate,direction,hip:0,ankle:0,hinge:0,minFlex:180,maxFlex:0,maxEmergenceFlex:0,worst:{},clips:new Set(),slip:{Jog_Fwd_Loop:[],Sprint_Loop:[]},previous:{}};
  for(let i=0;i<12*rate;i++){
   const t=i/rate,emerging=t>=8.5&&t<8.5+emergenceDuration?enemyEmergenceFrame(t-8.5,emergenceOptions):null,moving=t>=.25,sprinting=t>=4.5&&t<8.5;
   const speed=ENEMY_TYPES[role].speed*(sprinting?1.4:1);p.root.position.z+=moving&&!emerging?direction*speed/rate:0;p.update(t,1/rate,{moving,moveSpeed:speed,sprinting,emerging,focused:direction<0,moveAngle:direction<0?Math.PI:0});p.root.updateMatrixWorld(true);
   row.clips.add(p.current);
   const steady=(t>.6&&t<4.45)||(t>4.8&&t<8.45);
   for(const side of ['r','l']){const toe=p.bones['ball_'+side].getWorldPosition(new T.Vector3()),prev=row.previous[side];if(steady&&prev?.clip===p.current&&toe.y<.033&&prev.toe.y<.033)row.slip[p.current].push(Math.abs(toe.z-prev.toe.z)*rate);row.previous[side]={toe,clip:p.current};}
   for(const s of ['r','l']){const m=measureLegAnatomy(cal[s],p.bones['thigh_'+s],p.bones['calf_'+s],p.bones['foot_'+s]);for(const[key,v]of [['hip',Math.abs(m.hipTwist)],['ankle',Math.abs(m.ankleTwist)],['hinge',m.kneeDeviation]])if(v>row[key]){row[key]=v;row.worst[key]={time:t,clip:p.current,side:s,...m};}row.minFlex=Math.min(row.minFlex,m.kneeFlexion);if(emerging)row.maxEmergenceFlex=Math.max(row.maxEmergenceFlex,m.kneeFlexion);else row.maxFlex=Math.max(row.maxFlex,m.kneeFlexion);}
  }row.clips=[...row.clips];row.slip=Object.fromEntries(Object.entries(row.slip).map(([name,values])=>[name,{samples:values.length,median:values.sort((a,b)=>a-b)[Math.floor(values.length/2)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)}]));delete row.previous;rows.push(row);p.dispose();
 }return rows;
});fs.writeFileSync('/tmp/ninja-enemy-leg-frames.json',JSON.stringify({errors,rows},null,2));assert.deepEqual(errors,[]);assert.equal(rows.length,24);for(const row of rows){assert.deepEqual([...row.clips].sort(),['Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Ninja_Emerge_Start','Ninja_Emerge_Flight','Ninja_Emerge_Land'].sort());for(const [clip,median,p95,max]of [['Jog_Fwd_Loop',.3,.8,1.5],['Sprint_Loop',.65,4,5.5]]){const slip=row.slip[clip];assert.ok(slip.samples>=30&&slip.median<median&&slip.p95<p95&&slip.max<max,JSON.stringify(row));}assert.ok(row.hip<30&&row.ankle<15&&row.hinge<.1&&row.minFlex>-.05&&row.maxFlex<150&&row.maxEmergenceFlex<165,JSON.stringify(row));}console.log(JSON.stringify({cases:rows.length,...Object.fromEntries(['hip','ankle','hinge'].map(k=>[k,Math.max(...rows.map(r=>r[k]))]))}));}finally{await browser.close();}
