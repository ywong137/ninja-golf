import craneHeather from '../assets/audio/music-crane-heather.json' with {type:'json'};
import copperNeo from '../assets/audio/music-copper-neo.json' with {type:'json'};

export const SOUNDTRACK_COURSES={
 'crane-coast':'Crane Coast',
 'heather-crown':'Heather & Crown',
 'copper-saguaro':'Copper Saguaro',
 'neo-tokyo':'Neo-Tokyo',
};
export const MUSIC_CREDITS=[...craneHeather,...copperNeo];
export const SOUNDTRACKS=Object.fromEntries(Object.keys(SOUNDTRACK_COURSES).map(id=>[
 id,Object.fromEntries(['course','combat'].map(mode=>[mode,MUSIC_CREDITS.filter(track=>track.courseId===id&&track.mode===mode)])),
]));
