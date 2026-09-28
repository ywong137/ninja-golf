import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../../tests/native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../native-arm-anatomy.mjs';
import {verifyAnimationReplacement} from '../verify-animation-replacement.mjs';
const {values}=parseArgs({options:{model:{type:'string'},before:{type:'string'},output:{type:'string'},rate:{type:'string',default:'480'},'preserve-feet':{type:'boolean'},'feet-only':{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/check-guards.mjs --model GUARDS.glb --before CLEAVE.glb --output REPORT.json [--rate 480] [--preserve-feet] [--feet-only]\nChecks native anatomy, grip closure, skin clearance, and preservation. --preserve-feet compares actual ankle/toe paths and foot rotations with --before. --feet-only requires that flag and omits anatomy, skin, and binary preservation checks. Does not certify travel transitions.');process.exit(0);}
if(!values.model||!values.before||!values.output)throw Error('Supply --model, --before, and --output.');
if(values['feet-only']&&!values['preserve-feet'])throw Error('--feet-only requires --preserve-feet.');
const file=values.model,rate=Number(values.rate);if(!Number.isInteger(rate)||rate<120||rate>1920)throw Error('--rate must be an integer from 120 through 1920.');
const g=await loadNativeSkin(file),metadata=skinGroups(g),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const point=n=>bones[n].getWorldPosition(new T.Vector3()),q=n=>bones[n].getWorldQuaternion(new T.Quaternion()),profiles=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword,neutral=JSON.parse(fs.readFileSync(new URL('./heavy-cleave-frames.json',import.meta.url))),calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));
const names=g.animations.map(a=>a.name).filter(n=>n.startsWith('Odachi_Guard_')),report={rate,passed:true,clips:{},preservation:values['feet-only']?null:verifyAnimationReplacement(values.before,file,names.map(n=>[n,n]))};
const source=values['preserve-feet']?await loadNativeSkin(values.before):null;
report.scope=values['feet-only']?'foot-path comparison only; anatomy, skin, and binary preservation were not checked':'full';
for(const name of names){const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();const row={samples:0,maxGap:0,maxWrist:0,violations:[],skin:{}};
 const sourceClip=source?.animations.find(c=>c.name===name);
 if(source&&!sourceClip)throw Error('The reference lacks '+name+'.');
 const sourceAction=sourceClip?source.mixer.clipAction(sourceClip).setLoop(T.LoopOnce,1):null;
 if(sourceAction){sourceAction.clampWhenFinished=true;sourceAction.play();row.feet={maxPositionError:0,maxRotationDegrees:0,worstPosition:null,worstRotation:null};}
 for(let i=0;i<=Math.ceil(clip.duration*rate);i++){const time=Math.min(i/rate,clip.duration-1e-7);g.mixer.setTime(time);g.scene.updateMatrixWorld(true);
 if(source){
  const sourceTime=time/clip.duration*sourceClip.duration;source.mixer.setTime(sourceTime);source.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){
   for(const prefix of ['foot_','ball_']){
    const bone=prefix+side,error=point(bone).distanceTo(source.scene.getObjectByName(bone).getWorldPosition(new T.Vector3()));
    if(error>row.feet.maxPositionError){row.feet.maxPositionError=error;row.feet.worstPosition={bone,time,sourceTime};}
   }
   const bone='foot_'+side,degrees=q(bone).normalize().angleTo(source.scene.getObjectByName(bone).getWorldQuaternion(new T.Quaternion()).normalize())*180/Math.PI;
   if(degrees>row.feet.maxRotationDegrees){row.feet.maxRotationDegrees=degrees;row.feet.worstRotation={bone,time,sourceTime};}
  }
 }
 if(values['feet-only']){row.samples++;continue;}
 const palms=Object.fromEntries(['r','l'].map(s=>[s,point('hand_'+s).add(new T.Vector3().fromArray(profiles[s].center).applyQuaternion(q('hand_'+s)))])),shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(q('hand_r'));row.maxGap=Math.max(row.maxGap,palms.r.clone().addScaledVector(shaft,-.15).distanceTo(palms.l));row.samples++;
 for(const side of ['r','l']){const anatomy=measureArmAnatomy(calibration[side],captureArmPose(bones,side));for(const violation of armAuthoringViolations(anatomy,{maxHingeDeviationDegrees:.5}))row.violations.push({time,side,...violation});row.maxWrist=Math.max(row.maxWrist,bones['hand_'+side].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(neutral[side].neutralHandRotation).normalize())*180/Math.PI);
 const skin=measureArmSkin(g,metadata,side);for(const type of ['forearmTorso_'+side,'upperarmTorso_'+side,'fold_'+side]){const item=skin[type];if(item.pairs>(row.skin[type]?.pairs??-1))row.skin[type]={...item,time};}}
 }
 action.stop();sourceAction?.stop();if(row.feet&&(row.feet.maxPositionError>.003||row.feet.maxRotationDegrees>1))report.passed=false;
 if(row.maxGap>.001||row.maxWrist>14.01||row.violations.length||Object.values(row.skin).some(s=>s.pairs))report.passed=false;report.clips[name]=row;console.log(name,JSON.stringify(row));
}
fs.writeFileSync(values.output,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
