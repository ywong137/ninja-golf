import {WARRIORS} from './warriors.js';
import {ENEMY_APPEARANCES} from './enemy-appearances.js';

// The order matches the character templates followed by their shared motion sources.
export const WARRIOR_ASSET_NAMES=Object.freeze([
 ...WARRIORS.map(w=>w.model),...ENEMY_APPEARANCES.map(e=>e.model),'warrior-motion','golf-motion',
]);
