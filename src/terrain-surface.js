// Terrain is a world-space height field. Bins reduce each lookup to nearby triangles.
export function createTerrainSurfaceSampler(geometry,{cellSize=64,maxReferences=2000000}={}){
 if(!(cellSize>0&&Number.isFinite(cellSize)))throw new Error('Terrain surface cellSize must be a positive finite number.');
 const position=geometry.getAttribute('position');if(!position||position.itemSize<3)throw new Error('Terrain surface requires a position attribute with XYZ coordinates.');
 const index=geometry.getIndex(),count=index?index.count:position.count,bins=new Map(),triangles=[];let references=0;
 for(let start=0;start+2<count;start+=3){
  const ids=[0,1,2].map(offset=>index?index.getX(start+offset):start+offset),x=ids.map(i=>position.getX(i)),y=ids.map(i=>position.getY(i)),z=ids.map(i=>position.getZ(i));
  const dx1=x[1]-x[0],dz1=z[1]-z[0],dx2=x[2]-x[0],dz2=z[2]-z[0],det=dx1*dz2-dz1*dx2;
  if(Math.abs(det)<1e-10)continue;
  const minX=Math.floor(Math.min(...x)/cellSize),maxX=Math.floor(Math.max(...x)/cellSize),minZ=Math.floor(Math.min(...z)/cellSize),maxZ=Math.floor(Math.max(...z)/cellSize);
  const extra=(maxX-minX+1)*(maxZ-minZ+1);if(!Number.isFinite(extra)||references+extra>maxReferences)throw new Error('Terrain surface index exceeds its reference limit. Increase cellSize or split the geometry.');
  const id=triangles.length;triangles.push([x[0],z[0],y[0],dx1,dz1,y[1]-y[0],dx2,dz2,y[2]-y[0],1/det]);
  for(let bx=minX;bx<=maxX;bx++)for(let bz=minZ;bz<=maxZ;bz++){const key=`${bx},${bz}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}references+=extra;
 }
 const sample=(x,z)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const nearby=bins.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`);if(!nearby)return null;
  let height=-Infinity;
  for(const id of nearby){const t=triangles[id],dx=x-t[0],dz=z-t[1],u=(dx*t[7]-dz*t[6])*t[9],v=(t[3]*dz-t[4]*dx)*t[9];if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)height=Math.max(height,t[2]+u*t[5]+v*t[8]);}
  return height===-Infinity?null:height;
 };
 sample.stats=Object.freeze({triangles:triangles.length,bins:bins.size,references,cellSize});return sample;
}
