"""Apply reviewed head geometry and glasses materials without changing the clips.

--before and --after must have matching mesh topology and accessor layouts.
The current model must still match --before at every changed vertex.
This creates a separate candidate and rejects an in-place model overwrite.
"""
import argparse, pathlib, json, struct, hashlib
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--current', type=pathlib.Path, required=True)
p.add_argument('--before', type=pathlib.Path, required=True)
p.add_argument('--after', type=pathlib.Path, required=True)
p.add_argument('--output', type=pathlib.Path, required=True)
p.add_argument('--report', type=pathlib.Path)
p.add_argument('--head-texture', type=pathlib.Path, help='Optional reviewed head atlas. Appends it without rewriting any existing binary stream.')
a = p.parse_args()
if a.output.resolve() in [a.current.resolve(), a.before.resolve(), a.after.resolve()]:
    p.error('--output must be a separate candidate file')

def read(path):
 raw=pathlib.Path(path).read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
def write(path,doc,data):
 doc['buffers'][0]['byteLength']=len(data);head=json.dumps(doc,separators=(',',':')).encode();head+=b' '*(-len(head)%4);data+=b'\0'*(-len(data)%4);pathlib.Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(head)+len(data))+struct.pack('<II',len(head),0x4e4f534a)+head+struct.pack('<II',len(data),0x004e4942)+data)
def info(doc,i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];size={'VEC3':3,'VEC4':4,'VEC2':2,'SCALAR':1,'MAT4':16}[a['type']]*{5121:1,5123:2,5125:4,5126:4}[a['componentType']];return a,v,a.get('byteOffset',0)+v.get('byteOffset',0),v.get('byteStride',size),size
before,bb=read(a.before);candidate,cb=read(a.after);current,mb=read(a.current);immutable=bytes(mb);changes=[]
for mi,m in enumerate(before['meshes']):
 assert m['name']==candidate['meshes'][mi]['name']==current['meshes'][mi]['name']
 for pi,p in enumerate(m['primitives']):
  # A geometry revision cannot silently replace the UVs, skin or topology.
  other=candidate['meshes'][mi]['primitives'][pi]
  unchanged=[(p['indices'],other['indices'])] if 'indices' in p else []
  unchanged.extend((index,other['attributes'][name]) for name,index in p['attributes'].items() if name not in ['POSITION','NORMAL'])
  for old_index,new_index in unchanged:
   old_a,_,old_start,old_stride,old_size=info(before,old_index);new_a,_,new_start,new_stride,new_size=info(candidate,new_index)
   assert old_a['count']==new_a['count'] and old_size==new_size,('Topology or skin accessor mismatch',mi,pi)
   for i in range(old_a['count']):
    assert bb[old_start+i*old_stride:old_start+i*old_stride+old_size]==cb[new_start+i*new_stride:new_start+i*new_stride+new_size],('Non-position geometry changed',mi,pi,i)
  for attr in ['POSITION','NORMAL']:
   ba,bv,bs,bt,bn=info(before,p['attributes'][attr]);ca,cv,cs,ct,cn=info(candidate,candidate['meshes'][mi]['primitives'][pi]['attributes'][attr]);ma,mv,ms,mt,mn=info(current,current['meshes'][mi]['primitives'][pi]['attributes'][attr]);assert ba['count']==ca['count']==ma['count'];assert bn==cn==mn==12
   count=0
   for i in range(ba['count']):
    old=bb[bs+i*bt:bs+i*bt+bn];new=cb[cs+i*ct:cs+i*ct+cn]
    if old==new:continue
    assert mb[ms+i*mt:ms+i*mt+mn]==old,('Current geometry diverged from --before at changed vertex',mi,pi,attr,i)
    mb[ms+i*mt:ms+i*mt+mn]=new;count+=1
   if attr=='POSITION':ma['min']=ca['min'];ma['max']=ca['max']
   changes.append({'mesh':m['name'],'primitive':pi,'attribute':attr,'vertices':count})
