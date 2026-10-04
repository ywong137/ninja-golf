// SkeletonUtils clones a skeleton for each mesh, even when those meshes use
// the same bones. Share only exact palettes inside one cloned actor.
export function shareClonedSkeletons(model){
 const canonical=[],replaced=new Set();
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const source=mesh.skeleton;
  const match=canonical.find(target=>target===source||(
   target.bones.length===source.bones.length&&
   target.bones.every((bone,i)=>bone===source.bones[i]&&target.boneInverses[i].equals(source.boneInverses[i]))
  ));
  if(!match)canonical.push(source);
  else if(match!==source){mesh.skeleton=match;replaced.add(source);}
 });
 for(const skeleton of replaced)skeleton.dispose();
 return{palettes:canonical.length,removed:replaced.size};
}
