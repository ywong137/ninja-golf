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
 // Seeking pauses the preview. Resuming continues from the selected time.
 seek(stageId,seconds=0){
  const index=this.stages.findIndex(stage=>stage.id===stageId);
  if(index<0)throw Error('Unknown showcase stage: '+stageId);
  if(!Number.isFinite(seconds)||seconds<0||seconds>this.stages[index].duration)throw Error('Preview time must be within the selected stage.');
  this.index=index;this.elapsed=seconds;this.paused=true;
  const cycleDuration=this.stages.reduce((sum,stage)=>sum+stage.duration,0);
  this.time=this.cycle*cycleDuration+this.stages.slice(0,index).reduce((sum,stage)=>sum+stage.duration,0)+seconds;
 }
 advance(dt){
  if(this.paused)return 0;
  const scaled=Math.max(0,dt)*this.speed;this.time+=scaled;this.elapsed+=scaled;
  while(this.elapsed>=this.stage.duration){this.elapsed-=this.stage.duration;this.index++;if(this.index===this.stages.length){this.index=0;this.cycle++;}}
  return scaled;
 }
}
