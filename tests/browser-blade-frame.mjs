import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';

// Golf and existing Ready transforms come from commit 00c1e3a. Ace_Ready comes
// from the reviewed native cut. A before/after comparison checked all 90 golf
// samples and found no transform change from the Ace weapon-mount correction.
// Preserve every full golf transform, including the club head's lateral offset.
const baseline=JSON.parse(readFileSync(new URL('./fixtures/weapon-ready-golf.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
  const page=await browser.newPage();await disableHmr(page);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.NINJA_TEST_URL||'http://localhost:5173/tests/rig-stage.html');
  const report=await page.evaluate(async baseline=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
    const {motions,sampleMotion}=await import('/src/motion.js');
    const {WARRIORS}=await import('/src/warriors.js');
    const {attackDefinition}=await import('/src/combat.js');
    await loadWarriorAssets();
    const Y=new T.Vector3(0,1,0),Q=()=>new T.Quaternion();
    const report={samples:0,clips:0,enemies:0,transitionSamples:0,maxAxisError:0,maxNativeAxisError:0,maxPalmFrameError:0,maxGripError:0,maxReadyError:0,maxGolfError:0,maxFadeError:0,maxLegacyFrameDrift:0,worst:null};
    report.pairedSamples=0;report.maxPairedGap=0;report.maxPairedCenterError=0;
    const setPose=(p,name,time,golf=false)=>{
      p.handGrip?.restore();p.mixer.stopAllAction();p.current='';p.play(name,0,true);
      p.actions.get(name).time=time;p.mixer.update(0);
      p.syncHeldObjects(sampleMotion(name,time),golf);p.root.updateMatrixWorld(true);
    };
    const sides=p=>p.offhand?['r','l']:['r'];
    const held=(p,side)=>side==='r'?p.weapon:p.offhand;
    const paired=p=>motions[p.current]?.pairedGrip&&p.handGrip?.secondaryWeight>.999&&(!p.heldBlend||p.mixer.time>=p.heldBlend.start+p.heldBlend.duration);
    const palms=p=>['r','l'].map(side=>p.bones['hand_'+side].localToWorld(p.palmGrips[side].clone()));
    // Undo only the native-to-authored swing correction. The remaining weapon
    // rotation relative to the live hand must be one fixed attachment frame.
    function frame(p,side,pose){
      const h=p.bones['hand_'+side].getWorldQuaternion(Q()).normalize();
      const from=side==='r'?pose.grip:pose.offGrip,to=side==='r'?pose.tip:pose.offTip;
      if(!from||!to)return null;
      const authored=new T.Vector3(to[0]-from[0],to[2]-from[2],from[1]-to[1]).normalize().applyQuaternion(p.root.getWorldQuaternion(Q()));
      const native=p.shaftAxes[side].clone().applyQuaternion(h).normalize();
      // Paired polearm clips align the shaft between both live palms. Undo
      // that measured correction before testing the fixed primary-hand frame.
      const pair=paired(p)?palms(p):null;
      const correction=pair?Q().setFromUnitVectors(native,pair[0].clone().sub(pair[1]).normalize()):motions[p.current]?.nativeAttachment?Q():Q().setFromUnitVectors(native,authored);
      const w=held(p,side).getWorldQuaternion(Q()).normalize();
      const mountRoll=motions[p.current]?.weaponGripRoll??0;
      const relative=h.clone().invert().multiply(correction.clone().invert()).multiply(w).multiply(Q().setFromAxisAngle(Y,-mountRoll)).normalize();
      const roll=side==='r'?pose.roll||0:pose.offRoll||0;
      const legacy=Q().setFromUnitVectors(Y,authored).multiply(Q().setFromAxisAngle(Y,roll));
      return{h,authored,correction,w,relative,legacyRelative:h.clone().invert().multiply(correction.clone().invert()).multiply(legacy)};
    }
    function checkGrip(p,side){
      const palm=p.bones['hand_'+side].localToWorld(p.palmGrips[side].clone());
      const weapon=held(p,side),station=new T.Vector3(0,weapon.userData.primaryGrip,0);
      const gap=palm.distanceTo(weapon.localToWorld(station));
      if(paired(p)){
        const pair=palms(p),spacing=motions[p.current].gripSpacing;
        const center=pair[0].add(pair[1]).multiplyScalar(.5);
        const expected=weapon.localToWorld(new T.Vector3(0,weapon.userData.primaryGrip-spacing*.5,0));
        report.pairedSamples++;report.maxPairedGap=Math.max(report.maxPairedGap,gap);
        report.maxPairedCenterError=Math.max(report.maxPairedCenterError,center.distanceTo(expected));
      }else report.maxGripError=Math.max(report.maxGripError,gap);
    }
    for(const item of baseline){
      const p=new Warrior(item.hero);
      for(const b of item.rows){
        const golf=b.name.startsWith('Golf');setPose(p,b.name,b.t,golf);
        const object=golf?p.club:p.weapon;
        // GLB rotations have float32 length residue. angleTo assumes unit
        // quaternions; otherwise even a rotation compared with itself can fail.
        const error=Math.max(object.quaternion.clone().normalize().angleTo(Q().fromArray(b.q).normalize()),object.position.distanceTo(new T.Vector3(...b.p)),object.scale.distanceTo(new T.Vector3(...b.s)),b.off?p.offhand.quaternion.clone().normalize().angleTo(Q().fromArray(b.off).normalize()):0);
        const key=golf?'maxGolfError':'maxReadyError';report[key]=Math.max(report[key],error);
        if(error>1e-5)(report.baselineErrors??=[]).push({hero:item.hero,name:b.name,t:b.t,error,actualQ:object.quaternion.toArray(),expectedQ:b.q});
      }
      p.dispose();
    }
    for(const enemy of [false,true])for(let type=0;type<(enemy?4:6);type++){
      const p=new Warrior(type,enemy),reference={},legacyReference={};
      if(enemy&&type===0&&p.offhand)throw Error('The single-sword scout has an unexpected offhand weapon');
      const names=[...p.actions.keys()].filter(name=>motions[name]&&/Cut_|Heavy_|Musou_|Enemy_/.test(name));
      if(enemy)report.enemies++;
      // Nontrivial root yaw exposes accidental world/local frame mixing.
      p.root.rotation.y=.73;
      for(const name of names){
        report.clips++;setPose(p,name,0);
        const duration=motions[name].duration;
        for(let i=0;i<=Math.ceil(duration*240);i++){
          const t=Math.min(duration,i/240);p.handGrip?.restore();p.actions.get(name).time=t;p.mixer.update(0);
          const pose=sampleMotion(name,t);p.syncHeldObjects(pose);p.root.updateMatrixWorld(true);
          for(const side of sides(p)){
            const f=frame(p,side,pose);if(!f)continue;report.samples++;checkGrip(p,side);
            reference[side]??=f.relative.clone();legacyReference[side]??=f.legacyRelative.clone();
            const error=reference[side].angleTo(f.relative);
            if(error>report.maxPalmFrameError){report.maxPalmFrameError=error;report.worst={enemy,type,name,t,side};}
            const axisKey=motions[name].nativeAttachment?'maxNativeAxisError':'maxAxisError';
            report[axisKey]=Math.max(report[axisKey],Y.clone().applyQuaternion(f.w).angleTo(f.authored));
            report.maxLegacyFrameDrift=Math.max(report.maxLegacyFrameDrift,legacyReference[side].angleTo(f.legacyRelative));
          }
        }
      }
      if(!enemy){
        // Check real controller transitions. During the fade, the weapon must
        // follow the shortest rotation between its saved frame and the current
        // live palm target. Afterward its attachment frame is constant again.
        for(const start of ['guard','travel','golf','attack']){
          const a=new Warrior(type);
          const heavy=attackDefinition('heavy',0,WARRIORS[type].combatStyle),light=attackDefinition('light',0,WARRIORS[type].combatStyle);
          for(let i=0;i<90;i++)a.update(i/60,1/60,start==='guard'?{blocking:true}:start==='travel'?{moving:true,moveSpeed:5.6}:start==='golf'?{golf:true}:{action:{kind:'heavy',step:0,token:1,time:i/60,duration:heavy.duration}});
          for(let i=0;i<30;i++){
            a.update(2+i/240,1/240,{action:{kind:'light',step:0,token:2,time:i/240,duration:light.duration}});
            a.root.updateMatrixWorld(true);const pose=sampleMotion(a.current,a.actions.get(a.current).time);
            for(const side of sides(a)){
              const f=frame(a,side,pose);if(!f)continue;checkGrip(a,side);
              // Carry adjusts the hand itself while it fades. Its temporary
              // shaft takes precedence until that layer releases the weapon.
              if(a.travelPose?.weight>0)continue;
              // The grip layer blends the HAND before attaching the weapon.
              // Applying heldBlend again would measure a second, obsolete fade.
              const target=f.h.clone().multiply(reference[side]).multiply(Q().setFromAxisAngle(Y,a.handGrip?.attachmentRoll??0));
              if(paired(a)){
                const pair=palms(a),axis=pair[0].sub(pair[1]).normalize();
                target.premultiply(Q().setFromUnitVectors(Y.clone().applyQuaternion(target).normalize(),axis));
              }
              report.maxFadeError=Math.max(report.maxFadeError,target.normalize().angleTo(f.w));report.transitionSamples++;
            }
          }
          a.dispose();
        }
      }
      p.dispose();
    }
    return report;
  },baseline);
  console.log(JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  assert.ok(report.samples>14900&&report.clips>=54&&report.enemies===4,'Missing attack/roster coverage');
  assert.ok(report.transitionSamples>300,'Missing transition coverage');
  assert.ok(report.maxLegacyFrameDrift>1,'The fixtures must expose the old shaft-dependent roll defect');
  assert.ok(report.maxPalmFrameError<1e-5,`Weapon twists independently of its hand: ${JSON.stringify(report.worst)}`);
  assert.ok(report.maxAxisError<1e-5,'Authored shaft changed outside a fade');
  // Native clips retain their anatomical wrist. Metadata linearly interpolates
  // the shaft, while the skeleton interpolates rotations between baked keys.
  assert.ok(report.maxNativeAxisError<Math.PI/180,'Native blade deviates more than one degree from its recorded path');
  assert.ok(report.maxGripError<1e-6,'The handle left the calibrated palm');
  assert.ok(report.pairedSamples>500,'Missing paired polearm attachment coverage');
  assert.ok(report.maxPairedGap<.001,'Native polearm interpolation separates a palm from its station');
  assert.ok(report.maxPairedCenterError<1e-6,'The polearm handle no longer balances between both palms');
  assert.ok(report.maxReadyError<1e-5,'Ready blade width/face changed');
  assert.ok(report.maxGolfError<1e-6,'Golf transform or contact path changed');
  assert.ok(report.maxFadeError<1e-5,'Transition does not follow the continuous palm frame');
}finally{await browser.close();}
