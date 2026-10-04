import test from 'node:test';
import assert from 'node:assert/strict';
import {Input} from '../src/input.js';
import {controlHints} from '../src/control-bindings.js';
function setup(t){
 const names=['window','document','navigator','matchMedia','localStorage','HTMLInputElement','HTMLSelectElement'],previous=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 const pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))},win=new EventTarget(),canvas=new EventTarget(),doc=new EventTarget();
 doc.pointerLockElement=null;doc.exitPointerLock=()=>{};
 const globals={window:win,document:doc,navigator:{getGamepads:()=>[pad]},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null},HTMLInputElement:class{},HTMLSelectElement:class{}};
 for(const [name,value]of Object.entries(globals))Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
 t.after(()=>{for(const name of names){const d=previous.get(name);if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name];}});
 const input=new Input(canvas),event=(target,type,data)=>target.dispatchEvent(Object.assign(new Event(type),data));
 return{input,pad,event,win,canvas};
}
test('Prompts follow input use; an idle connected pad never steals keyboard prompts',t=>{
 const {input,pad,event,win,canvas}=setup(t);
 input.poll(.016,true);assert.equal(input.gamepad,true);assert.equal(controlHints(input.device).swing,'SPACE');
 pad.axes[0]=.6;input.poll(.016,true);assert.equal(controlHints(input.device).swing,'A');
 pad.axes[0]=.1;event(win,'keydown',{code:'KeyW',repeat:false});input.poll(.016,true);assert.equal(input.device,'keyboard');assert.equal(input.move.y,1);
 pad.buttons[2].pressed=true;input.poll(.016,true);assert.equal(input.device,'gamepad');assert.equal(input.tap('LightAttack'),true);
 pad.buttons[2].pressed=false;event(canvas,'mousedown',{button:0});input.poll(.016,true);assert.equal(input.device,'keyboard');
 input.device='gamepad';navigator.getGamepads=()=>[];input.poll(.016,true);assert.equal(input.device,'keyboard');assert.equal(input.gamepad,false);
});
test('Displayed controller actions produce the matching semantic commands once per press',t=>{
 const {input,pad}=setup(t);input.setContext('combat');
 for(const [button,action]of [[0,'Interact'],[1,'Dodge'],[2,'LightAttack'],[3,'HeavyAttack'],[5,'Musou'],[11,'Waypoint']]){
  pad.buttons[button].pressed=true;input.poll(.016,true);assert.equal(input.tap(action),true,action);input.end();input.poll(.016,true);assert.equal(input.tap(action),false,'held '+action);
  pad.buttons[button].pressed=false;input.poll(.016,true);input.end();
 }
 const combat=controlHints('gamepad',{phase:'combat'});assert.equal(combat.interact,'A');assert.equal(combat.musou,'RB');assert.equal(combat.heavy,'Y');assert.ok(combat.combat.some(([button,label])=>button==='RS CLICK'&&label==='Face waypoint'));
 input.setContext('aim');pad.buttons[0].pressed=true;input.poll(.016,false);assert.equal(input.tap('Space'),true);assert.equal(input.tap('Interact'),false);
});
