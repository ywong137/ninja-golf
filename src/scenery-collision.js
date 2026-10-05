const CELL=12,EPS=1e-7,SKIN=1e-5;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function local(s,x,z){const dx=x-s.x,dz=z-s.z;return{x:s.cos*dx-s.sin*dz,z:s.sin*dx+s.cos*dz};}
function worldNormal(s,x,z){return{x:s.cos*x+s.sin*z,z:-s.sin*x+s.cos*z};}
function overlapY(s,y,height){return y+height>s.minY+EPS&&y<s.maxY-EPS;}
function interval(p,d,min,max){if(Math.abs(d)<EPS)return p>=min&&p<=max?[-Infinity,Infinity]:null;const a=(min-p)/d,b=(max-p)/d;return[Math.min(a,b),Math.max(a,b)];}
function rectangle(p,d,w,h){const a=interval(p.x,d.x,-w,w),b=interval(p.z,d.z,-h,h);if(!a||!b)return null;const lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);return lo<=hi?[lo,hi]:null;}
function circle(p,d,x,z,r){const px=p.x-x,pz=p.z-z,a=d.x*d.x+d.z*d.z,c=px*px+pz*pz-r*r;if(a<EPS*EPS)return c<=0?[-Infinity,Infinity]:null;const b=px*d.x+pz*d.z,disc=b*b-a*c;if(disc<0)return null;const q=Math.sqrt(disc);return[(-b-q)/a,(-b+q)/a];}
// The rounded rectangle is the union of two strips and four corner disks.
function horizontalInterval(s,from,to,radius){
 const p=local(s,from.x,from.z),q=local(s,to.x,to.z),d={x:q.x-p.x,z:q.z-p.z};
 if(s.kind==='cylinder')return circle(p,d,0,0,s.radius+radius);
 const w=s.halfWidth,h=s.halfDepth,parts=[rectangle(p,d,w+radius,h),rectangle(p,d,w,h+radius)];
 for(const x of [-w,w])for(const z of [-h,h])parts.push(circle(p,d,x,z,radius));
 const hits=parts.filter(Boolean);return hits.length?[Math.min(...hits.map(a=>a[0])),Math.max(...hits.map(a=>a[1]))]:null;
}
function penetration(s,p,radius){
 const q=local(s,p.x,p.z);
 if(s.kind==='cylinder'){const length=Math.hypot(q.x,q.z),depth=s.radius+radius-length;return{depth,...worldNormal(s,length>EPS?q.x/length:1,length>EPS?q.z/length:0)};}
 const x=clamp(q.x,-s.halfWidth,s.halfWidth),z=clamp(q.z,-s.halfDepth,s.halfDepth),dx=q.x-x,dz=q.z-z,length=Math.hypot(dx,dz);
 if(length>EPS)return{depth:radius-length,...worldNormal(s,dx/length,dz/length)};
 const horizontal=s.halfWidth-Math.abs(q.x),vertical=s.halfDepth-Math.abs(q.z);
 return horizontal<vertical?{depth:horizontal+radius,...worldNormal(s,q.x<0?-1:1,0)}:{depth:vertical+radius,...worldNormal(s,0,q.z<0?-1:1)};
}
function sweep(s,from,to,radius,height,verticalMargin=0){
 const horizontal=horizontalInterval(s,from,to,radius),vertical=interval(from.y??0,(to.y??0)-(from.y??0),s.minY-height-verticalMargin+(height>0?EPS:0),s.maxY+verticalMargin-(height>0?EPS:0));
 if(!horizontal||!vertical)return null;
 const enter=Math.max(horizontal[0],vertical[0],0),exit=Math.min(horizontal[1],vertical[1],1);
 if(enter>exit||exit<0||enter>1)return null;
 const point={x:from.x+(to.x-from.x)*enter,z:from.z+(to.z-from.z)*enter};
 return{t:enter,...penetration(s,point,radius)};
}

