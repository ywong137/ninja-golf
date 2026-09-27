import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
    this.renderer=renderer;this.scene=scene;this.camera=camera;
    this.composer=new EffectComposer(renderer);this.composer.renderTarget1.samples=4;this.composer.renderTarget2.samples=4;
    this.composer.addPass(new RenderPass(scene,camera));
    this.contact=new ContactPass(scene,camera,innerWidth,innerHeight);
    this.contact.updateGtaoMaterial({radius:.75,thickness:.7,distanceFallOff:1,samples:8});
    this.contact.updatePdMaterial({radius:5,samples:8});this.contact.blendIntensity=.8;
    this.composer.addPass(this.contact);this.composer.addPass(new OutputPass());
    this.resize();renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;
  }
  resize(){this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(innerWidth,innerHeight);}
  render(quality){this.renderer.info.reset();this.renderer.shadowMap.needsUpdate=true;if(quality==='low')this.renderer.render(this.scene,this.camera);else this.composer.render();}
}
