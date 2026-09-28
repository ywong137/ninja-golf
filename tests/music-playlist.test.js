import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlaylist} from '../src/music-playlist.js';
const catalog=Object.fromEntries(['crane','heather','copper','neo'].map(id=>[id,{course:[{src:id+'-calm-a'},{src:id+'-calm-b'}],combat:[{src:id+'-fight-a'},{src:id+'-fight-b'}]}]));
test('each course alternates both playlists without sharing track positions',()=>{
 const music=new MusicPlaylist(catalog,'crane');assert.equal(music.current('course').src,'crane-calm-a');music.next('course');assert.equal(music.current('course').src,'crane-calm-b');
 assert.equal(music.enterCombat().src,'crane-fight-a');assert.equal(music.enterCombat().src,'crane-fight-b');assert.equal(music.enterCombat().src,'crane-fight-a');
 music.setCourse('neo');assert.equal(music.current('course').src,'neo-calm-a');assert.equal(music.next('combat').src,'neo-fight-b');music.setCourse('crane');assert.equal(music.current('course').src,'crane-calm-b');
});
test('catalog rejects missing songs, repeated recordings, and unknown courses',()=>{
 assert.throws(()=>new MusicPlaylist({bad:{course:[],combat:[]}},'bad'),/two playable/);
 assert.throws(()=>new MusicPlaylist({bad:{course:[{src:'same'},{src:'same'}],combat:[]}},'bad'),/same song/);
 const music=new MusicPlaylist(catalog,'crane');assert.throws(()=>music.setCourse('missing'),/Unknown soundtrack course/);assert.throws(()=>music.current('quiet'),/Unknown soundtrack mode/);
});
