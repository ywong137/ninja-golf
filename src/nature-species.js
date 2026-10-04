// Distinct source anatomy, with uniform scale only. Weights replace existing trees.
// Fir needles use 34k triangles; keep their native branches through the middle view.
// Dense pines retain their shorter range to keep the crowd rendering budget bounded.
export const CONIFER_DETAIL={nearStart:34,nearEnd:36,farStart:46,farEnd:50};
export const TREE_SPECIES={
 'forest-canopy':{height:14},'dry-tree':{height:7},
 'pine-open':{height:17,detail:CONIFER_DETAIL},'pine-young':{height:12,detail:CONIFER_DETAIL},'fir-layered':{height:19,detail:{nearStart:34,nearEnd:36,farStart:100,farEnd:104}},
};
export function forestSpecies(theme){
 if(theme==='highlands')return[{name:'pine-open',weight:.20},{name:'pine-young',weight:.15},{name:'fir-layered',weight:.65}];
 if(theme==='japanese')return[{name:'pine-open',weight:.15},{name:'pine-young',weight:.15},{name:'fir-layered',weight:.35},{name:'forest-canopy',weight:.35}];
 return[{name:theme==='desert'?'dry-tree':'forest-canopy',weight:1}];
}
export function selectForestSpecies(theme,value){
 const species=forestSpecies(theme);let remaining=value;
 for(const entry of species){remaining-=entry.weight;if(remaining<0)return entry.name;}
 return species.at(-1).name;
}
