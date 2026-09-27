"""Append native guard animations while retaining every existing animation byte."""
import argparse,copy,json,pathlib,struct

def read_glb(path):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 return json.loads(raw[20:20+length]),raw[28+length:]
def append_guards(target,source):
 old,binary=read_glb(target);new,incoming=read_glb(source);out=bytearray(binary);nodes={node.get('name'):i for i,node in enumerate(old['nodes'])}
 incoming_names={a['name'] for a in new.get('animations',[])};preserved=copy.deepcopy([a for a in old.get('animations',[]) if a['name'] not in incoming_names]);old['animations']=preserved.copy();views={};accessors={}
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
  assert '_Guard_' in original['name'],f"Unexpected appended clip: {original['name']}"
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
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('target',type=pathlib.Path);parser.add_argument('source',type=pathlib.Path);args=parser.parse_args();append_guards(args.target,args.source)
