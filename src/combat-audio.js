// Recorded CC0 / CC-BY-SA effects; credits and source names live beside the files.
export const COMBAT_SAMPLES=Object.freeze({
 whoosh:['whoosh-1','whoosh-2','whoosh-3'],
 clash:['clash-1','clash-2','clash-3'],
 hit:['impact-1','impact-2','impact-3'],
 cut:['metal-cut-1','metal-cut-2','metal-cut-3'],
 flesh:['flesh-1','flesh-2'],
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
  const rate=.97+Math.random()*.06;
  if(kind==='whoosh'||kind==='heavy-whoosh'){
   const heavy=kind==='heavy-whoosh';
   const played=this.sample('whoosh',heavy?.95:.8,heavy?.90:1.12);
   // The lower air layer gives large blades weight without a metallic ring.
   this.sample('whoosh',heavy?.52:.24,heavy?.65:.82,{delay:.012,duration:.30});
   return played;
  }
  if(kind==='clash'){
   const played=this.sample('clash',.85,rate,{offset:.15});
   this.sample('cut',.65,1.07,{duration:.32});return played;
  }
  if(kind==='hit'||kind==='heavy-hit'){
   const heavy=kind==='heavy-hit',played=this.sample('hit',heavy?1.1:.9,heavy?.88:rate);
   this.sample('flesh',heavy?.70:.48,heavy?.88:1.03,{delay:.008,duration:.32});
   this.sample('cut',heavy?.82:.58,heavy?.93:1.12,{delay:.004,duration:.42});
   return played;
  }
  return false;
 }
 stop(){for(const voice of [...this.voices])voice.source.stop();}
}
