import {SAGUARO_NAMES} from './saguaro.js';
import {forestSpecies} from './nature-species.js';
export const NATURE_MODEL_NAMES=Object.freeze(['forest-canopy','dry-tree','understory','fern','coastal-rock','desert-rock','sea-cliff','pine-open','pine-young','fir-layered','woody-scrub','desert-scrub']);
export const NATURE_ASSET_NAMES=Object.freeze([...NATURE_MODEL_NAMES,...SAGUARO_NAMES]);

// Trees follow the course species. Rocks and understory follow NaturalLandscape.
export function natureAssetsForTheme(theme){
 if(theme===undefined)return NATURE_ASSET_NAMES;
 if(!['japanese','highlands','desert','cyberpunk'].includes(theme))throw new Error(`Unknown scenery theme: ${theme}`);
 const names=new Set(forestSpecies(theme).map(entry=>entry.name));
 if(theme==='desert'){names.add('desert-rock');names.add('woody-scrub');names.add('desert-scrub');}
 else for(const name of ['coastal-rock','sea-cliff','fern',theme==='highlands'?'woody-scrub':'understory'])names.add(name);
 return NATURE_ASSET_NAMES.filter(name=>names.has(name));
}

// Downloads exclude the original cactus meshes generated in memory.
export function natureModelFilesForTheme(theme){return natureAssetsForTheme(theme).filter(name=>NATURE_MODEL_NAMES.includes(name));}
