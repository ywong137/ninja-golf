#!/usr/bin/env node
// Rebuild the isolated hand checkpoint. Never writes production grip data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../../../tests/native-skin-helper.mjs';

const {values}=parseArgs({options:{hero:{type:'string'},side:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/art-candidates/golf-hands/twelve-hands/rebuild-hand.mjs --hero MODEL --side r|l --output /tmp/HAND.json\nRebuilds the thumb from its saved four-finger source. Applies the saved narrow finger repair with native hinge axes. Checks every final rotation against the reviewed isolated checkpoint. Does not change public assets.');
 process.exit(0);
}
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..'),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))),entry=manifest.hands.find(row=>row.hero===values.hero&&row.side===values.side);
if(!entry||!values.output)throw Error('Supply a listed hero, side r|l, and --output. See --help.');
const output=path.resolve(values.output);
if(path.extname(output)!=='.json'||output.startsWith(root+path.sep))throw Error('Write a separate .json file outside the project, such as /tmp/HAND.json.');
const expected=JSON.parse(fs.readFileSync(path.join(folder,entry.fit))),source=path.join(folder,entry.thumbSource),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-golf-hand-rebuild-'));
try{
 const thumbOutput=path.join(temporary,'thumb.json'),settings=entry.settings,args=[path.join(root,'tools/fit-golf-thumb-pad.mjs'),'--hero',entry.hero,'--side',entry.side,'--profile',source,'--output',thumbOutput,'--distal-axis',settings.distalAxis,'--search',settings.search,'--cmc-max-degrees',String(settings.cmcMaxDegrees)],child=spawnSync(process.execPath,args,{encoding:'utf8'});
 if(child.status!==0)throw Error('Thumb rebuild failed: '+child.stderr+'\n'+child.stdout);
 const rebuilt=JSON.parse(fs.readFileSync(thumbOutput));
 if(entry.adjacentRepair){
  const g=await loadNativeSkin(path.join(root,'public/models/'+entry.hero+'.glb')),side=entry.side,hand=g.scene.getObjectByName('hand_'+side);g.scene.updateMatrixWorld(true);
  const inverse=hand.matrixWorld.clone().invert(),inverseRotation=hand.getWorldQuaternion(new T.Quaternion()).normalize().invert(),point=bone=>bone.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),long=point(g.scene.getObjectByName('middle_01_'+side)).normalize(),across=point(g.scene.getObjectByName('index_01_'+side)).sub(point(g.scene.getObjectByName('pinky_01_'+side)));across.addScaledVector(long,-across.dot(long)).normalize();
  const normal=across.clone().cross(long).normalize();if(normal.dot(new T.Vector3().fromArray(rebuilt.center))<0)normal.negate();
  // Derive every axis before changing a parent joint.
  const controls={};for(const finger of entry.adjacentRepair.active){const chain=[1,2,3].map(i=>g.scene.getObjectByName(`${finger}_0${i}_${side}`));controls[finger]=chain.map((bone,i)=>{const inHand=inverseRotation.clone().multiply(bone.getWorldQuaternion(new T.Quaternion()).normalize()),p=point(bone),direction=(i<2?point(chain[i+1]).sub(p):p.clone().sub(point(chain[i-1]))).normalize();return{bone,rest:bone.quaternion.clone(),hinge:direction.clone().cross(normal).normalize().applyQuaternion(inHand.clone().invert()),splay:normal.clone().applyQuaternion(inHand.clone().invert())};});}
  for(const [finger,chain]of Object.entries(controls)){const parameters=entry.adjacentRepair.after[finger];chain.forEach((c,i)=>{const q=c.rest.clone();if(i===0)q.multiply(new T.Quaternion().setFromAxisAngle(c.splay,parameters[3]));q.multiply(new T.Quaternion().setFromAxisAngle(c.hinge,parameters[i]));rebuilt.rotations[c.bone.name]=q.toArray();});}
 }
 for(const key of ['center','axis','radius','frame'])assert.deepEqual(rebuilt[key],expected[key],key+' changed during rebuild.');
 for(const [name,q]of Object.entries(expected.rotations)){const actual=rebuilt.rotations[name];if(!actual||q.some((x,i)=>Math.abs(x-actual[i])>1e-12))throw Error(name+' differs from the checkpoint. Recheck the current model bind geometry before replacing this candidate.');}
 // Preserve checkpoint diagnostics. The fresh thumb solver reports its own
 // metrics above; the narrow finger measurements belong to the saved audit.
 rebuilt.fingerClosureFit=expected.fingerClosureFit;
 if(expected.adjacentFingerFit)rebuilt.adjacentFingerFit=expected.adjacentFingerFit;
 fs.writeFileSync(output,JSON.stringify(rebuilt,null,2));
 console.log(JSON.stringify({hero:entry.hero,side:entry.side,output,matchedRotations:Object.keys(expected.rotations).length,maximumComponentError:Math.max(...Object.entries(expected.rotations).flatMap(([n,q])=>q.map((x,i)=>Math.abs(x-rebuilt.rotations[n][i]))))}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
