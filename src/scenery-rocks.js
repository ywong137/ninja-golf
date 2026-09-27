import * as THREE from 'three';

// Dimensions describe the visible cover, independently of the scan's native scale.
export function queueSceneryRock(root,record){
 const {x,z,y,height,radius,angle=0,burial=.12,source='coastal-rock'}=record;
 if(!['coastal-rock','desert-rock'].includes(source)||![x,z,y,height,radius,angle,burial].every(Number.isFinite)||height<=0||radius<=0||burial<0||burial>.45)throw new Error('Scenery rock needs a valid scan, finite position, positive height/radius, and burial between 0 and .45');
 const queue=root.userData.sceneryRocks??=[];
 if(queue.length>=256)throw new Error('Scenery rock queue exceeds 256 records; reduce garden detail');
 const result={x,z,y,height,radius,angle,burial,source};queue.push(result);return result;
}

export function sceneryRockBounds(parts){
 const bounds=new THREE.Box3();
 for(const part of parts){part.geometry.computeBoundingBox();bounds.union(part.geometry.boundingBox);}
 if(bounds.isEmpty())throw new Error('Scenery rock scan has no geometry');
 return bounds;
}

export function fitSceneryRock(record,bounds){
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const horizontal=record.radius/Math.hypot(size.x*.5,size.z*.5),vertical=record.height/(size.y*(1-record.burial));
 const co=Math.cos(record.angle),si=Math.sin(record.angle),cx=center.x*horizontal,cz=center.z*horizontal;
 return {x:record.x-co*cx-si*cz,z:record.z+si*cx-co*cz,y:record.y-bounds.min.y*vertical-record.burial*size.y*vertical,angle:record.angle,scale:1,scaleX:horizontal,scaleY:vertical,scaleZ:horizontal};
}
