"""Append skinned wardrobe geometry while preserving native skeleton and animation bytes."""
import argparse, copy, hashlib, json, pathlib, struct
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base',required=True,type=pathlib.Path)
p.add_argument('--garment',required=True,type=pathlib.Path)
p.add_argument('--output',required=True,type=pathlib.Path)
a=p.parse_args()
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:]
doc,original=read(a.base);src,sbin=read(a.garment);data=bytearray(original)
if doc.get('extras',{}).get('wardrobeDefault'):raise ValueError('Use an unmodified base model; this model already has wardrobe geometry.')
views={};accessors={};materials={};textures={};images={};samplers={}
widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};formats={5121:'B',5123:'H',5125:'I',5126:'f'}
def values(d,b,index):
 ac=d['accessors'][index];view=d['bufferViews'][ac['bufferView']];fmt='<'+formats[ac['componentType']]*widths[ac['type']];size=struct.calcsize(fmt)
 start=view.get('byteOffset',0)+ac.get('byteOffset',0);stride=view.get('byteStride',size)
 return [struct.unpack_from(fmt,b,start+i*stride) for i in range(ac['count'])]
def blob(chunk,target=None):
 data.extend(b'\0'*(-len(data)%4));v={'buffer':0,'byteOffset':len(data),'byteLength':len(chunk)}
 if target:v['target']=target
 doc['bufferViews'].append(v);data.extend(chunk);return len(doc['bufferViews'])-1
def array(rows,typ,component,target):
 flat=[x for row in rows for x in row];fmt='<'+formats[component]*len(flat);v=blob(struct.pack(fmt,*flat),target)
 ac={'bufferView':v,'componentType':component,'count':len(rows),'type':typ}
 if typ=='VEC3' and component==5126:ac.update(min=[min(r[i] for r in rows) for i in range(3)],max=[max(r[i] for r in rows) for i in range(3)])
 doc['accessors'].append(ac);return len(doc['accessors'])-1
def cpview(i):
 if i not in views:
  v=copy.deepcopy(src['bufferViews'][i]);chunk=sbin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];j=blob(chunk,v.get('target'))
  if 'byteStride' in v:doc['bufferViews'][j]['byteStride']=v['byteStride']
  views[i]=j
 return views[i]
def cpaccessor(i):
 if i not in accessors:
  ac=copy.deepcopy(src['accessors'][i]);ac['bufferView']=cpview(ac['bufferView']);doc['accessors'].append(ac);accessors[i]=len(doc['accessors'])-1
 return accessors[i]
def cpimage(i):
 if i not in images:
  ob=copy.deepcopy(src['images'][i]);ob['bufferView']=cpview(ob['bufferView']);doc['images'].append(ob);images[i]=len(doc['images'])-1
 return images[i]
def cptexture(i):
 if i not in textures:
  ob=copy.deepcopy(src['textures'][i]);ob['source']=cpimage(ob['source'])
  if 'sampler' in ob:
   j=ob['sampler']
   if j not in samplers:doc.setdefault('samplers',[]).append(copy.deepcopy(src['samplers'][j]));samplers[j]=len(doc['samplers'])-1
   ob['sampler']=samplers[j]
  doc['textures'].append(ob);textures[i]=len(doc['textures'])-1
 return textures[i]
def cpmaterial(i):
 if i not in materials:
  ob=copy.deepcopy(src['materials'][i])
  def visit(x):
   if isinstance(x,dict):
    for k,v in x.items():
     if k.endswith('Texture') and isinstance(v,dict) and 'index' in v:v['index']=cptexture(v['index'])
     else:visit(v)
  visit(ob);doc['materials'].append(ob);materials[i]=len(doc['materials'])-1
 return materials[i]
original_skin=doc['skins'][0];native={doc['nodes'][j]['name']:i for i,j in enumerate(original_skin['joints'])}
imported_skin=src['skins'][0];mapping={i:native.get(src['nodes'][j]['name']) for i,j in enumerate(imported_skin['joints'])}
old_bind=values(doc,original,original_skin['inverseBindMatrices']);new_bind=values(src,sbin,imported_skin['inverseBindMatrices'])
error=max(abs(x-y) for i,j in mapping.items() if j is not None for x,y in zip(new_bind[i],old_bind[j]))
if error>1e-4:raise ValueError(f'Wardrobe bind matrices differ from the existing skeleton: {error}')
mesh=doc['meshes'][0];cloth_index=next(i for i,m in enumerate(src['materials']) if m['name']=='Hostile Takeover body fabric')
# Split the original garment primitive by its existing UV islands. Hands keep
# their original material and every original position, normal, and skin weight.
base=next(p for p in mesh['primitives'] if doc['materials'][p['material']]['name']=='m009_body')
uv=values(doc,original,base['attributes']['TEXCOORD_0']);indices=[i[0] for i in values(doc,original,base['indices'])];hands=[];clothes=[]
for i in range(0,len(indices),3):
 tri=indices[i:i+3];u=sum(uv[j][0] for j in tri)/3;v=sum(uv[j][1] for j in tri)/3
 # glTF V points down. The source hand islands occupy the bottom corners.
 target=hands if v>.83 and (u<.235 or u>.765) else clothes;target.extend(tri)
