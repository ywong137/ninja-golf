import {forestSpecies} from './nature-species.js';
export const NATURE_ASSET_NAMES=Object.freeze(['forest-canopy','dry-tree','understory','fern','coastal-rock','desert-rock','sea-cliff','pine-open','pine-young','fir-layered','woody-scrub']);

// Trees follow the course species. Rocks and understory follow NaturalLandscape.
export function natureAssetsForTheme(theme){
 if(theme===undefined)return NATURE_ASSET_NAMES;
 if(!['japanese','highlands','desert','cyberpunk'].includes(theme))throw new Error(`Unknown scenery theme: ${theme}`);
 const names=new Set(forestSpecies(theme).map(entry=>entry.name));
 if(theme==='desert')names.add('desert-rock');
 else for(const name of ['coastal-rock','sea-cliff','fern',theme==='highlands'?'woody-scrub':'understory'])names.add(name);
 return NATURE_ASSET_NAMES.filter(name=>names.has(name));
}
