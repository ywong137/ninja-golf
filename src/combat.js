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
  musou:{name:'Musou',duration:2.1,hits:[.14,.46,.8,1.16,1.65],reach:19,arc:Math.PI,damage:120,lunge:1,flourish:3,launch:8},
};
export function attackDefinition(kind,chain=0){if(kind==='musou')return ATTACKS.musou;return ATTACKS[kind][clamp(kind==='light'?chain%4:chain,0,3)];}
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
  {name:'Scout',model:'ninja',weapon:'scout',hp:50,speed:5.9,reach:2.7,duration:.50,hits:[.24,.37],damage:5,recovery:1.25,clip:'Twin_Cut_Diagonal',role:2},
  {name:'Guard',model:'enemy-guard',weapon:'guard',hp:135,speed:3.7,reach:3.6,duration:1.12,hits:[.53],damage:17,recovery:2.25,clip:'Heavy_Cleave',role:0,armor:true},
  {name:'Lancer',model:'enemy-lancer',weapon:'lancer',hp:80,speed:4.4,reach:5.3,duration:1.05,hits:[.714],damage:13,recovery:2.1,clip:'Enemy_Thrust',role:1},
  {name:'Skirmisher',model:'enemy-skirmisher',weapon:'skirmisher',hp:45,speed:4.9,reach:16,duration:.85,hits:[.544],damage:8,recovery:2.8,clip:'Enemy_Throw',role:2,ranged:true},
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
