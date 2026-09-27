"""Keep a hero's own clips and remove their unused GLB animation buffers."""
import argparse,json,pathlib,struct
PREFIX={'ronin':'','shinobi':'Twin_','monk':'','kaede':'Fan_','ayame':'Ring_','sora':'Sickle_'}
GUARD_PREFIX={'ronin':'Odachi','shinobi':'Twin','monk':'Naginata','kaede':'Fan','ayame':'Ring','sora':'Sickle'}
COMMON={'Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Jump_Start','Jump_Loop','Jump_Land','Hit_Chest','Golf_Address','Golf_Swing','Golf_Putt'}
def clip_names(hero,names):
 prefix=PREFIX[hero]
 return {n for n in names if n in COMMON or n.startswith(GUARD_PREFIX[hero]+'_Guard_') or (n.startswith(prefix) and n[len(prefix):].startswith(('Cut_','Heavy_','Musou_','Ready')))}
def prune(path,hero):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:];assert len(doc['buffers'])==1,'Expected one embedded GLB buffer'
 keep=clip_names(hero,[a['name'] for a in doc['animations']]);doc['animations']=[a for a in doc['animations'] if a['name'] in keep]
 refs=[]
 for mesh in doc.get('meshes',[]):
  for p in mesh['primitives']:
   refs.extend((p['attributes'],key) for key in p['attributes'])
   if 'indices' in p:refs.append((p,'indices'))
   for target in p.get('targets',[]):refs.extend((target,key) for key in target)
 for skin in doc.get('skins',[]):
  if 'inverseBindMatrices' in skin:refs.append((skin,'inverseBindMatrices'))
 for animation in doc['animations']:
  for sampler in animation['samplers']:refs.extend([(sampler,'input'),(sampler,'output')])
 used=sorted({obj[key] for obj,key in refs});mapping={old:new for new,old in enumerate(used)};doc['accessors']=[doc['accessors'][old] for old in used]
 for obj,key in refs:obj[key]=mapping[obj[key]]
 view_refs=[]
 for accessor in doc['accessors']:
  if 'bufferView' in accessor:view_refs.append((accessor,'bufferView'))
  if 'sparse' in accessor:
   for key in ['indices','values']:view_refs.append((accessor['sparse'][key],'bufferView'))
 for image in doc.get('images',[]):
  if 'bufferView' in image:view_refs.append((image,'bufferView'))
 used=sorted({obj[key] for obj,key in view_refs});mapping={old:new for new,old in enumerate(used)};doc['bufferViews']=[doc['bufferViews'][old] for old in used];out=bytearray()
 for view in doc['bufferViews']:
  assert view['buffer']==0
  start=view.get('byteOffset',0);chunk=binary[start:start+view['byteLength']];view['byteOffset']=len(out);out.extend(chunk);out.extend(b'\0'*(-len(out)%4))
 for obj,key in view_refs:obj[key]=mapping[obj[key]]
 doc['buffers'][0]['byteLength']=len(out);header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(out))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(out),0x004e4942)+out
 path.write_bytes(result);print(path.name,len(raw),'->',len(result),len(keep),'clips',flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--hero',required=True,choices=PREFIX);parser.add_argument('file',type=pathlib.Path);args=parser.parse_args();prune(args.file,args.hero)
