import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.NINJA_BASE_URL??'http://localhost:5173')+'/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js'),{enemyAppearanceForSlot,ENEMY_APPEARANCES}=await import('/src/enemy-appearances.js'),{ENEMY_TYPES}=await import('/src/combat.js');await loadWarriorAssets();
  const actors=[],rows=[];
  for(let slot=0;slot<16;slot++)for(let role=0;role<4;role++){
   const appearance=enemyAppearanceForSlot(slot),p=new Warrior(role,true,appearance);actors.push(p);
   for(const name of ['Jog_Fwd_Loop','Sprint_Loop','Jump_Loop',ENEMY_TYPES[role].clip]){if(!p.actions.has(name))throw Error(`Missing ${name}`);p.play(name,0);p.actions.get(name).time=.2;p.mixer.update(0);p.syncHeldObjects();}
   const materials=[];p.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.enemyPalette)materials.push(m);});
   if(!materials.length)throw Error('No wardrobe materials');
   if(materials.some(m=>m.userData.enemyPalette!==ENEMY_APPEARANCES[appearance.family].palettes[appearance.palette].id))throw Error('Wrong palette');
   if(p.type!==role||p.facialPose)throw Error('Appearance changed gameplay role or added hero face work');
   rows.push({role,...appearance,materials:materials.length});
  }
  const first=actors[0].ownedMaterials[0],second=actors[1].ownedMaterials[0];if(first===second)throw Error('Enemy instances share mutable wardrobe materials');
  actors.forEach(p=>p.dispose());return rows;
 });
 assert.equal(report.length,64);assert.deepEqual(errors,[]);console.log('All 16 ninja palette and trim combinations work with all 4 combat roles; palettes and owned materials remain separate.');
}finally{await browser.close();}
