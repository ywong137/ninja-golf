import {attackDefinition} from './combat.js';
import {withMotionTiming} from './attack-timing.js';
import {buildMusouSequence} from './musou-sequence.js';
import {buildShadowSequence} from './shadow-sequence.js';

// Gameplay and the selection inspector construct the same captured performance.
export function createAttackPerformance(warrior,kind,step,motionName,records){
 const motion=records[motionName];
 if(!motion)throw Error('Missing attack motion: '+motionName);
 let definition=withMotionTiming(attackDefinition(kind,step,warrior.combatStyle),motion);
 const sequence=kind==='musou'?(warrior.musouChain?buildMusouSequence(records,warrior.musouChain):warrior.musouSequence?buildShadowSequence(records,warrior.musouSequence,{gap:.075,continuous:true,minDuration:7}):null):null;
 if(sequence)definition={...definition,duration:sequence.duration,hits:sequence.hits,headings:sequence.headings,damage:definition.damage*definition.hits.length/sequence.hits.length};
 return{...definition,motionName,kind,step,sequence,syncMotion:!!motion.continuations,
  impactHands:sequence?.impactHands??motion.impactHands,rootAdvance:motion.rootAdvance??0,
  planarRoot:sequence?.planarRoot??motion.planarRoot,movementScale:sequence?0:motion.movementScale??.45,
  headings:definition.headings??(kind==='musou'?motion.headings:null)};
}
