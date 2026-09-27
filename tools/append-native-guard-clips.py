"""Append selected native clips while retaining every unrelated animation byte."""
import argparse,copy,json,pathlib,struct

def read_glb(path):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 return json.loads(raw[20:20+length]),raw[28+length:]
def trim_replaced_tail(doc,binary):
 """Remove only unreferenced trailing animation storage from earlier append runs."""
 used=set()
 for mesh in doc.get('meshes',[]):
  for primitive in mesh['primitives']:
   used.update(primitive['attributes'].values())
   if 'indices' in primitive:used.add(primitive['indices'])
   for target in primitive.get('targets',[]):used.update(target.values())
 for skin in doc.get('skins',[]):
  if 'inverseBindMatrices' in skin:used.add(skin['inverseBindMatrices'])
 for clip in doc.get('animations',[]):
  for sampler in clip['samplers']:used.update([sampler['input'],sampler['output']])
 doc['accessors']=doc['accessors'][:max(used)+1]
 views={image['bufferView'] for image in doc.get('images',[]) if 'bufferView' in image}
 for accessor in doc['accessors']:
  if 'bufferView' in accessor:views.add(accessor['bufferView'])
  if 'sparse' in accessor:
   views.update(accessor['sparse'][key]['bufferView'] for key in ['indices','values'])
 doc['bufferViews']=doc['bufferViews'][:max(views)+1]
 end=max(view.get('byteOffset',0)+view['byteLength'] for view in doc['bufferViews']);end=(end+3)//4*4
 return binary[:end]

def append_guards(target,source,clip_prefixes=None,allowed_clips=()):
 old,binary=read_glb(target);new,incoming=read_glb(source)
 motion_path=pathlib.Path(__file__).resolve().parents[1]/'src/motion-data.json'
 athletic={name for name,clip in json.loads(motion_path.read_text()).items() if clip.get('athleticAttack')}
 if clip_prefixes:new['animations']=[a for a in new['animations'] if a['name'].startswith(clip_prefixes)]
 nodes={node.get('name'):i for i,node in enumerate(old['nodes'])}
 incoming_names={a['name'] for a in new.get('animations',[])};preserved=copy.deepcopy([a for a in old.get('animations',[]) if a['name'] not in incoming_names]);old['animations']=preserved.copy();binary=trim_replaced_tail(old,binary);out=bytearray(binary);views={};accessors={}
 def accessor(index):
  if index in accessors:return accessors[index]
  value=copy.deepcopy(new['accessors'][index]);assert 'sparse' not in value,'Guard animation must use dense accessors'
  source_view=value['bufferView']
  if source_view not in views:
   view=copy.deepcopy(new['bufferViews'][source_view]);assert view['buffer']==0
   out.extend(b'\0'*(-len(out)%4));start=view.get('byteOffset',0);chunk=incoming[start:start+view['byteLength']];view['byteOffset']=len(out);out.extend(chunk)
   views[source_view]=len(old['bufferViews']);old['bufferViews'].append(view)
  value['bufferView']=views[source_view];accessors[index]=len(old['accessors']);old['accessors'].append(value);return accessors[index]
 for original in new.get('animations',[]):
  assert original['name'] in allowed_clips or original['name'] in athletic or '_Guard_' in original['name'] or original['name'].startswith(('Run_','Sprint_Forward')),f"Unexpected appended clip: {original['name']}"
  clip=copy.deepcopy(original)
  for sampler in clip['samplers']:
   for key in ['input','output']:sampler[key]=accessor(sampler[key])
  for channel in clip['channels']:
   name=new['nodes'][channel['target']['node']]['name'];assert name in nodes,f'Missing destination joint {name}';channel['target']['node']=nodes[name]
  old['animations'].append(clip)
 assert old['animations'][:len(preserved)]==preserved
 assert out[:len(binary)]==binary,'Existing animation or mesh bytes changed'
 out.extend(b'\0'*(-len(out)%4));old['buffers'][0]['byteLength']=len(out)
 header=json.dumps(old,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(out))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(out),0x004e4942)+out
 temporary=target.with_suffix('.guard-update.glb');temporary.write_bytes(result);temporary.replace(target)
 print('APPENDED',target.name,len(new['animations']),'clips; preserved',len(preserved),'animations and',len(binary),'existing binary bytes',flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('target',type=pathlib.Path);parser.add_argument('source',type=pathlib.Path);parser.add_argument('--allow-clip',action='append',default=[]);args=parser.parse_args();append_guards(args.target,args.source,allowed_clips=args.allow_clip)
