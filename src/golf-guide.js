import * as THREE from 'three';
import {heightAt,greenDistance,launchShot,lieAt} from './course.js';
// Predict only the first landing. Bounce, roll, and random dispersion still belong to the shot.
export function previewShot(course,club,warrior,lie,power,aim,origin){
 const v=launchShot(club,warrior,lie,power,aim),p={...origin},points=[{...p}],h=1/30;
 if(club.short==='PT'){
  for(let i=0;i<360;i++){p.x+=v.x*h;p.z+=v.z*h;p.y=heightAt(course,p.x,p.z)+.15;const speed=Math.hypot(v.x,v.z),next=Math.max(0,speed-.95*h);if(next<.1){points.push({...p});break;}v.x*=next/speed;v.z*=next/speed;v.x-=(heightAt(course,p.x+.3,p.z)-heightAt(course,p.x-.3,p.z))/.6*5*h;v.z-=(heightAt(course,p.x,p.z+.3)-heightAt(course,p.x,p.z-.3))/.6*5*h;if(i%4===0)points.push({...p});}
 }else for(let i=0;i<600;i++){v.y-=9.81*h;v.x+=course.wind[0]*.22*h;v.z+=course.wind[1]*.22*h;p.x+=v.x*h;p.y+=v.y*h;p.z+=v.z*h;const ground=Math.max(heightAt(course,p.x,p.z)+.15,lieAt(course,p.x,p.z)==='Water'?3.15:-99);if(p.y<ground){p.y=ground;points.push({...p});break;}if(i%3===0)points.push({...p});}
 return{points,landing:p,lie:lieAt(course,p.x,p.z),distance:Math.hypot(p.x-origin.x,p.z-origin.z)};
}
export class PuttingGuide {
 constructor(scene){
  this.root=new THREE.Group();scene.add(this.root);this.root.visible=false;
  this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#def0c1',transparent:true,opacity:.22,depthWrite:false}));this.root.add(this.lines);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`uniform float time;attribute vec2 downhill;varying float opacity;void main(){vec3 p=position;p.xz+=downhill*fract(time*.4);opacity=.22;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.5;}`,fragmentShader:`varying float opacity;void main(){if(length(gl_PointCoord-.5)>.5)discard;gl_FragColor=vec4(.96,.88,.59,opacity);}`});
  this.dots=new THREE.Points(new THREE.BufferGeometry(),mat);this.root.add(this.dots);
 }
 build(course){
  const positions=[],dots=[],directions=[],segment=(x,z,xx,zz)=>{positions.push(x,heightAt(course,x,z)+.04,z,xx,heightAt(course,xx,zz)+.04,zz);};
  for(let z=course.length-18;z<=course.length+18;z+=2)for(let x=course.greenX-18;x<=course.greenX+18;x+=2){if(greenDistance(course,x,z)>16)continue;if(greenDistance(course,x+2,z)<17)segment(x,z,x+2,z);if(greenDistance(course,x,z+2)<17)segment(x,z,x,z+2);dots.push(x,heightAt(course,x,z)+.055,z);const dx=(heightAt(course,x+.3,z)-heightAt(course,x-.3,z))/.6,dz=(heightAt(course,x,z+.3)-heightAt(course,x,z-.3))/.6;directions.push(-dx*70,-dz*70);}
  this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.dots.geometry.dispose();this.dots.geometry=new THREE.BufferGeometry();this.dots.geometry.setAttribute('position',new THREE.Float32BufferAttribute(dots,3));this.dots.geometry.setAttribute('downhill',new THREE.Float32BufferAttribute(directions,2));
 }
 update(time,visible){this.root.visible=visible;this.dots.material.uniforms.time.value=time;}
}
