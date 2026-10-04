import * as T from 'three';
const origin=new T.Vector3(),velocity=new T.Vector3();
// Two bounded draws: luminous velocity-aligned sparks, then opaque red droplets.
export class ImpactParticles{
 constructor(scene){this.pools=[this.pool(scene,4096,true),this.pool(scene,768,false)];}
 pool(scene,capacity,glowing){
  const geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));geometry.setIndex([0,1,2,2,1,3]);
  const attributes={};for(const [name,size]of [['head',3],['tail',3],['tint',3],['width',1],['opacity',1]]){
   attributes[name]=new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,attributes[name]);
  }
  geometry.instanceCount=capacity;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:glowing?T.AdditiveBlending:T.NormalBlending,
   vertexShader:`attribute vec3 head,tail,tint;attribute float width,opacity;varying vec2 ribbonUv;varying vec3 color;varying float fade;
    void main(){vec4 a=modelViewMatrix*vec4(head,1.),b=modelViewMatrix*vec4(tail,1.);vec2 direction=a.xy-b.xy;
     if(dot(direction,direction)<.000001)direction=vec2(0.,1.);direction=normalize(direction);
     vec4 p=mix(a,b,position.y);p.xy+=vec2(-direction.y,direction.x)*position.x*width;
     gl_Position=projectionMatrix*p;ribbonUv=position.xy;color=tint;fade=opacity;}`,
   fragmentShader:`varying vec2 ribbonUv;varying vec3 color;varying float fade;
    void main(){float x=abs(ribbonUv.x),y=ribbonUv.y;
     float taper=pow(max(0.,1.-y),.55);float edge=1.-smoothstep(.12,1.,x/max(.08,taper));
     ${glowing?'float core=exp(-x*x*65.)*(1.-y);gl_FragColor=vec4(color*(1.+core*2.),fade*edge*(.28+core*.72));':'gl_FragColor=vec4(color,fade*edge*.9);'}
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(geometry,material);mesh.name=glowing?'Impact spark streaks':'Impact blood droplets';mesh.frustumCulled=false;scene.add(mesh);
  return {mesh,attributes,capacity,glowing,cursor:0,particles:Array.from({length:capacity},()=>({p:new T.Vector3(),v:new T.Vector3(),life:0,max:1,width:0}))};
 }
 emit(position,direction,{heavy=false,guarded=false,special=false}={}){
  const count=special?360:heavy?216:120;
  for(let i=0;i<count;i++){
   velocity.set((Math.random()-.5)*13,1+Math.random()*10,(Math.random()-.5)*13).addScaledVector(direction,3);
   if(special)velocity.multiplyScalar(1.5);
   this.add(0,position,velocity,.19+Math.random()*.32,.025+Math.random()*.035,i%4===0?0xfff4da:i%3===0?0x95deff:0xffbd5c);
  }
  if(!guarded)for(let i=0;i<(heavy?66:36);i++){
   velocity.set((Math.random()-.5)*3,Math.random()*2.4,(Math.random()-.5)*3).addScaledVector(direction,2.4);
   this.add(1,position,velocity,.17+Math.random()*.23,.018+Math.random()*.027,i%2?0x9b1b2f:0x510b19);
  }
 }
 add(poolIndex,position,v,life,width,color){
  const pool=this.pools[poolIndex],i=pool.cursor++%pool.capacity,p=pool.particles[i];
  p.p.copy(position);p.v.copy(v);p.life=p.max=life;p.width=width;
  const c=new T.Color(color);pool.attributes.tint.setXYZ(i,c.r,c.g,c.b);
 }
 update(dt,calm=false){
  for(const pool of this.pools){const a=pool.attributes;
   for(let i=0;i<pool.capacity;i++){const p=pool.particles[i];
    if(p.life<=0){a.opacity.setX(i,0);continue;}
    p.life-=dt*(calm?4:1);p.v.y-=9.8*dt;p.p.addScaledVector(p.v,dt);
    origin.copy(p.p).addScaledVector(p.v,-(pool.glowing?.065:.026));
    a.head.setXYZ(i,p.p.x,p.p.y,p.p.z);a.tail.setXYZ(i,origin.x,origin.y,origin.z);
    const age=1-Math.max(0,p.life)/p.max;a.opacity.setX(i,Math.pow(1-age,.6));a.width.setX(i,p.width*(1-age*.6));
   }
   for(const attribute of Object.values(a))attribute.needsUpdate=true;
  }
 }
 clear(){for(const pool of this.pools){for(const p of pool.particles)p.life=0;pool.attributes.opacity.array.fill(0);pool.attributes.opacity.needsUpdate=true;}}
}
