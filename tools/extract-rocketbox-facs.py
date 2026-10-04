import bpy, json, sys, argparse
bpy.ops.wm.read_factory_settings(use_empty=True)
parser=argparse.ArgumentParser(description='Extract Microsoft Rocketbox authored FACS deltas without exporting or replacing its rig.')
parser.add_argument('--input',required=True,help='Official *_facial.fbx source')
parser.add_argument('--output',required=True,help='Extracted JSON path')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.import_scene.fbx(filepath=args.input)
obj=next(o for o in bpy.data.objects if o.type=='MESH')
mesh=obj.data
mesh.calc_loop_triangles()
names=['AU_04_BrowLowerer','AU_05_UpperLidRaiser','AU_06_CheekRaiser','AU_07_LidTightener','AU_09_NoseWrinkler','AU_10_UpperLipRaiser','AU_16_LowerLipDepressor','AU_20_LipStretcher','AU_23_LipTightener','AU_24_LipPressor','AU_25_LipsPart','AU_26_JawDrop']
def gltf(v):return [v.x,v.z,-v.y]
transform=obj.matrix_world.to_3x3()
out={'materials':[m.name for m in mesh.materials],'positions':[gltf(obj.matrix_world @ v.co) for v in mesh.vertices], 'shapes':{},'triangles':[]}
for name in names:
    key=mesh.shape_keys.key_blocks[name]
    out['shapes'][name]=[gltf(transform @ (key.data[i].co-v.co)) for i,v in enumerate(mesh.vertices)]
uv=mesh.uv_layers.active.data
for tri in mesh.loop_triangles:
    out['triangles'].append({'material':mesh.materials[tri.material_index].name,'v':list(tri.vertices),'uv':[[uv[i].uv.x,1-uv[i].uv.y] for i in tri.loops]})
path=args.output
with open(path,'w') as f:json.dump(out,f,separators=(',',':'))
print('EXTRACTED',len(out['positions']),len(out['triangles']),out['materials'])
