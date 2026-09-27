// CC0 field recordings. Sources: public/audio/field/CREDITS.md.
const BANK={
 wind:{loop:true,level:.22},surf_far:{loop:true,level:.14},
 step_grass:{slices:[[.08,.304],[.464,.3553],[.8993,.284],[1.2633,.254],[1.5973,.2473]]},
 step_sand:{slices:[[.08,.191],[.351,.3153],[.7463,.2237],[1.05,.516],[1.646,.436]]},
 step_rock:{slices:[[.08,.504],[.664,.504],[1.248,.504],[1.832,.504],[2.416,.504]]},
 rod_swish:{slices:[[.08,.404],[.564,.4453],[1.0893,.604],[1.7733,.424],[2.2773,.604]]},
 gull:{slices:[[.08,1.001],[1.161,1.404],[2.645,.904],[3.629,1.114],[4.823,1.044],[5.947,.5267]]},
 splash:{slices:[[.08,1.604],[1.764,2.2067],[4.0507,2.2133],[6.344,1.906]]},
 bail_click:{slices:[[.08,.164],[.324,.174],[.578,.144],[.802,.184]]},
};
export class FieldAudio{
 constructor(ctx,destination){this.ctx=ctx;this.destination=destination;this.buffers=new Map();this.loops=[];this.nextBird=7;this.ready=Promise.all(Object.keys(BANK).map(async name=>{try{const response=await fetch(`${import.meta.env.BASE_URL}audio/field/${name}.ogg`);if(!response.ok)throw new Error(response.status);this.buffers.set(name,await ctx.decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn(`Field recording unavailable: ${name}`,error);}})).then(()=>{for(const [name,entry]of Object.entries(BANK))if(entry.loop&&this.buffers.has(name)){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(name);source.loop=true;gain.gain.value=entry.level;source.connect(gain).connect(destination);source.start();this.loops.push({name,gain,level:entry.level});}});}
 play(name,volume=.3,rate=1,pan=0){const buffer=this.buffers.get(name);if(!buffer)return false;const entry=BANK[name],slice=entry.slices[Math.floor(Math.random()*entry.slices.length)],source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;panner.pan.value=pan;source.connect(gain).connect(panner).connect(this.destination);source.start(0,slice[0],slice[1]);source.onended=()=>{source.disconnect();gain.disconnect();panner.disconnect();};return true;}
 update(dt,combat,coastDistance){const now=this.ctx.currentTime;for(const loop of this.loops){const near=loop.name==='surf_far'?Math.max(.15,1-coastDistance/190):1;loop.gain.gain.setTargetAtTime(loop.level*near*(combat?.4:1),now,.5);}this.nextBird-=dt;if(this.nextBird<0&&!combat){this.play('gull',.05+Math.random()*.06,.92+Math.random()*.16,Math.random()*1.5-.75);this.nextBird=13+Math.random()*19;}}
}
