import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {CLUBS,carryFor} from '../src/course.js';
import {createGolfClub} from '../src/golf-club.js';
import {SHOT_HEIGHTS} from '../src/shot-height.js';
import {BALL_RADIUS} from '../src/golf-equipment.js';

// Exercise the actual Game methods without starting its renderer or CSS loader.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
class FakeWarrior{
 constructor(){this.root=new THREE.Group();this.golfClub=createGolfClub();this.root.add(this.golfClub.root);this.disposed=false;}
 setGolfClub(code){this.golfClub.setClub(code);this.clubShort=code;}
 dispose(){this.disposed=true;}
}
class FakeShowcase{constructor(player){this.player=player;this.state={};this.clock={speed:1,paused:false};}dispose(){}}
const context={THREE,CLUBS,carryFor,SHOT_HEIGHTS,WARRIORS:[{power:1,health:100},{power:1,health:100}],Warrior:FakeWarrior,CharacterShowcase:FakeShowcase,heightAt:()=>0,ellipse:()=>0,createCourseSurfaceSampler:()=>()=>0,createPlayerGuard:()=>({}),BALL_RADIUS};
vm.runInNewContext(source.slice(source.indexOf('class Game {'),source.indexOf('\nasync function boot')).replace('class Game {','this.Game=class Game {').replaceAll('import.meta.env.DEV','false'),context);
function fixture(){
 const game=Object.create(context.Game.prototype);
 Object.assign(game,{mode:'game',phase:'aim',paused:false,club:0,shotHeight:0,playerIndex:0,player:new FakeWarrior(),scene:new THREE.Scene(),ball:{position:new THREE.Vector3()},world:{cup:new THREE.Vector3(),build(){}},ui:{warriorDetails(){},showcaseState(){}},audio:{play(){}},showcaseSettings:{},refreshAim(){this.refreshCount=(this.refreshCount||0)+1;},placePlayer(){}});
 game.updateClubModel();return game;
}
function active(game,code){assert.equal(game.player.clubShort,code);assert.equal(game.player.golfClub.head.children[0].userData.clubShort,code);}

test('manual club selection changes the attached runtime head for all eight clubs',()=>{
 const game=fixture();
 for(let i=0;i<CLUBS.length;i++){game.selectClub(i);assert.equal(game.club,i);active(game,CLUBS[i].short);}
 assert.equal(game.refreshCount,8);
 for(const i of [-1,8,1.5,undefined])game.selectClub(i);
 assert.equal(game.club,7);active(game,'PT');
 for(const block of [{mode:'selection'},{phase:'flight'},{paused:true}]){const blocked=fixture();Object.assign(blocked,block);blocked.selectClub(4);assert.equal(blocked.club,0);active(blocked,'DR');}
});

test('automatic clubs, hole defaults, and new players update the same runtime model',()=>{
 const game=fixture();
 for(const [distance,lie,code]of [[10,'Green','PT'],[150,'Bunker','SW'],[140,'Fairway','7I'],[1,'Fairway','SW']]){game.world.cup.set(distance,0,0);game.lie=lie;game.selectBestClub();active(game,code);}
 game.selectClub(5);const previous=game.player;game.selectWarrior(1);assert.equal(previous.disposed,true);active(game,'PW');
 Object.assign(game,{holes:[{par:3,theme:'park',greenX:0,length:100},{par:4,theme:'park',greenX:0,length:200}],puttingGuide:{build(){}},clearEnemies(){},effects:{clear(){}},shotOrigin:new THREE.Vector3(),trail:{},camera:{position:new THREE.Vector3()},aimAtPin(){this.aim=0;}});
 game.loadHole(0);active(game,'5I');game.loadHole(1);active(game,'DR');
});

test('selection showcase explicitly uses a driver for its Golf_Swing clip',()=>{
 const game=fixture();game.selectClub(7);active(game,'PT');game.startShowcase();active(game,'DR');assert.equal(game.showcase.player,game.player);
 game.updateCamera=(dt,options)=>{game.previewCameraUpdate={dt,options};};
 game.mode='selection';game.course={};game.selectWarrior(1);active(game,'DR');assert.equal(game.showcase.player,game.player);
 assert.equal(game.previewCameraUpdate.dt,0);assert.equal(game.previewCameraUpdate.options.immediate,true);
});


test('shot height edits cancel charging, preserve aim, lock after commitment, and reset for putting',()=>{
 const game=fixture();game.aim=.7;game.charging=true;game.power=.4;
 game.selectShotHeight(-1);assert.equal(game.shotHeight,-1);assert.equal(game.charging,false);assert.equal(game.power,1);assert.equal(game.aim,.7);assert.equal(game.refreshCount,1);
 game.charging=true;game.selectShotHeight(-1);assert.equal(game.charging,true);assert.equal(game.refreshCount,1);
 for(const value of [2,-2,NaN,'high'])game.selectShotHeight(value);
 assert.equal(game.shotHeight,-1);
 game.selectClub(3);assert.equal(game.shotHeight,-1);game.selectClub(7);assert.equal(game.shotHeight,0);game.selectShotHeight(1);assert.equal(game.shotHeight,0);
 for(const block of [{mode:'selection'},{phase:'flight'},{phase:'swing'},{phase:'combat'},{paused:true}]){const blocked=fixture();Object.assign(blocked,block);blocked.selectShotHeight(1);assert.equal(blocked.shotHeight,0);}
 game.selectClub(3);game.selectShotHeight(1);game.lie='Fairway';game.selectBestClub();assert.equal(game.shotHeight,0);
});
