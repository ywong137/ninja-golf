"""Register an image-generated iris and composite only its annulus in Blender.

Run with Blender --background --python tools/repair-vice-president-iris.py --
  --base-texture assets/characters/vice-president-face-baked.jpg
  --output /tmp/vice-president-warm-eyes.png

The original pupil, catchlights, sclera, and every other atlas region remain intact.
The generated source is artwork. No original photograph enters this operation.
"""
import argparse, json, pathlib, sys
import bpy
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base-texture',type=pathlib.Path,required=True)
p.add_argument('--repair-texture',type=pathlib.Path,default=ROOT/'assets/characters/vice-president-iris-repair.png')
p.add_argument('--output',type=pathlib.Path,required=True)
p.add_argument('--report',type=pathlib.Path)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if a.output.resolve() in [a.base_texture.resolve(),a.repair_texture.resolve()]:p.error('Keep both source images separate from --output.')
if a.output.suffix.lower()!='.png':p.error('--output must use .png so the masked result remains lossless.')
bpy.ops.wm.read_factory_settings(use_empty=True)
base=bpy.data.images.load(str(a.base_texture));source=bpy.data.images.load(str(a.repair_texture))
w,h=base.size;sw,sh=source.size
if (w,h)!=(2048,2048) or (sw,sh)!=(1254,1254):raise ValueError('This registered repair requires the reviewed 2048 base and 1254 generated source.')
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(h,w,4)
# Byte-buffer JPEG pixels use encoded sRGB. Float bake buffers use linear light.
# Convert once before comparing or restoring the untouched source regions.
linear=pixels.copy()
if not base.is_float:
 rgb=linear[:,:,:3];linear[:,:,:3]=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
# Blender image rows start at the bottom. Coordinates below retain the measured
# top-left image convention for reproducible iris registration.
x,y=np.meshgrid(np.arange(w),h-1-np.arange(h));cx,cy=539.2,1910.0
radius=np.hypot(x-cx,y-cy)
def smooth(lo,hi,q):
 t=np.clip((q-lo)/(hi-lo),0,1);return t*t*(3-2*t)
mask=smooth(12,16,radius)*(1-smooth(34,39,radius))
# Preserve the pupil and the original white reflections, including reflections
# which cross the annular mask. Their positions carry the existing gaze cues.
luma=pixels[:,:,:3].mean(axis=2)
mask*=smooth(.003,.015,luma)*(1-smooth(.60,.75,luma))
uvmask=bpy.data.images.new('Registered iris annulus',w,h,alpha=True,float_buffer=True)
rgba=np.stack([mask,mask,mask,np.ones_like(mask)],axis=2).astype(np.float32)
uvmask.colorspace_settings.name='Non-Color';uvmask.pixels.foreach_set(rgba.ravel());uvmask.update()
result=bpy.data.images.new('Ethan brown hazel iris',w,h,alpha=False,float_buffer=True)
bpy.ops.mesh.primitive_plane_add();plane=bpy.context.object
mat=bpy.data.materials.new('Registered iris blend');mat.use_nodes=True;plane.data.materials.append(mat)
nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial');emit=nodes.new('ShaderNodeEmission');links.new(emit.outputs[0],out.inputs['Surface'])
uv=nodes.new('ShaderNodeTexCoord');old=nodes.new('ShaderNodeTexImage');old.image=base;links.new(uv.outputs['UV'],old.inputs['Vector'])
mapping=nodes.new('ShaderNodeMapping');mapping.vector_type='POINT';links.new(uv.outputs['UV'],mapping.inputs['Vector'])
scale=(35/36)*2048/1254
source_uv=(331.6/1254,1-1165.1/1254);target_uv=(cx/2048,1-cy/2048)
mapping.inputs['Scale'].default_value=(scale,scale,1)
mapping.inputs['Location'].default_value=(source_uv[0]-target_uv[0]*scale,source_uv[1]-target_uv[1]*scale,0)
new=nodes.new('ShaderNodeTexImage');new.image=source;links.new(mapping.outputs['Vector'],new.inputs['Vector'])
weight=nodes.new('ShaderNodeTexImage');weight.image=uvmask;weight.interpolation='Closest';links.new(uv.outputs['UV'],weight.inputs['Vector'])
mix=nodes.new('ShaderNodeMixRGB');links.new(weight.outputs['Color'],mix.inputs[0]);links.new(old.outputs['Color'],mix.inputs[1]);links.new(new.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],emit.inputs[0])
target=nodes.new('ShaderNodeTexImage');target.image=result;nodes.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=0
bpy.ops.object.bake(type='EMIT',use_clear=True)
baked=np.array(result.pixels[:],dtype=np.float32).reshape(h,w,4)
# A full atlas bake can introduce roundoff outside the operation. Restore those
# source values exactly, then assert the isolation before any file encoding.
changed=mask>0;baked[~changed]=linear[~changed]
outside_error=float(np.max(np.abs(baked[~changed]-linear[~changed])))
if outside_error!=0:raise AssertionError('The iris repair changed pixels outside its mask.')
if np.any(changed & (radius<=12)):raise AssertionError('The pupil entered the repair mask.')
result.pixels.foreach_set(baked.ravel());result.update()
a.output.parent.mkdir(parents=True,exist_ok=True);result.filepath_raw=str(a.output);result.file_format='PNG';result.save()
report={'baseTexture':str(a.base_texture),'repairTexture':str(a.repair_texture),'output':str(a.output),'changedPixels':int(changed.sum()),'outsideMaskFloatError':outside_error,'targetPupilPixels':[cx,cy],'sourcePupilPixels':[331.6,1165.1],'innerMaskRadiiPixels':[12,16],'outerMaskRadiiPixels':[34,39],'sourceToTargetRadiusRatio':35/36,'originalPupilPreserved':True,'originalScleraPreserved':True}
if a.report:a.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
