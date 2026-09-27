// Apply once, before scaling or rotating a box into world space.
export function scaleBoxUV(geometry,width,height,depth,metersPerRepeat=1.25){
 if(![width,height,depth,metersPerRepeat].every(v=>Number.isFinite(v)&&v>0))throw new Error('Box UV dimensions and metersPerRepeat must be positive finite numbers');
 const uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
 if(!uv||!normal||uv.count!==normal.count)throw new Error('Box UV scaling requires matching uv and normal attributes');
 for(let i=0;i<uv.count;i++){
  const x=Math.abs(normal.getX(i)),y=Math.abs(normal.getY(i)),z=Math.abs(normal.getZ(i));
  const u=x>y&&x>z?depth:width,v=y>x&&y>z?depth:height;
  uv.setXY(i,uv.getX(i)*u/metersPerRepeat,uv.getY(i)*v/metersPerRepeat);
 }
 uv.needsUpdate=true;return geometry;
}
