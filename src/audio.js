import {FieldAudio} from './field-audio.js';
import {MusicPlaylist} from './music-playlist.js';
import {SOUNDTRACKS} from './soundtracks.js';
export class AudioEngine {
  constructor(){
    this.channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('ninja-golf-audio'):null;this.channel?.addEventListener('message',()=>{if(!this.paused)this.pause();});
    this.ctx=null;this.enabled=true;this.musicEnabled=true;this.volume=.4;this.mode='course';this.paused=false;this.musicFailed=false;this.fadeTimer=null;
    this.playlist=new MusicPlaylist(SOUNDTRACKS,'crane-coast');
    this.music=new Audio(`${import.meta.env.BASE_URL}${this.playlist.current('course').src}`);
    this.combatMusic=new Audio(`${import.meta.env.BASE_URL}${this.playlist.current('combat').src}`);
    this.tracks={course:{element:this.music,level:.55},combat:{element:this.combatMusic,level:.43}};
    for(const [mode,track] of Object.entries(this.tracks)){track.element.loop=false;track.element.preload='none';track.element.addEventListener('error',()=>{this.musicFailed=true;});track.element.addEventListener('ended',()=>{if(mode==='combat'&&this.mode!=='combat')return;this.playlist.next(mode);this.loadTrack(mode);this.syncMusic();});}
  }
  async start(){
    try{
      if(!this.ctx){
        this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?this.volume:0;this.master.connect(this.ctx.destination);this.field=new FieldAudio(this.ctx,this.master);
        for(const track of Object.values(this.tracks)){track.source=this.ctx.createMediaElementSource(track.element);track.gain=this.ctx.createGain();track.gain.gain.value=0;track.source.connect(track.gain).connect(this.master);}
      }
      this.paused=false;if(this.enabled)this.channel?.postMessage('playing');await this.ctx.resume();this.syncMusic();
    }catch{/* A later user gesture can unlock audio after autoplay restrictions. */}
  }
  loadTrack(mode){const track=this.tracks[mode],song=this.playlist.current(mode),url=new URL(import.meta.env.BASE_URL+song.src,location.href).href;if(track.element.src===url)return;track.element.pause();track.element.src=url;track.element.load();}
  setCourse(id){if(id===this.playlist.courseId)return;clearTimeout(this.fadeTimer);this.playlist.setCourse(id);for(const mode of ['course','combat'])this.loadTrack(mode);this.syncMusic();}
  setMode(mode){if(mode!==this.mode){if(!this.tracks[mode])throw Error('Unknown audio mode: '+mode);this.mode=mode;if(mode==='combat'){this.playlist.enterCombat();this.loadTrack('combat');}this.syncMusic();}}
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
  update(dt,combat,position,coastal=true){if(this.ctx&&!this.paused&&this.enabled)this.field?.update(dt,combat,Math.abs(position.x-145),coastal);}
  play(name,lie='Fairway'){if(!this.enabled||this.paused)return;
    if(name==='step'&&this.field?.play(lie==='Bunker'?'step_sand':'step_grass',.22,.94+Math.random()*.12))return;
    if((name==='sword'||name==='swing')&&this.field?.play('rod_swish',name==='sword'?.52:.68,name==='sword'?1.35:1.2))return;
    if(name==='water'&&this.field?.play('splash',.4))return;
    if(name==='click'&&this.field?.play('bail_click',.18,1.15))return;
    if(name==='land'&&this.field?.play(lie==='Bunker'?'step_sand':'step_grass',.16,.8))return;
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
  pause(){this.paused=true;clearTimeout(this.fadeTimer);for(const track of Object.values(this.tracks))track.element.pause();this.ctx?.suspend();}
  resume(){if(this.ctx)this.start();}
}
