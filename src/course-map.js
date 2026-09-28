import {shorelineOutline} from './shoreline.js';
import {bunkerOutline} from './bunkers.js';
import {mapOutlines,waterBasins} from './course-layout.js';
const geometryCache=new WeakMap();
function ellipse([x,z,rx,rz]){return Array.from({length:64},(_,i)=>{const a=i*Math.PI/32;return[x+Math.cos(a)*rx,z+Math.sin(a)*rz];});}
export function courseMapGeometry(c){
 if(geometryCache.has(c))return geometryCache.get(c);
 const fairways=mapOutlines(c),waters=waterBasins(c).map(b=>shorelineOutline(b)),islands=c.layout.islands.map(b=>shorelineOutline(b,true)),bridges=mapOutlines({layout:{segments:c.layout.bridgeSegments}}),green=ellipse([c.greenX,c.length,17*1.05,17]),bunkers=c.bunkers.map(b=>bunkerOutline(b));
 const points=[...fairways,...waters,...islands,...bridges,green,...bunkers,c.layout.route].flat();
 const bounds={minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};
 const tee=[[-5,-7],[5,-7],[5,7],[-5,7]];
 const result={fairways,waters,islands,bridges,green,tee,bunkers,bounds};geometryCache.set(c,result);return result;
}
export function courseMapProjection(c){const b=courseMapGeometry(c).bounds,scale=Math.min(188/(b.maxX-b.minX),222/(b.maxZ-b.minZ)),mx=(b.minX+b.maxX)/2,mz=(b.minZ+b.maxZ)/2;return(x,z)=>({x:110-(x-mx)*scale,y:135-(z-mz)*scale});}
function fillPolygons(ctx,polygons,project,color){ctx.fillStyle=color;for(const polygon of polygons){ctx.beginPath();polygon.forEach(([x,z],i)=>{const p=project(x,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fill();}}
// The water layer uses the same dry masks as its world shader. Erasing their union preserves overlapping bridges and islands.
export function drawCourseGround(ctx,c,project,waterCanvas){
 const g=courseMapGeometry(c);fillPolygons(ctx,[...g.fairways,g.tee],project,'#637e4b');fillPolygons(ctx,[g.green],project,'#9fa774');fillPolygons(ctx,g.bunkers,project,'#c2ae82');
 const water=waterCanvas.getContext('2d');water.clearRect(0,0,waterCanvas.width,waterCanvas.height);water.globalCompositeOperation='source-over';fillPolygons(water,g.waters,project,'#477575');water.globalCompositeOperation='destination-out';fillPolygons(water,[...g.islands,...g.bridges],project,'#000');water.globalCompositeOperation='source-over';ctx.drawImage(waterCanvas,0,0);fillPolygons(ctx,g.bridges,project,'#ae9971');
}
