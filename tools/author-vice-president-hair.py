#!/usr/bin/env python3
"""Create a separate, UV-mapped hair shell. Preserve every source binary byte.

Requires NumPy. Uses a static reviewed head-space recipe.
The exact head geometry, UVs and topology must match that recipe.
Body and animation changes do not affect this authoring transform.
The default recipe contains the reviewed side-only correction.
Output uses a separate file. Custom offset overrides require another visual review.
"""
import argparse,copy,hashlib,json,math,pathlib,struct
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--input',type=pathlib.Path,required=True,help='Source GLB with the reviewed measured Ethan head.')
p.add_argument('--output',type=pathlib.Path,required=True,help='Separate output GLB and adjacent JSON report.')
p.add_argument('--recipe',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1]/'assets/characters/vice-president-hair-recipe.json',help='Static camera, head fingerprints and approved offsets.')
p.add_argument('--side-mm',type=float,help='Override reviewed side offset, in millimetres.')
p.add_argument('--back-mm',type=float,help='Override reviewed rear offset. The accepted recipe uses zero.')
p.add_argument('--line-mm',type=float,help='Override reviewed hairline offset, in millimetres.')
a=p.parse_args()
recipe=json.loads(a.recipe.read_text())
if recipe.get('schemaVersion')!=1: p.error('Unsupported hair recipe schema. Expected version 1.')
for arg,key in [('side_mm','side'),('back_mm','back'),('line_mm','hairline')]:
 if getattr(a,arg) is None: setattr(a,arg,float(recipe['offsetsMm'][key]))
if a.output.suffix.lower()!='.glb':p.error('Output must use the .glb extension.')
if {a.input.resolve(),a.recipe.resolve()} & {a.output.resolve(),a.output.with_suffix('.json').resolve()}:p.error('Use separate output and report paths. Preserve the source and recipe.')
if not all(0<=q<=10 for q in [a.side_mm,a.back_mm,a.line_mm]):p.error('Offsets must stay between zero and ten millimetres.')
raw=a.input.read_bytes()
if len(raw)<28 or struct.unpack_from('<III',raw,0)!=(0x46546c67,2,len(raw)):p.error('Input must be a complete GLB version 2 file.')
n,kind=struct.unpack_from('<II',raw,12)
if kind!=0x4e4f534a or 28+n>len(raw):p.error('Input has no valid JSON chunk.')
doc=json.loads(raw[20:20+n]);binary_length,binary_kind=struct.unpack_from('<II',raw,20+n)
if binary_kind!=0x004e4942 or binary_length!=len(raw)-28-n:p.error('Expected one embedded binary chunk.')
if len(doc.get('buffers',[]))!=1 or doc['buffers'][0].get('uri'):p.error('Expected one embedded buffer.')
data=bytearray(raw[28+n:]);source_data=bytes(data)
if doc.get('extras',{}).get('vicePresidentHairEnvelope'):raise ValueError('Input already contains a candidate hair shell.')
matches=[(mi,pi) for mi,m in enumerate(doc['meshes'])for pi,q in enumerate(m['primitives'])if doc['materials'][q['material']].get('name')==recipe['head']['material']]
if len(matches)!=1:p.error('Expected exactly one reviewed head material primitive.')
mesh_index,primitive_index=matches[0];primitive=doc['meshes'][mesh_index]['primitives'][primitive_index]
def read(i):
 ac=doc['accessors'][i];bv=doc['bufferViews'][ac['bufferView']];dtype={5126:'<f4',5123:'<u2',5121:'u1',5125:'<u4'}[ac['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']];start=ac.get('byteOffset',0)+bv.get('byteOffset',0);stride=bv.get('byteStride',k*np.dtype(dtype).itemsize)
 return np.array([np.frombuffer(data,dtype,count=k,offset=start+i*stride)for i in range(ac['count'])])
