// Move an existing attack's horizontal pelvis travel into the game root path.
import fs from 'node:fs';
import {Vector3,LoopOnce} from 'three';
import {parseArgs} from 'node:util';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {extractPlanarRoot} from './extract-planar-root.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {samplePlanarRoot} from '../src/attack-root-motion.js';

export async function extractExistingAttackRoot(input,name,record,{referenceClip=null}={}){
 if(!record||record.planarRoot)throw Error('Supply a motion record without an extracted root path.');
 const g=await loadNativeSkin(input),clip=g.animations.find(c=>c.name===name);
 if(!clip||Math.abs(clip.duration-record.duration)>1e-6)throw Error('The model clip and motion record must have matching durations.');
 let anchor=null;
 if(referenceClip){
  const reference=g.animations.find(c=>c.name===referenceClip);if(!reference)throw Error('Missing root anchor clip: '+referenceClip);
  const action=g.mixer.clipAction(reference).setLoop(LoopOnce,1).play();action.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);anchor=g.scene.getObjectByName('pelvis').getWorldPosition(new Vector3());g.mixer.stopAllAction();
 }
 const {clip:local,path,offset}=extractPlanarRoot(g.scene,clip,{anchor}),track=local.tracks.find(t=>t.name==='pelvis.position');
 const model=patchAnimationTransforms(fs.readFileSync(input),[{clip:name,times:Array.from(track.times),translations:{pelvis:Array.from(track.values)},extras:{planarRootExtracted:true,...(referenceClip?{rootAnchor:referenceClip}: {})}}]);
 const motion=structuredClone(record);motion.planarRoot=path;if(referenceClip)motion.rootAnchor={clip:referenceClip,offset};
 // Motion points use [x, -z, y]; angles and vertical offsets stay unchanged.
 for(const pose of motion.poses){const delta=samplePlanarRoot(path,pose.t*record.duration);for(const key of ['grip','tip','secondaryGrip','offGrip','offTip','elbowR','elbowL','footR','footL','shift'])if(pose[key]){pose[key][0]-=delta.x+offset.x;pose[key][1]+=delta.z+offset.z;}}
 return{model,motion};
}
if(process.argv[1]?.endsWith('extract-existing-attack-root.mjs')){
 const {values:v}=parseArgs({options:{input:{type:'string'},motions:{type:'string'},clip:{type:'string'},output:{type:'string'},record:{type:'string'},reference:{type:'string'},help:{type:'boolean'}}});
 if(v.help){console.log('node tools/extract-existing-attack-root.mjs --input MODEL.glb --motions motion-data.json --clip NAME --output NEW.glb --record NEW.json [--reference READY_CLIP]\nPreserve the full captured motion while separating horizontal travel. An optional ready clip anchors the source pelvis horizontally. Refuses already extracted motion and existing output files.');process.exit(0);}
 for(const key of ['input','motions','clip','output','record'])if(!v[key])throw Error('Supply --'+key+'. See --help.');
 for(const key of ['output','record'])if(fs.existsSync(v[key]))throw Error('Choose a new '+key+' file.');
 const {model,motion}=await extractExistingAttackRoot(v.input,v.clip,JSON.parse(fs.readFileSync(v.motions))[v.clip],{referenceClip:v.reference});
 fs.writeFileSync(v.output,model);fs.writeFileSync(v.record,JSON.stringify({[v.clip]:motion}));
 console.log(JSON.stringify({clip:v.clip,travel:motion.planarRoot.rows.at(-1)}));
}
