import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const courses=await page.evaluate(async()=>{
  const {AudioEngine}=await import('/src/audio.js');
  const {SOUNDTRACKS}=await import('/src/soundtracks.js');
  window.audioTest=new AudioEngine();
  window.audioElements=[audioTest.music,audioTest.combatMusic];
  const button=document.createElement('button');button.id='start';button.textContent='Start audio test';button.onclick=()=>audioTest.start();document.body.append(button);
  return Object.keys(SOUNDTRACKS);
 });
 await page.click('#start');
 const played=[];
 for(const id of courses){
  await page.evaluate(id=>audioTest.setCourse(id),id);
  for(const mode of ['course','combat']){
   await page.evaluate(mode=>audioTest.setMode(mode),mode);
   for(let index=0;index<2;index++){
    await page.waitForFunction(mode=>{const element=audioTest.tracks[mode].element;return element.readyState>=3&&!element.paused&&element.currentTime>.07;},mode);
    const result=await page.evaluate(mode=>({id:audioTest.playlist.courseId,mode,title:audioTest.playlist.current(mode).title,src:audioTest.tracks[mode].element.currentSrc,duration:audioTest.tracks[mode].element.duration}),mode);
    assert.ok(result.duration>30,JSON.stringify(result));played.push(result);
    if(index===0)await page.evaluate(mode=>{const element=audioTest.tracks[mode].element;element.pause();element.dispatchEvent(new Event('ended'));},mode);
   }
   await page.waitForFunction(mode=>audioTest.tracks[mode==='course'?'combat':'course'].element.paused,mode);
  }
 }
 assert.equal(new Set(played.map(track=>track.src)).size,16);
 assert.ok(await page.evaluate(()=>audioTest.music===audioElements[0]&&audioTest.combatMusic===audioElements[1]),'Playlist changes must reuse the two audio elements.');
 const outgoingEnd=await page.evaluate(()=>{
  const before=audioTest.playlist.current('combat').src;
  audioTest.setMode('course');
  audioTest.combatMusic.dispatchEvent(new Event('ended'));
  audioTest.setMode('combat');
  return {before,after:audioTest.playlist.current('combat').src};
 });
 assert.notEqual(outgoingEnd.after,outgoingEnd.before,'An outgoing ended event must not skip the next combat song.');
 await page.evaluate(()=>{audioTest.setMusic(false);audioTest.setCourse('crane-coast');audioTest.setMode('course');});
 assert.ok(await page.evaluate(()=>audioTest.music.paused&&audioTest.combatMusic.paused),'Course changes must preserve mute.');
 await page.evaluate(()=>{audioTest.pause();audioTest.channel?.close();});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({decodedAndPlayed:played.length,tracks:played,mutedCourseSwitch:true,reusedPlayers:true}));
}finally{await browser.close();}
