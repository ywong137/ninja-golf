import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Vector2,Vector3 } from 'three';
import {PortraitCutaway} from './portrait-cutaway.js';

class ContactPass extends GTAOPass {
  setSize(width,height){super.setSize(Math.max(1,Math.round(width*.65)),Math.max(1,Math.round(height*.65)));}
  _overrideVisibility(){
    super._overrideVisibility();
    // Cutout foliage and translucent effects need their own depth shaders. They do
    // not enter this surface-only pass, so branch cards cannot leave dark rectangles.
    this.scene.traverse(o=>{const m=o.material;if(o.visible&&m&&(m.alphaTest>0||m.transparent||m.isShaderMaterial)){o.visible=false;this._visibilityCache.push(o);}});
  }
}
export class Rendering {
  constructor(renderer,scene,camera){
    this.renderer=renderer;this.scene=scene;this.camera=camera;this.cutaway=new PortraitCutaway();this.portraitFocus=new Vector3();this.portraitRoots=null;
    this.composer=new EffectComposer(renderer);this.composer.renderTarget1.samples=4;this.composer.renderTarget2.samples=4;
    this.composer.addPass(new RenderPass(scene,camera));
    this.contact=new ContactPass(scene,camera,innerWidth,innerHeight);
    this.contact.updateGtaoMaterial({radius:.75,thickness:.7,distanceFallOff:1,samples:8});
    this.contact.updatePdMaterial({radius:5,samples:8});this.contact.blendIntensity=.8;
    this.composer.addPass(this.contact);this.bloom=new UnrealBloomPass(new Vector2(innerWidth,innerHeight),.32,.55,1.05);this.bloom.materialHighPassFilter.fragmentShader=this.bloom.materialHighPassFilter.fragmentShader.replace('float v = luminance( texel.xyz );','texel.rgb=min(texel.rgb,vec3(6.));float v = luminance( texel.xyz );');this.bloom.enabled=false;this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.resize();renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;
  }
  resize(){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(innerWidth,innerHeight);}
  preparePortrait(roots,lights){
    const target=this.renderer.getRenderTarget(),visible=lights.visible;
    const focus=this.camera.getWorldDirection(new Vector3()).add(this.camera.position);
    lights.visible=true;
    try{
      // compileAsync submits its shader variants synchronously, then waits for
      // GPU compilation. Restore scene state before another frame can draw.
      const pending=this.cutaway.withClippedScenery(this.renderer,this.camera,focus,roots,()=>{
        const jobs=[];
        for(const destination of [null,this.composer.readBuffer]){
          this.renderer.setRenderTarget(destination);
          jobs.push(this.renderer.compileAsync(this.scene,this.camera));
        }
        return jobs;
      });
      return Promise.all(pending);
    }finally{this.renderer.setRenderTarget(target);lights.visible=visible;}
  }
  setPortrait(focus,roots){this.portraitRoots=focus?roots:null;if(focus)this.portraitFocus.copy(focus);}
  render(quality){
    this.renderer.info.reset();this.renderer.shadowMap.needsUpdate=true;
    // Avoid drawing every skinned crowd member a third time in Balanced mode.
    // Separate thresholds keep the pass stable as waves enter and leave.
    const crowd=this.scene.userData.crowdCount||0;
    if(quality==='high'||crowd<24)this.contact.enabled=true;else if(crowd>32)this.contact.enabled=false;
    this.bloom.enabled=this.scene.userData.courseTheme==='cyberpunk'||!!this.scene.userData.musou;this.bloom.strength=this.scene.userData.musou?.45:.32;this.bloom.threshold=this.scene.userData.musou?3.5:1.05;
    const draw=()=>{if(quality==='low')this.renderer.render(this.scene,this.camera);else this.composer.render();};
    if(this.portraitRoots){
      // The AO override shader cannot use each scenery material's cutaway plane.
      // Dedicated portrait lighting supplies the face's close-up shading.
      const contactEnabled=this.contact.enabled;this.contact.enabled=false;
      try{this.cutaway.withClippedScenery(this.renderer,this.camera,this.portraitFocus,this.portraitRoots,draw);}
      finally{this.contact.enabled=contactEnabled;}
    }else draw();
  }
}