v=read(primitive['attributes']['POSITION']);uv=read(primitive['attributes']['TEXCOORD_0']);tri=read(primitive['indices']).reshape(-1,3)
expected=recipe['head']
if len(v)!=expected['vertexCount'] or tri.size!=expected['indexCount']:p.error('Head topology differs from the reviewed recipe. Rebase and review the shell first.')
for label,arr,key in [('positions',v,'positionSha256'),('UVs',uv,'texcoordSha256'),('indices',tri,'indexSha256')]:
 if hashlib.sha256(arr.tobytes()).hexdigest()!=expected[key]:p.error(f'Head {label} differ from the reviewed recipe. Refuse an unreviewed fit.')
head=next(i for i,n in enumerate(doc['nodes'])if n.get('name')=='Head');head_joint=doc['skins'][0]['joints'].index(head)
skinj=read(primitive['attributes']['JOINTS_0']);skinw=read(primitive['attributes']['WEIGHTS_0'])
constraint=recipe['projectionConstraint'];J=np.array(constraint['headLinear']);T=np.array(constraint['headTranslation'])
origin=np.array(constraint['modelOrigin']);rv=np.array(constraint['rotationVector']);ang=np.linalg.norm(rv)
if J.shape!=(3,3) or abs(np.linalg.det(J))<1e-10:p.error('Recipe head transform is singular.')
R=np.eye(3)
if ang>1e-12:
 axis=rv/ang;K=np.array([[0,-axis[2],axis[1]],[axis[2],0,-axis[0]],[-axis[1],axis[0],0]])
 R+=math.sin(ang)*K+(1-math.cos(ang))*(K@K)
translation=np.array(constraint['translation']);cameraJ=R@J
# Manual boundary on the existing atlas excludes ears, eyebrows and beard.
line=np.array([[0,.394],[.075,.409],[.14,.418],[.19,.400],[.218,.292],[.235,.282],[.262,.282],[.280,.292],[.291,.302],[.313,.300],[.329,.250],[.347,.197],[.368,.171],[.39,.161],[.414,.142],[.443,.136],[.468,.140],[.486,.134],[.496,.133],[.505,.133],[.518,.134],[.530,.140],[.558,.135],[.586,.144],[.609,.162],[.633,.177],[.650,.202],[.669,.254],[.687,.299],[.708,.302],[.720,.292],[.737,.282],[.765,.282],[.779,.292],[.81,.400],[.86,.418],[.925,.409],[1,.395]],float)
def smooth(lo,hi,x):
 t=np.clip((x-lo)/(hi-lo),0,1);return t*t*(3-2*t)
def boundary(u):return np.interp(u,line[:,0],line[:,1])
def native_edge(pos):
 # Avoid the auricle and its tight postauricular crease. Hair can extend down
 # the nape only behind the ear, not by inflating the ear surface itself.
 return pos[1]-(1.701-.058*smooth(.020,.062,-pos[2]))
def field(pos,tex):
 x,y,z=pos;ax=abs(x);side=1 if x>=0 else -1
 # A positive distance is inside the painted hair boundary.
 d=boundary(tex[0])-tex[1]
 crown=1-smooth(1.766,1.794,y)
 back=smooth(-.015,.033,-z)*smooth(1.649,1.689,y)*crown
 sideweight=smooth(.055,.086,ax)*(1-smooth(.025,.065,z))*smooth(1.680,1.715,y)*crown
 # A raised lip at the front hairline, tapering into the existing scalp surface.
 front=smooth(.040,.085,z)*math.exp(-max(0,d)/.028)*crown
 lift=a.line_mm*.001*front
 dx=side*a.side_mm*.001*sideweight
 dz=-a.back_mm*.001*back +lift*.7
 dy=lift*.25-a.back_mm*.00010*back
 # Avoid duplicate coplanar surfaces; the upper shell edge goes just below scalp.
 edge=min(smooth(0,.010,d),smooth(0,.014,native_edge(pos)))
 inset=.00016*(1-smooth(1.772,1.794,y))-.0006*smooth(1.781,1.794,y)-.0003*(1-edge)
 radial=np.array([x,0,z-.004]);radial/=max(np.linalg.norm(radial),1e-8)
 delta=np.array([dx,dy,dz])*edge+radial*inset
 # Preserve the already-matched upper left outline in the front camera.
 # Moving only along this camera ray leaves both projected coordinates intact.
 keep=smooth(1.648,1.649,y)*(1-smooth(-.026,-.008,x))
 if keep:
  cameraPoint=R@(J@pos+T-origin)+translation
  ray=np.linalg.solve(cameraJ,cameraPoint);along=ray*(np.dot(delta,ray)/np.dot(ray,ray))
  delta=delta*(1-keep)+along*keep
 return delta
