import {GAMEPAD_ACTIONS} from './control-bindings.js';
// Keyboard, mouse and gamepad produce the same semantic combat actions.
const COMBAT_KEYS={KeyF:'Musou',KeyE:'Interact',KeyQ:'Waypoint',Space:'Dodge'};
export class Input {
  constructor(canvas){
    this.canvas=canvas;this.keys=new Set();this.pressed=new Set();this.lookX=0;this.lookY=0;this.panX=0;this.panY=0;this.zoom=0;this.dragging=false;this.gamepad=false;this.device='keyboard';this.previousButtons=[];this.context='menu';this.locked=false;this.sensitivity=1;this.invertY=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;try{const options=JSON.parse(localStorage.getItem('ninja-golf-controls'));if(options){this.sensitivity=Math.max(.3,Math.min(2,options.sensitivity||1));this.invertY=!!options.invertY;this.reducedMotion=!!options.reducedMotion;}}catch{}
    window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;this.device='keyboard';if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&(this.locked||performance.now()-(this.unlockedAt??-Infinity)<150)){if(this.locked)document.exitPointerLock();return;}if(!e.repeat)this.pressed.add(this.context==='combat'?(COMBAT_KEYS[e.code]||e.code):e.code);this.keys.add(e.code);});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.clear());
    canvas.addEventListener('mousedown',e=>{
      this.device='keyboard';
      if(this.context==='combat'){
        if(!this.locked&&canvas.requestPointerLock){try{const request=canvas.requestPointerLock();request?.catch(()=>{this.lockFailed=true;});}catch{this.lockFailed=true;}}
        if(e.button===0)this.pressed.add('LightAttack');if(e.button===2)this.pressed.add('HeavyAttack');
      }else if(this.context==='survey'){this.dragging=e.button===2?'orbit':'pan';e.preventDefault();}else if(this.context==='aim'){if(e.button===2)this.dragging=true;if(e.button===0)this.pressed.add('Mouse0');}
    });
    window.addEventListener('pointermove',e=>{if((this.dragging||this.locked||this.context==='combat'&&this.lockFailed&&e.target===canvas)&&(e.movementX||e.movementY))this.device='keyboard';if(this.context==='survey'&&this.dragging==='pan'){this.panX+=e.movementX;this.panY+=e.movementY;return;}if(this.dragging||(this.context==='combat'&&(this.locked||this.lockFailed&&e.target===canvas))){this.lookX+=e.movementX;this.lookY+=e.movementY;}});
    window.addEventListener('mouseup',e=>{if(e.button===2||this.context==='survey')this.dragging=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{if(this.context==='survey'){this.device='keyboard';e.preventDefault();this.zoom+=e.deltaY;}},{passive:false});
    document.addEventListener('pointerlockchange',()=>{const was=this.locked;this.locked=document.pointerLockElement===canvas;if(was&&!this.locked&&this.context==='combat'){this.unlockedAt=performance.now();this.pressed.delete('Escape');this.onUnlock?.();}});
  }
  setContext(context){if(context===this.context)return;this.context=context;this.dragging=false;if(context!=='combat'&&document.pointerLockElement===this.canvas)document.exitPointerLock();}
  poll(dt,combat=false){
    const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);this.gamepad=!!pad;this.padX=0;this.padY=0;this.padFocus=false;this.padSprint=false;this.padGuard=false;
    if(pad){const dead=x=>Math.abs(x)<.16?0:x;this.padX=dead(pad.axes[0]||0);this.padY=dead(pad.axes[1]||0);this.lookX+=dead(pad.axes[2]||0)*dt*620;this.lookY+=dead(pad.axes[3]||0)*dt*240;
      const map=GAMEPAD_ACTIONS[combat?'combat':'golf'];
      if(pad.axes.some(x=>Math.abs(x)>.16)||pad.buttons.some(b=>b.pressed||b.value>.16))this.device='gamepad';
      pad.buttons.forEach((b,i)=>{if(b.pressed&&!this.previousButtons[i]&&map[i])this.pressed.add(map[i]);this.previousButtons[i]=b.pressed;});this.padSprint=combat&&!!pad.buttons[10]?.pressed;this.padFocus=pad.buttons[6]?.pressed;this.padGuard=combat&&!!pad.buttons[4]?.pressed;if(this.context==='survey')this.zoom+=((pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0))*dt*650;
    }else{this.previousButtons=[];this.device='keyboard';}
  }
  saveSettings(){try{localStorage.setItem('ninja-golf-controls',JSON.stringify({sensitivity:this.sensitivity,invertY:this.invertY,reducedMotion:this.reducedMotion}));}catch{}}
  get guarding(){return this.padGuard||this.down('KeyV');}
  get focused(){return this.padFocus||this.down('KeyC');}
  down(...codes){return codes.some(c=>this.keys.has(c));}
  tap(...codes){return codes.some(c=>this.pressed.has(c));}
  get move(){return{x:(this.down('KeyD','ArrowRight')?1:0)-(this.down('KeyA','ArrowLeft')?1:0)+(this.padX||0),y:(this.down('KeyW','ArrowUp')?1:0)-(this.down('KeyS','ArrowDown')?1:0)-(this.padY||0)};}
  end(){this.pressed.clear();this.lookX=0;this.lookY=0;this.panX=0;this.panY=0;this.zoom=0;}
  clear(){this.keys.clear();this.end();this.dragging=false;this.padGuard=false;this.padFocus=false;this.padSprint=false;}
}
