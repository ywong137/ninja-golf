import { clamp } from './course.js';
export const ATTACKS={
  light:[
    {name:'Opening cut',duration:.40,hits:[.15],reach:5.5,arc:1.65,damage:31,lunge:3.6,flourish:1},
    {name:'Returning cut',duration:.43,hits:[.16],reach:5.8,arc:1.85,damage:35,lunge:3.9,flourish:-1},
    {name:'Rising cut',duration:.48,hits:[.20],reach:6.2,arc:1.95,damage:40,lunge:4.1,flourish:1},
    {name:'Whirlwind cut',duration:.58,hits:[.20,.38],reach:6.7,arc:Math.PI,damage:28,lunge:2.0,flourish:2},
  ],
  heavy:[
    {name:'Driving cleave',duration:.76,hits:[.36],reach:7,arc:1.5,damage:90,lunge:5,flourish:0},
    {name:'Skyward finish',duration:.72,hits:[.30],reach:7,arc:1.9,damage:100,lunge:3,flourish:1,launch:5},
    {name:'Sweeping finish',duration:.82,hits:[.28,.53],reach:8,arc:Math.PI,damage:62,lunge:2,flourish:2},
    {name:'Earthshaker',duration:.94,hits:[.47],reach:10,arc:Math.PI,damage:150,lunge:3,flourish:0,launch:7},
  ],
  musou:{name:'Musou',duration:3.3,hits:[.42,.86,1.30,1.78,2.25,2.82],reach:19,arc:Math.PI,damage:220,lunge:1,flourish:3,launch:8},
};
// Each style shares input timing but has its own coverage, movement, and crowd control.
const STYLE_ATTACKS={
  fan:{
    light:[
      {name:'Opening petal',reach:4.5,arc:2.1,damage:28,lunge:2.6},
      {name:'Silk return',reach:4.7,arc:2.3,damage:32,lunge:1.7},
      {name:'Rising breeze',reach:5,arc:1.8,damage:35,lunge:3.6,launch:2},
      {name:'Petal circle',reach:5.4,arc:Math.PI,damage:27,lunge:.8},
    ],
    heavy:[
      {name:'Gale palm',reach:6,arc:2.2,damage:82,lunge:2.4,knockback:19},
      {name:'Updraft',reach:5.6,arc:2.4,damage:91,lunge:1.7,launch:7},
      {name:'Silk whirlwind',reach:6.5,arc:Math.PI,damage:60,lunge:.5},
      {name:'Falling blossoms',reach:7.5,arc:Math.PI,damage:140,lunge:1,launch:5},
    ],
    musou:{name:'Thousand-petal gale',reach:17,launch:10,lunge:.5},
  },
  ring:{
    light:[
      {name:'Crescent pass',reach:6.2,arc:2,damage:30,lunge:3.5},
      {name:'Returning orbit',reach:6.4,arc:2.6,damage:34,lunge:2.2},
      {name:'Moonrise',reach:6,arc:1.6,damage:42,lunge:4,launch:3},
      {name:'Full orbit',reach:7,arc:Math.PI,damage:29,lunge:1},
    ],
    heavy:[
      {name:'Crescent wheel',reach:7,arc:2.5,damage:90,lunge:4},
      {name:'Lunar ascent',reach:6.5,arc:1.8,damage:104,lunge:3,launch:6},
      {name:'Double orbit',reach:8.5,arc:Math.PI,damage:63,lunge:.6},
      {name:'Eclipse',reach:9,arc:Math.PI,damage:145,lunge:1.2,launch:7},
    ],
    musou:{name:'Seven-moon eclipse',reach:20,launch:8,lunge:.8},
  },
  sickle:{
    light:[
      {name:'Low hook',reach:4.8,arc:1.3,damage:38,lunge:4.2},
      {name:'Reaping return',reach:5,arc:1.7,damage:41,lunge:1.2,pull:true},
      {name:'Rising talon',reach:5.3,arc:1.5,damage:48,lunge:3.4,launch:4},
      {name:'Harvest circle',reach:6,arc:Math.PI,damage:33,lunge:1.5},
    ],
    heavy:[
      {name:'Anchor hook',reach:6.4,arc:1.6,damage:100,lunge:3.8,pull:true},
      {name:'Sky snare',reach:6,arc:1.5,damage:110,lunge:2,launch:8},
      {name:'Reaping spiral',reach:7,arc:Math.PI,damage:69,lunge:.6,pull:true},
      {name:'Harvest fall',reach:8,arc:2.7,damage:160,lunge:3,launch:9},
    ],
    musou:{name:'Jade harvest',reach:18,launch:12,lunge:1.2},
  },
};
export function attackDefinition(kind,chain=0,style='sword'){
  const step=clamp(kind==='light'?chain%4:chain,0,3),base=kind==='musou'?ATTACKS.musou:ATTACKS[kind][step];
  const variation=kind==='musou'?STYLE_ATTACKS[style]?.musou:STYLE_ATTACKS[style]?.[kind]?.[step];
  return variation?{...base,...variation,style}:base;
}
export function strikeContains(dx,dz,facing,reach,arc){const angle=Math.atan2(dx,dz)-facing;return Math.hypot(dx,dz)<reach&&Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<=arc;}
export function interceptTarget(enemy,player,velocity){
  const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
  if(distance<5)return{x:player.x,z:player.z};
  const speed=Math.hypot(velocity.x,velocity.z),fx=speed>.4?velocity.x/speed:Math.sin(enemy.slot),fz=speed>.4?velocity.z/speed:Math.cos(enemy.slot);
  const prediction=enemy.role===1?1.35:enemy.role===2?.7:.35;
  const side=enemy.role===2?(enemy.slot%2<1?-1:1)*Math.min(7,distance*.32):Math.sin(enemy.slot)*2;
  return{x:player.x+velocity.x*prediction-fz*side,z:player.z+velocity.z*prediction+fx*side};
}
export function chooseAmbushSites(sites,player,heading,now){
  return sites.filter(s=>{const d=Math.hypot(s.x-player.x,s.z-player.z);return d>9&&d<68&&(s.readyAt||0)<=now;}).map(s=>{
    const dx=s.x-player.x,dz=s.z-player.z,d=Math.hypot(dx,dz),front=(dx*Math.sin(heading)+dz*Math.cos(heading))/d;
    return{site:s,score:Math.abs(d-28)-front*13};
  }).sort((a,b)=>a.score-b.score).map(x=>x.site);
}

