import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js'),{golfShoulderSkinWeight}=await import('/src/golf-shoulder-skin.js');await loadWarriorAssets();const rows=[];
  for(let hero=0;hero<6;hero++){
   const actor=new Warrior(hero),helpers=Object.keys(actor.forearmTwist.upperArmHelpers),row={hero,helpers,samples:0,maxWeightError:0,maxUpperTwist:0};
   actor.mixer.stopAllAction();actor.current='';actor.play('Golf_Swing',0,true);
   for(let f=0;f<=144;f++){
    const time=f/60;actor.update(time,f?1/60:0,{golf:true,previewPose:{clip:'Golf_Swing',time:Math.min(time,2.4-1e-5)}});
    const action=actor.actions.get('Golf_Swing');row.maxWeightError=Math.max(row.maxWeightError,Math.abs(actor.forearmTwist.report.upperArmWeight-(hero===3?golfShoulderSkinWeight(action.time,action.getEffectiveWeight()):0)));if(hero===3&&actor.forearmTwist.report.upperArmWeight>0)row.maxUpperTwist=Math.max(row.maxUpperTwist,Math.abs(actor.forearmTwist.report.angles.upper_r.principalDegrees));row.samples++;
   }
   // Preview seeks and action fades must drive the same skin controller.
   for(const time of [1.471,.3,1.471,2.3])actor.update(3,0,{golf:true,previewPose:{clip:'Golf_Swing',time}});
   if(hero===3){
    actor.update(3,0,{golf:true,previewPose:{clip:'Golf_Swing',time:1.471}});
    const old=actor.actions.get('Golf_Swing');const before=actor.forearmTwist.report.upperArmWeight;
    actor.play('Golf_Swing',.1,true);actor.updateSkinDeformation();
    row.restart={before,immediate:actor.forearmTwist.report.upperArmWeight,usesTwoActions:actor.actions.get('Golf_Swing')!==old};
    actor.mixer.update(.05);actor.updateSkinDeformation();row.restart.mid=actor.forearmTwist.report.upperArmWeight;
    actor.mixer.update(.06);actor.updateSkinDeformation();row.restart.end=actor.forearmTwist.report.upperArmWeight;
   }
   actor.mixer.stopAllAction();actor.current='';actor.play('Idle_Loop',0);actor.update(4,0,{});row.idleWeight=actor.forearmTwist.report.upperArmWeight;
   actor.dead=1;actor.update(5,1/60,{});row.deathWeight=actor.forearmTwist.report.upperArmWeight;
   actor.dispose();row.disposed=actor.forearmTwist.report.disposed;rows.push(row);
  }
  const enemy=new Warrior(0,true),crowdUnchanged=enemy.forearmTwist===null;enemy.dispose();return{rows,crowdUnchanged};
 });
 assert.deepEqual(errors,[]);assert.ok(report.crowdUnchanged);
 for(const row of report.rows){assert.deepEqual(row.helpers,row.hero===3?['r']:[]);assert.ok(row.maxWeightError<1e-9);assert.equal(row.idleWeight,0);assert.equal(row.deathWeight,0);assert.ok(row.disposed);if(row.hero===3){assert.ok(row.maxUpperTwist<165);assert.ok(row.restart.usesTwoActions);assert.equal(row.restart.immediate,row.restart.before);assert.ok(row.restart.mid>0&&row.restart.mid<row.restart.before);assert.equal(row.restart.end,0);}}
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
