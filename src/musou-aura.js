import * as THREE from 'three';

// Persistent, bounded geometry makes the whole ultimate readable between cuts.
// These three draws do not allocate particles or lights during an attack.
export class MusouAura {
 constructor(scene){
  this.root=new THREE.Group();this.root.name='Musou red fire and aura';this.root.visible=false;scene.add(this.root);
  this.active=false;this.strength=0;this.uniforms={clock:{value:0},strength:{value:0},motion:{value:1}};
  const material=(vertexShader,fragmentShader,blending=THREE.NormalBlending)=>new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending});
  const output=`#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
  const fire=new THREE.InstancedBufferGeometry();
  fire.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));fire.setIndex([0,1,2,2,1,3]);
  fire.setAttribute('seed',new THREE.InstancedBufferAttribute(Float32Array.from({length:28},(_,i)=>i),1));fire.instanceCount=28;
  const flames=new THREE.Mesh(fire,material(`
   uniform float clock,motion;attribute float seed;varying vec2 flameUv;varying float phase;
   void main(){
    phase=seed*2.39996;float t=clock*motion;
    float angle=phase+t*(.35+mod(seed,3.)*.11),radius=.72+mod(seed,4.)*.17;
    vec3 center=vec3(sin(angle)*radius,.04,cos(angle)*radius);
    float height=.95+mod(seed,5.)*.31+.15*sin(t*3.+phase);
    vec4 p=modelViewMatrix*vec4(center,1.);
    p.x+=(position.x*(.17+mod(seed,3.)*.05)+sin(position.y*5.+t*3.+phase)*.11*position.y);
    p.y+=position.y*height;gl_Position=projectionMatrix*p;flameUv=position.xy;
   }`, `
   uniform float clock,strength,motion;varying vec2 flameUv;varying float phase;
   void main(){
    float y=flameUv.y,x=flameUv.x,t=clock*motion;
    float width=(1.-y)*(.75+.22*sin(y*13.-t*5.+phase));
    float body=1.-smoothstep(width*.18,width,abs(x));
    float fade=sin(clamp(y,0.,1.)*3.14159)*(.72+.28*sin(phase+t*4.-y*8.));
    float core=pow(max(0.,1.-abs(x)*3.),3.)*(1.-y);
    gl_FragColor=vec4(vec3(1.5,.005+core*.06,.003),body*fade*strength*.88);
    ${output}
   }`));flames.name='Continuous crimson flames';flames.frustumCulled=false;this.root.add(flames);
  const points=[],uv=[],indices=[];
  for(let band=0;band<3;band++)for(let i=0;i<=48;i++)for(let edge=0;edge<2;edge++){
   points.push(i/48,edge*2-1,band);uv.push(i/48,edge);
   if(i<48&&edge===0){const a=band*98+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
  }
  const streaks=new THREE.BufferGeometry();streaks.setAttribute('position',new THREE.Float32BufferAttribute(points,3));streaks.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));streaks.setIndex(indices);
  const ribbons=new THREE.Mesh(streaks,material(`
   uniform float clock,motion;varying vec2 streakUv;
   void main(){float u=position.x,band=position.z,t=clock*motion;
    float angle=u*4.6+band*2.0944-t*2.3,rad=1.05+sin(u*3.14159)*.32+position.y*.075;
    vec3 p=vec3(sin(angle)*rad,.14+u*2.35,cos(angle)*rad);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);streakUv=uv;
   }`, `
   uniform float strength;varying vec2 streakUv;
   void main(){float edge=pow(max(0.,1.-abs(streakUv.y*2.-1.)),1.8);
    float tail=sin(streakUv.x*3.14159);
    gl_FragColor=vec4(vec3(2.2,.007+edge*.025,.004),strength*edge*tail*.9);
    ${output}
   }`));ribbons.name='Rising red energy streaks';ribbons.frustumCulled=false;this.root.add(ribbons);
  const halo=new THREE.Mesh(new THREE.RingGeometry(.48,1.55,64,3),material(`
   varying vec2 ringPoint;void main(){ringPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `, `
   uniform float clock,strength,motion;varying vec2 ringPoint;
   void main(){float r=length(ringPoint),angle=atan(ringPoint.y,ringPoint.x);
    float edge=exp(-pow((r-1.13)*9.,2.))*.65+exp(-pow((r-.8)*3.,2.))*.16;
    float shimmer=.7+.3*sin(angle*11.-clock*motion*2.);
    gl_FragColor=vec4(vec3(1.5,.004,.002),strength*edge*shimmer);
    ${output}
   }`));halo.name='Musou ground glow';halo.rotation.x=-Math.PI/2;halo.position.y=.07;this.root.add(halo);
 }
 set(position,active,reducedMotion=false){this.active=active;this.uniforms.motion.value=reducedMotion?.2:1;if(active)this.root.position.copy(position);}
 update(dt,calm=false){
  if(calm)this.active=false;
  this.strength=THREE.MathUtils.clamp(this.strength+dt*(this.active?12:-5),0,1);
  this.uniforms.clock.value+=dt;this.uniforms.strength.value=this.strength;
  this.root.visible=this.strength>0;
 }
 clear(){this.active=false;this.strength=this.uniforms.strength.value=0;this.root.visible=false;}
}
