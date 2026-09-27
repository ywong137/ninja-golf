// Original layouts. Distances are metres. Each course has its own terrain and scenery theme.
const original = [
  { name: 'The Crane’s Landing', subtitle: 'A quiet opening. Allegedly.', par: 4, length: 330, bend: 28, width: 23, greenX: 8, wind: [1.3, .5], seed: 18,
    bunkers: [[-21, 205, 10, 17], [29, 309, 10, 15], [-12, 338, 9, 10]], pond: [-65, 260, 26, 46] },
  { name: 'Across the Still Water', subtitle: 'Carry the water. Keep your composure.', par: 3, length: 154, bend: -10, width: 19, greenX: -7, wind: [-1.6, .8], seed: 44,
    bunkers: [[-29, 150, 8, 14], [16, 167, 9, 12]], pond: [2, 88, 53, 31] },
  { name: 'The Shogun’s Approach', subtitle: 'One last fairway. Everyone is invited.', par: 5, length: 456, bend: -43, width: 25, greenX: -15, wind: [1.9, -1], seed: 78,
    bunkers: [[-62, 233, 11, 22], [0, 345, 11, 18], [-36, 448, 9, 16], [7, 468, 10, 13]], pond: [49, 362, 28, 50] },
];
function hole(name, subtitle, par, length, bend, width, greenX, seed, options={}) {
  const side=seed%2 ? 1 : -1;
  return {name,subtitle,par,length,bend,width,greenX,seed,wind:[side*(.8+seed%4*.45),.3-seed%3*.45],
    bunkers:[[bend*.8+side*(width+5),length*.58,8,14],[greenX-25,length-9,7,12],[greenX+23,length+9,7,10]],
    pond:[-side*78,length*.7,19,27],...options};
}
const japanese=[...original,
 hole('The Lantern Walk','Follow the lights through the pines.',4,292,-31,22,-13,101),
 hole('Lotus Crossing','A short carry. A long memory.',3,132,8,20,11,102,{pond:[-7,72,38,22],bunkers:[[-33,119,7,10],[34,143,8,11]]}),
 hole('The Fox’s Detour','The inside line invites trouble.',5,478,49,24,18,103),
 hole('Wind at the Shrine','The sea has its own opinion.',4,365,20,21,-9,104),
 hole('The Hidden Bell','Find the green beyond the grove.',3,181,-22,20,-18,105),
 hole('Ninefold Return','The temple waits beyond the last bunker.',5,501,-38,26,12,106),
];
const highlands=[
 hole('Heather Gate','An open fairway beneath the old stones.',4,341,-22,26,-6,201),
 hole('The Gorse Pocket','Small targets. Very large opinions.',3,143,12,19,9,202),
 hole('Crofter’s Road','Choose your side of the rolling links.',5,489,41,25,15,203),
 hole('Firth Watch','Crosswinds arrive without an appointment.',4,382,-36,22,-18,204),
 hole('The Sunken Kirk','Stone walls guard the high approach.',4,314,29,23,4,205),
 hole('Burnside','The quiet water divides the landing ground.',3,172,-14,20,-8,206,{pond:[4,92,37,23]}),
 hole('The Long Glen','A patient route through golden gorse.',5,516,-46,27,-20,207),
 hole('Cairn and Crown','Keep the approach below the wind.',4,352,32,23,12,208),
 hole('Last Light at the Keep','One final climb beneath the ruined tower.',4,407,-28,24,-11,209),
];
const desert=[
 hole('Saguaro Sunrise','Wide turf between tall desert sentinels.',4,328,26,27,8,301),
 hole('The Copper Bowl','Aim into the sandstone amphitheatre.',3,159,-16,21,-12,302),
 hole('Arroyo Bend','The wash rewards a patient second shot.',5,482,-47,25,-16,303),
 hole('Palm Mirage','The water here is quite real.',4,304,34,23,13,304,{pond:[-37,214,22,28]}),
 hole('Coyote Ridge','A narrow approach above the desert scrub.',4,391,-24,22,-8,305),
 hole('Oasis Carry','One clean shot over the water.',3,138,10,21,4,306,{pond:[0,72,37,22],bunkers:[[-24,131,7,10],[29,149,7,11]]}),
 hole('Red Mesa Run','Long shadows cross a generous landing ground.',5,524,42,28,18,307),
 hole('Agave Alley','The safe side changes with the wind.',4,363,-35,23,-16,308),
 hole('The Sunset Terrace','The last green rests beside the resort.',4,418,23,25,9,309),
];
const cyberpunk=[
 hole('Loading Screen','Your opening drive has entered the network.',4,321,10,23,4,401,{weave:35}),
 hole('The Quantum Teacup','The pond remains stubbornly physical.',3,148,-12,20,-6,402,{weave:-19,pond:[3,75,37,22]}),
 hole('Serpent Express','Follow the double bend through the neon garden.',5,496,28,24,12,403,{weave:55}),
 hole('Error 404: Straight Line','The fairway takes the scenic route.',4,338,-20,21,-10,404,{weave:-48}),
 hole('The Hologram Orchard','The trees glow. The bunkers still count.',4,387,38,25,17,405,{weave:31}),
 hole('Pocket Universe','A tiny green at the end of a large idea.',3,177,-10,19,-5,406,{weave:29}),
 hole('Infinite Noodle','Three shots. Two bends. One hungry golfer.',5,537,-34,27,-14,407,{weave:-63}),
 hole('Moon Rabbit Circuit','Cut the corner under the floating moon.',4,354,16,24,7,408,{weave:58}),
 hole('The Final Upload','Leave a score the city cannot forget.',4,431,-28,25,11,409,{weave:-43}),
];
// Individual hazard plans define the intended landing decision on each hole.
// [pond, bunkers, elevation at green, fairway ridge height, strategy]
const plans={
 japanese:[null,null,null,
  [[-71,206,18,36],[[-39,154,9,18],[10,275,8,13],[-35,303,8,11]],2,2,'Play right of the long fairway bunker; the approach climbs towards the lanterns.'],
  [[-7,72,38,22],[[-33,119,7,10],[34,143,8,11]],0,0,'Carry the lotus pond or follow the dry left bank.'],
  [[-58,340,22,41],[[53,213,12,24],[4,365,8,17],[43,468,10,13]],4,3,'A broad first landing narrows before the uphill third shot.'],
  [[65,237,21,45],[[3,215,9,23],[-33,352,10,12],[17,378,8,13]],-1,4,'Choose the left landing shelf to keep the pond out of the approach.'],
  [[-70,123,20,23],[[-43,169,8,14],[4,191,8,12]],3,0,'Club up for the elevated green between two bunkers.'],
  [[66,379,24,39],[[-44,230,12,23],[-4,358,10,15],[-13,487,9,14],[38,510,8,11]],1,5,'The second landing asks for precision before the final temple approach.'],
 ],
 highlands:[
  [[-76,231,17,29],[[8,204,6,10],[-31,321,7,11],[19,353,6,9]],1,3,'Stay left of the small central pot bunker for an open green.'],
  [[-61,84,13,19],[[-14,132,6,8],[31,147,7,9],[6,165,8,6]],3,0,'The raised green demands carry; its back bunker catches excess club.'],
  [[-63,364,18,35],[[10,217,7,17],[55,281,9,15],[-8,467,7,12]],2,4,'Thread two staggered landing bunkers before the long approach.'],
  [[58,261,22,46],[[-46,209,9,22],[-6,348,7,14],[-43,394,7,10]],-2,3,'The inside bunker makes the outside route safer in the crosswind.'],
  [[-68,212,13,27],[[48,167,8,19],[-18,304,8,9],[28,328,7,10]],4,2,'A short drive sets up the uphill shot beneath the kirk.'],
  [[4,92,37,23],[[-30,163,6,10],[16,181,6,10]],-1,0,'Cross the burn to a shallow target, or walk the broad bank.'],
  [[69,389,21,42],[[-53,219,10,25],[-8,332,7,18],[-44,507,8,12]],3,5,'Use the broad right landing before the route turns across the glen.'],
  [[-64,203,19,31],[[42,239,8,19],[-9,335,7,13],[37,364,6,9]],-2,3,'Land below the ridge and leave a low approach between pot bunkers.'],
  [[62,296,17,35],[[-32,190,7,20],[9,292,7,12],[-33,395,6,12],[13,420,7,10]],4,1,'Avoid the crossing bunkers, then climb to the final green.'],
 ],
 desert:[
  [[-74,240,17,24],[[37,184,11,20],[-17,306,9,13]],2,2,'The broad left landing gives the best line around the long bunker.'],
  [[61,96,16,28],[[-34,143,11,16],[15,172,8,10]],-2,0,'A downhill shot lands in the bowl between two sandstone shoulders.'],
  [[58,317,15,45],[[-53,202,13,26],[2,324,11,19],[-39,468,8,13]],3,4,'The wash-shaped bunkers force a choice between a short layup and a long carry.'],
  [[-37,214,22,28],[[44,164,10,16],[35,292,8,12],[-9,319,7,9]],-1,1,'Aim right of the oasis; the approach turns back towards the palms.'],
  [[68,281,14,29],[[-35,226,12,23],[15,376,8,14]],4,3,'Take the broad outside line before the rising ridge approach.'],
  [[0,72,37,22],[[-24,131,7,10],[29,149,7,11]],0,0,'Carry the oasis to a green with room beyond the front edge.'],
  [[-62,395,21,36],[[50,227,14,25],[9,341,10,18],[41,508,9,13],[-8,538,8,10]],2,5,'Two wide landing shelves allow several routes through the desert.'],
  [[61,248,17,33],[[-48,180,11,17],[7,282,9,17],[-39,352,8,13]],-2,3,'The staggered bunkers change the safest side of each shot.'],
  [[-67,304,22,33],[[5,203,11,19],[40,293,10,20],[-17,405,9,14]],4,2,'Play around the long middle bunker before climbing to the resort terrace.'],
 ],
 cyberpunk:[
  [[-66,209,16,31],[[53,109,9,18],[-35,239,10,17],[28,331,8,10]],1,2,'Two bends leave a direct shortcut through the rough for a brave drive.'],
  [[3,75,37,22],[[-29,139,8,11],[19,158,7,10]],2,0,'The floating teacup marks the pond carry to a raised green.'],
  [[-74,346,20,44],[[76,126,10,23],[-29,337,11,22],[36,487,8,12]],3,4,'Follow the serpent or carry its rough-filled inside corners.'],
  [[65,230,22,38],[[-66,104,9,21],[38,259,9,17],[-34,325,8,11]],-1,3,'The first bend goes left; the second returns sharply to the right.'],
  [[-68,293,18,30],[[61,143,12,18],[6,279,9,22],[42,397,8,11]],4,2,'Holographic trees frame an uphill finish after a wide first landing.'],
  [[-51,95,17,26],[[38,53,7,12],[-28,168,7,10],[20,188,8,9]],-1,1,'Cut across the small first bend and avoid the deep rear bunker.'],
  [[73,367,24,38],[[-76,155,12,25],[26,360,12,22],[-39,523,8,13],[10,549,7,10]],3,5,'The longest route has two landing shelves and a final climb.'],
  [[-69,243,19,35],[[71,108,10,18],[-34,241,9,19],[31,346,9,13]],2,3,'The moon watches a large S-bend with an open outside landing.'],
  [[66,317,18,39],[[-62,128,12,23],[15,299,10,21],[-12,420,8,12],[37,442,7,10]],4,2,'A sharp first bend opens into the final neon-lit approach.'],
 ],
};
for(const [theme,holes] of Object.entries({japanese,highlands,desert,cyberpunk}))holes.forEach((h,i)=>{const p=plans[theme][i];if(p)Object.assign(h,{pond:p[0],bunkers:p[1],rise:p[2],swell:p[3],strategy:p[4]});});
original.forEach((h,i)=>{h.strategy=['The right bend opens a wide landing; keep the approach away from the two green bunkers.','Carry the water towards the raised green, or follow the dry bank for a safer route.','Aim for the first landing left of the pond, then choose a layup before the narrow approach.'][i];});
const set=(id,name,subtitle,description,theme,accent,holes,extra)=>({id,name,subtitle,description,theme,accent,preview:{hole:0},holes:holes.map((h,i)=>({...h,...extra,id:`${id}-${i+1}`,number:i+1,courseId:id,theme}))});
export const COURSE_SETS=[
 set('crane-coast','Crane Coast','Japan · Coastal gardens','Temple gardens, pine groves, and a deeply unreliable promise of peace.','japanese','#bc5949',japanese,{coastal:true,relief:1}),
 set('heather-crown','Heather & Crown','Scotland · Highland links','Ancient stone, stubborn winds, and several men who object to your backswing.','highlands','#a08bb2',highlands,{coastal:true,relief:1.3}),
 set('copper-saguaro','Copper Saguaro','Arizona · Sonoran resort','Perfect resort conditions. The cacti are the friendliest things here.','desert','#d9a36b',desert,{coastal:false,relief:.9}),
 set('neo-tokyo','Neo-Tokyo After Dark','Japan, 2099 · Neon absurdity','Glowing gardens, floating moons, and fairways with unusual opinions.','cyberpunk','#73e4ec',cyberpunk,{coastal:false,relief:.65}),
];
export const COURSES=COURSE_SETS[0].holes;
