import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1800,height:900}});await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js'),{motions,sampleMotion,combatMotionName}=await import('/src/motion.js'),{WARRIORS}=await import('/src/warriors.js');await loadWarriorAssets();
  const prefixes=['Odachi','Twin','Naginata','Fan','Ring','Sickle'],players=prefixes.map((_,i)=>new Warrior(i)),reports=[];
  function sample(p,name,time){p.mixer.stopAllAction();p.current='';p.play(name,0,true);p.actions.get(name).time=time;p.mixer.update(0);p.syncHeldObjects();p.root.updateMatrixWorld(true);}
  for(let i=0;i<players.length;i++){
   const p=players[i],prefix=prefixes[i];let secondaryGap=0,minimumKnee=.99,minimumFreeWrist=1,footDrift=0;
   for(const kind of ['Loop','Impact','Break']){
    const name=`${prefix}_Guard_${kind}`,clip=motions[name];sample(p,name,0);const feet=['r','l'].map(side=>p.bones['foot_'+side].getWorldPosition(new T.Vector3()));
    for(let frame=0;frame<=30;frame++){
     const time=clip.duration*frame/30;sample(p,name,time);const pose=sampleMotion(name,time);
     if(clip.twoHanded){const shaft=new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize(),expected=p.weapon.localToWorld(new T.Vector3(0,p.weapon.userData.primaryGrip,0)).addScaledVector(shaft,-clip.gripSpacing*p.root.scale.x),actual=p.bones.hand_l.localToWorld(p.palmGrips.l.clone());secondaryGap=Math.max(secondaryGap,expected.distanceTo(actual));}
     if(pose.freeHand!==undefined){const wrist=p.bones.hand_l.getWorldPosition(new T.Vector3()),forearm=wrist.clone().sub(p.bones.lowerarm_l.getWorldPosition(new T.Vector3())).normalize(),hand=p.bones.middle_01_l.getWorldPosition(new T.Vector3()).sub(wrist).normalize();minimumFreeWrist=Math.min(minimumFreeWrist,forearm.dot(hand));}
     for(const [j,side]of ['r','l'].entries()){const hip=p.bones['thigh_'+side].getWorldPosition(new T.Vector3()),knee=p.bones['calf_'+side].getWorldPosition(new T.Vector3()),ankle=p.bones['foot_'+side].getWorldPosition(new T.Vector3());footDrift=Math.max(footDrift,feet[j].distanceTo(ankle));const axis=ankle.clone().sub(hip),bend=knee.sub(hip);bend.addScaledVector(axis,-bend.dot(axis)/axis.lengthSq());minimumKnee=Math.min(minimumKnee,bend.z);}
    }
   }
   const transitions=[];p.oneShot=0;p.update(0,.02,{blocking:true});transitions.push(p.current);p.update(.02,.02,{blocking:true,guardHitToken:1});transitions.push(p.current);p.update(.04,.02,{blocking:true,parry:.24,guardHitToken:2});transitions.push(p.current);p.update(.06,.02,{guardBreak:.4,guardHitToken:3});transitions.push(p.current);
   const attackName=combatMotionName(WARRIORS[i],'light',0);p.update(.08,.02,{action:{token:1234,kind:'light',step:0,duration:motions[attackName].duration,time:0}});transitions.push(p.current);p.update(.1,.02,{blocking:true,guardHitToken:0});transitions.push(p.current);p.update(.12,.02,{});transitions.push(p.current);
   reports.push({hero:WARRIORS[i].model,secondaryGap,minimumKnee,minimumFreeWrist,footDrift,transitions,attackName,prefix});
  }
  const scene=new T.Scene();scene.background=new T.Color('#53616b');scene.add(new T.HemisphereLight(0xffffff,0x333943,2.4));const light=new T.DirectionalLight(0xfff1dc,3);light.position.set(2,5,4);scene.add(light);const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#434e50'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
  const camera=new T.PerspectiveCamera(35,2,.01,100);camera.position.set(0,3.4,11.7);camera.lookAt(0,1,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1800,900);document.body.append(renderer.domElement);players.forEach((p,i)=>{p.root.position.x=(i-2.5)*1.55;scene.add(p.root);});window.__guards={players,prefixes,sample,scene,camera,renderer};return reports;
 });
 console.log(JSON.stringify(reports,null,2));
 for(const [kind,time]of [['Loop',.4],['Impact',.07],['Break',.12]]){await page.evaluate(({kind,time})=>{const {players,prefixes,sample,scene,camera,renderer}=window.__guards;players.forEach((p,i)=>sample(p,`${prefixes[i]}_Guard_${kind}`,time));renderer.render(scene,camera);},{kind,time});await page.screenshot({path:`/tmp/ninja-guard-${kind.toLowerCase()}.png`});}
 for(const r of reports){assert.ok(r.secondaryGap<.015,JSON.stringify(r));assert.ok(r.minimumKnee>.05,JSON.stringify(r));assert.ok(r.minimumFreeWrist>.65,JSON.stringify(r));assert.ok(r.footDrift<.015,JSON.stringify(r));assert.deepEqual(r.transitions.slice(0,6),[`${r.prefix}_Guard_Loop`,`${r.prefix}_Guard_Impact`,`${r.prefix}_Guard_Impact`,`${r.prefix}_Guard_Break`,r.attackName,`${r.prefix}_Guard_Loop`]);assert.ok(!r.transitions[6].includes('_Guard_'),'Released guard returns to ready stance');}
}finally{await browser.close();}