// Every occupied cell stores the full obstacle, including wide and rotated buildings.
export class SceneryCollision {
 constructor(sites=[],buildingObstacles=[],rockObstacles=[]){
  this.cells=new Map();this.buildings=[];this.rocks=[];
  for(const site of sites){
   if(!['tree','lantern','pagoda','rock'].includes(site.kind)||site.kind==='rock'&&rockObstacles.length)continue;
   const radius=site.radius??(site.kind==='tree'?.32:site.kind==='rock'?Math.min(1.15,site.height*.65):.7),height=site.kind==='tree'?site.height:site.height||2.5;
   this.insert({...site,kind:'cylinder',radius,minY:site.y??0,maxY:(site.y??0)+height,cos:1,sin:0,building:false});
  }
  const ids=new Set();
  for(const [category,records]of [['building',buildingObstacles],['rock',rockObstacles]])for(const record of records){
   if(!['box','cylinder'].includes(record.kind))throw new Error(`Unsupported ${category} collision kind: ${record.kind}`);
   const values=[record.x,record.z,record.minY,record.maxY,...(record.kind==='box'?[record.halfWidth,record.halfDepth,record.yaw??0]:[record.radius])];
   if(!values.every(Number.isFinite)||record.maxY<=record.minY||(record.kind==='box'?record.halfWidth<=0||record.halfDepth<=0:record.radius<=0))throw new Error(`Invalid ${category} collision bounds: ${record.id??'unnamed'}`);
   if(record.id!=null&&ids.has(record.id))continue;
   ids.add(record.id);const yaw=record.yaw??0,item={...record,yaw,cos:Math.cos(yaw),sin:Math.sin(yaw),building:category==='building'};(item.building?this.buildings:this.rocks).push(item);this.insert(item);
  }
 }
 key(x,z){return `${Math.floor(x/CELL)},${Math.floor(z/CELL)}`;}
 insert(s){const w=s.kind==='box'?Math.abs(s.cos)*s.halfWidth+Math.abs(s.sin)*s.halfDepth:s.radius,h=s.kind==='box'?Math.abs(s.sin)*s.halfWidth+Math.abs(s.cos)*s.halfDepth:s.radius;for(let z=Math.floor((s.z-h)/CELL);z<=Math.floor((s.z+h)/CELL);z++)for(let x=Math.floor((s.x-w)/CELL);x<=Math.floor((s.x+w)/CELL);x++){const key=`${x},${z}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(s);}}
 query(minX,minZ,maxX,maxZ,buildingsOnly=false){const found=new Set();for(let z=Math.floor(minZ/CELL);z<=Math.floor(maxZ/CELL);z++)for(let x=Math.floor(minX/CELL);x<=Math.floor(maxX/CELL);x++)for(const item of this.cells.get(`${x},${z}`)||[])if(!buildingsOnly||item.building)found.add(item);return [...found];}
 nearby(x,z){return this.query(x-CELL,z-CELL,x+CELL,z+CELL);}
 blocked(position,radius=.38,height=2,buildingsOnly=false){return this.query(position.x-radius,position.z-radius,position.x+radius,position.z+radius,buildingsOnly).some(s=>overlapY(s,position.y??0,height)&&penetration(s,position,radius).depth>EPS);}
 segmentClear(from,to,radius=.38,height=2,buildingsOnly=false){
  if(this.blocked(from,radius,height,buildingsOnly)||this.blocked(to,radius,height,buildingsOnly))return false;
  return !this.query(Math.min(from.x,to.x)-radius,Math.min(from.z,to.z)-radius,Math.max(from.x,to.x)+radius,Math.max(from.z,to.z)+radius,buildingsOnly).some(s=>{const hit=sweep(s,from,to,radius,height);return hit&&hit.t<1-EPS&&((to.x-from.x)*hit.x+(to.z-from.z)*hit.z<-EPS||Math.abs((to.y??0)-(from.y??0))>EPS);});
 }
 resolve(position,radius,height){
  for(let pass=0;pass<12;pass++){let moved=false;for(const s of this.query(position.x-radius,position.z-radius,position.x+radius,position.z+radius)){if(!overlapY(s,position.y??0,height))continue;const hit=penetration(s,position,radius);if(hit.depth>EPS){position.x+=hit.x*hit.depth;position.z+=hit.z*hit.depth;moved=true;}}if(!moved)break;}
 }
 slide(position,radius=.38,from=null,height=2){
  if(!from){this.resolve(position,radius,height);return position;}
  const end={x:position.x,y:position.y??0,z:position.z},current={x:from.x,y:from.y??0,z:from.z};this.resolve(current,radius,height);
  let dx=end.x-current.x,dz=end.z-current.z;
  for(let pass=0;pass<8&&Math.hypot(dx,dz)>EPS;pass++){
   const target={x:current.x+dx,y:end.y,z:current.z+dz};let nearest=null;
   for(const s of this.query(Math.min(current.x,target.x)-radius,Math.min(current.z,target.z)-radius,Math.max(current.x,target.x)+radius,Math.max(current.z,target.z)+radius)){
    const hit=sweep(s,current,target,radius,height);if(hit&&dx*hit.x+dz*hit.z<-EPS&&(!nearest||hit.t<nearest.t))nearest=hit;
   }
   if(!nearest){current.x=target.x;current.z=target.z;break;}
   const t=Math.max(0,nearest.t-SKIN/Math.max(SKIN,Math.hypot(dx,dz)));current.x+=dx*t;current.z+=dz*t;current.y+=(end.y-current.y)*t;
   dx*=1-t;dz*=1-t;const inward=dx*nearest.x+dz*nearest.z;dx-=nearest.x*Math.min(0,inward);dz-=nearest.z*Math.min(0,inward);
  }
  position.x=current.x;position.z=current.z;this.resolve(position,radius,height);return position;
 }
 sweepSphere(from,to,radius=.13,buildingsOnly=true){
  let nearest=null;
  for(const obstacle of this.query(Math.min(from.x,to.x)-radius,Math.min(from.z,to.z)-radius,Math.max(from.x,to.x)+radius,Math.max(from.z,to.z)+radius,buildingsOnly)){
   const hit=sweep(obstacle,from,to,radius,0,radius);if(!hit||nearest&&hit.t>=nearest.t)continue;
   const y=from.y+(to.y-from.y)*hit.t,normal={x:hit.x,y:0,z:hit.z};
   if(Math.abs(y-(obstacle.minY-radius))<1e-6){normal.x=normal.z=0;normal.y=-1;}
   else if(Math.abs(y-(obstacle.maxY+radius))<1e-6){normal.x=normal.z=0;normal.y=1;}
   else if(hit.t===0){const below=y-(obstacle.minY-radius),above=obstacle.maxY+radius-y;if(Math.min(below,above)<hit.depth){normal.x=normal.z=0;normal.y=below<above?-1:1;}}
   const inward=(to.x-from.x)*normal.x+(to.y-from.y)*normal.y+(to.z-from.z)*normal.z;
   if(hit.t===0&&inward>=0&&(normal.y!==0?Math.min(Math.abs(y-(obstacle.minY-radius)),Math.abs(y-(obstacle.maxY+radius)))<=EPS:hit.depth<=EPS))continue;
   nearest={t:hit.t,normal,obstacle};
  }
  return nearest;
 }
 camera(origin,target,minimumDistance=0){
  const radius=minimumDistance>0?.25:.45;
  const project=end=>{const hit=this.sweepSphere(origin,end,radius,false),t=hit?Math.max(0,hit.t-.002):1;return{x:origin.x+(end.x-origin.x)*t,y:origin.y+(end.y-origin.y)*t,z:origin.z+(end.z-origin.z)*t};};
  const desired={...target},length=p=>Math.hypot(p.x-origin.x,p.y-origin.y,p.z-origin.z);
  let best=project(desired);
  if(minimumDistance>0&&length(best)<minimumDistance){
   // Keep a clear view of the body instead of collapsing the lens into it.
   // Search nearby side and elevated views only when the normal boom is blocked.
   const dx=desired.x-origin.x,dz=desired.z-origin.z,span=Math.max(minimumDistance,Math.hypot(dx,dz)),yaw=Math.atan2(dx,dz);
   let score=Infinity;
   for(const rise of [0,2.5,5,9,16])for(const turn of [0,-Math.PI/4,Math.PI/4,-Math.PI/2,Math.PI/2,-Math.PI*.75,Math.PI*.75,Math.PI]){
    const candidate=project({x:origin.x+Math.sin(yaw+turn)*span,y:Math.max(origin.y+.6,desired.y)+rise,z:origin.z+Math.cos(yaw+turn)*span});
    if(length(candidate)<minimumDistance)continue;
    const distance=(candidate.x-desired.x)**2+(candidate.y-desired.y)**2+(candidate.z-desired.z)**2;
    if(distance<score){best=candidate;score=distance;}
   }
  }
  target.x=best.x;target.y=best.y;target.z=best.z;return target;
 }
}
