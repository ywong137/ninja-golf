import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import {disableHmr} from './disable-hmr.mjs';
const source=process.argv[2],output=process.argv[3];
if(process.argv.includes('--help')){console.log('Usage: node tools/study-lighting-fill.mjs CAMERA_REPORT_JSON OUTPUT_DIRECTORY\nCompare sky-fill strengths at the saved environment cameras.');process.exit(0);}
if(!source||!output||process.argv.length!==4)throw Error('Pass a camera report and output directory. Use --help.');
const manifest=JSON.parse(readFileSync(source,'utf8')).manifest;mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app > :not(#game){visibility:hidden!important}'});
 await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.ui.showScreen('game');g.paused=true;g.audio.pause();g.renderer.setPixelRatio(1);g.renderer.setSize(1440,900);g.rendering.resize();});
 for(const [theme,view,values]of [[0,'edge',[.75,1,1.25]],[1,'preview',[.9,1.15,1.4]],[2,'edge',[.65,.85,1.05]]]){
  await page.evaluate(async({theme,view,spec})=>{const g=window.__golfTest;g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.audio.pause();g.time=12.5;for(const o of[g.ball,g.aimLine,g.aimMarker,g.trail,g.puttingGuide.root,g.portraitLights])o.visible=false;g.player.root.visible=view==='edge';g.player.root.position.fromArray(spec.hero);g.player.root.rotation.y=Math.PI;g.player.update(12.5,0,{});const c=spec.views[view];g.camera.fov=c.fov;g.camera.updateProjectionMatrix();g.camera.position.fromArray(c.camera);g.camera.lookAt(...c.look);g.camera.updateMatrixWorld(true);g.world.update(12.5,0,view==='edge'?g.player.root.position:null,g.camera.position);},{theme,view,spec:manifest.themes[theme]});
  for(const fill of values){await page.evaluate(fill=>{const g=window.__golfTest;g.world.hemisphere.intensity=fill;g.rendering.render('high');g.rendering.render('high');},fill);await page.screenshot({path:`${output}/${theme}-${fill}.png`});}
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('Nine fill comparisons captured.');
}finally{await browser.close();}
