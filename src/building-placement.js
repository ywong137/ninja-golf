import {heightAt,lieAt,fairwayDistance,greenDistance,routeNearest,waterBasins,COURSE_BOUNDS} from './course.js';

export function buildingFootprint(c,{x,z,halfWidth,halfDepth},root=null,margin=6,avoidSites=[]){
 if(avoidSites.some(s=>!['sand','water'].includes(s.kind)&&Math.abs(s.x-x)<halfWidth+3&&Math.abs(s.z-z)<halfDepth+3))return null;
 const minX=x-halfWidth-1,maxX=x+halfWidth+1,minZ=z-halfDepth-1,maxZ=z+halfDepth+1;
 if(minX<COURSE_BOUNDS.minX||maxX>COURSE_BOUNDS.maxX||minZ<COURSE_BOUNDS.minZ||maxZ>c.length+COURSE_BOUNDS.endMargin)return null;
 // Reject any basin intersection, even when a dry island masks part of its water.
 for(const basin of waterBasins(c)){const xx=Math.max(minX,Math.min(maxX,basin[0])),zz=Math.max(minZ,Math.min(maxZ,basin[1]));if(Math.hypot((xx-basin[0])/basin[2],(zz-basin[1])/basin[3])<=1)return null;}
 if(c.coastal!==false)for(let zz=minZ;zz<=maxZ+1;zz++)if(maxX>136+Math.sin(zz*.014)*28)return null;
 let low=Infinity,high=-Infinity;
 const nx=Math.ceil(halfWidth*2/2),nz=Math.ceil(halfDepth*2/2);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
  const xx=x-halfWidth+i*halfWidth*2/nx,zz=z-halfDepth+j*halfDepth*2/nz,lie=lieAt(c,xx,zz);
  if(['Water','Out of bounds','Green','Tee','Bunker'].includes(lie)||fairwayDistance(c,xx,zz)<margin||greenDistance(c,xx,zz)<30||routeNearest(c,xx,zz).distance<6||root?.userData.pathContains?.(xx,zz,3))return null;
  const y=heightAt(c,xx,zz);low=Math.min(low,y);high=Math.max(high,y);
 }
 if(high-low>5)return null;
 if((root?.userData.landmarks||[]).some(b=>Math.abs(x-b.x)<halfWidth+b.halfWidth+8&&Math.abs(z-b.z)<halfDepth+b.halfDepth+8))return null;
 return {x,z,halfWidth,halfDepth,y:high+.06,foundationBottom:low-.25};
}

export function findBuildingSite(root,c,preferred,halfWidth,halfDepth,preferredSide=-1,avoidSites=[]){
 for(const side of [preferredSide,-preferredSide])for(const radius of [58,78,100,126,156,186])for(const dz of [0,24,-24,48,-48,80,-80]){
  const site=buildingFootprint(c,{x:preferred.x+side*radius,z:preferred.z+dz,halfWidth,halfDepth},root,6,avoidSites);
  if(site)return site;
 }
 throw new Error(`No dry building footprint for ${c.name}; reduce the structure footprint`);
}

export function buildingBox(root,id,x,y,z,width,height,depth,yaw=0){
 const record={id,kind:'box',x,z,halfWidth:width/2,halfDepth:depth/2,yaw,minY:y-height/2,maxY:y+height/2};
 (root.userData.buildingObstacles??=[]).push(record);return record;
}
export function buildingCylinder(root,id,x,y,z,radius,height){
 const record={id,kind:'cylinder',x,z,radius,minY:y-height/2,maxY:y+height/2};
 (root.userData.buildingObstacles??=[]).push(record);return record;
}
