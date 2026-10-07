// Keep the same Texture object, UV transform, and color space when detail arrives.
// Two background requests leave room for character and course selections.
export class ProgressiveTextures {
 constructor({loader,base,manifest={},warn=console.warn,resumeDelayMs=1800}){
  this.loader=loader;this.base=base;this.manifest=manifest;this.warn=warn;
  this.queue=[];this.active=0;this.started=false;this.holds=0;this.resumeDelayMs=resumeDelayMs;this.resumeAt=0;this.timer=null;
 }
 load(file,onLoad,onError){
  const entry=this.manifest[file];
  if(!entry)return this.loader.load(this.base+file,onLoad,undefined,onError);
  const fullURL=this.base+file+'?v='+entry.sourceSHA256.slice(0,12);
  let texture;
  const replace=full=>{texture.image=full.image;texture.needsUpdate=true;full.dispose();};
  texture=this.loader.load(this.base+entry.file,()=>{
   onLoad?.(texture);
   this.queue.push(()=>new Promise(resolve=>this.loader.load(fullURL,full=>{replace(full);resolve();},undefined,error=>{this.warn(`Full texture unavailable: ${file}; keeping the preview.`,error);resolve();})));
   this.drain();
  },undefined,()=>{
   // A missing preview must never prevent an otherwise valid course from loading.
   this.loader.load(fullURL,full=>{replace(full);onLoad?.(texture);},undefined,onError);
  });
  return texture;
 }
 hold(){
  this.holds++;clearTimeout(this.timer);this.timer=null;let released=false;
  return()=>{if(released)return;released=true;this.holds--;this.resumeAt=performance.now()+this.resumeDelayMs;this.drain();};
 }
 start(){this.started=true;this.drain();}
 drain(){
  if(!this.started||this.holds||!this.queue.length)return;
  const delay=this.resumeAt-performance.now();
  if(delay>0){if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.drain();},delay);return;}
  while(this.active<2&&this.queue.length){
   const job=this.queue.shift();this.active++;
   job().finally(()=>{this.active--;this.drain();});
  }
 }
}
