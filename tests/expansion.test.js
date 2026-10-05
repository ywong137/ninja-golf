import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera} from 'three';
import {COURSE_SETS,WARRIORS} from '../src/course.js';
import {readRoundSave} from '../src/round.js';
import {createSurvey,moveSurvey,surveyPosition} from '../src/survey.js';
import {ENEMY_TYPES,enemyReadyToAttack,MUSOU_CINEMATIC_DURATION,attackDefinition} from '../src/combat.js';

test('Saved rounds resume the correct course and reject malformed progress',()=>{
 const data={version:2,courseId:COURSE_SETS[3].id,playerIndex:5,scores:[4,3,5,4],penalties:[0,0,1,0],nextHole:4};
 assert.equal(readRoundSave(JSON.stringify(data),COURSE_SETS,WARRIORS).courseIndex,3);
 for(const change of [{courseId:'missing'},{nextHole:9},{playerIndex:19},{scores:[4,3]},{scores:[4,3,-2,4]}])assert.equal(readRoundSave(JSON.stringify({...data,...change}),COURSE_SETS,WARRIORS),null);
 assert.equal(readRoundSave(JSON.stringify({...data,version:1,nextHole:2,scores:[4,3]}),COURSE_SETS,WARRIORS).courseIndex,0);
});
test('Survey fits a full drive and keeps camera exploration independent of the shot',()=>{
 const start=new Vector3(0,8,0),landing=new Vector3(20,8,280),view=createSurvey(start,landing,48,1440/900),camera=new PerspectiveCamera(48,1440/900,.4,6500);
 camera.position.copy(surveyPosition(view));camera.lookAt(view.target);camera.updateMatrixWorld();
 for(const point of [start,landing]){const screen=point.clone().project(camera);assert.ok(Math.abs(screen.x)<.8&&Math.abs(screen.y)<.8);}
 const initial=view.target.clone(),distance=view.distance;
 moveSurvey(view,{lookX:0,lookY:0,zoom:-120,panX:60,panY:-30,move:{x:0,y:0}},.016,COURSE_SETS[0].holes[0]);
 assert.ok(view.distance<distance);assert.ok(view.target.distanceTo(initial)>10);assert.deepEqual(start.toArray(),[0,8,0]);assert.deepEqual(landing.toArray(),[20,8,280]);
});
test('Enemy damage is halved and hesitation must finish before another commitment',()=>{
 assert.deepEqual(ENEMY_TYPES.map(t=>t.damage),[2.5,8.5,6.5,4]);
 const enemy={cooldown:0,readyAt:4};assert.equal(enemyReadyToAttack(enemy,3),false);assert.equal(enemyReadyToAttack(enemy,4),true);assert.equal(enemyReadyToAttack({...enemy,stun:.5},5),false);
 assert.equal(MUSOU_CINEMATIC_DURATION,4.2);const special=attackDefinition('musou');assert.equal(special.duration,3.3);assert.ok(special.hits.every(t=>t>0&&t<special.duration));
});
