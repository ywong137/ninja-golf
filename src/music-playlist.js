// Keep course identity, mode, and track order separate from Web Audio playback.
export class MusicPlaylist{
 constructor(catalog,courseId){
  this.catalog=catalog;this.positions=new Map();
  for(const [id,modes]of Object.entries(catalog))for(const mode of ['course','combat']){
   if(modes[mode]?.length!==2||modes[mode].some(track=>!track.src))throw Error(`${id}/${mode} needs two playable songs.`);
   if(new Set(modes[mode].map(track=>track.src)).size!==2)throw Error(`${id}/${mode} repeats the same song.`);
  }
  this.setCourse(courseId);
 }
 setCourse(id){if(!this.catalog[id])throw Error('Unknown soundtrack course: '+id);this.courseId=id;if(!this.positions.has(id))this.positions.set(id,{course:0,combat:0,combatStarted:false});}
 current(mode){const index=this.positions.get(this.courseId)[mode];if(!Number.isInteger(index))throw Error('Unknown soundtrack mode: '+mode);return this.catalog[this.courseId][mode][index];}
 next(mode){const positions=this.positions.get(this.courseId);this.current(mode);positions[mode]=(positions[mode]+1)%2;return this.current(mode);}
 enterCombat(){const positions=this.positions.get(this.courseId);if(positions.combatStarted)this.next('combat');positions.combatStarted=true;return this.current('combat');}
}
