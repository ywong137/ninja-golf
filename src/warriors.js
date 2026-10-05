const SHINOBI_MUSOU_SEQUENCE = [
  {
    "clip": "Shinobi_Stepping_Cut",
    "heading": 0
  },
  {
    "clip": "Shinobi_Left_Stepping_Cut",
    "heading": 2.0943951023931953,
    "shadowTravel": 1.5
  },
  {
    "clip": "Shinobi_Airborne_Cut",
    "heading": -2.0943951023931953,
    "shadowTravel": 1.5
  },
  {
    "clip": "Shinobi_Left_Airborne_Cut",
    "heading": 0,
    "shadowTravel": 1.5
  }
];

// Combat styles identify existing animation families; weaponKind selects the current blade geometry.
export const WARRIORS = [
  { model: 'ronin', selectionClip: 'Ronin_Selection_Idle', combatStyle: 'odachi', motionPrefix: '', readyClip: 'Ronin_Ready', motionOverrides: { Cut_Diagonal: 'Ronin_Driving_Cut', Cut_Return: 'Ronin_Low_Cut', Heavy_Cleave: 'Ronin_Power_Cut', Musou_Flow: 'Ronin_Musou_Advance' }, weaponKind: 'odachi', dualWield: false, name: 'The Ronin', title: 'Master of the long game', color: '#bc493c', power: 1.08, speed: 1, damage: 1.2, health: 110, precision: .95, weapon: 'Odachi', special: 'Crimson cyclone', description: 'A powerful drive. A devastating blade. Still working on his short game.', stats: [92, 68, 86] },
  { model: 'shinobi', musouSequence: SHINOBI_MUSOU_SEQUENCE, selectionClip: 'Twin_Selection_Idle', combatStyle: 'twin', motionPrefix: 'Twin_', readyClip: 'Twin_Ready', motionOverrides: { Twin_Cut_Diagonal: 'Shinobi_Stepping_Cut', Twin_Cut_Return: 'Shinobi_Left_Stepping_Cut', Twin_Heavy_Cleave: 'Shinobi_Airborne_Cut', Twin_Heavy_Rising: 'Shinobi_Left_Airborne_Cut' }, weaponKind: 'twin', dualWield: true, name: 'The Shinobi', title: 'Quiet feet. Questionable handicap.', color: '#6ca3aa', power: .93, speed: 1.23, damage: .95, health: 90, precision: 1.3, weapon: 'Twin blades', special: 'Shadow storm', description: 'Quick across the rough, precise on the green. Disappears after a bogey.', stats: [68, 96, 76] },
  { model: 'monk', selectionClip: 'Naginata_Selection_Idle', combatStyle: 'naginata', motionPrefix: 'Naginata_', readyClip: 'Ethan_Naginata_Ready', motionOverrides: { Naginata_Cut_Diagonal: 'Ethan_Naginata_Driving_Cut', Naginata_Cut_Return: 'Ethan_Naginata_Cut_Return', Naginata_Cut_Rising: 'Ethan_Naginata_Cut_Rising', Naginata_Cut_Sweep: 'Ethan_Naginata_Cut_Sweep', Naginata_Heavy_Cleave: 'Ethan_Naginata_Power_Cut', Naginata_Heavy_Rising: 'Ethan_Naginata_Heavy_Rising', Naginata_Heavy_Sweep: 'Ethan_Naginata_Heavy_Sweep', Naginata_Heavy_Slam: 'Ethan_Naginata_Heavy_Slam', Naginata_Musou_Flow: 'Ethan_Naginata_Musou_Flow' }, weaponKind: 'naginata', dualWield: false, name: 'The Vice President', title: 'This meeting could have been a birdie.', color: '#dcad57', power: 1, speed: .94, damage: 1.4, health: 140, precision: 1.12, weapon: 'Naginata', special: 'Hostile takeover', description: 'Ethan Cary brings executive authority to the municipal links. Every ambush becomes an unscheduled restructuring.', stats: [80, 80, 96] },
  { model: 'kaede', selectionClip: 'Fan_Selection_Idle', combatStyle: 'fan', motionPrefix: 'Fan_', readyClip: 'Ace_Ready', lightComboLength: 3, motionOverrides: { Fan_Cut_Diagonal: 'Ace_Combo_Opening', Fan_Cut_Return: 'Ace_Combo_Return', Fan_Cut_Rising: 'Ace_Combo_Finish', Fan_Heavy_Cleave: 'Ace_Turning_Double_Cut', Fan_Musou_Flow: 'Ace_Musou_Tempest' }, weaponKind: 'jian', dualWield: false, name: 'The Ace', title: 'Course record. Incident report.', color: '#cc6175', power: 1.05, speed: 1.08, damage: 1.12, health: 105, precision: 1.1, weapon: 'Jian · straight sword', special: 'Petal tempest', description: 'A tour captain with a precise straight sword and graceful countersteps. Her etiquette is sharper than her putting.', stats: [88, 83, 82] },
  { model: 'ayame', selectionClip: 'Ring_Selection_Idle', combatStyle: 'ring', motionPrefix: 'Ring_', readyClip: 'Ring_Ready', lightComboLength: 3, motionOverrides: { Ring_Cut_Diagonal: 'Hustler_Combo_Opening', Ring_Cut_Return: 'Hustler_Combo_Return', Ring_Cut_Rising: 'Hustler_Combo_Finish', Ring_Heavy_Cleave: 'Hustler_Power_Finish', Ring_Musou_Flow: 'Hustler_Musou_Advance' }, weaponKind: 'dao', dualWield: false, name: 'The Hustler', title: 'Your handicap is negotiable.', color: '#9e8cce', power: .96, speed: 1.2, damage: 1, health: 95, precision: 1.28, weapon: 'Dao · curved sabre', special: 'Violet orbit', description: 'A match-play tactician with a curved sabre and quick changes of direction. Takes every dogleg personally.', stats: [73, 95, 80] },
  { model: 'sora', selectionClip: 'Sickle_Selection_Idle', combatStyle: 'sickle', motionPrefix: 'Sickle_', readyClip: 'Sickle_Ready', lightComboLength: 3, motionOverrides: { Sickle_Cut_Diagonal: 'Closer_Combo_Opening', Sickle_Cut_Return: 'Closer_Combo_Return', Sickle_Cut_Rising: 'Closer_Combo_Finish', Sickle_Heavy_Cleave: 'Closer_Power_Finish', Sickle_Musou_Flow: 'Closer_Musou_Pursuit' }, weaponKind: 'wakizashi', dualWield: false, name: 'The Closer', title: 'Always makes the cut.', color: '#6caf9c', power: 1.03, speed: 1, damage: 1.3, health: 125, precision: 1.18, weapon: 'Wakizashi · short sword', special: 'Jade harvest', description: 'A quiet links hunter with a short sword, low footwork, and a dry sense of humor. Always makes the cut.', stats: [84, 88, 91] },
];

