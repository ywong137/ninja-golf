// Standard gamepad button numbers are shared by input handling and visible prompts.
export const GAMEPAD_ACTIONS=Object.freeze({
 combat:Object.freeze({0:'Interact',1:'Dodge',2:'LightAttack',3:'HeavyAttack',5:'Musou',7:'LightAttack',9:'Escape',11:'Waypoint'}),
 golf:Object.freeze({0:'Space',1:'ShiftLeft',3:'KeyR',4:'KeyQ',5:'KeyE',9:'Escape',12:'KeyX',13:'KeyZ',14:'ArrowLeft',15:'ArrowRight'}),
});
const BUTTON_LABELS={0:'A',1:'B',2:'X',3:'Y',4:'LB',5:'RB',7:'RT',9:'START',11:'RS CLICK',12:'D-PAD ↑',13:'D-PAD ↓',14:'D-PAD ←',15:'D-PAD →'};
const padKey=(context,action)=>Object.entries(GAMEPAD_ACTIONS[context]).filter(([,value])=>value===action).map(([button])=>BUTTON_LABELS[button]).join(' / ');
const keyboard={
 combatEntry:'The walk begins. Click to capture mouse · Left / right click: fast / heavy · F: Musou',
 device:'KEYBOARD + MOUSE',swing:'SPACE',survey:'R',interact:'E',musou:'F',guard:'V',heavy:'RMB',shotHeight:'Z / X',
 clubs:'Q / E · Change club   A / D · Aim',skip:'SPACE · Follow ball faster',
 combat:[['W A S D','Move'],['SHIFT','Sprint'],['SPACE','Dodge'],['V','Guard'],['LMB','Fast'],['RMB','Heavy'],['F','Musou'],['C','Focus'],['Q','Face waypoint']],
};
const gamepad={
 combatEntry:`The walk begins. LS: move · ${padKey('combat','LightAttack')}: fast · ${padKey('combat','HeavyAttack')}: heavy · ${padKey('combat','Musou')}: Musou`,
 device:'GAMEPAD',swing:padKey('golf','Space'),survey:padKey('golf','KeyR'),interact:padKey('combat','Interact'),musou:padKey('combat','Musou'),guard:'LB',heavy:padKey('combat','HeavyAttack'),shotHeight:'D-PAD ↓ / ↑',
 clubs:`${padKey('golf','KeyQ')} / ${padKey('golf','KeyE')} · Change club   LS · Aim`,skip:`${padKey('golf','Space')} · Follow ball faster`,
 combat:[['LS','Move'],['LS CLICK','Sprint'],[padKey('combat','Dodge'),'Dodge'],['LB','Guard'],[padKey('combat','LightAttack'),'Fast'],[padKey('combat','HeavyAttack'),'Heavy'],[padKey('combat','Musou'),'Musou'],['LT','Focus'],[padKey('combat','Waypoint'),'Face waypoint']],
};
export function controlHints(device,{phase='aim',survey=false,locked=false}={}){
 const pad=device==='gamepad',labels=pad?gamepad:keyboard,combat=phase==='combat';
 const look=pad?(combat?'RS · LOOK    START · PAUSE':survey?'LS · PAN    RS · ORBIT    LT / RT · ZOOM    Y · RETURN':'LS · AIM    START · PAUSE / CONTROLS'):
  combat?(locked?'MOUSE · LOOK    ESC · RELEASE MOUSE / PAUSE':'CLICK COURSE · CAPTURE MOUSE    ESC · PAUSE'):survey?'DRAG · PAN    RIGHT DRAG · ORBIT    WHEEL · ZOOM    R · RETURN':'RIGHT DRAG · AIM    ESC · PAUSE / CONTROLS';
 return {...labels,look:phase==='flight'?`${labels.swing} · FOLLOW BALL FASTER    ${pad?'START':'ESC'} · PAUSE`:look};
}
