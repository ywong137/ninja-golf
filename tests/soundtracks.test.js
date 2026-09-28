import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {MUSIC_CREDITS,SOUNDTRACKS,SOUNDTRACK_COURSES} from '../src/soundtracks.js';
import {MusicPlaylist} from '../src/music-playlist.js';

test('four complete course soundtracks ship sixteen distinct licensed recordings',()=>{
 assert.equal(MUSIC_CREDITS.length,16);
 assert.equal(new Set(MUSIC_CREDITS.map(track=>track.src)).size,16);
 assert.equal(Object.keys(SOUNDTRACK_COURSES).length,4);
 const playlist=new MusicPlaylist(SOUNDTRACKS,'crane-coast');
 for(const id of Object.keys(SOUNDTRACK_COURSES)){
  playlist.setCourse(id);
  for(const mode of ['course','combat'])for(const track of SOUNDTRACKS[id][mode]){
   assert.match(track.src,/^audio\/.+\.mp3$/,'Paths must remain relative to the deployed game.');
   for(const key of ['title','artist','source','license','licenseUrl'])assert.ok(track[key],`${track.src}: ${key}`);
   assert.match(track.source,/^https:\/\//);
   assert.match(track.licenseUrl,/^https:\/\//);
   const bytes=fs.readFileSync(new URL('../public/'+track.src,import.meta.url));
   assert.ok(bytes.length>100_000,`${track.src}: audio payload is incomplete`);
   if(track.sha256)assert.equal(createHash('sha256').update(bytes).digest('hex'),track.sha256);
  }
 }
});
