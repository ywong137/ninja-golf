import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
import {routeModelDirectory} from './route-model-directory.mjs';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{output:{type:'string',default:'artifacts/reviews/full-body-cut'},candidate:{type:'string',default:'artifacts/reviews/full-body-cut/candidate'},model:{type:'string',default:'kaede'},index:{type:'string',default:'3'},'still-only':{type:'boolean'},'follow-root':{type:'boolean'},'reverse-grip':{type:'boolean'},times:{type:'string'},detail:{type:'boolean'},wide:{type:'boolean'},audit:{type:'boolean'},body:{type:'boolean'},limbs:{type:'boolean'},'right-side':{type:'boolean'},'grip-roll':{type:'string',default:'0'}}});
const output=values.output,release='/Users/yishan/.codex/worktrees/shared-pose-transitions/ninja-golf';fs.mkdirSync(output,{recursive:true});
const report=JSON.parse(fs.readFileSync(`${values.candidate}/${values.model}.glb.json`)),name=report.clip??'Ace_Reference_Cut';
const motions=JSON.parse(fs.readFileSync(release+'/src/motion-data.json'));
motions[name]={duration:report.duration,twoHanded:report.pairedSpacing!=null,pairedGrip:report.pairedSpacing!=null,gripSpacing:report.pairedSpacing??.1,primaryGrip:values.model==='monk'?-.7:.095,nativeAttachment:true,nativeStanceFeet:true,nativeKneeHinges:true,nativeKneeHeading:true,athleticAttack:true,rootAdvance:0,impacts:[],poses:[{t:0},{t:1}]};
if(fs.existsSync(values.candidate+'/'+values.model+'-motion.json'))motions[name]=JSON.parse(fs.readFileSync(values.candidate+'/'+values.model+'-motion.json'))[name];
const source=fs.readFileSync(release+'/src/motion.js','utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await disableHmr(page);await routeModelDirectory(page,path.resolve(values.candidate));
 await page.route('**/src/motion.js*',r=>r.fulfill({contentType:'application/javascript',body:source}));
 await page.goto('http://localhost:5174/tests/rig-stage.html');
 await page.evaluate(async({name,duration,index,detail,wide,gripRoll,body,limbs,rightSide,followRoot,twoHanded,dualWield,reverseGrip})=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();
  const actors=[new Warrior(index),new Warrior(index)],scene=new T.Scene();
  if(reverseGrip)for(const a of actors)for(const side of ['r','l'])a.handGrip.profiles.sword[side].frame.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI));
  for(const a of actors)a.handGrip.profiles.sword.r.frame.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),gripRoll));scene.background=new T.Color('#69767d');
  scene.add(new T.HemisphereLight(0xffffff,0x45413a,2));const sun=new T.DirectionalLight(0xfff6e8,3);sun.position.set(-3,5,5);scene.add(sun,new T.GridHelper(30,60,0x84959b,0x7a898e));
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,820);document.body.append(renderer.domElement);renderer.setScissorTest(true);
  const labels=document.createElement('div');labels.style='position:absolute;inset:18px 0 auto;color:white;display:flex;font:19px sans-serif;text-align:center';labels.innerHTML=['Prototype · three-quarter view','Prototype · side view'].map(t=>'<div style="width:50%">'+t+'</div>').join('');document.body.append(labels);
  const clock=document.createElement('div');clock.style='position:absolute;bottom:24px;left:24px;color:white;font:20px sans-serif';document.body.append(clock);
  const camera=new T.PerspectiveCamera(37,750/820,.01,100);let time=0;
  const film=document.createElement('canvas');film.width=1500;film.height=820;const ink=film.getContext('2d');
  actors.forEach(a=>a.play(name,0,true));
  window.drawStudy=(t,speedLabel='')=>{
   time+=1/60;
   for(let i=0;i<2;i++){
    const a=actors[i];
    a.update(time,1/60,{previewPose:{clip:name,time:t}});
    for(const other of actors)scene.remove(other.root);scene.add(a.root);
    const center=new T.Vector3(0,detail?1.65:1.10,0);if(followRoot){const p=a.bones.pelvis.getWorldPosition(new T.Vector3());center.x=p.x;center.z=p.z;}camera.position.copy(center).add(detail?(i===1?new T.Vector3(0,3,.6):new T.Vector3(.2,.05,3.3)):(i===1?new T.Vector3((wide?8:5.1)*(rightSide?-1:1),.65,.4):new T.Vector3(wide?3.7:2.4,.55,wide?7.3:4.7)));camera.lookAt(center);
    renderer.setViewport(i*750,0,750,820);renderer.setScissor(i*750,0,750,820);renderer.render(scene,camera);
   }
   clock.textContent=`${t.toFixed(2)} s / ${duration.toFixed(2)} s  ${speedLabel}   ·   Motion study; not published`;
   ink.drawImage(renderer.domElement,0,0);ink.fillStyle='rgba(0,0,0,.25)';ink.fillRect(0,0,1500,55);ink.fillRect(0,775,1500,45);ink.fillStyle='white';ink.font='22px sans-serif';ink.fillText('Prototype · three-quarter view',24,34);ink.fillText('Prototype · side view',774,34);ink.fillText(clock.textContent,24,806);
  };
  window.captureStudy=async()=>{
   const chunks=[],stream=film.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});recorder.start();
   for(const speed of [1,.5])for(let repeat=0;repeat<2;repeat++){
    const begin=performance.now(),total=duration/speed+.9;
    while((performance.now()-begin)/1000<total){const elapsed=(performance.now()-begin)/1000;window.drawStudy(Math.max(0,Math.min(duration,(elapsed-.3)*speed)),`${speed}x`);await new Promise(r=>requestAnimationFrame(r));}
   }
   recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  };
  window.auditStudy=async()=>{
   const {headSurfaceMetadata,measureTriangleHeadClearance}=await import('/tools/blade-head-surface.mjs');
   const a=actors[0],surfaces=headSurfaceMetadata({scene:a.model}),parts=[];
   if(body||limbs)a.model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const {skinIndex,skinWeight}=mesh.geometry.attributes,index=mesh.geometry.index;
    // A paired weapon must touch its holding hand. Keep the forearm, body,
    // and legs in the collision check; omit only the fitted holding fingers.
    const limbNames=dualWield?/^(upperarm_[rl]|lowerarm_[rl]|thigh_[rl]|calf_[rl]|foot_[rl]|ball_[rl])$/:twoHanded?/^(upperarm_[rl]|lowerarm_[rl]|thigh_[rl]|calf_[rl]|foot_[rl]|ball_[rl])$/:/^(upperarm_l|lowerarm_l|hand_l|\w+_0[123]_l|thigh_[rl]|calf_[rl]|foot_[rl]|ball_[rl])$/;
    const weights=Array.from({length:skinIndex.count},(_,i)=>{let sum=0;for(let k=0;k<4;k++){const bone=mesh.skeleton.bones[skinIndex.getComponent(i,k)].name;if((body&&/^(pelvis|spine_\d+|neck_\d+)$/.test(bone))||(limbs&&limbNames.test(bone)))sum+=skinWeight.getComponent(i,k);}return sum;});
    const triangles=[];for(let i=0;i<(index?index.count:skinIndex.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.some(v=>weights[v]>.5))triangles.push(ids);}
    if(triangles.length)surfaces.push({mesh,triangles});
   });
   for(const weapon of [a.weapon,...(a.offhand?[a.offhand]:[])])weapon.traverse(mesh=>{if(!mesh.isMesh)return;const pos=mesh.geometry.attributes.position,ix=mesh.geometry.index;const triangles=[];for(let i=0;i<(ix?ix.count:pos.count);i+=3)triangles.push([0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,ix?ix.getX(i+k):i+k)));parts.push({mesh,triangles});});
   const report={region:body?'head and torso':'head',surfaceTriangles:surfaces.reduce((n,s)=>n+s.triangles.length,0),minimumClearance:.03,crossingSamples:0,crossingTimes:[],closest:null,parts:parts.map(p=>p.mesh.name),path:[]};
   for(let i=0;i<=Math.ceil(duration*120);i++){
    const t=Math.min(i/120,duration);a.update(i/120,1/120,{previewPose:{clip:name,time:t}});a.root.updateMatrixWorld(true);
    const sets=Object.fromEntries(parts.map(({mesh,triangles},j)=>[mesh.name+' '+j,triangles.map(tri=>tri.map(p=>p.clone().applyMatrix4(mesh.matrixWorld)))]));
    const hit=measureTriangleHeadClearance(surfaces,sets,{distanceCap:.03});
    report.path.push({time:t,tip:a.weapon.localToWorld(new T.Vector3().fromArray(a.weapon.userData.tip)).toArray(),shaft:new T.Vector3(0,1,0).applyQuaternion(a.weapon.getWorldQuaternion(new T.Quaternion())).toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(a.weapon.getWorldQuaternion(new T.Quaternion())).toArray(),hilt:a.weapon.getWorldPosition(new T.Vector3()).toArray(),...(a.offhand?{offTip:a.offhand.localToWorld(new T.Vector3().fromArray(a.offhand.userData.tip)).toArray(),offEdge:new T.Vector3(1,0,0).applyQuaternion(a.offhand.getWorldQuaternion(new T.Quaternion())).toArray()}:{} )});
    if(hit.minimumClearance<report.minimumClearance){report.minimumClearance=hit.minimumClearance;report.closest={time:t,...hit.closest};}if(hit.crossings){report.crossingSamples++;report.crossingTimes.push(t);}
   }
   return report;
  };
  window.drawStudy(0);
 },{name,duration:report.duration,index:Number(values.index),detail:!!values.detail,wide:!!values.wide,gripRoll:Number(values['grip-roll']),body:!!values.body,limbs:!!values.limbs,rightSide:!!values['right-side'],followRoot:!!values['follow-root'],twoHanded:motions[name].twoHanded,dualWield:report.dualWield??values.model==='shinobi',reverseGrip:!!values['reverse-grip']});
 for(const time of (values.times?values.times.split(',').map(Number):[0,.13,.21,.28,.36,.55,.72,.98].map(t=>t*report.duration))){await page.evaluate(t=>window.drawStudy(t),time);await page.screenshot({path:`${output}/study-${time.toFixed(2)}.png`});}
 if(!values['still-only']){const video=await page.evaluate(()=>window.captureStudy());fs.writeFileSync(`${output}/study.webm`,Buffer.from(video,'base64'));}
 if(values.audit){const audit=await page.evaluate(()=>window.auditStudy());fs.writeFileSync(output+'/clearance.json',JSON.stringify(audit,null,2));console.log(JSON.stringify({...audit,path:undefined}));}
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({errors,output}));
}finally{await browser.close();}
