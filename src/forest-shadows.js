import * as THREE from 'three';

// The atlas projects the scanned tree along SUN_DIRECTION from lighting.js.
// Its eight bounds already include tree rotation. Do not rotate the projected quad again.
export const FOREST_SHADOW_GRID=4;
export function forestShadowGeometry(records,source,height,{grid=FOREST_SHADOW_GRID}={}){
 if(!source.shadowMap||source.shadowViews?.length!==8)throw new Error('Forest grounding requires the eight baked sun silhouettes.');
 if(!Number.isInteger(grid)||grid<1||grid>8)throw new Error('Forest shadow grid must be an integer from 1 to 8.');
 const positions=[],uvs=[],bounds=[],indices=[],n=grid;
 for(const p of records){
  const view=((Math.round(p.angle/(Math.PI*2)*8)%8)+8)%8;
  const box=source.shadowViews[view];
  if(box.length!==4||!box.every(Number.isFinite)||box[2]<=box[0]||box[3]<=box[1])throw new Error(`Invalid forest shadow bounds for view ${view}.`);
  const [minX,minZ,maxX,maxZ]=box,base=positions.length/3,u0=(view%4)/4,v0=(1-Math.floor(view/4))/2;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
   const x=p.x+(minX+(maxX-minX)*i/n)*p.scale,z=p.z+(minZ+(maxZ-minZ)*j/n)*p.scale,y=height(x,z);
   if(!Number.isFinite(y))throw new Error('Forest shadow terrain sampler returned a non-finite height.');
   positions.push(x,y+.055,z);uvs.push(u0+i/n/4,v0+(1-j/n)/2);bounds.push(u0+.5/2048,v0+.5/1024,u0+.25-.5/2048,v0+.5-.5/1024);
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=base+j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('atlasBounds',new THREE.Float32BufferAttribute(bounds,4));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
export function forestShadowMaterial(map){
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,fog:true,
  uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),map:{value:map},opacity:{value:.33}},
  vertexShader:`attribute vec4 atlasBounds;varying vec2 shadowUV;varying vec4 tileBounds;
   #include <fog_pars_vertex>
   void main(){shadowUV=uv;tileBounds=atlasBounds;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform sampler2D map;uniform float opacity;varying vec2 shadowUV;varying vec4 tileBounds;
   #include <fog_pars_fragment>
   float coverage(vec2 p){return texture2D(map,clamp(p,tileBounds.xy,tileBounds.zw)).a;}
   void main(){vec2 pixel=vec2(2.2/2048.,2.2/1024.);float a=coverage(shadowUV)*.4;
    a+=coverage(shadowUV+pixel)*.15+coverage(shadowUV-pixel)*.15;
    a+=coverage(shadowUV+vec2(pixel.x,-pixel.y))*.15+coverage(shadowUV+vec2(-pixel.x,pixel.y))*.15;
    a*=opacity;
    #ifdef USE_FOG
     #ifdef FOG_EXP2
      a*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
     #else
      a*=1.-smoothstep(fogNear,fogFar,vFogDepth);
     #endif
    #endif
    if(a<.003)discard;gl_FragColor=vec4(.018,.024,.012,a);
   }`});
}
export function buildForestShadows(records,source,height,options){
 const mesh=new THREE.Mesh(forestShadowGeometry(records,source,height,options),forestShadowMaterial(source.shadowMap));
 mesh.name='Distant forest ground silhouettes';mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
}
