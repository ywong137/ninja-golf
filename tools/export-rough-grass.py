import bpy,json,sys
from pathlib import Path
import argparse
p=argparse.ArgumentParser(description='Export CC0 Bermuda grass leaf templates from the original Blender asset.')
p.add_argument('--source',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(a.source))
result=[]
for label in ['small_a','small_b','small_c','small_d','small_e','small_f','medium_a','medium_b','medium_c','medium_d','medium_e','medium_f']:
 mesh=bpy.data.objects['grass_bermuda_01_'+label].data;mesh.calc_loop_triangles();uv=mesh.uv_layers.active.data;position=[];normal=[];tex=[]
 floor=min(v.co.z for v in mesh.vertices)
 for triangle in mesh.loop_triangles:
  for loop_id in triangle.loops:
   loop=mesh.loops[loop_id];v=mesh.vertices[loop.vertex_index];position.extend([v.co.x,v.co.z-floor,-v.co.y]);normal.extend([v.normal.x,v.normal.z,-v.normal.y]);tex.extend(uv[loop_id].uv)
 result.append({'name':label,'position':position,'normal':normal,'uv':tex})
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps(result,separators=(',',':')))
print('Exported',len(result),'templates',sum(len(r['position'])//9 for r in result),'triangles')
