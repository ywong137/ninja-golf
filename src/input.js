// Actions are shared by keyboard, mouse, and standard-mapped gamepads.
export class Input {
  constructor(canvas){this.keys=new Set();this.pressed=new Set();this.lookX=0;this.lookY=0;this.dragging=false;this.gamepad=false;this.previousButtons=[];
    window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!e.repeat)this.pressed.add(e.code);this.keys.add(e.code);});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    canvas.addEventListener('pointerdown',e=>{if(e.button===2){this.dragging=true;canvas.setPointerCapture(e.pointerId);}else if(e.button===0)this.pressed.add('Mouse0');});
    canvas.addEventListener('pointermove',e=>{if(this.dragging){this.lookX+=e.movementX;this.lookY+=e.movementY;}});
    canvas.addEventListener('pointerup',()=>this.dragging=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }
  poll(dt){
    const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);this.gamepad=!!pad;this.padX=0;this.padY=0;this.padAim=0;
    if(pad){const dead=x=>Math.abs(x)<.16?0:x;this.padX=dead(pad.axes[0]||0);this.padY=dead(pad.axes[1]||0);this.lookX+=dead(pad.axes[2]||0)*dt*190;this.lookY+=dead(pad.axes[3]||0)*dt*90;
      const map={0:'Space',1:'ShiftLeft',2:'KeyJ',3:'KeyK',4:'KeyQ',5:'KeyE',7:'KeyJ',9:'Escape',12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'};
      pad.buttons.forEach((b,i)=>{if(b.pressed&&!this.previousButtons[i]&&map[i])this.pressed.add(map[i]);this.previousButtons[i]=b.pressed;});this.padSprint=pad.buttons[1]?.pressed;}
  }
  down(...codes){return codes.some(c=>this.keys.has(c));}
  tap(...codes){return codes.some(c=>this.pressed.has(c));}
  get move(){return {x:(this.down('KeyD','ArrowRight')?1:0)-(this.down('KeyA','ArrowLeft')?1:0)+(this.padX||0),y:(this.down('KeyW','ArrowUp')?1:0)-(this.down('KeyS','ArrowDown')?1:0)-(this.padY||0)};}
  end(){this.pressed.clear();this.lookX=0;this.lookY=0;}
  clear(){this.keys.clear();this.pressed.clear();this.dragging=false;this.lookX=0;this.lookY=0;}
}
