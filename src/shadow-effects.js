import * as T from 'three';
export function shadowBurst(effects,position,color,{appear=false}={}){
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:.9},age:{value:0},tint:{value:new T.Color(color)}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);vec2 size=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));p.xy+=position.xy*size;gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float opacity,age;uniform vec3 tint;varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 void main(){vec2 p=(vUv-.5)*2.;float n=noise(p*4.+vec2(age,-age)*1.5)*.65+noise(p*9.)*.35;float r=length(p*vec2(1.,.8));float a=(1.-smoothstep(.28,.9,r+.2*n))*(.55+.45*n)*opacity;
 vec3 c=mix(vec3(.015,.025,.045),tint*.6,smoothstep(.35,.76,r)*.75);gl_FragColor=vec4(c,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const cloud=new T.Mesh(new T.PlaneGeometry(3.4,4.2),material);cloud.position.copy(position);cloud.position.y+=1.35;cloud.name='Shadow step smoke';cloud.renderOrder=2;effects.scene.add(cloud);effects.items.push({m:cloud,life:.38,max:.38,peak:.9,growth:2,flash:true});
 if(appear)effects.impacts.emit(position.clone().add(new T.Vector3(0,1,0)),new T.Vector3(0,.2,0),{heavy:true,guarded:true});
 effects.ribbonTracks.clear();
}

export function shadowWave(effects,position,yaw,reach,arc,color){
 const geometry=new T.RingGeometry(.86,1,64,1,-arc,2*arc),material=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(3),transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending});
 const wave=new T.Mesh(geometry,material);wave.name='Shadow storm cutting wave';wave.rotation.set(-Math.PI/2,0,yaw-Math.PI/2);wave.position.copy(position);wave.position.y+=1.15;wave.scale.setScalar(.8);effects.scene.add(wave);effects.items.push({m:wave,life:.24,max:.24,peak:.7,shockwave:reach});
}
