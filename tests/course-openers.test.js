import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,CLUBS,fairwayDistance,lieAt,heightAt,routePoint} from '../src/course.js';
function turfComponents(c){
 const step=2,cols=141,rows=Math.ceil((c.length+60)/step),cells=new Uint8Array(cols*rows);let components=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)cells[j*cols+i]=fairwayDistance(c,-140+i*step,-25+j*step)<0?1:0;
 for(let start=0;start<cells.length;start++)if(cells[start]){components++;cells[start]=0;const pending=[start];while(pending.length){const k=pending.pop(),x=k%cols,y=Math.floor(k/cols);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=cols||yy<0||yy>=rows)continue;const next=yy*cols+xx;if(cells[next]){cells[next]=0;pending.push(next);}}}}
 return components;
}
test('Desert opener has detached tee, oblique landing shelf, and final approach instead of another loop',()=>{
 const desert=COURSE_SETS[2].holes[0],highlands=COURSE_SETS[1].holes[0];
 assert.equal(turfComponents(desert),3);assert.equal(turfComponents(highlands),1);
 assert.equal(lieAt(desert,0,desert.length*.25),'Rough');assert.equal(lieAt(desert,55,desert.length*.70),'Rough');
 assert.ok(fairwayDistance(desert,-77,desert.length*.40)<0);assert.ok(fairwayDistance(desert,53,desert.length*.59)<0);
 assert.equal(desert.par,4);assert.ok(desert.playLength>395&&desert.playLength<435);assert.equal(desert.length,328);assert.equal(desert.greenX,8);
});
test('The diagonal shelf gives a wider short drive and a rewarded carry over sand',()=>{
 const c=COURSE_SETS[2].holes[0],safe={x:-45,z:c.length*.45},attack={x:53,z:c.length*.59},cup={x:c.greenX,z:c.length};
 for(const [target,radius]of [[safe,20],[attack,9]])for(let a=0;a<Math.PI*2;a+=.13)assert.equal(lieAt(c,target.x+Math.cos(a)*radius,target.z+Math.sin(a)*radius),'Fairway');
 assert.ok(-fairwayDistance(c,safe.x,safe.z)>-fairwayDistance(c,attack.x,attack.z)*1.8);
 const distance=p=>Math.hypot(p.x-cup.x,p.z-cup.z);assert.ok(distance(safe)-distance(attack)>40);
 assert.ok(Math.hypot(attack.x,attack.z)<CLUBS[0].carry);assert.ok(Math.hypot(safe.x,safe.z)<170);
 const crossedSand=target=>Array.from({length:100},(_,i)=>lieAt(c,target.x*i/100,target.z*i/100)).filter(l=>l==='Bunker').length;
 assert.equal(crossedSand(safe),0);assert.ok(crossedSand(attack)>10);
});
test('The opener retains a dry travel corridor with gradual terrain and a clean cup surround',()=>{
 const c=COURSE_SETS[2].holes[0];let previous=routePoint(c,0);
 for(let i=1;i<=800;i++){
  const p=routePoint(c,i/800),width=3;
  for(const side of [-1,0,1])assert.ok(!['Water','Out of bounds'].includes(lieAt(c,p.x+p.tangentZ*width*side,p.z-p.tangentX*width*side)));
  const grade=Math.abs(heightAt(c,p.x,p.z)-heightAt(c,previous.x,previous.z))/Math.hypot(p.x-previous.x,p.z-previous.z);assert.ok(grade<.18);previous=p;
 }
 for(let a=0;a<Math.PI*2;a+=.12)assert.equal(lieAt(c,c.greenX+Math.cos(a)*10,c.length+Math.sin(a)*10),'Green');
});