# Each point stores source barycentric coordinates; cuts interpolate them exactly.
def clip(poly,func):
 out=[]
 for i,b in enumerate(poly):
  c=poly[(i+1)%len(poly)];fb=func(b);fc=func(c)
  if fb>=0:out.append(b)
  if (fb>=0)!=(fc>=0):out.append(b+(c-b)*(fb/(fb-fc)))
 return out
positions=[];texcoords=[];sourcepoints=[];origtriids=[];indices=[];memo={}
def vertex(t,b):
 pos=b@v[t];tex=b@uv[t];new=pos+field(pos,tex);key=tuple(np.round(np.r_[pos,tex],9))
 if key in memo:return memo[key]
 i=len(positions);memo[key]=i;positions.append(new);texcoords.append(tex);sourcepoints.append(pos);return i
N=5
for ti,t in enumerate(tri):
 if v[t,1].max()<1.649 or v[t,1].min()>1.794:continue
 if np.min(uv[t,1]-boundary(uv[t,0]))>.025:continue
 for i in range(N):
  for j in range(N-i):
   b0=np.array([1-(i+j)/N,i/N,j/N]);b1=np.array([1-(i+j+1)/N,(i+1)/N,j/N]);b2=np.array([1-(i+j+1)/N,i/N,(j+1)/N]);small=[[b0,b1,b2]]
   if i+j<N-1:small.append([b1,np.array([1-(i+j+2)/N,(i+1)/N,(j+1)/N]),b2])
   for poly in small:
    poly=clip(poly,lambda b: boundary(float((b@uv[t])[0]))-float((b@uv[t])[1]))
    if len(poly)<3:continue
    poly=clip(poly,lambda b: 1.794-float((b@v[t])[1]))
    if len(poly)<3:continue
    poly=clip(poly,lambda b: float((b@v[t])[1])-1.649)
    if len(poly)<3:continue
    poly=clip(poly,lambda b: native_edge(b@v[t]))
    if len(poly)<3:continue
    ids=[vertex(t,b)for b in poly]
    for k in range(1,len(ids)-1):
     ids3=[ids[0],ids[k],ids[k+1]]
     if len(set(ids3))==3:indices.append(ids3);origtriids.append(ti)
used_source_vertices=set(int(i)for ti in set(origtriids)for i in tri[ti])
for i in used_source_vertices:
 if abs(sum(skinw[i,k]for k in range(4)if skinj[i,k]==head_joint)-1)>1e-6:p.error('Hair source no longer has rigid Head weights. Rebase skinning before use.')
positions=np.asarray(positions);texcoords=np.asarray(texcoords);sourcepoints=np.asarray(sourcepoints);indices=np.asarray(indices,dtype=np.uint32)
# Smooth geometric normals across coincident UV seams, without modifying source normals.
normal=np.zeros_like(positions);area=np.cross(positions[indices[:,1]]-positions[indices[:,0]],positions[indices[:,2]]-positions[indices[:,0]])
source_area=np.cross(sourcepoints[indices[:,1]]-sourcepoints[indices[:,0]],sourcepoints[indices[:,2]]-sourcepoints[indices[:,0]])
cosine=np.einsum('ij,ij->i',area,source_area)/np.maximum(np.linalg.norm(area,axis=1)*np.linalg.norm(source_area,axis=1),1e-30)
if np.any(np.linalg.norm(area,axis=1)<=1e-15):p.error('Hair shell contains a degenerate triangle.')
if np.any(cosine<=0):
 bad=np.flatnonzero(cosine<=0);print(json.dumps({'reversed':len(bad),'triangles':[{'index':int(i),'cosine':float(cosine[i]),'sourceArea':float(np.linalg.norm(source_area[i])/2),'sourceCenter':sourcepoints[indices[i]].mean(0).tolist(),'uv':texcoords[indices[i]].tolist()}for i in bad[:12]]}));raise ValueError('Hair displacement reverses a source triangle. Inspect the shell field.')
