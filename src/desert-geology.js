import {heightAt,lieAt,fairwayDistance,greenDistance,random} from './course.js';
import {bridgeDistance} from './course-layout.js';
import {bunkerDistance} from './bunkers.js';

// A complete projected footprint protects the course, not just the rock's center.
export function desertRockFits(course,root,record,bounds){
 const width=(bounds.max.x-bounds.min.x)*record.scale,depth=(bounds.max.z-bounds.min.z)*record.scale;
 const nx=Math.ceil(width/2),nz=Math.ceil(depth/2),co=Math.cos(record.angle),si=Math.sin(record.angle);
 let ground=Infinity;
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const dx=(bounds.min.x+(bounds.max.x-bounds.min.x)*ix/nx)*record.scale,dz=(bounds.min.z+(bounds.max.z-bounds.min.z)*iz/nz)*record.scale;
  const x=record.x+co*dx+si*dz,z=record.z-si*dx+co*dz;
  if(fairwayDistance(course,x,z)<5||greenDistance(course,x,z)<27||lieAt(course,x,z)==='Water'||root.userData.pathContains?.(x,z,1.4)||bridgeDistance(course,x,z)<2||course.bunkers.some(b=>bunkerDistance(x,z,b)<1.5))return false;
  if((root.userData.landmarks||[]).some(b=>Math.abs(x-b.x)<b.halfWidth+3&&Math.abs(z-b.z)<b.halfDepth+3))return false;
  ground=Math.min(ground,heightAt(course,x,z));
 }
 // Bury the complete underside, including sloping terrain at the outer edges.
 record.y=ground-bounds.min.y*record.scale-(bounds.max.y-bounds.min.y)*record.scale*.12;
 return true;
}

export function buildDesertFormations(course,root,anchors,formBounds){
 const r=random(course.seed+55219),records=[],forms=[...formBounds.keys()];
 const place=(x,z,scale,angle,form)=>{const record={x,z,scale,angle,rockForm:form};if(desertRockFits(course,root,record,formBounds.get(form))){records.push(record);return record;}};
 for(const [i,a]of anchors.entries()){
  const form=forms[i%forms.length],scale=a.distant?2.7+(a.scale-7)*.15:1.2+a.scale*.35;
  const main=place(a.x,a.z,scale,a.angle,form);if(!main)continue;
  const bounds=formBounds.get(form),spread=Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*scale*.43;
  for(let j=0;j<2;j++){
   const angle=a.angle+(j?1:-1)*(1.1+r()*.7),distance=spread*(.75+r()*.3);
   place(a.x+Math.sin(angle)*distance,a.z+Math.cos(angle)*distance,scale*(.35+r()*.25),r()*Math.PI*2,forms[(i+j+1)%forms.length]);
  }
 }
 return records;
}

export function insideDesertFormation(x,z,records,formBounds,margin=0){
 return records.some(record=>{
  const b=formBounds.get(record.rockForm),co=Math.cos(record.angle),si=Math.sin(record.angle),dx=x-record.x,dz=z-record.z;
  const localX=co*dx-si*dz,localZ=si*dx+co*dz;
  return localX>b.min.x*record.scale-margin&&localX<b.max.x*record.scale+margin&&localZ>b.min.z*record.scale-margin&&localZ<b.max.z*record.scale+margin;
 });
}
