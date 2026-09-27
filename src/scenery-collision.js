// Small spatial buckets avoid scanning the forest for each crowd member.
export class SceneryCollision {
 constructor(sites){this.cells=new Map();for(const s of sites){if(!['tree','lantern','pagoda','rock'].includes(s.kind))continue;const radius=s.kind==='tree'?.32:s.kind==='rock'?Math.min(1.15,s.height*.65):.7;const item={...s,radius,height:s.kind==='tree'?s.height:s.height||2.5};const key=this.key(s.x,s.z);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(item);}}
 key(x,z){return `${Math.floor(x/12)},${Math.floor(z/12)}`;}
 nearby(x,z){const out=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)out.push(...(this.cells.get(this.key(x+dx*12,z+dz*12))||[]));return out;}
 slide(position,radius=.38){for(const s of this.nearby(position.x,position.z)){const dx=position.x-s.x,dz=position.z-s.z,d=Math.hypot(dx,dz),r=radius+s.radius;if(d<r){position.x=s.x+(d>.001?dx/d:1)*r;position.z=s.z+(d>.001?dz/d:0)*r;}}return position;}
 camera(origin,target){const dx=target.x-origin.x,dz=target.z-origin.z,length=dx*dx+dz*dz;let closest=1;for(const s of this.nearby(origin.x,origin.z)){const t=Math.max(0,Math.min(1,((s.x-origin.x)*dx+(s.z-origin.z)*dz)/Math.max(.01,length))),y=origin.y+(target.y-origin.y)*t;if(y>s.y+s.height||y<s.y||t<.05)continue;const d=Math.hypot(origin.x+dx*t-s.x,origin.z+dz*t-s.z),r=s.radius+.45;if(d<r)closest=Math.min(closest,Math.max(.2,t-Math.sqrt(r*r-d*d)/Math.sqrt(length)));}target.x=origin.x+dx*closest;target.z=origin.z+dz*closest;target.y=origin.y+(target.y-origin.y)*closest;return target;}
}
