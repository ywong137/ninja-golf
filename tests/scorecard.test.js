import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UI} from '../src/ui.js';

const holes=[4,3,5,4,4,3,5,4,4].map((par,i)=>({par,name:`Hole ${i+1}`}));
function render(scores,penalties=[]){
 let html;const controls=new Map();
 const ui={modal(markup){html=markup;},$(id){if(!controls.has(id))controls.set(id,{});return controls.get(id);}};
 UI.prototype.scorecard.call(ui,{holes,scores,scorePenalties:penalties,strokes:scores.at(-1),course:holes[scores.length-1],kills:2708,bestCombo:67,warrior:{name:'The Vice President'}});
 return html;
}

test('A completed round describes its total, even after a bad final hole',()=>{
 const html=render([3,1,4,3,3,2,4,2,11],[0,0,0,0,0,0,0,0,4]);
 assert.match(html,/<h2>3 under par<span/);
 assert.match(html,/<td>TOTAL<\/td><td>36<\/td><td>33<\/td><td>-3<\/td>/);
 assert.match(html,/includes 4 penalty/);
 assert.match(html,/Play another round/);
});
test('Completed level-par and over-par rounds use the round result',()=>{
 assert.match(render(holes.map(h=>h.par)),/<h2>Level par<span/);
 assert.match(render(holes.map((h,i)=>h.par+(i===0?2:0))),/<h2>2 over par<span/);
});
test('An intermediate scorecard still describes the completed hole',()=>{
 const html=render([5]);
 assert.match(html,/<h2>Bogey<span/);
 assert.match(html,/HOLE 1 COMPLETE/);
 assert.match(html,/On to the next tee/);
});
