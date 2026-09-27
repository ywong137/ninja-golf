import * as THREE from 'three';
const PALETTE=['#ffe1a0','#c9d9af','#ee557d','#9ee4ff','#dcc294'];
// One draw call for sparks, splashes, sand and weapon trails, regardless of particle count.
export class Effects {
  constructor(scene){
    this.scene=scene;this.items=[];this.capacity=4096;this.cursor=0;this.particles=Array.from({length:this.capacity},()=>({life:0,v:new THREE.Vector3()}));
    this.positions=new Float32Array(this.capacity*3);this.colors=new Float32Array(this.capacity*3);this.sizes=new Float32Array(this.capacity);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));geometry.setAttribute('size',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,vertexShader:`attribute float size; varying vec3 tint; void main(){tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*650./max(1.,-p.z),0.,50.);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 tint; void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,pow(1.-d,1.6));}`});
    this.points=new THREE.Points(geometry,material);this.points.frustumCulled=false;scene.add(this.points);this.palette=PALETTE.map(x=>new THREE.Color(x));
  }
  particle(position,velocity,life,size,kind){const i=this.cursor++%this.capacity,p=this.particles[i];p.life=p.max=life;p.size=size;p.v.copy(velocity);position.toArray(this.positions,i*3);this.palette[kind].toArray(this.colors,i*3);this.points.geometry.attributes.color.needsUpdate=true;}
  burst(position,count=12,power=4,kind=0){for(let i=0;i<count;i++)this.particle(position,new THREE.Vector3((Math.random()-.5)*power,Math.random()*power*.8,(Math.random()-.5)*power),.35+Math.random()*.55,.07+Math.random()*.16,kind);}
  trail(a,b,kind=0){for(let i=0;i<5;i++)this.particle(a.clone().lerp(b,i/4),new THREE.Vector3(0,.2,0),.19,.11,kind);}
  slash(position,yaw,special=false){const g=new THREE.RingGeometry(special?2:1.4,special?8:4.6,56,1,-Math.PI*.7,Math.PI*1.4);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:special?'#efb5ff':'#ffedb3',transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));m.rotation.set(-Math.PI/2,.12,yaw+Math.PI/2);m.position.copy(position);m.position.y+=1;this.scene.add(m);this.items.push({m,life:.24,max:.24});this.burst(m.position,special?100:22,special?20:8,special?2:0);}
  update(dt,calm=false){for(let i=0;i<this.capacity;i++){const p=this.particles[i];if(p.life<=0)continue;p.life-=dt*(calm?3:1);p.v.y-=6*dt;const j=i*3;this.positions[j]+=p.v.x*dt;this.positions[j+1]+=p.v.y*dt;this.positions[j+2]+=p.v.z*dt;this.sizes[i]=Math.max(0,p.life/p.max)*p.size;}this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.size.needsUpdate=true;for(let i=this.items.length-1;i>=0;i--){const p=this.items[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();this.items.splice(i,1);}else{p.m.material.opacity=p.life/p.max*.75;p.m.scale.multiplyScalar(1+dt*3);}}}
  clear(){for(const p of this.items){this.scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();}this.items=[];this.particles.forEach(p=>p.life=0);this.sizes.fill(0);this.points.geometry.attributes.size.needsUpdate=true;}
}
