import {ImpactParticles} from './impact-particles.js';
import * as THREE from 'three';
const PALETTE=['#ffe1a0','#c9d9af','#ee557d','#9ee4ff','#dcc294'];
const TRAIL_HANDS=[[],['r'],['l'],['r','l']].map(Object.freeze);
export function activeBladeTrailHands(action,hasOffhand){
  let mask=0;
  for(let i=0;i<action.hits.length;i++){
    if(Math.abs(action.time-action.hits[i])>=.105)continue;
    const hand=action.impactHands?.[i]??(hasOffhand?'both':'r');
    if(!['r','l','both'].includes(hand))throw Error(`Unknown attack hand: ${hand}`);
    if(hand==='r'||hand==='both')mask|=1;
    if(hasOffhand&&(hand==='l'||hand==='both'))mask|=2;
  }
  return TRAIL_HANDS[mask];
}
// Particles share one draw call. Blade ribbons use a separate dynamic mesh.
export function telegraphGeometry(position,yaw,reach,type,groundHeight){
  const arc=type==='thrust'?.48:1.15,outer=type==='ranged'?.78:reach+.3;
  const geo=new THREE.RingGeometry(type==='ranged'?.55:.05,outer,32,8,-arc,arc*2);
  const attr=geo.attributes.position,coverage=new Float32Array(attr.count),sin=Math.sin(yaw),cos=Math.cos(yaw);
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),y=attr.getY(i),forward=x,side=y;
    const wx=position.x+sin*forward+cos*side,wz=position.z+cos*forward-sin*side;
    attr.setXYZ(i,wx,(groundHeight?groundHeight(wx,wz):position.y)+.085,wz);
    coverage[i]=Math.min(1,(arc-Math.abs(Math.atan2(y,x)))/.16,(outer-Math.hypot(x,y))/.35);
  }
  geo.setAttribute('coverage',new THREE.BufferAttribute(coverage,1));geo.computeVertexNormals();return geo;
}
export class Effects {
  constructor(scene,groundHeight){
    this.groundHeight=groundHeight;this.impacts=new ImpactParticles(scene);
    this.scene=scene;this.items=[];this.ribbonTracks=new Map();this.ribbonSamples=[];this.elapsed=0;this.capacity=4096;this.cursor=0;this.particles=Array.from({length:this.capacity},()=>({life:0,v:new THREE.Vector3()}));
    this.positions=new Float32Array(this.capacity*3);this.colors=new Float32Array(this.capacity*3);this.sizes=new Float32Array(this.capacity);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));geometry.setAttribute('size',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,vertexShader:`attribute float size; varying vec3 tint; void main(){tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*650./max(1.,-p.z),0.,50.);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 tint; void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,pow(1.-d,1.6));}`});
    this.points=new THREE.Points(geometry,material);this.points.frustumCulled=false;scene.add(this.points);this.palette=PALETTE.map(x=>new THREE.Color(x));
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(96*18),3).setUsage(THREE.DynamicDrawUsage));rg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(96*18),3));rg.setAttribute('alpha',new THREE.BufferAttribute(new Float32Array(96*6),1));rg.setDrawRange(0,0);
    const rm=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:`attribute float alpha;varying float opacity;varying vec3 tint;void main(){opacity=alpha;tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying float opacity;varying vec3 tint;void main(){gl_FragColor=vec4(tint,opacity);}`});
    this.ribbon=new THREE.Mesh(rg,rm);this.ribbon.frustumCulled=false;scene.add(this.ribbon);
  }
  particle(position,velocity,life,size,kind){const i=this.cursor++%this.capacity,p=this.particles[i];p.life=p.max=life;p.size=size;p.v.copy(velocity);position.toArray(this.positions,i*3);this.palette[kind].toArray(this.colors,i*3);this.points.geometry.attributes.color.needsUpdate=true;}
  burst(position,count=12,power=4,kind=0){for(let i=0;i<count;i++)this.particle(position,new THREE.Vector3((Math.random()-.5)*power,Math.random()*power*.8,(Math.random()-.5)*power),.35+Math.random()*.55,.07+Math.random()*.16,kind);}
  hit(position,direction,options={}){this.impacts.emit(position,direction,options);this.explosion(position.clone().add(new THREE.Vector3(0,-.8,0)),options.heavy?.36:.23,{debris:false});}
  explosion(position,scale=1,{debris=true}={}){
    const center=position.clone().add(new THREE.Vector3(0,.8,0));if(debris){this.burst(center,Math.round(48*scale),12*scale,0);this.burst(center,Math.round(24*scale),9*scale,2);}
    const material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{tint:{value:new THREE.Color('#ffe8b8')},opacity:{value:.7}},
      vertexShader:`varying vec2 flashUv;
        void main(){
          flashUv=uv;
          vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);
          vec2 scale=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
          center.xy+=position.xy*scale;
          gl_Position=projectionMatrix*center;
        }`,
      fragmentShader:`uniform vec3 tint;uniform float opacity;varying vec2 flashUv;
        void main(){
          vec2 p=(flashUv-.5)*2.;float r2=dot(p,p);
          float core=exp(-r2*105.);
          float halo=.2*exp(-r2*7.);
          float edge=1.-smoothstep(.75,1.,sqrt(r2));
          gl_FragColor=vec4(tint*1.5,(core+halo)*opacity*edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(4*scale,4*scale),material);
    m.name='Soft impact flash';m.position.copy(center);this.scene.add(m);
    this.items.push({m,life:.22,max:.22,peak:.6,growth:3,flash:true});
  }
  flourish(position,beat,color,style,{final=false}={}){
    this.impacts.emit(position.clone().add(new THREE.Vector3(0,1.2,0)),new THREE.Vector3(Math.sin(beat),.1,Math.cos(beat)),{heavy:true,special:true,guarded:true});
    for(let i=0;i<3;i++){
      const radius=2.4+i*1.3,m=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.12,64,1,-2.1,4.2),new THREE.MeshBasicMaterial({color:i===1?'#fff1b2':color,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      m.position.copy(position).add(new THREE.Vector3(0,style==='sickle'?.6:1.25,0));m.rotation.set(-Math.PI/2+(i-1)*(style==='fan'?.95:.65),beat*1.07,i*.7+beat*.95);this.scene.add(m);this.items.push({m,life:.5,max:.5,peak:.48,growth:style==='ring'?3:2.1});
    }
    for(let i=0;i<100;i++){const angle=i*2.39996+beat,r=1+Math.random()*4,p=position.clone().add(new THREE.Vector3(Math.sin(angle)*r,.5+Math.random()*2,Math.cos(angle)*r));this.particle(p,new THREE.Vector3(Math.sin(angle)*9,2+Math.random()*7,Math.cos(angle)*9),.5+Math.random()*.45,.10+Math.random()*.15,i%3===0?2:0);}
    if(final)this.explosion(position,2);
  }
  trail(a,b,kind=0,token=0,channel=0){
    if(token!==this.trailToken){this.ribbonTracks.clear();this.trailToken=token;}
    let samples=this.ribbonTracks.get(channel)||[];const previous=samples.at(-1);if(previous&&(this.elapsed-previous.time>.09||previous.b.distanceTo(b)>7))samples=[];
    samples.push({a:a.clone().lerp(b,kind===2?.68:.84),b:b.clone(),kind,time:this.elapsed});if(samples.length>45)samples.shift();this.ribbonTracks.set(channel,samples);
    this.particle(b,new THREE.Vector3(0,.1,0),.13,.045,kind);
  }
  telegraph(position,yaw,reach,duration,type){
    const geo=telegraphGeometry(position,yaw,reach,type,this.groundHeight);
    const mat=new THREE.MeshBasicMaterial({color:type==='ranged'?'#edcc83':'#e96d47',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
    mat.onBeforeCompile=s=>{s.vertexShader='attribute float coverage;varying float edgeCoverage;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nedgeCoverage=coverage;');s.fragmentShader='varying float edgeCoverage;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=clamp(edgeCoverage,0.,1.);');};
    const m=new THREE.Mesh(geo,mat);m.name='Combat telegraphs';
    this.scene.add(m);this.items.push({m,life:duration,max:duration,telegraph:true});
  }
  slash(position,yaw,special=false,{style,reach=special?8:4.6,arc=Math.PI*.7,color}={}){
    const radius=Math.min(reach,special?8:6),sweep=Math.min(Math.PI,arc),g=new THREE.RingGeometry(radius-.24,radius,56,1,-sweep,sweep*2);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:style?color:special?'#efb5ff':'#ffedb3',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    m.rotation.set(-Math.PI/2,style==='ring'?.38:.12,yaw-Math.PI/2);m.position.copy(position);m.position.y+=style==='sickle'?.55:1.2;this.scene.add(m);this.items.push({m,life:.24,max:.24,peak:.45});
    if(style==='fan'){
      for(let i=0;i<18;i++){const a=yaw-sweep+sweep*2*i/17;this.particle(m.position,new THREE.Vector3(Math.sin(a)*9,1+Math.random()*3,Math.cos(a)*9),.3+Math.random()*.2,.1,i%3===0?2:0);}
    }else this.burst(m.position,special?80:20,special?17:7,special?2:0);
  }
  update(dt,calm=false){
    this.impacts.update(dt,calm);this.elapsed+=dt;for(const [key,samples]of this.ribbonTracks)this.ribbonTracks.set(key,samples.filter(s=>this.elapsed-s.time<.18&&!calm));
    const rg=this.ribbon.geometry;let n=0;for(const samples of this.ribbonTracks.values())for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];for(const [sample,point] of [[a,a.a],[a,a.b],[b,b.b],[a,a.a],[b,b.b],[b,b.a]]){point.toArray(rg.attributes.position.array,n*3);this.palette[sample.kind].toArray(rg.attributes.color.array,n*3);rg.attributes.alpha.array[n++]=Math.max(0,1-(this.elapsed-sample.time)/.18)*.24*(point===sample.a?0:1);}}
    rg.setDrawRange(0,n);Object.values(rg.attributes).forEach(a=>a.needsUpdate=true);
    for(let i=0;i<this.capacity;i++){const p=this.particles[i];if(p.life<=0)continue;p.life-=dt*(calm?3:1);p.v.y-=6*dt;const j=i*3;this.positions[j]+=p.v.x*dt;this.positions[j+1]+=p.v.y*dt;this.positions[j+2]+=p.v.z*dt;this.sizes[i]=Math.max(0,p.life/p.max)*p.size;}this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.size.needsUpdate=true;for(let i=this.items.length-1;i>=0;i--){const p=this.items[i];p.life-=dt*(calm?3:1);if(p.life<=0){this.scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();this.items.splice(i,1);}else{p.m.material.opacity=p.telegraph?.12+(1-p.life/p.max)*.18:p.life/p.max*(p.peak||.32);if(p.flash)p.m.material.uniforms.opacity.value=p.m.material.opacity;if(!p.telegraph)p.m.scale.multiplyScalar(1+dt*(p.growth||3));}}}
  clear(){this.impacts.clear();for(const p of this.items){this.scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();}this.items=[];this.ribbonTracks.clear();this.ribbonSamples=[];this.ribbon.geometry.setDrawRange(0,0);this.particles.forEach(p=>p.life=0);this.sizes.fill(0);this.points.geometry.attributes.size.needsUpdate=true;}
}
