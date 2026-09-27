// Bake EZ-Tree's MIT-licensed generator into compact, reusable glTF assets.
// Run against npm run dev: PLAYWRIGHT_CHANNEL=chrome node tools/build-trees.mjs
import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage();await page.goto('http://localhost:5173/tools/tree-bake.html');
 for(const [name,preset,seed,height]of [['coastal-pine','Pine Medium',381,15],['windswept-pine','Pine Small',781,11],['garden-oak','Oak Medium',35729,12],['garden-ash','Ash Small',461,10]]){
  const data=await page.evaluate(async({preset,seed,height})=>{
   const {Tree}=await import('/node_modules/@dgreenheck/ez-tree/build/ez-tree.es.js'),THREE=await import('/node_modules/three/build/three.module.js'),{GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
   const tree=new Tree();tree.loadPreset(preset);tree.options.seed=seed;if(preset.startsWith('Pine')){tree.options.branch.children[0]=64;tree.options.branch.sections[1]=6;tree.options.leaves.count=24;tree.options.leaves.size*=3.5;}else {tree.options.leaves.count=20;tree.options.leaves.size*=1.7;}tree.options.branch.sections[0]=12;tree.options.branch.segments[0]=10;tree.generate();tree.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3());const scale=height/size.y;
   for(const [mesh,leaf]of [[tree.branchesMesh,false],[tree.leavesMesh,true]]){
    const old=mesh.material;await Promise.all([old.map,old.normalMap,old.roughnessMap].filter(Boolean).map(t=>new Promise(resolve=>{if(t.image?.complete)resolve();else if(t.image)t.image.addEventListener('load',resolve,{once:true});else resolve();})));
    mesh.geometry.scale(scale,scale,scale);mesh.name=leaf?'Canopy':'Branches';
    mesh.material=new THREE.MeshStandardMaterial({map:old.map,normalMap:leaf?null:old.normalMap,roughnessMap:leaf?null:old.roughnessMap,color:leaf?0xbac6a5:0xc2b7a2,roughness:leaf?1:.94,side:leaf?THREE.DoubleSide:THREE.FrontSide,alphaTest:leaf?.25:0});
    if(leaf){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;const colors=[];for(let i=0;i<p.count;i++){const pos=new THREE.Vector3().fromBufferAttribute(p,i),out=pos.clone().sub(new THREE.Vector3(0,height*.62,0));out.y*=.55;out.normalize();const normal=new THREE.Vector3().fromBufferAttribute(n,i).lerp(out,.82).normalize();n.setXYZ(i,...normal);const shade=.64+.35*Math.min(1,p.getY(i)/height)+.08*Math.sin(p.getX(i)*4+p.getZ(i)*3);colors.push(shade,shade,shade);}mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh.material.vertexColors=true;}
   }
   const binary=await new GLTFExporter().parseAsync(tree,{binary:true,onlyVisible:true});return Array.from(new Uint8Array(binary));
  },{preset,seed,height});
  mkdirSync('public/models/vegetation',{recursive:true});writeFileSync(`public/models/vegetation/${name}.glb`,Buffer.from(data));console.log(name,data.length);
 }
}finally{await browser.close();}