for k in range(3):np.add.at(normal,indices[:,k],area)
keys=np.round(positions,7);_,inv=np.unique(keys,axis=0,return_inverse=True);total=np.zeros((inv.max()+1,3));np.add.at(total,inv,normal);normal=total[inv];normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12)
joints=np.zeros((len(positions),4),dtype=np.uint16);joints[:,0]=head_joint;weights=np.zeros((len(positions),4),dtype=np.float32);weights[:,0]=1
# Appended accessors leave all existing source payload bytes intact.
def add(arr,kind,target):
 arr=np.ascontiguousarray(arr);data.extend(b'\0'*(-len(data)%4));offset=len(data);blob=arr.tobytes();data.extend(blob);view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(blob),'target':target});count=arr.shape[0];component={np.dtype('<f4'):5126,np.dtype('<u2'):5123,np.dtype('<u4'):5125}[arr.dtype];ac={'bufferView':view,'componentType':component,'count':count,'type':kind}
 if kind=='VEC3':ac.update({'min':arr.min(0).astype(float).tolist(),'max':arr.max(0).astype(float).tolist()})
 doc['accessors'].append(ac);return len(doc['accessors'])-1
attrs={'POSITION':add(positions.astype('<f4'),'VEC3',34962),'NORMAL':add(normal.astype('<f4'),'VEC3',34962),'TEXCOORD_0':add(texcoords.astype('<f4'),'VEC2',34962),'JOINTS_0':add(joints,'VEC4',34962),'WEIGHTS_0':add(weights,'VEC4',34962)}
index=add(indices.ravel().astype('<u4'),'SCALAR',34963)
# Reuse the mapped hair pixels without changing the head material or texture.
material=copy.deepcopy(doc['materials'][primitive['material']]);material['name']='Vice President swept hair';material.pop('normalTexture',None);material.pop('occlusionTexture',None);material['doubleSided']=True
material['pbrMetallicRoughness']['roughnessFactor']=.78;material['pbrMetallicRoughness']['metallicFactor']=0
mat=len(doc['materials']);doc['materials'].append(material);doc['meshes'][mesh_index]['primitives'].append({'attributes':attrs,'indices':index,'material':mat})
report={'source':str(a.input),'sourceSha256':hashlib.sha256(raw).hexdigest(),'recipeSha256':hashlib.sha256(a.recipe.read_bytes()).hexdigest(),'frontProjectionConstraint':{'recipe':str(a.recipe),'region':'Native x below -0.026m and y above1.649m, with smooth boundary. Displacement follows the unchanged front-camera ray.'},'sourceBinaryPreserved':bytes(data[:len(source_data)])==source_data,'newHairVertices':len(positions),'newHairTriangles':len(indices),'sourceTriangleIds':sorted(set(origtriids)),'headMaximumY':float(v[:,1].max()),'shellMaximumY':float(positions[:,1].max()),'minimumTriangleNormalDot':float(cosine.min()),'maxOffsetMm':float(np.linalg.norm(positions-sourcepoints,axis=1).max()*1000),'parameters':{'sideMm':a.side_mm,'backMm':a.back_mm,'lineMm':a.line_mm},'uvBoundary':line.tolist(),'limits':['Source head geometry and all original binary data remain unchanged.','Scalp and hair share the original head texture; this shell adds geometry only.','Default offsets follow the reviewed side-only correction. Custom offsets need visual review.']}
assert report['sourceBinaryPreserved'];assert report['shellMaximumY']<report['headMaximumY']
doc.setdefault('extras',{})['vicePresidentHairEnvelope']={k:v for k,v in report.items()if k not in ['sourceTriangleIds','uvBoundary']};doc['buffers'][0]['byteLength']=len(data);h=json.dumps(doc,separators=(',',':')).encode();h+=b' '*(-len(h)%4);data.extend(b'\0'*(-len(data)%4));a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(struct.pack('<III',0x46546c67,2,28+len(h)+len(data))+struct.pack('<II',len(h),0x4e4f534a)+h+struct.pack('<II',len(data),0x004e4942)+data);a.output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k not in ['sourceTriangleIds','uvBoundary']}))
