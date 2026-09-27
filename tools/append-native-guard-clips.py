"""Append selected native clips while retaining every unrelated animation byte."""
import argparse,copy,json,pathlib,struct

def read_glb(path):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 return json.loads(raw[20:20+length]),raw[28+length:]

def authored_motions():
 root=pathlib.Path(__file__).resolve().parents[1]
 motions=json.loads((root/'src/motion-data.json').read_text())
 selection=root/'src/selection-data.json'
 if selection.exists():
  extra=json.loads(selection.read_text())
  if set(extra)&set(motions):raise ValueError('Selection and combat clip names overlap')
  motions.update(extra)
 return motions

def align_authored_end_times(doc,binary,motions):
 """Place the baked endpoint at its authored time after whole-frame NLA export."""
 binary=bytearray(binary);aligned={}
 for clip in doc.get('animations',[]):
  spec=motions.get(clip['name'],{})
  if not(spec.get('athleticAttack') or spec.get('nativeAttackReady') or spec.get('nativeSelectionIdle')):continue
  duration=spec['duration'];rate=spec.get('nativeSampleRate',60)
  for index in {sampler['input'] for sampler in clip['samplers']}:
   if index in aligned:
    if aligned[index]!=duration:raise ValueError('Shared animation times have different authored durations')
    continue
   accessor=doc['accessors'][index];view=doc['bufferViews'][accessor['bufferView']]
   if accessor['componentType']!=5126 or accessor['type']!='SCALAR' or accessor['count']<2:
    raise ValueError(f"{clip['name']}: expected at least two float timestamp keys")
   stride=view.get('byteStride',4);offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)+(accessor['count']-1)*stride
   end=struct.unpack_from('<f',binary,offset)[0];previous=struct.unpack_from('<f',binary,offset-stride)[0]
   if previous>=duration or end<duration-1e-6 or end-duration>1/rate+1e-6:
    raise ValueError(f"{clip['name']}: missing baked endpoint at {duration}s; last keys are {previous}, {end}")
   struct.pack_into('<f',binary,offset,duration);accessor['max']=[duration];aligned[index]=duration
 return binary

def normalize_authored_end_times(path):
 doc,binary=read_glb(path)
 motions=authored_motions()
 binary=align_authored_end_times(doc,binary,motions)
 header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary
 path.write_bytes(result)
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

def append_guards(target,source,clip_prefixes=None,allowed_clips=(),removed_clips=()):
 old,binary=read_glb(target);new,incoming=read_glb(source)
 motions=authored_motions()
 attack_source_names={name for name,clip in motions.items() if clip.get('athleticAttack') or clip.get('nativeAttackReady') or clip.get('nativeSelectionIdle')}
 incoming=align_authored_end_times(new,incoming,motions)
 if clip_prefixes:new['animations']=[a for a in new['animations'] if a['name'].startswith(clip_prefixes)]
 nodes={node.get('name'):i for i,node in enumerate(old['nodes'])}
 incoming_names={a['name'] for a in new.get('animations',[])};replaced=incoming_names|set(removed_clips);preserved=copy.deepcopy([a for a in old.get('animations',[]) if a['name'] not in replaced]);old['animations']=preserved.copy();binary=trim_replaced_tail(old,binary);out=bytearray(binary);views={};accessors={}
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
  assert original['name'] in allowed_clips or original['name'] in attack_source_names or '_Guard_' in original['name'] or original['name'].startswith(('Run_','Sprint_Forward')),f"Unexpected appended clip: {original['name']}"
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
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('target',type=pathlib.Path);parser.add_argument('source',type=pathlib.Path);parser.add_argument('--allow-clip',action='append',default=[]);parser.add_argument('--remove-clip',action='append',default=[],help='Retire a replaced animation name while preserving unrelated buffer offsets');args=parser.parse_args();append_guards(args.target,args.source,allowed_clips=args.allow_clip,removed_clips=args.remove_clip)