# The glasses have separate named materials. Apply their reviewed finish while
# keeping the skin, hair, clothing and every other current material unchanged.
material_changes=[]
for name in ['Vice President graphite glasses','Vice President brushed silver temples']:
 old_material=next(m for m in before['materials'] if m.get('name')==name)
 new_material=next(m for m in candidate['materials'] if m.get('name')==name)
 if old_material==new_material:continue
 current_index=next(i for i,m in enumerate(current['materials']) if m.get('name')==name)
 assert current['materials'][current_index]==old_material,('Current glasses material differs from --before',name)
 current['materials'][current_index]=new_material
 material_changes.append(name)
# Optional eye-pivot offsets preserve local bone transforms and every clip key.
# Only two named constant parent nodes and their inverse bind entries may change.
eye_pivot_changes=[]
for update in candidate.get('extras',{}).get('vicePresidentLikeness',{}).get('eyePivotOffsets',[]):
 name='Bip01 '+update['side']+'Eye'
 find_node=lambda doc,name:next(i for i,n in enumerate(doc['nodes']) if n.get('name')==name)
 bi,ci,mi=[find_node(doc,name) for doc in [before,candidate,current]]
 new_parent=candidate['nodes'][update['offsetNode']]
 assert new_parent['name'].startswith('Vice President ') and new_parent['children']==[ci]
 assert not any(n.get('name')==new_parent['name'] for n in current['nodes']),('Eye offset already installed',name)
 assert before['nodes'][bi]==candidate['nodes'][ci]==current['nodes'][mi],('Eye local transform changed',name)
 old_parent=next(i for i,n in enumerate(current['nodes']) if mi in n.get('children',[]))
 new_index=len(current['nodes']);current['nodes'].append({**new_parent,'children':[mi]})
 current['nodes'][old_parent]['children']=[new_index if i==mi else i for i in current['nodes'][old_parent]['children']]
 for skin_index,skin in enumerate(current.get('skins',[])):
  if mi not in skin['joints']:continue
  positions=[before['skins'][skin_index]['joints'].index(bi),candidate['skins'][skin_index]['joints'].index(ci),skin['joints'].index(mi)]
  entries=[info(doc,doc['skins'][skin_index]['inverseBindMatrices']) for doc in [before,candidate,current]]
  starts=[entry[2]+index*entry[3] for entry,index in zip(entries,positions)]
  assert bb[starts[0]:starts[0]+64]==mb[starts[2]:starts[2]+64],('Eye bind matrix diverged',name)
  mb[starts[2]:starts[2]+64]=cb[starts[1]:starts[1]+64]
 eye_pivot_changes.append({**update,'node':mi,'parent':old_parent,'offsetNode':new_index})
# Verify all animation bytes explicitly. Only the selected position/normal
# ranges above can change; skin streams and the scene hierarchy stay intact.
for clip in current['animations']:
 for s in clip['samplers']:
  for prop in ['input','output']:
   ac,v,start,stride,size=info(current,s[prop]);end=start+stride*(ac['count']-1)+size
   assert immutable[start:end]==mb[start:end],(clip['name'],prop)
if a.head_texture:
 material=next(m for m in current['materials'] if m.get('name')=='m009_head')
 image_index=current['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
 image=a.head_texture.read_bytes();mb.extend(b'\0'*(-len(mb)%4))
 view=len(current['bufferViews']);current['bufferViews'].append({'buffer':0,'byteOffset':len(mb),'byteLength':len(image)});mb.extend(image)
 mime='image/png' if a.head_texture.suffix.lower()=='.png' else 'image/jpeg'
 current['images'][image_index]={'bufferView':view,'mimeType':mime,'name':'Ethan reviewed face atlas'}
current.setdefault('extras',{})['vicePresidentLikeness']={**candidate['extras']['vicePresidentLikeness'],'eyePivotOffsets':eye_pivot_changes};write(a.output,current,mb)
report={'source':str(a.current),'sourceSha256':hashlib.sha256(a.current.read_bytes()).hexdigest(),'animationCount':len(current['animations']),'preservedAnimationPayloads':True,'geometryChanges':changes,'glassesMaterialChanges':material_changes,'eyePivotChanges':eye_pivot_changes,'headTexture':str(a.head_texture) if a.head_texture else None,'result':str(a.output)}
if a.report:a.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
