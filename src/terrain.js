import * as THREE from 'three';
// Course boundaries use the same analytic shapes as lieAt. They stay crisp at any mesh resolution.
export function courseMaterial(c, textures) {
  const mat=new THREE.MeshStandardMaterial({map:textures.grassColor,normalMap:textures.grassNormal,normalScale:new THREE.Vector2(.36,.36),roughness:.96});
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{courseWeave:{value:c.weave||0},courseCoastal:{value:c.coastal===false?0:1},courseTheme:{value:({japanese:0,highlands:1,desert:2,cyberpunk:3})[c.theme]||0},courseShape:{value:new THREE.Vector4(c.length,c.bend,c.greenX,c.width)},sandColor:{value:textures.sandColor},sandNormal:{value:textures.sandNormal},bunkers:{value:[...c.bunkers.map(b=>new THREE.Vector4(...b)),...Array.from({length:4-c.bunkers.length},()=>new THREE.Vector4(9999,9999,1,1))]}});
    shader.vertexShader='varying vec3 terrainPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`varying vec3 terrainPosition;uniform sampler2D sandColor;uniform sampler2D sandNormal;uniform vec4 bunkers[4];uniform vec4 courseShape;uniform float courseWeave;uniform float courseCoastal;uniform float courseTheme;
      float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 p=terrainPosition.xz;
      float sandMask=0.;for(int i=0;i<4;i++){vec4 b=bunkers[i];sandMask=max(sandMask,1.-smoothstep(.985,1.015,length((p-b.xy)/b.zw)));}
      float t=clamp(p.y/courseShape.x,0.,1.);float cx=sin(t*3.14159265)*courseShape.y+courseShape.z*t+courseWeave*sin(t*6.2831853);
      float width=courseShape.w*(.84+.18*sin(p.y*.031));
      float edge=abs(p.x-cx)-width;float extent=smoothstep(-13.,-11.,p.y)*(1.-smoothstep(courseShape.x+5.,courseShape.x+7.,p.y));
      float fairway=(1.-smoothstep(-.2,.2,edge))*extent;
      float firstCut=(1.-smoothstep(1.8,2.4,edge))*extent;
      float greenDistance=length(vec2((p.x-courseShape.z)/1.05,p.y-courseShape.x));
      float green=1.-smoothstep(16.85,17.15,greenDistance);float collar=1.-smoothstep(18.3,18.8,greenDistance);
      float tee=(1.-smoothstep(4.9,5.1,abs(p.x)))*(1.-smoothstep(6.9,7.1,abs(p.y)));
      fairway=max(fairway,tee);float shortGrass=max(fairway,collar);
      float stripe=smoothstep(-.1,.1,sin((p.y+p.x*.3)*3.14159265/11.));
      vec3 rough=mix(vec3(.080,.135,.038),vec3(.115,.172,.060),groundNoise(p*.06));
      vec3 cut=mix(vec3(.095,.185,.045),vec3(.115,.220,.055),stripe);
      vec3 putting=mix(vec3(.18,.28,.090),vec3(.20,.30,.100),stripe);
      if(courseTheme>.5&&courseTheme<1.5){rough=mix(vec3(.16,.16,.07),vec3(.22,.17,.16),groundNoise(p*.08));cut*=vec3(1.22,1.05,.86);}
      if(courseTheme>1.5&&courseTheme<2.5){rough=texture2D(sandColor,p/5.).rgb*vec3(.74,.48,.30);cut*=vec3(1.15,1.2,.85);}
      if(courseTheme>2.5){rough=mix(vec3(.035,.055,.11),vec3(.065,.08,.17),groundNoise(p*.1));cut=vec3(.04,.24,.21)*mix(.85,1.1,stripe);putting=vec3(.14,.34,.26);}
      vec3 grass=mix(rough,vec3(.090,.175,.046),firstCut);grass=mix(grass,cut,shortGrass);grass=mix(grass,putting,green);
      vec3 closeSample=mix(texture2D(map,p/2.7).rgb,texture2D(map,p/.85).rgb,shortGrass*.72);
      float detail=clamp(dot(closeSample,vec3(.299,.587,.114))*3.1,.65,1.35);
      float macro=.92+.1*groundNoise(p*.18)+.04*groundNoise(p*.75);
      vec3 sand=texture2D(sandColor,p/4.).rgb*.81;
      float rake=.96+.04*sin(p.x*21.+sin(p.y*.3)*3.);sand*=rake;
      float coast=138.+sin(p.y*.014)*28.;float beach=courseCoastal*smoothstep(coast-12.,coast-2.,p.x);
      diffuseColor.rgb=mix(grass*detail*macro,sand,max(sandMask,beach));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 gn=mix(texture2D(normalMap,p/2.7).xyz,texture2D(normalMap,p/.85).xyz,shortGrass*.72)*2.-1.;
      vec3 sn=texture2D(sandNormal,p/4.).xyz*2.-1.;vec3 terrainNormal=mix(gn,sn,max(sandMask,beach));
      terrainNormal.xy*=normalScale*mix(1.,.35,green);normal=normalize(tbn*terrainNormal);`);
  };
  mat.customProgramCacheKey=()=>`course-ground-v2`;
  return mat;
}

export function courseGeometry(c,heightAt,ellipse){
 const vertices=[],normals=[],uv=[],indices=[],extent=c.length+330,nz=Math.round(extent/3),dz=extent/nz;
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<250;ix++){
  const x0=-375+ix*3,z0=c.length/2-extent/2+iz*dz,cx=x0+1.5,cz=z0+dz*.5;
  const detailed=ellipse(cx,cz,c.pond)<1.35||c.bunkers.some(b=>ellipse(cx,cz,b)<1.3)||Math.hypot(cx-c.greenX,cz-c.length)<26;
  const n=detailed?3:1,base=vertices.length/3;
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=x0+x/n*3,pz=z0+z/n*dz;vertices.push(px,heightAt(c,px,pz),pz);const nx=heightAt(c,px-.15,pz)-heightAt(c,px+.15,pz),ny=.3,nzz=heightAt(c,px,pz-.15)-heightAt(c,px,pz+.15),len=Math.hypot(nx,ny,nzz);normals.push(nx/len,ny/len,nzz/len);uv.push((px+375)/750,(pz+extent/2-c.length/2)/extent);}
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=base+z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);return geo;
}
