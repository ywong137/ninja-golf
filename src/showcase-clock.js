export function showcaseStages(swingDuration,lightDuration,heavyDuration){
 for(const duration of [swingDuration,lightDuration,heavyDuration])if(!(duration>0))throw Error('Showcase animations need positive durations.');
 return [
  {id:'address',label:'Golf · address',duration:1.1,golf:true},
  {id:'swing',label:'Golf · full swing',duration:swingDuration,golf:true},
  {id:'follow',label:'Golf · follow-through',duration:.65,golf:true},
  {id:'golf-out',label:'Combat stance',duration:.24,golf:true,fade:'out'},
  {id:'ready-in',label:'Combat stance',duration:.24,fade:'in'},
  {id:'ready',label:'Combat · ready',duration:.75},
  {id:'light',label:'Combat · fast attack',duration:lightDuration},
  {id:'light-rest',label:'Combat · recovery',duration:.6},
  {id:'heavy',label:'Combat · heavy attack',duration:heavyDuration},
  {id:'heavy-rest',label:'Combat · recovery',duration:.8},
  {id:'combat-out',label:'Golf address',duration:.24,fade:'out'},
  {id:'golf-in',label:'Golf address',duration:.24,golf:true,fade:'in'},
 ];
}
export class ShowcaseClock{
 constructor(stages){this.stages=stages;this.index=0;this.elapsed=0;this.time=0;this.speed=1;this.paused=false;this.cycle=0;}
 get stage(){return this.stages[this.index];}
 get opacity(){const p=this.elapsed/this.stage.duration;return this.stage.fade==='out'?1-p:this.stage.fade==='in'?p:1;}
 setSpeed(speed){if(!Number.isFinite(speed)||speed<.1||speed>1)throw Error('Animation speed must be between 0.1 and 1.0.');this.speed=speed;}
 advance(dt){
  if(this.paused)return 0;
  const scaled=Math.max(0,dt)*this.speed;this.time+=scaled;this.elapsed+=scaled;
  while(this.elapsed>=this.stage.duration){this.elapsed-=this.stage.duration;this.index++;if(this.index===this.stages.length){this.index=0;this.cycle++;}}
  return scaled;
 }
}
