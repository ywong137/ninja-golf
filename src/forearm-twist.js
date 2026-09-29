// Distribute forearm rotation through skin helpers installed in the rest pose.
// Keep the anatomical lowerarm/hand hierarchy and all original transforms intact.
import {Bone,Quaternion,Skeleton,Uint16BufferAttribute,Float32BufferAttribute,Vector3} from 'three';

const TAU=2*Math.PI,DEGREES=180/Math.PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const wrapped=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const finiteQuaternion=q=>[q.x,q.y,q.z,q.w].every(Number.isFinite)&&q.lengthSq()>1e-12;

/**
 * Install only on a loaded native human in its rest pose, before animation starts.
 * Geometry and skeleton palettes are private clones; source assets stay untouched.
 * Options: sides, stations, overflow ('reject' or explicit 'nearest').
 * The default rejects a remap that needs more than four influences.
 * Default updates are stateless: identical joint poses always produce identical skin.
 * update({continuousTwist:true}) explicitly unwraps a sequential authoring path.
 * Reset that opt-in history with update({continuousTwist:true,resetContinuity:true}).
 * update({refreshMatrices:false}) leaves world/palette refresh to the renderer.
 */
export function installForearmTwistHelpers(scene,{sides=['r','l'],stations=[.12,.5,.9],overflow='reject'}={}){
 if(!scene?.isObject3D)throw new TypeError('Supply the loaded human scene, before animation.');
 if(!Array.isArray(sides)||!sides.length||new Set(sides).size!==sides.length||sides.some(s=>!['r','l'].includes(s)))throw new Error('Choose unique native sides: r and/or l.');
 if(stations.length!==3||stations.some(x=>!Number.isFinite(x))||stations[0]<0||stations[2]>1||!(stations[0]<stations[1]&&stations[1]<stations[2]))throw new Error('Supply three increasing forearm stations within [0,1].');
 if(!['reject','nearest'].includes(overflow))throw new Error('Choose overflow="reject" or explicitly choose "nearest".');
 scene.updateWorldMatrix(true,true);
 const bones=new Map(),meshes=[];
 scene.traverse(o=>{if(o.isBone){if(bones.has(o.name))throw new Error('The scene has duplicate bone names: '+o.name);bones.set(o.name,o);}if(o.isSkinnedMesh)meshes.push(o);});
 if(!meshes.length)throw new Error('The human scene has no skinned meshes.');
 const bindValidation={maximumPositionError:0,maximumQuaternionErrorRadians:0,maximumScaleError:0};
 const arms=sides.map(side=>{
  const upper=bones.get('upperarm_'+side),lower=bones.get('lowerarm_'+side),hand=bones.get('hand_'+side);
  if(!upper||!lower||!hand||lower.parent!==upper)throw new Error('Side '+side+' needs upperarm -> lowerarm and a native hand bone.');
  let parent=hand;while(parent&&parent!==lower)parent=parent.parent;if(!parent)throw new Error('hand_'+side+' must descend from lowerarm_'+side+'.');
  if(!finiteQuaternion(lower.quaternion))throw new Error('lowerarm_'+side+' has an invalid rest quaternion.');
  for(const bone of [upper,lower,hand]){const mesh=meshes.find(m=>m.skeleton.bones.includes(bone)&&m.skeleton.bones.includes(bone.parent));if(!mesh)throw new Error('Cannot verify the local bind frame for '+bone.name+'.');const skeleton=mesh.skeleton,index=skeleton.bones.indexOf(bone),parentIndex=skeleton.bones.indexOf(bone.parent),expected=skeleton.boneInverses[parentIndex].clone().multiply(skeleton.boneInverses[index].clone().invert()),p=new Vector3(),q=new Quaternion(),s=new Vector3();expected.decompose(p,q,s);const positionError=p.distanceTo(bone.position),quaternionError=q.normalize().angleTo(bone.quaternion.clone().normalize()),scaleError=s.distanceTo(bone.scale);bindValidation.maximumPositionError=Math.max(bindValidation.maximumPositionError,positionError);bindValidation.maximumQuaternionErrorRadians=Math.max(bindValidation.maximumQuaternionErrorRadians,quaternionError);bindValidation.maximumScaleError=Math.max(bindValidation.maximumScaleError,scaleError);if(positionError>1e-5*Math.max(1,p.length())||quaternionError>1e-5||scaleError>1e-5*Math.max(1,s.length()))throw new Error('Install forearm helpers before animation. '+bone.name+' differs from its inverse-bind local transform.');}
  const localHand=lower.worldToLocal(hand.getWorldPosition(new Vector3())),length=localHand.length();
  if(!(length>1e-8))throw new Error('Side '+side+' has zero rest forearm length.');
  const restQuaternion=lower.quaternion.clone().normalize(),axis=localHand.clone().multiply(lower.scale).normalize().applyQuaternion(restQuaternion);
  const baseName='lowerarm_skin_base_'+side,midName='lowerarm_skin_mid_'+side;
  if(bones.has(baseName)||bones.has(midName))throw new Error('Forearm helpers already exist for side '+side+'. Dispose them before reinstalling.');
  const make=name=>{const b=new Bone();b.name=name;b.position.copy(lower.position);b.quaternion.copy(lower.quaternion);b.scale.copy(lower.scale);return b;};
  return{side,upper,lower,hand,restQuaternion,restInverse:restQuaternion.clone().invert(),axis,localHand,length,base:make(baseName),mid:make(midName),previousAngle:null,delta:new Quaternion(),twist:new Quaternion(),swing:new Quaternion(),half:new Quaternion()};
 });
 const report={version:2,defaultTwistMode:'stateless principal angle',bindValidation,helperCount:arms.length*2,stations:stations.slice(),overflowPolicy:overflow,meshes:[],modifiedVertices:0,splitVertices:0,protectedFingerVertices:0,quantizedOverflowVertices:0,maximumInfluences:0,updates:0,angles:{},singularities:0,disposed:false};
 for(const arm of arms)report.angles[arm.side]={principalDegrees:0,unwrappedDegrees:0,branchTurns:0};
 const plans=meshes.map((mesh,meshId)=>{
  const sourceSkeleton=mesh.skeleton,position=mesh.geometry.attributes.position,ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  if(!position||ids?.itemSize!==4||weights?.itemSize!==4||ids.count!==position.count||weights.count!==position.count)throw new Error('Mesh '+mesh.name+' needs four matching skin indices and weights.');
  const additions=[];for(const arm of arms){const index=sourceSkeleton.bones.indexOf(arm.lower);if(index>=0)additions.push({arm,index,baseIndex:sourceSkeleton.bones.length+additions.length*2,midIndex:sourceSkeleton.bones.length+additions.length*2+1});}
  if(sourceSkeleton.bones.length+additions.length*2>65535)throw new Error('The extended skin palette exceeds Uint16 indices.');
  const byIndex=new Map(additions.map(a=>[a.index,a])),newIds=new Uint16Array(position.count*4),newWeights=new Float32Array(position.count*4);let modifiedVertices=0,splitVertices=0,protectedFingerVertices=0,quantized=0,maximumInfluences=0,maximumWeightSumDifference=0;
  for(let id=0;id<position.count;id++){
   const entries=[],source=[];let modified=false;
   for(let k=0;k<4;k++){const weight=weights.getComponent(id,k),index=ids.getComponent(id,k);if(!Number.isFinite(weight)||weight<0||!Number.isInteger(index)||index<0||index>=sourceSkeleton.bones.length)throw new Error('Invalid skin influence at '+mesh.name+' vertex '+id+'.');if(weight>0)source.push({index,weight});}
   if(!source.length)throw new Error('Unweighted skin vertex at '+mesh.name+' vertex '+id+'.');
   if(source.some(e=>/^(thumb|index|middle|ring|pinky)_/.test(sourceSkeleton.bones[e.index].name))){for(let k=0;k<4;k++){newIds[id*4+k]=ids.getComponent(id,k);newWeights[id*4+k]=weights.getComponent(id,k);}maximumInfluences=Math.max(maximumInfluences,source.length);protectedFingerVertices++;continue;}
   const expansions=[];
   for(const entry of source){const a=byIndex.get(entry.index);if(!a){expansions.push([entry]);continue;}
    const p=new Vector3().fromBufferAttribute(position,id).applyMatrix4(mesh.bindMatrix).applyMatrix4(sourceSkeleton.boneInverses[entry.index]);
    const f=p.dot(a.arm.localHand)/a.arm.localHand.lengthSq();let choices;
    if(f<stations[1]){const t=smooth(f,stations[0],stations[1]);choices=[{index:a.baseIndex,weight:entry.weight*(1-t)},{index:a.midIndex,weight:entry.weight*t}];}
    else if(f<stations[2]){const t=smooth(f,stations[1],stations[2]);choices=[{index:a.midIndex,weight:entry.weight*(1-t)},{index:entry.index,weight:entry.weight*t}];}
    else choices=[entry];
    choices=choices.filter(e=>e.weight>0);modified ||= choices.length!==1||choices[0].index!==entry.index;expansions.push(choices);
   }
   let count=expansions.reduce((sum,a)=>sum+a.length,0);
   if(count>4){if(overflow==='reject')throw new Error('Forearm remap needs '+count+' influences at '+mesh.name+' vertex '+id+'. No scene changes occurred. Review weights or explicitly choose overflow="nearest".');while(count>4){const choices=expansions.filter(a=>a.length>1).sort((a,b)=>Math.min(...a.map(e=>e.weight))-Math.min(...b.map(e=>e.weight)))[0];const total=choices.reduce((sum,e)=>sum+e.weight,0),chosen=choices.reduce((a,b)=>a.weight>=b.weight?a:b);choices.splice(0,choices.length,{index:chosen.index,weight:total});count--;}quantized++;}
   for(const e of expansions.flat())entries.push(e);
   const total=entries.reduce((s,e)=>s+e.weight,0),oldTotal=source.reduce((s,e)=>s+e.weight,0);maximumWeightSumDifference=Math.max(maximumWeightSumDifference,Math.abs(total-oldTotal));
   for(let k=0;k<entries.length;k++){newIds[id*4+k]=entries[k].index;newWeights[id*4+k]=entries[k].weight;}
   maximumInfluences=Math.max(maximumInfluences,entries.length);if(modified)modifiedVertices++;if(entries.length>source.length)splitVertices++;
  }
  return{mesh,meshId,sourceGeometry:mesh.geometry,sourceSkeleton,additions,newIds,newWeights,metrics:{meshId,name:mesh.name,vertices:position.count,modifiedVertices,splitVertices,protectedFingerVertices,quantizedOverflowVertices:quantized,maximumInfluences,maximumWeightSumDifference}};
 });
 // All preflight checks finish before any scene or mesh mutation.
 for(const arm of arms){arm.upper.add(arm.base,arm.mid);}
 const palettes=new Map();for(const plan of plans){let extended=palettes.get(plan.sourceSkeleton);if(!extended){const added=plan.additions.flatMap(a=>[a.arm.base,a.arm.mid]),inverses=plan.additions.flatMap(a=>[plan.sourceSkeleton.boneInverses[a.index].clone(),plan.sourceSkeleton.boneInverses[a.index].clone()]);extended=new Skeleton([...plan.sourceSkeleton.bones,...added],[...plan.sourceSkeleton.boneInverses.map(m=>m.clone()),...inverses]);palettes.set(plan.sourceSkeleton,extended);}const geometry=plan.sourceGeometry.clone();geometry.setAttribute('skinIndex',new Uint16BufferAttribute(plan.newIds,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(plan.newWeights,4));plan.privateGeometry=geometry;plan.mesh.geometry=geometry;plan.mesh.skeleton=extended;report.meshes.push(plan.metrics);report.modifiedVertices+=plan.metrics.modifiedVertices;report.splitVertices+=plan.metrics.splitVertices;report.protectedFingerVertices+=plan.metrics.protectedFingerVertices;report.quantizedOverflowVertices+=plan.metrics.quantizedOverflowVertices;report.maximumInfluences=Math.max(report.maximumInfluences,plan.metrics.maximumInfluences);}
 function update({continuousTwist=false,resetContinuity=false,refreshMatrices=true}={}){
  if(report.disposed)throw new Error('The forearm helper instance is disposed.');
  for(const arm of arms){const delta=arm.delta.copy(arm.lower.quaternion).normalize().multiply(arm.restInverse),projection=delta.x*arm.axis.x+delta.y*arm.axis.y+delta.z*arm.axis.z,norm=Math.hypot(projection,delta.w);
   if(norm<1e-10){report.singularities++;throw new Error('Undefined forearm twist at a perpendicular 180° swing on side '+arm.side+'. Preserve a continuous pose path before updating helpers.');}
   const twist=arm.twist.set(arm.axis.x*projection/norm,arm.axis.y*projection/norm,arm.axis.z*projection/norm,delta.w/norm),swing=arm.swing.copy(delta).multiply(twist.conjugate()),principal=wrapped(2*Math.atan2(projection,delta.w)),angle=!continuousTwist||resetContinuity||arm.previousAngle===null?principal:principal+TAU*Math.round((arm.previousAngle-principal)/TAU);
   arm.previousAngle=continuousTwist?angle:null;arm.base.position.copy(arm.lower.position);arm.mid.position.copy(arm.lower.position);arm.base.scale.copy(arm.lower.scale);arm.mid.scale.copy(arm.lower.scale);
   arm.base.quaternion.copy(swing).multiply(arm.restQuaternion).normalize();arm.mid.quaternion.copy(swing).multiply(arm.half.setFromAxisAngle(arm.axis,angle*.5)).multiply(arm.restQuaternion).normalize();
   const angles=report.angles[arm.side];angles.principalDegrees=principal*DEGREES;angles.unwrappedDegrees=angle*DEGREES;angles.branchTurns=Math.round((angle-principal)/TAU);
  }
  if(refreshMatrices){scene.updateWorldMatrix(true,true);for(const palette of palettes.values())palette.update();}report.updates++;return report.angles;
 }
 function dispose(){if(report.disposed)return;for(const plan of plans){plan.mesh.geometry=plan.sourceGeometry;plan.mesh.skeleton=plan.sourceSkeleton;plan.privateGeometry.dispose();}for(const palette of palettes.values())palette.dispose();for(const arm of arms){arm.base.removeFromParent();arm.mid.removeFromParent();}report.disposed=true;}
 update({resetContinuity:true});
 return{update,dispose,report,helpers:Object.fromEntries(arms.map(a=>[a.side,{base:a.base,mid:a.mid}]))};
}
