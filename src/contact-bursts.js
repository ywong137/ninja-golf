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
    void main(){p=position.xy;t=age;spin=rotation;metal=guard;vec4 view=modelViewMatrix*vec4(center,1.);view.xy+=position.xy*radius;gl_Position=projectionMatrix*view;}`,
   fragmentShader:`varying vec2 p;varying float t,spin,metal;
    void main(){if(t>=1.)discard;float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x)+spin;
     float rays=pow(abs(cos(a*5.)),26.);float slash=pow(abs(cos(a)),90.);
     float ignition=1.-smoothstep(.13,.68,t);float core=exp(-r*r*38.);
     float star=(1.-smoothstep(.17+rays*.58+slash*.18,.24+rays*.58+slash*.18,r))*ignition;
     float shock=exp(-pow((r-mix(.20,.90,t))*32.,2.))*(.50+.50*cos(a*9.+t*5.))*(1.-t);
     float glow=exp(-r*r*7.)*.32;
     float alpha=(core+star*.75+shock*.7+glow)*pow(1.-t,.65)*(1.-smoothstep(.9,1.,r));
     vec3 gold=mix(vec3(1.,.07,.005),vec3(1.,.95,.72),clamp(core,0.,1.));
     vec3 ice=mix(vec3(.18,.60,1.),vec3(.83,.96,1.),clamp(core+star,0.,1.));
     gl_FragColor=vec4(mix(gold,ice,metal)*(1.4+core*3.),min(.85,alpha));
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});
  this.mesh=new T.Mesh(geometry,this.material);this.mesh.name='Contact flash pool';this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 emit(position,{heavy=false,special=false,guarded=false,radius,duration}={}){
  const index=this.cursor++%this.capacity,p=this.records[index],a=this.attributes;
  p.life=p.duration=duration??(special?.38:heavy?.32:.26);p.size=radius??(special?2.6:heavy?1.65:1.25);
  a.center.setXYZ(index,position.x,position.y,position.z);a.radius.setX(index,p.size);a.age.setX(index,0);a.rotation.setX(index,Math.random()*Math.PI*2);a.guard.setX(index,guarded?1:0);
  for(const attribute of Object.values(a))attribute.needsUpdate=true;
 }
 update(dt,calm=false){
  this.active=0;
  for(let i=0;i<this.capacity;i++){
   const p=this.records[i];p.life=Math.max(0,p.life-dt*(calm?4:1));const age=1-p.life/p.duration;
   this.attributes.age.setX(i,age);this.attributes.radius.setX(i,p.size*(1+age*.45));if(p.life>0)this.active++;
  }
  this.attributes.age.needsUpdate=true;this.attributes.radius.needsUpdate=true;
 }
 clear(){for(const p of this.records)p.life=0;this.active=0;this.attributes.age.array.fill(1);this.attributes.age.needsUpdate=true;}
}
