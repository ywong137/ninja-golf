import * as T from 'three';

// All contact flashes share one draw. Each flash stays at the struck body,
// while its expanding ring and streaks make the force visible from behind.
export class ContactBursts {
 constructor(scene){
  this.capacity=96;this.cursor=0;this.active=0;
  this.records=Array.from({length:this.capacity},()=>({life:0,duration:1,size:1}));
  const geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));geometry.setIndex([0,1,2,2,1,3]);
  this.attributes={};
  for(const [name,width] of [['center',3],['radius',1],['age',1],['rotation',1],['guard',1]]){
   const a=new T.InstancedBufferAttribute(new Float32Array(this.capacity*width),width).setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a);this.attributes[name]=a;
  }
  this.attributes.age.array.fill(1);geometry.instanceCount=this.capacity;
  this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
   vertexShader:`attribute vec3 center;attribute float radius,age,rotation,guard;varying vec2 p;varying float t,spin,metal;
    void main(){p=position.xy;t=age;spin=rotation;metal=guard;if(age>=1.){gl_Position=vec4(2.,2.,2.,1.);return;}vec4 view=modelViewMatrix*vec4(center,1.);view.xy+=position.xy*radius;gl_Position=projectionMatrix*view;}`,
   fragmentShader:`varying vec2 p;varying float t,spin,metal;
    float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 v){vec2 i=floor(v),f=fract(v);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    void main(){if(t>=1.)discard;float r=length(p);if(r>1.)discard;
     vec2 q=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p;
     float grain=noise(q*7.+vec2(spin,t*2.));
     float ignition=1.-smoothstep(.05,.62,t);
     float core=exp(-r*r*60.)*ignition;
     // One short hot filament replaces the repeated geometric star points.
     float filament=exp(-q.x*q.x*6.-q.y*q.y*650.)*ignition;
     float halo=exp(-r*r*9.)*(.30+grain*.40)*(1.-t);
     float shockRadius=mix(.12,.88,sqrt(t));
     float shock=exp(-pow((r-shockRadius+(grain-.5)*.055)*35.,2.));
     shock*=smoothstep(.30,.68,grain)*sin(t*3.14159)*.42;
     float alpha=(core*.95+filament*.62+halo+shock)*pow(1.-t,.8)*(1.-smoothstep(.88,1.,r));
     float heat=clamp(core+filament*.7+halo*.4,0.,1.);
     vec3 gold=mix(vec3(1.,.23,.025),vec3(1.,.97,.80),heat);
     vec3 ice=mix(vec3(.25,.58,1.),vec3(.88,.97,1.),heat);
     gl_FragColor=vec4(mix(gold,ice,metal)*(1.4+core*2.5),min(.85,alpha));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.Mesh(geometry,this.material);this.mesh.name='Contact flash pool';this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
 }
 emit(position,{heavy=false,special=false,guarded=false,radius,duration}={}){
  const index=this.cursor++%this.capacity,p=this.records[index],a=this.attributes;
  this.mesh.visible=true;p.life=p.duration=duration??(special?.38:heavy?.32:.26);p.size=radius??(special?2.6:heavy?1.65:1.25);
  a.center.setXYZ(index,position.x,position.y,position.z);a.radius.setX(index,p.size);a.age.setX(index,0);a.rotation.setX(index,Math.random()*Math.PI*2);a.guard.setX(index,guarded?1:0);
  for(const attribute of Object.values(a))attribute.needsUpdate=true;
 }
 update(dt,calm=false){
  this.active=0;
  for(let i=0;i<this.capacity;i++){
   const p=this.records[i];p.life=Math.max(0,p.life-dt*(calm?4:1));const age=1-p.life/p.duration;
   this.attributes.age.setX(i,age);this.attributes.radius.setX(i,p.size*(1+age*.45));if(p.life>0)this.active++;
  }
  this.mesh.visible=this.active>0;this.attributes.age.needsUpdate=true;this.attributes.radius.needsUpdate=true;
 }
 clear(){this.mesh.visible=false;for(const p of this.records)p.life=0;this.active=0;this.attributes.age.array.fill(1);this.attributes.age.needsUpdate=true;}
}
