import assert from 'node:assert/strict';
// Historical sculpt/skin tools deliberately reject morph targets. Reconstruct
// their pre-morph fixture without changing any geometry, skin or binary bytes.
export function withoutMusouTarget(model){
 for(const mesh of model.doc.meshes){
  if(!mesh.extras?.targetNames?.includes('Musou_Snarl'))continue;
  assert.deepEqual(mesh.extras.targetNames,['Musou_Snarl']);assert.deepEqual(mesh.weights,[0]);
  for(const p of mesh.primitives){assert.equal(p.targets.length,1);assert.deepEqual(Object.keys(p.targets[0]).sort(),['NORMAL','POSITION']);delete p.targets;}
  delete mesh.weights;delete mesh.extras.targetNames;if(!Object.keys(mesh.extras).length)delete mesh.extras;
 }
 return model;
}