export const ENEMY_TYPES=[
  {name:'Scout',model:'ninja',weapon:'scout',hp:50,speed:5.9,reach:2.7,duration:.50,hits:[.24,.37],damage:2.5,recovery:2.2,clip:'Twin_Cut_Diagonal',role:2},
  {name:'Guard',model:'enemy-guard',weapon:'guard',hp:135,speed:3.7,reach:3.6,duration:1.12,hits:[.53],damage:8.5,recovery:3.2,clip:'Heavy_Cleave',role:0,armor:true},
  {name:'Lancer',model:'enemy-lancer',weapon:'lancer',hp:80,speed:4.4,reach:5.3,duration:1.05,hits:[.714],damage:6.5,recovery:2.8,clip:'Enemy_Thrust',role:1},
  {name:'Skirmisher',model:'enemy-skirmisher',weapon:'skirmisher',hp:45,speed:4.9,reach:16,duration:.85,hits:[.544],damage:4,recovery:3.5,clip:'Enemy_Throw',role:2,ranged:true},
];
export function enemyTypeForSlot(slot){return [0,0,1,0,2,0,3,0][slot%8];}
export function enemyIntent(enemy,player,velocity){
  const d=Math.hypot(player.x-enemy.x,player.z-enemy.z),definition=ENEMY_TYPES[enemy.type],dx=(player.x-enemy.x)/Math.max(.01,d),dz=(player.z-enemy.z)/Math.max(.01,d),side=enemy.slot%2?1:-1;
  if(definition.ranged&&d<8)return{x:enemy.x-dx*5-dz*side*2,z:enemy.z-dz*5+dx*side*2};
  if((definition.ranged&&d<13)||(enemy.type===2&&d<4.5&&d>3.3))return{x:enemy.x-dz*side*2,z:enemy.z+dx*side*2};
  if(enemy.type===1)return{x:player.x,z:player.z};
  return interceptTarget({...enemy,role:definition.role},player,velocity);
}
export function guardDamageMultiplier(type,kind,front,stunned){return ENEMY_TYPES[type]?.armor&&kind==='light'&&front&&!stunned?.24:1;}

// Reserve a few readable attacks while the rest approach from distinct lanes.
export function engagementTarget(enemy,player,velocity,engaged){
 const d=Math.hypot(player.x-enemy.x,player.z-enemy.z),speed=Math.hypot(velocity.x,velocity.z);
 if(d>11||speed>3||ENEMY_TYPES[enemy.type].ranged)return enemyIntent(enemy,player,velocity);
 const current=Math.atan2(enemy.x-player.x,enemy.z-player.z),lane=enemy.slot*2.39996323;
 const offset=Math.atan2(Math.sin(lane-current),Math.cos(lane-current));
 const angle=current+Math.max(-.65,Math.min(.65,offset));
 const radius=engaged?ENEMY_TYPES[enemy.type].reach*.72:6.3+(enemy.slot%3)*1.1;
 return{x:player.x+Math.sin(angle)*radius,z:player.z+Math.cos(angle)*radius};
}

export const MUSOU_CINEMATIC_DURATION=2.85;
export function enemyReadyToAttack(enemy,time){return !enemy.dead&&!enemy.emerging&&!(enemy.stun>0)&&enemy.cooldown<.4&&time>=(enemy.readyAt||0);}
