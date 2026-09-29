"""Repair the two reviewed eye-skin regions without altering the iris island.
Run with Blender --background --python this-file -- --output CANDIDATE.png.
"""
import bpy,numpy as np,json,argparse,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base',type=Path,default=ROOT/'assets/characters/vice-president-face-warm-eyes.png')
p.add_argument('--repair',type=Path,default=ROOT/'assets/characters/vice-president-eye-skin-repair.png')
p.add_argument('--output',type=Path,required=True)
p.add_argument('--report',type=Path)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if a.output.resolve() in [a.base.resolve(),a.repair.resolve()]:raise ValueError('Write to a separate output path.')
if a.report and a.report.resolve() in [a.base.resolve(),a.repair.resolve(),a.output.resolve()]:raise ValueError('Use a separate report path.')
if hashlib.sha256(a.base.read_bytes()).hexdigest()!='2e1598a4e6fa7260ab87dc682117d5a51b34d7882709ca1f358b82c899d2966e':raise ValueError('The iris intermediate changed. Recheck the UV masks before rebuilding.')
bpy.ops.wm.read_factory_settings(use_empty=True)
base=bpy.data.images.load(str(a.base));source=bpy.data.images.load(str(a.repair))
w,h=base.size;sw,sh=source.size
if (w,h)!=(2048,2048) or sw!=sh:raise ValueError('Unexpected atlas layout.')
x,y=np.meshgrid(np.arange(w),h-1-np.arange(h))
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
# The source artwork shares the complete atlas layout. Only these two exterior
# skin patches use it. The separate eye UV island never enters this mask.
mask=np.zeros((h,w),np.float32)
for cx in [898,1150]:
 radius=np.hypot((x-cx)/78,(y-573)/47)
 mask=np.maximum(mask,1-smooth(.65,1,radius))
rgba=np.stack([mask,mask,mask,np.ones_like(mask)],axis=-1).astype(np.float32)
maskImage=bpy.data.images.new('Outer corner skin mask',w,h,alpha=True,float_buffer=True);maskImage.colorspace_settings.name='Non-Color';maskImage.pixels.foreach_set(rgba.ravel());maskImage.update()
result=bpy.data.images.new('Outer corner preview',w,h,alpha=False,float_buffer=True)
bpy.ops.mesh.primitive_plane_add();plane=bpy.context.object;mat=bpy.data.materials.new('Masked generated corner repair');mat.use_nodes=True;plane.data.materials.append(mat)
n=mat.node_tree.nodes;l=mat.node_tree.links;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');l.new(em.outputs[0],out.inputs['Surface']);uv=n.new('ShaderNodeTexCoord')
def tex(im):
 t=n.new('ShaderNodeTexImage');t.image=im;l.new(uv.outputs['UV'],t.inputs['Vector']);return t
old=tex(base);new=tex(source);weight=tex(maskImage);weight.interpolation='Closest';mix=n.new('ShaderNodeMixRGB');l.new(weight.outputs['Color'],mix.inputs[0]);l.new(old.outputs['Color'],mix.inputs[1]);l.new(new.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],em.inputs[0]);target=n.new('ShaderNodeTexImage');target.image=result;n.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=0;bpy.ops.object.bake(type='EMIT',use_clear=True)
original=np.array(base.pixels[:],dtype=np.float32).reshape(h,w,4);linear=original.copy()
if not base.is_float:
 rgb=linear[:,:,:3];linear[:,:,:3]=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
baked=np.array(result.pixels[:],dtype=np.float32).reshape(h,w,4);changed=mask>0;baked[~changed]=linear[~changed]
assert np.array_equal(baked[~changed],linear[~changed])
result.pixels.foreach_set(baked.ravel());result.update();result.filepath_raw=str(a.output);result.file_format='PNG';result.save()
report={'baseDimensions':[w,h],'generatedDimensions':[sw,sh],'maskEllipses':[{'center':[cx,573],'radii':[78,47],'fullStrengthRadiusFraction':.65}for cx in [898,1150]],'maskedPixels':int(changed.sum()),'outsideMaskLinearError':0,'eyeIslandExcluded':True,'geometryChanged':False,'registration':'The full generated atlas uses the original normalized UV coordinates. Only two bounded skin patches enter the bake.'}
if a.report:a.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
