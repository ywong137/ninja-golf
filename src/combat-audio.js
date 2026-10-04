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
  this.bus=ctx.createDynamicsCompressor();this.bus.threshold.value=-7;this.bus.knee.value=8;
  this.bus.ratio.value=8;this.bus.attack.value=.003;this.bus.release.value=.08;
  this.output=ctx.createGain();this.output.gain.value=.82;this.bus.connect(this.output).connect(destination);
  this.presence=ctx.createBiquadFilter();this.presence.type='highshelf';this.presence.frequency.value=1800;this.presence.gain.value=4.5;this.presence.connect(this.bus);
  this.lowCut=ctx.createBiquadFilter();this.lowCut.type='highpass';this.lowCut.frequency.value=85;this.lowCut.Q.value=.6;this.lowCut.connect(this.presence);
  this.ready=Promise.all(Object.values(COMBAT_SAMPLES).flat().map(async name=>{
   try{const response=await fetch(`${import.meta.env.BASE_URL}audio/combat/${name}.ogg`);
    if(!response.ok)throw Error(String(response.status));
    this.buffers.set(name,await ctx.decodeAudioData(await response.arrayBuffer()));
   }catch(error){console.warn(`Combat recording unavailable: ${name}`,error);}
  }));
 }
 sample(kind,level,rate=1,{offset=0,delay=0,duration}={}){
  const variants=COMBAT_SAMPLES[kind],index=this.sequence[kind]??0;
  this.sequence[kind]=(index+1)%variants.length;
  const buffer=this.buffers.get(variants[index]);if(!buffer)return false;
  while(this.voices.length>=16)this.voices.shift().source.stop();
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),voice={source,gain};
  source.buffer=buffer;source.playbackRate.value=rate;
  const when=this.ctx.currentTime+delay,seconds=Math.min(duration??buffer.duration-offset,buffer.duration-offset)/rate;
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+.002);
  gain.gain.setValueAtTime(level,when+Math.max(.002,seconds-.025));gain.gain.linearRampToValueAtTime(0,when+seconds);
  source.connect(gain).connect(this.lowCut);this.voices.push(voice);
  source.onended=()=>{const i=this.voices.indexOf(voice);if(i>=0)this.voices.splice(i,1);source.disconnect();gain.disconnect();};
  source.start(when,offset,duration??Math.max(.01,buffer.duration-offset));return true;
 }
 play(kind){
  const rate=.96+Math.random()*.08;
  if(kind==='sword')return this.sample('sword',.65,rate);
  if(kind==='clash')return this.sample('clash',.6,rate,{offset:.15});
  if(kind==='hit'||kind==='heavy-hit'){
   // The old wood layer arrived first; the cut and metal recordings had
   // 130–150 ms of lead-in. Align their transients with the contact frame.
   const heavy=kind==='heavy-hit',played=this.sample('hit',heavy?1.15:.95,heavy?.94:rate);
   this.sample('hit',heavy?.65:.4,heavy?1.24:1.35,{offset:.09,delay:.018,duration:.24});
   this.sample('crunch',heavy?.24:.14,heavy?1.12:1.3,{delay:.012,duration:.20});
   this.sample('clash',heavy?.18:.1,1.35,{offset:.15,duration:.22});
   this.sample('sword',heavy?.45:.32,1.35,{offset:.20,duration:.32});
   return played;
  }
  return false;
 }
 stop(){for(const voice of [...this.voices])voice.source.stop();}
}