hand_primitive=copy.deepcopy(base);hand_primitive['indices']=array([(i,) for i in hands],'SCALAR',5125,34963)
base['indices']=array([(i,) for i in clothes],'SCALAR',5125,34963);base['material']=cpmaterial(cloth_index)
mesh['primitives'].append(hand_primitive)
added=[];triangles=0;pending=[]
for node in src['nodes']:
 if 'mesh' not in node or not node.get('name','').startswith(('Coat split','Gold ','Raised executive','Collar gold','Executive frog','Frog clasp')):continue
 if node.get('skin')!=0:raise ValueError('Unskinned garment: '+node['name'])
 if any(k in node for k in ['matrix','rotation','translation','scale']):raise ValueError('Bake garment node transforms: '+node['name'])
 for prim in src['meshes'][node['mesh']]['primitives']:
  ob=copy.deepcopy(prim);ob['attributes']={name:cpaccessor(i) for name,i in prim['attributes'].items()};ob['indices']=cpaccessor(prim['indices']);ob['material']=cpmaterial(prim['material'])
  joints=values(src,sbin,prim['attributes']['JOINTS_0']);weights=values(src,sbin,prim['attributes']['WEIGHTS_0']);remapped=[]
  for js,ws in zip(joints,weights):
   if abs(sum(ws)-1)>.001:raise ValueError('Garment vertex weights do not sum to one.')
   row=[]
   for j,w in zip(js,ws):
    mapped=mapping[j]
    if mapped is None and w>1e-5:raise ValueError('Garment uses a new bone: '+src['nodes'][imported_skin['joints'][j]]['name'])
    row.append(mapped or 0)
   remapped.append(row)
  ob['attributes']['JOINTS_0']=array(remapped,'VEC4',5123,34962)
  pending.append(ob);triangles+=src['accessors'][prim['indices']]['count']//3
 added.append(node['name'])
# Merge garment parts by material to keep the runtime draw count bounded.
for material in dict.fromkeys(p['material'] for p in pending):
 parts=[p for p in pending if p['material']==material];rows={k:[] for k in ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']};indices=[];count=0
 for prim in parts:
  n=doc['accessors'][prim['attributes']['POSITION']]['count']
  for name in rows:
   ac=prim['attributes'].get(name)
   rows[name].extend(values(doc,data,ac) if ac is not None else [(0,0)]*n)
  indices.extend((i[0]+count,) for i in values(doc,data,prim['indices']));count+=n
 attrs={}
 for name,typ,component in [('POSITION','VEC3',5126),('NORMAL','VEC3',5126),('TEXCOORD_0','VEC2',5126),('JOINTS_0','VEC4',5123),('WEIGHTS_0','VEC4',5126)]:attrs[name]=array(rows[name],typ,component,34962)
 mesh['primitives'].append({'attributes':attrs,'indices':array(indices,'SCALAR',5125,34963),'material':material,'mode':4})
# No rig nodes, clips, existing buffer bytes, or facial materials are changed.
doc.setdefault('extras',{})['wardrobeDefault']={'id':1,'name':'Hostile Takeover','newGarmentParts':added,'materials':[doc['materials'][i]['name'] for i in materials.values()],'bindError':error}
doc['buffers'][0]['byteLength']=len(data)
for extension in src.get('extensionsUsed',[]):
 if extension not in doc.setdefault('extensionsUsed',[]):doc['extensionsUsed'].append(extension)
head=json.dumps(doc,separators=(',',':')).encode();head+=b' '*(-len(head)%4);data+=b'\0'*(-len(data)%4)
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(struct.pack('<III',0x46546c67,2,28+len(head)+len(data))+struct.pack('<II',len(head),0x4e4f534a)+head+struct.pack('<II',len(data),0x004e4942)+data)
original_doc,_=read(a.base)
fingerprint=lambda x:hashlib.sha256(json.dumps(x,separators=(',',':'),sort_keys=True).encode()).hexdigest()
report={'originalBinarySha256':hashlib.sha256(original).hexdigest(),'originalAnimationsSha256':fingerprint(original_doc['animations']),'originalNodesSha256':fingerprint(original_doc['nodes']),'originalSkinsSha256':fingerprint(original_doc['skins']),'output':str(a.output),'baseSha256':hashlib.sha256(a.base.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'preservedBinaryBytes':len(original),'preservedAnimations':len(doc['animations']),'addedParts':len(added),'addedTriangles':triangles,'bindMatrixMaximumError':error,'handsTriangles':len(hands)//3,'garmentTriangles':len(clothes)//3}
a.output.with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
