import * as THREE from 'three';
// Shared maps keep the finish consistent without a texture request per weapon.
function finishMap(kind){
 const width=128,height=256,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,grain=(Math.sin(x*19.17+y*.037)+Math.sin(x*7.31+y*.011))*.5;
  const patina=Math.sin(x*.13+y*.041)*Math.sin(y*.061-x*.037);
  const v=kind==='roughness'?190+grain*4+patina*5:kind==='cord'?190+Math.sin(x*Math.PI/4)*Math.sin(y*Math.PI/4)*34:238+grain*2+patina*2;
  data[i]=data[i+1]=data[i+2]=Math.max(0,Math.min(255,v));data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
 if(kind!=='roughness')texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
const grain=finishMap('steel'),roughness=finishMap('roughness'),cordMap=finishMap('cord');
export const weaponSteel=new THREE.MeshStandardMaterial({name:'Brushed tempered steel',color:'#c6d4df',map:grain,roughnessMap:roughness,metalness:.7,roughness:.36});
export const weaponEdge=new THREE.MeshStandardMaterial({name:'Honed steel edge',color:'#eef1ed',map:grain,metalness:.82,roughness:.18});
export const weaponBrass=new THREE.MeshStandardMaterial({name:'Worn brass fittings',color:'#bda06b',map:grain,roughnessMap:roughness,metalness:.72,roughness:.48});
export const weaponCord=new THREE.MeshStandardMaterial({name:'Woven grip cord',color:'#423830',map:cordMap,roughness:.93,metalness:0,side:THREE.DoubleSide});
export const weaponGrip=new THREE.MeshStandardMaterial({name:'Textured grip core',color:'#191f23',map:cordMap,roughness:.84,metalness:0});
export function enamelMaterial(color){return new THREE.MeshStandardMaterial({name:'Inlaid lacquer',color,map:grain,roughnessMap:roughness,metalness:.3,roughness:.48,side:THREE.DoubleSide});}
