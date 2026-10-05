import * as T from 'three';

// Layer world-space fire and smoke over contact sparks. Each pool uses one draw.
// Distance-spaced trail emission keeps the density independent of frame rate.
export class EmberClouds {
 constructor(scene){this.pools=[this.pool(scene,256,true),this.pool(scene,384,false)];this.trails=new Map();this.clock=0;}
 pool(scene,capacity,fire){
  const geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));geometry.setIndex([0,1,2,2,1,3]);
  const a={};for(const[name,size]of [['center',3],['size',1],['age',1],['seed',1]]){a[name]=new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a[name]);}
  a.age.array.fill(1);geometry.instanceCount=capacity;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:fire?T.AdditiveBlending:T.NormalBlending,
   vertexShader:`attribute vec3 center;attribute float size,age,seed;varying vec2 vUv;varying float t,s;
    void main(){vUv=position.xy;t=age;s=seed;if(age>=1.){gl_Position=vec4(2.,2.,2.,1.);return;}vec4 p=modelViewMatrix*vec4(center,1.);p.xy+=position.xy*size;gl_Position=projectionMatrix*p;}`,
   fragmentShader:`varying vec2 vUv;varying float t,s;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+7.)*.28+noise(p*4.11+13.)*.15;}
    void main(){if(t>=1.)discard;float r=length(vUv);if(r>1.)discard;
     vec2 p=vUv*2.7+vec2(s,t*-1.8);p+=vec2(fbm(p+t),fbm(p+4.-t))*.85;
     float n=fbm(p),density=smoothstep(.23,.76,n)*(1.-smoothstep(.20,1.,r));
     float fade=smoothstep(0.,.075,t)*pow(1.-t,1.6);
     ${fire?`float heat=clamp(density*1.7-t*.65,0.,1.);vec3 color=mix(vec3(.55,.004,.001),vec3(1.,.10,.002),smoothstep(.04,.58,heat));color=mix(color,vec3(1.,.48,.06),smoothstep(.80,1.,heat));gl_FragColor=vec4(color*1.7,density*fade*.85);`:`vec3 color=mix(vec3(.12,.15,.20),vec3(.46,.50,.57),n*.8+vUv.y*.12);gl_FragColor=vec4(color,density*fade*.56);`}
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(geometry,material);mesh.name=fire?'Turbulent impact fire':'Dissolving ninja wisps';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  return {mesh,a,capacity,cursor:0,fire,particles:Array.from({length:capacity},()=>({p:new T.Vector3(),v:new T.Vector3(),life:0,max:1,size:1,seed:0}))};
 }
 add(index,position,velocity,size,life){const pool=this.pools[index],i=pool.cursor++%pool.capacity,p=pool.particles[i];p.p.copy(position);p.v.copy(velocity);p.life=p.max=life;p.size=size;p.seed=Math.random()*100;pool.a.seed.setX(i,p.seed);pool.a.age.setX(i,0);pool.a.center.setXYZ(i,position.x,position.y,position.z);pool.a.size.setX(i,size);pool.mesh.visible=true;for(const attribute of Object.values(pool.a))attribute.needsUpdate=true;}
 explosion(position,scale=1){
  for(let i=0;i<7;i++){const angle=i*2.4,r=.15+Math.random()*.3;const p=position.clone().add(new T.Vector3(Math.cos(angle)*r,.15+Math.random()*.3,Math.sin(angle)*r));this.add(0,p,new T.Vector3(Math.cos(angle)*1.9,1.1+Math.random()*1.5,Math.sin(angle)*1.9),(.5+Math.random()*.5)*scale,.38+Math.random()*.35);}
  for(let i=0;i<4;i++)this.add(1,position,new T.Vector3((Math.random()-.5)*1.8,1.4+Math.random(),(Math.random()-.5)*1.8),(.4+Math.random()*.35)*scale,.8+Math.random()*.5);
 }
 dissolve(position){
  for(let i=0;i<5;i++){const p=position.clone().add(new T.Vector3((Math.random()-.5)*.65,.15+Math.random()*1.8,(Math.random()-.5)*.65));this.add(1,p,new T.Vector3((Math.random()-.5)*.6,.7+Math.random()*.8,(Math.random()-.5)*.6),.32+Math.random()*.28,.75+Math.random()*.5);}
 }
 trail(position,token,channel){
  const key=token+':'+channel,last=this.trails.get(key);
  if(last&&this.clock-last.time<.12){const distance=last.p.distanceTo(position),count=Math.min(16,Math.floor(distance/.16));for(let i=1;i<=count;i++)this.add(0,last.p.clone().lerp(position,i/count),new T.Vector3(0,.65,0),.22+Math.random()*.12,.18+Math.random()*.2);if(count===0)return;}
  this.trails.set(key,{p:position.clone(),time:this.clock});
 }
 update(dt,calm=false){this.clock+=dt;for(const[key,value]of this.trails)if(this.clock-value.time>.5)this.trails.delete(key);
  for(const pool of this.pools){if(!pool.mesh.visible)continue;const a=pool.a;let active=0;for(let i=0;i<pool.capacity;i++){const p=pool.particles[i];if(p.life<=0){a.age.setX(i,1);continue;}p.life=Math.max(0,p.life-dt*(calm?4:1));if(p.life>0)active++;const age=1-p.life/p.max;p.v.multiplyScalar(Math.exp(-dt*.7));p.p.addScaledVector(p.v,dt);p.p.x+=Math.sin(age*5+p.seed)*dt*.18;p.p.z+=Math.cos(age*4+p.seed)*dt*.18;a.center.setXYZ(i,p.p.x,p.p.y,p.p.z);a.age.setX(i,age);a.size.setX(i,p.size*(pool.fire?1+age*.9:1+age*1.8));}pool.mesh.visible=active>0;for(const attribute of Object.values(a))attribute.needsUpdate=true;}
 }
 clear(){this.trails.clear();for(const pool of this.pools){pool.mesh.visible=false;for(const p of pool.particles)p.life=0;pool.a.age.array.fill(1);pool.a.age.needsUpdate=true;}}
}
