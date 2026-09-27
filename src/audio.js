export class AudioEngine {
  constructor(){
    this.ctx=null;this.enabled=true;this.musicEnabled=true;this.volume=.4;this.mode='course';this.paused=false;this.musicFailed=false;this.fadeTimer=null;
    this.music=new Audio(`${import.meta.env.BASE_URL}audio/ishikari-lore.mp3`);
    this.combatMusic=new Audio(`${import.meta.env.BASE_URL}audio/neolith.mp3`);
    this.tracks={course:{element:this.music,level:.55},combat:{element:this.combatMusic,level:.43}};
    for(const track of Object.values(this.tracks)){track.element.loop=true;track.element.preload='none';track.element.addEventListener('error',()=>{this.musicFailed=true;});}
  }
  async start(){
    try{
      if(!this.ctx){
        this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?this.volume:0;this.master.connect(this.ctx.destination);this.makeAmbience();
        for(const track of Object.values(this.tracks)){track.source=this.ctx.createMediaElementSource(track.element);track.gain=this.ctx.createGain();track.gain.gain.value=0;track.source.connect(track.gain).connect(this.master);}
      }
      this.paused=false;await this.ctx.resume();this.syncMusic();
    }catch{/* A later user gesture can unlock audio after autoplay restrictions. */}
  }
  setMode(mode){if(mode!==this.mode){this.mode=mode;this.syncMusic();}}
  syncMusic(){
    clearTimeout(this.fadeTimer);if(!this.ctx)return;
    const active=this.enabled&&this.musicEnabled&&!this.paused,now=this.ctx.currentTime;
    for(const [name,track] of Object.entries(this.tracks)){
      const target=active&&name===this.mode?track.level:0;
      const gain=track.gain.gain;gain.cancelAndHoldAtTime(now);gain.linearRampToValueAtTime(target,now+1.15);
      if(target>0)track.element.play().catch(()=>{/* Retry on the next user gesture. */});
      if(!active)track.element.pause();
    }
    if(active)this.fadeTimer=setTimeout(()=>{for(const [name,track] of Object.entries(this.tracks))if(name!==this.mode)track.element.pause();},1200);
  }
  setVolume(v){this.volume=v;if(this.master)this.master.gain.value=this.enabled?v:0;}
  toggle(){this.enabled=!this.enabled;this.setVolume(this.volume);if(this.enabled&&!this.paused)this.start();else this.syncMusic();return this.enabled;}
  setMusic(on){this.musicEnabled=on;if(on&&this.enabled&&!this.paused)this.start();else this.syncMusic();}
  noise(duration=.2,frequency=1000,gain=.3){if(!this.ctx||!this.enabled)return;const ctx=this.ctx,n=ctx.sampleRate*duration,b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;const src=ctx.createBufferSource();src.buffer=b;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(frequency,ctx.currentTime);f.frequency.exponentialRampToValueAtTime(Math.max(60,frequency*.18),ctx.currentTime+duration);const g=ctx.createGain();g.gain.setValueAtTime(gain,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);src.connect(f).connect(g).connect(this.master);src.start();src.stop(ctx.currentTime+duration);}
  tone(freq,duration,volume=.2,type='sine',end=freq){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+duration);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.006);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start(t);o.stop(t+duration+.01);}
  play(name){if(!this.enabled)return;
    if(name==='swing'){this.noise(.24,3800,.6);this.tone(700,.09,.5,'triangle',170);}
    if(name==='putt'){this.tone(600,.06,.23,'sine',160);this.noise(.04,1600,.16);}
    if(name==='land')this.noise(.1,330,.28);
    if(name==='sword'){this.noise(.19,2400,.55);this.tone(230,.12,.09,'triangle',90);}
    if(name==='hit'){this.noise(.13,700,.7);this.tone(940,.14,.23,'triangle',400);}
    if(name==='hurt'){this.noise(.18,390,.38);this.tone(80,.2,.2,'sawtooth',40);}
    if(name==='special'){this.noise(.9,1200,.85);this.tone(65,.9,.35,'triangle',210);}
    if(name==='cup'){this.tone(880,.38,.2,'sine',760);this.noise(.15,320,.18);}
    if(name==='step')this.noise(.065,650,.11);
    if(name==='click')this.tone(560,.045,.08,'sine',440);
    if(name==='water')this.noise(.7,1200,.45);
  }
  makeAmbience(){const ctx=this.ctx,b=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+.015*(Math.random()*2-1))/1.02;last=Math.max(-1,Math.min(1,last));d[i]=last*.03;}const src=ctx.createBufferSource();src.buffer=b;src.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;const g=ctx.createGain();g.gain.value=.1;src.connect(f).connect(g).connect(this.master);src.start();}
  pause(){this.paused=true;clearTimeout(this.fadeTimer);for(const track of Object.values(this.tracks))track.element.pause();this.ctx?.suspend();}
  resume(){if(this.ctx)this.start();}
}
