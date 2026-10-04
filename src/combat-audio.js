// Recorded CC0 effects; attribution and unmodified source names live beside the files.
export const COMBAT_SAMPLES=Object.freeze({
 sword:['sword-1','sword-2','sword-3'],
 clash:['clash-1','clash-2','clash-3'],
 hit:['flesh-1','flesh-2'],
 crunch:['crunch-1','crunch-2'],
});
export class CombatAudio{
 constructor(ctx,destination){
  this.ctx=ctx;this.buffers=new Map();this.voices=[];this.sequence={};
  this.bus=ctx.createDynamicsCompressor();this.bus.threshold.value=-12;this.bus.knee.value=8;
  this.bus.ratio.value=5;this.bus.attack.value=.003;this.bus.release.value=.12;this.bus.connect(destination);
  this.ready=Promise.all(Object.values(COMBAT_SAMPLES).flat().map(async name=>{
   try{const response=await fetch(`${import.meta.env.BASE_URL}audio/combat/${name}.ogg`);
    if(!response.ok)throw Error(String(response.status));
    this.buffers.set(name,await ctx.decodeAudioData(await response.arrayBuffer()));
   }catch(error){console.warn(`Combat recording unavailable: ${name}`,error);}
  }));
 }
 sample(kind,level,rate=1){
  const variants=COMBAT_SAMPLES[kind],index=this.sequence[kind]??0;
  this.sequence[kind]=(index+1)%variants.length;
  const buffer=this.buffers.get(variants[index]);if(!buffer)return false;
  while(this.voices.length>=16)this.voices.shift().source.stop();
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),voice={source,gain};
  source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=level;
  source.connect(gain).connect(this.bus);this.voices.push(voice);
  source.onended=()=>{const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1);source.disconnect();gain.disconnect();};
  source.start();return true;
 }
 play(kind){
  const rate=.96+Math.random()*.08;
  if(kind==='sword')return this.sample('sword',.65,rate);
  if(kind==='clash')return this.sample('clash',.72,rate);
  if(kind==='hit'||kind==='heavy-hit'){
   const heavy=kind==='heavy-hit',played=this.sample('hit',heavy?1.35:1.12,heavy?.88:rate);
   this.sample('crunch',heavy?.95:.72,heavy?.86:1.05);
   this.sample('clash',heavy?.3:.21,1.25);
   this.sample('sword',heavy?.5:.35,1.1);
   return played;
  }
  return false;
 }
 stop(){for(const voice of [...this.voices])voice.source.stop();}
}
