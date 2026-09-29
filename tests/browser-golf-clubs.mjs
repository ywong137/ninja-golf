import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{CLUBS}=await import('/src/course.js'),{sampleMotion}=await import('/src/motion.js'),g=window.__golfTest;
  g.frame=()=>{};g.audio.pause();g.begin(0,0);g.audio.pause();
  const active=()=>({selected:CLUBS[g.club].short,actor:g.player.clubShort,head:g.player.clubHead.children[0].userData.clubShort});
  const manual=CLUBS.map((club,i)=>{g.selectClub(i);return active();});
  const automatic=[];
  for(const [distance,lie]of [[10,'Green'],[150,'Bunker'],[140,'Fairway']]){g.ball.position.copy(g.world.cup).add(new T.Vector3(distance,0,0));g.lie=lie;g.selectBestClub();automatic.push(active());}
  g.selectClub(5);g.selectWarrior(3);const replacement=active();
  const par3=g.holes.findIndex(h=>h.par===3),other=g.holes.findIndex(h=>h.par!==3);g.loadHole(par3);const par3Club=active();g.loadHole(other);const otherClub=active();
  g.selectClub(7);g.selectScreen();const showcase={actor:g.player.clubShort,head:g.player.clubHead.children[0].userData.clubShort};g.stopShowcase();
  const faces=[];
  for(let hero=0;hero<6;hero++){
   g.mode='game';g.phase='aim';g.selectWarrior(hero);const p=g.player;
   for(const {short:code,loft}of CLUBS){
    p.setGolfClub(code);const name=code==='PT'?'Golf_Putt':'Golf_Swing',time=code==='PT'?22/30:1.4;
    p.handGrip.restore();p.mixer.stopAllAction();p.current='';p.play(name,0,true,1);p.actions.get(name).time=time;p.mixer.update(0);p.syncHeldObjects(sampleMotion(name,time),true);p.root.updateMatrixWorld(true);
    const faceMesh=p.golfClub.body.getObjectByName(p.clubHead.children[0].userData.strikingFace),positions=faceMesh.geometry.attributes.position,indices=faceMesh.geometry.index,count=indices?.count??positions.count;
    let face=null;
    for(let i=0;i<count;i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(positions,indices?indices.getX(i+j):i+j));if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize().z<-.9999){v.forEach(point=>point.applyMatrix4(faceMesh.matrixWorld));face=v[1].sub(v[0]).cross(v[2].sub(v[0])).normalize();break;}}
    if(!face)throw Error('Missing finite striking face for '+code);
    const desired=new T.Vector3(-Math.cos(loft*Math.PI/180),Math.sin(loft*Math.PI/180),0).applyQuaternion(p.root.getWorldQuaternion(new T.Quaternion()));
    const shaftAxis=new T.Vector3(0,1,0).applyQuaternion(p.clubShaft.getWorldQuaternion(new T.Quaternion())),neckAxis=new T.Vector3(0,1,0).applyQuaternion(p.golfClub.neck.getWorldQuaternion(new T.Quaternion()));
    const bodyDown=new T.Vector3(0,1,0).applyQuaternion(p.golfClub.body.getWorldQuaternion(new T.Quaternion()));
    const size=new T.Box3().setFromObject(p.clubHead).getSize(new T.Vector3()),grip=p.club.getObjectByName('Golf club grip');
    const shaftStart=p.clubShaft.position.y-p.clubShaft.scale.y/2,shaftEnd=p.clubShaft.position.y+p.clubShaft.scale.y/2,endpointError=Math.abs(shaftEnd-p.clubHead.position.y);
    const joints=Object.values(p.bones),before=JSON.stringify(joints.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]));p.setGolfClub(code==='PT'?'7I':'PT');
    faces.push({hero,code,alignment:face.dot(desired),neckAlignment:shaftAxis.dot(neckAxis),bodyDown:bodyDown.toArray(),finiteHead:size.toArray().every(Number.isFinite),headSize:size.toArray(),gripRadius:grip.scale.x,shaftStart,endpointError,bonesPreserved:before===JSON.stringify(joints.map(b=>[b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]))});
   }
  }
  return{manual,automatic,replacement,par3Club,otherClub,showcase,faces};
 });
 console.log(JSON.stringify(report,null,2));
 for(const result of report.manual)assert.equal(result.selected,result.head,JSON.stringify(result));
 assert.deepEqual(report.automatic.map(r=>r.head),['PT','SW','7I']);assert.equal(report.replacement.head,'PW');assert.equal(report.par3Club.head,'5I');assert.equal(report.otherClub.head,'DR');assert.equal(report.showcase.head,'DR');
 for(const row of report.faces){assert.ok(row.alignment>.99999,JSON.stringify(row));assert.ok(row.neckAlignment>.99999,JSON.stringify(row));assert.ok(Math.abs(row.bodyDown[1]+1)<1e-5,JSON.stringify(row));assert.equal(row.bonesPreserved,true,JSON.stringify(row));assert.equal(row.finiteHead,true,JSON.stringify(row));assert.ok(row.headSize.every(s=>s>.01&&s<.25),JSON.stringify(row));assert.equal(row.gripRadius,.012);assert.ok(Math.abs(row.shaftStart-.14)<1e-8,JSON.stringify(row));assert.ok(row.endpointError<1e-8,JSON.stringify(row));}
 assert.deepEqual(errors,[]);console.log('Eight runtime clubs, six hero actual face normals, straight necks, and joint invariance pass.');
}finally{await browser.close();}