// Keep persistent hero IDs stable; arrange the selection cards independently.
export const WARRIOR_SELECTION_ORDER=[0,3,1,4,2,5];

// Ultimate chains keep the complete captured torso, stepping and recovery motion.
WARRIORS[0].musouChain=['Ronin_Musou_Advance','Ronin_Power_Cut','Ronin_Low_Cut','Ronin_Musou_Advance'];
WARRIORS[2].musouChain=['Ethan_Naginata_Power_Cut','Ethan_Naginata_Driving_Cut','Ethan_Naginata_Power_Cut','Ethan_Naginata_Driving_Cut','Ethan_Naginata_Power_Cut','Ethan_Naginata_Driving_Cut'];
WARRIORS[3].musouChain=['Ace_Musou_Tempest','Ace_Turning_Double_Cut'];
WARRIORS[4].musouChain=['Hustler_Combo_Opening','Hustler_Combo_Return','Hustler_Combo_Finish','Hustler_Musou_Advance'];
WARRIORS[5].musouChain=['Closer_Combo_Opening','Closer_Combo_Return','Closer_Combo_Finish','Closer_Musou_Pursuit'];
SHINOBI_MUSOU_SEQUENCE.push({clip:'Shinobi_Stepping_Cut',heading:-2.0943951023931953,shadowTravel:1.5},{clip:'Shinobi_Left_Airborne_Cut',heading:0,shadowTravel:1.5});

// The purchased performances are part of the normal character build.
WARRIORS[2].musouChain=['Ethan_GDH_Combo5_Review','Ethan_GDH_Advancing_Thrust','Ethan_GDH_Combo5_Review'];
WARRIORS[2].motionOverrides.Naginata_Heavy_Cleave='Ethan_GDH_Combo5_Review';
WARRIORS[2].motionOverrides.Naginata_Cut_Diagonal='Ethan_GDH_Advancing_Thrust';

// Short blades use captured lunges and airborne cuts throughout the combo.
Object.assign(WARRIORS[1].motionOverrides,{Twin_Cut_Diagonal:'Shinobi_Airborne_Cut',Twin_Cut_Return:'Shinobi_Left_Airborne_Cut',Twin_Cut_Rising:'Shinobi_Stepping_Cut',Twin_Cut_Sweep:'Shinobi_Left_Stepping_Cut',Twin_Heavy_Sweep:'Shinobi_Airborne_Cut',Twin_Heavy_Slam:'Shinobi_Left_Airborne_Cut'});
WARRIORS[1].heavySequence=[{clip:'Shinobi_Airborne_Cut',heading:0},{clip:'Shinobi_Left_Stepping_Cut',heading:Math.PI*2/3,shadowTravel:.6},{clip:'Shinobi_Left_Airborne_Cut',heading:-Math.PI*2/3,shadowTravel:.6}];
