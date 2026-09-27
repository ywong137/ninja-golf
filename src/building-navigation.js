import {heightAt,lieAt} from './course.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const RADIUS=.3,HEIGHT=2;
// Visibility routes around solid architecture. Forest avoidance remains local to movement.
export class BuildingNavigation {
 constructor(course,collision){this.course=course;this.collision=collision;this.nodes=[];this.edges=new Map();this.endpointLinks=new Map();this.corridors=[];const seen=new Set();
  const add=(x,z)=>{const y=heightAt(course,x,z),key=`${x.toFixed(3)},${z.toFixed(3)}`,p={x,y,z};if(seen.has(key)||!this.dry(p)||collision.blocked(p,RADIUS,HEIGHT,true))return;seen.add(key);this.nodes.push(p);};
  for(const b of collision.buildings){
   if(b.navigationSkip)continue;
   const footprint=b.navigationFootprint;
   if(!footprint&&(b.minY>heightAt(course,b.x,b.z)+HEIGHT||b.maxY<heightAt(course,b.x,b.z)))continue;
   // Grouping reduces graph corners only. All route checks still use every real solid.
   const shape=footprint?{...footprint,kind:'box'}:b;
   if(footprint&&(![shape.x,shape.z,shape.halfWidth,shape.halfDepth,shape.yaw??0].every(Number.isFinite)||shape.halfWidth<=0||shape.halfDepth<=0))throw new Error(`Invalid navigation footprint: ${b.id}`);
   if(shape.kind==='box'){const c=Math.cos(shape.yaw||0),s=Math.sin(shape.yaw||0);for(const x of [-shape.halfWidth-.75,shape.halfWidth+.75])for(const z of [-shape.halfDepth-.75,shape.halfDepth+.75])add(shape.x+c*x+s*z,shape.z-s*x+c*z);}
   else for(let i=0;i<8;i++){const a=i*Math.PI/4;add(shape.x+Math.cos(a)*(shape.radius+.75),shape.z+Math.sin(a)*(shape.radius+.75));}
  }
 }
 dry(p){for(const [dx,dz]of [[0,0],[RADIUS,0],[-RADIUS,0],[0,RADIUS],[0,-RADIUS]])if(['Water','Out of bounds'].includes(lieAt(this.course,p.x+dx,p.z+dz)))return false;return true;}
 clear(a,b){
  const count=Math.max(1,Math.ceil(distance(a,b)/1.5)),points=[];let before=a;
  // Reject obstructed links before the more expensive terrain classification.
  for(let i=1;i<=count;i++){const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,next={x,y:heightAt(this.course,x,z),z};if(!this.collision.segmentClear(before,next,RADIUS,HEIGHT,true))return false;points.push(next);before=next;}
  return points.every(point=>this.dry(point));
 }
 neighbors(index){if(this.edges.has(index))return this.edges.get(index);const out=[];for(let j=0;j<this.nodes.length;j++){if(j===index)continue;const d=distance(this.nodes[index],this.nodes[j]);if(d<95&&this.clear(this.nodes[index],this.nodes[j]))out.push({index:j,cost:d});}this.edges.set(index,out);return out;}
 links(point,towardTarget=false){
  // Exact coordinates avoid unsafe reuse across a wall or shoreline.
  const key=`${towardTarget?1:0}:${point.x},${point.y},${point.z}`;
  if(this.endpointLinks.has(key))return this.endpointLinks.get(key);
  const links=[];
  for(let i=0;i<this.nodes.length;i++){const node=this.nodes[i],cost=distance(point,node);if(cost<95&&(towardTarget?this.clear(node,point):this.clear(point,node)))links.push({index:i,cost});}
  if(this.endpointLinks.size>=256)this.endpointLinks.delete(this.endpointLinks.keys().next().value);
  this.endpointLinks.set(key,links);return links;
 }
 route(from,target){
  if(this.clear(from,target))return [{...target}];
  // Nearby enemies can share static corners after validating both new endpoint links.
  for(const corridor of this.corridors){
   if(distance(from,corridor.from)>4||distance(target,corridor.target)>4)continue;
   const corners=corridor.corners;
   if(this.clear(from,corners[0])&&this.clear(corners[corners.length-1],target))return [...corners.map(p=>({...p})),{...target}];
  }
  const costs=new Map(),previous=new Map(),open=new Set(),goalLinks=new Map();
  for(const {index,cost}of this.links(from)){costs.set(index,cost);previous.set(index,-1);open.add(index);}
  for(const {index,cost}of this.links(target,true))goalLinks.set(index,cost);
  let goal=-1,best=Infinity;
  while(open.size){let current=-1,score=Infinity;for(const i of open){const f=costs.get(i)+distance(this.nodes[i],target);if(f<score){score=f;current=i;}}if(score>=best)break;open.delete(current);if(goalLinks.has(current)){const total=costs.get(current)+goalLinks.get(current);if(total<best){best=total;goal=current;}}
   for(const edge of this.neighbors(current)){const value=costs.get(current)+edge.cost;if(value<(costs.get(edge.index)??Infinity)){costs.set(edge.index,value);previous.set(edge.index,current);open.add(edge.index);}}
  }
  if(goal<0)return [];
  const route=[{...target}];for(let i=goal;i>=0;i=previous.get(i))route.unshift({...this.nodes[i]});
  this.corridors.unshift({from:{...from},target:{...target},corners:route.slice(0,-1).map(p=>({...p}))});if(this.corridors.length>32)this.corridors.pop();return route;
 }
 waypoint(from,target,state,time){
  if(this.collision.segmentClear(from,target,RADIUS,HEIGHT,true)){state.buildingPath=null;return target;}
  if(!state.buildingPath||time>=(state.buildingRouteAt||0)){
   const path=state.buildingPath,goal=state.buildingGoal;
   const reusable=path?.length&&goal&&distance(goal,target)<8&&this.clear(from,path[0])&&this.clear(path.length>1?path[path.length-2]:from,target);
   if(reusable)path[path.length-1]={...target};else state.buildingPath=this.route(from,target);
   state.buildingGoal={...target};state.buildingRouteAt=time+.8;
  }
  while(state.buildingPath.length&&distance(from,state.buildingPath[0])<.55)state.buildingPath.shift();
  return state.buildingPath[0]||from;
 }
}
