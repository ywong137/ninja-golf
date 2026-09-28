#!/usr/bin/env python3
"""Fit and apply shared head geometry from checked photographic measurements.

Requires NumPy, SciPy and OpenCV. Export the baseline pose with
export-vice-president-fit-surface.mjs. The fit changes head positions and normals
only. Photos, camera corrections and fitting code never enter the game runtime.
"""
import argparse
import hashlib
import json
import pathlib
import struct
import numpy as np
import cv2
from scipy.optimize import least_squares
from vice_president_contours import Contour

NAMES=['lower_cheek_width','jaw_angle_width','chin_width','chin_height','chin_depth',
       'nose_height','nose_depth','nose_base_height','nose_base_depth','mouth_height',
       'lower_cheek_depth','alar_width']
PRIORS=np.array([4,3,2,3,3,2,2,2,2,2,4,3],float)

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1)
 return t*t*(3-2*t)

def basis(v):
 """Smooth symmetric displacement handles, in millimetres of mesh space."""
 x,y,z=v.T;ax=np.abs(x);sign=np.tanh(x/.012)
 b=np.zeros((len(x),3,len(NAMES)))
 def g(cx,cy,cz,sx,sy,sz):
  return np.exp(-.5*(((ax-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2))
 b[:,0,0]=sign*g(.056,1.629,.075,.030,.032,.066)
 b[:,0,1]=sign*g(.057,1.588,.054,.025,.022,.048)
 b[:,0,2]=sign*g(.025,1.568,.112,.020,.018,.026)
 b[:,1,3]=(1-smooth(1.57,1.609,y))*smooth(.024,.092,z)
 b[:,2,4]=g(0,1.568,.120,.043,.028,.037)
 b[:,1,5]=g(0,1.647,.157,.020,.016,.019)
 b[:,2,6]=g(0,1.647,.157,.020,.016,.019)
 b[:,1,7]=g(0,1.633,.141,.024,.010,.020)
 b[:,2,8]=g(0,1.633,.141,.024,.010,.020)
 b[:,1,9]=g(0,1.611,.131,.043,.018,.023)
 b[:,2,10]=g(.049,1.626,.100,.025,.032,.039)
 b[:,0,11]=sign*g(.022,1.641,.131,.014,.011,.019)
 # Protect the eyes, forehead, hair and neck seam.
 b*=(smooth(1.49,1.544,y)*(1-smooth(1.653,1.672,y)))[:,None,None]
 return b*.001

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--model',type=pathlib.Path,required=True)
 parser.add_argument('--surface',type=pathlib.Path,required=True)
 parser.add_argument('--reference',type=pathlib.Path,required=True)
 parser.add_argument('--output',type=pathlib.Path,required=True)
 parser.add_argument('--camera-mode',choices=['fixed','constrained'],default='constrained')
 parser.add_argument('--apply-fit',type=pathlib.Path,help='Apply a saved fit instead of optimizing again.')
 args=parser.parse_args()
 if args.model.resolve()==args.output.resolve():parser.error('Use a separate output; do not overwrite the baseline model.')
 raw=args.model.read_bytes();source_hash=hashlib.sha256(raw).hexdigest()
 surface=json.loads(args.surface.read_text());ref=json.loads(args.reference.read_text())
 if source_hash!=surface['modelSha256'] or source_hash!=ref['sourceModelSha256']:
  raise ValueError('The model, surface export and measurement reference must use the same baseline. Export the correct baseline first.')
 mesh=next(m for m in surface['meshes'] if m['name']=='Mesh_1')
 if mesh.get('indexSha256')!=ref['sourceHeadIndexSha256'] or mesh['vertexCount']!=1713:
  raise ValueError('The anatomical reference requires the unchanged native head topology.')
 bind=np.array(mesh['bind']).reshape(-1,3);posed=np.array(mesh['posed']);jac=np.array(mesh['posedJacobian'])
 if bind.shape!=(1713,3) or posed.shape!=bind.shape or jac.shape!=(1713,3,3):raise ValueError('Invalid surface dimensions.')
 if not all(np.isfinite(v).all() for v in [bind,posed,jac]):raise ValueError('The surface contains non-finite values.')
 eyes=np.array(ref['excludedEyeVertices']);B=basis(bind);B[eyes]=0
 PB=np.einsum('vij,vjk->vik',jac,B);origin=np.array(ref['modelOrigin'])
 contour=Contour(bind,mesh['triangles'],{'triangleIds':ref['patchTriangleIds']})
 observations=ref['photos'];camera_count=0 if args.camera_mode=='fixed' else len(observations)*6
 size=len(NAMES)+camera_count
 bounds=np.r_[np.full(len(NAMES),8),np.tile([35,35,35,5,5,5],len(observations))] if camera_count else np.full(size,8)
 def residual(parameters,report=False):
  shape=parameters[:len(NAMES)]
  adjustments=np.zeros((len(observations),6)) if not camera_count else parameters[len(NAMES):].reshape(-1,6)
  points=posed+np.einsum('vik,k->vi',PB,shape);errors=[];reports=[]
  for oi,photo in enumerate(observations):
   base=photo['camera'];adjustment=adjustments[oi]
   rotation=cv2.Rodrigues(adjustment[:3]*.001)[0]@cv2.Rodrigues(np.array(base['rotationVector']))[0]
   rvec=cv2.Rodrigues(rotation)[0].ravel();translation=np.array(base['translation'])+adjustment[3:]*.001
   pixels=cv2.projectPoints(points-origin,rvec,translation,np.array(base['cameraMatrix']),None)[0].reshape(-1,2)
   rows=[]
   for anchor in photo['anchors']:
    indices=ref['semanticVertices'][anchor['id']]
    value=pixels[indices].mean(axis=0);delta=value-anchor['pixel'];uncertainty=np.array(anchor['uncertaintyPx'])
    errors.extend(delta/uncertainty)
    rows.append({'feature':anchor['id'],'observed':anchor['pixel'],'projected':value.tolist(),'residualPixels':delta.tolist(),'uncertaintyPixels':uncertainty.tolist()})
   if 'alarWidth' in photo:
    measure=photo['alarWidth'];loop=pixels[measure['candidateVertices']]
    width=float(np.ptp(loop[:,0]));delta=width-measure['observedPixels'];errors.append(delta/measure['uncertaintyPixels'])
    rows.append({'feature':'alar_silhouette_width','observed':measure['observedPixels'],'projected':width,'residualPixels':delta,'uncertaintyPixels':measure['uncertaintyPixels']})
   curve=np.array(photo['outline']);delta,edges,nearest=contour.distances(points,pixels,rotation,translation,origin,curve)
   errors.extend((delta/photo['outlineUncertaintyPixels']).ravel())
   reports.append({'photo':photo['id'],'anchors':rows,'outlineDistancesPixels':np.linalg.norm(delta,axis=1).tolist(),
    'outlineRmsPixels':float(np.sqrt(np.mean(np.sum(delta*delta,axis=1)))),
    'modelContourSegments':pixels[edges].tolist(),'nearestContourPoints':nearest.tolist(),
    'camera':{**base,'rotationVector':rvec.tolist(),'translation':translation.tolist()}})
  errors.extend(shape/PRIORS)
  if camera_count:errors.extend((adjustments/np.array([15,15,15,2.5,2.5,2.5])).ravel())
  return reports if report else np.array(errors)
 if args.apply_fit:
  previous=json.loads(args.apply_fit.read_text())
  if previous['sourceModelSha256']!=source_hash or previous['cameraMode']!=args.camera_mode:
   raise ValueError('Saved fit uses a different source or camera mode.')
  parameters=np.array(previous['parameters'],float)
  if parameters.shape!=(size,) or not np.isfinite(parameters).all():raise ValueError('Saved fit contains invalid parameters.')
  if np.any(np.abs(parameters)>bounds):raise ValueError('Saved fit exceeds the declared shape or camera bounds.')
 else:
  # Machine-epsilon perturbations can change a silhouette edge's facing or
  # visibility classification. Differentiate at a resolved geometric scale.
  def derivative(parameters):
   step=.01
   return np.column_stack([(residual(parameters+np.eye(size)[i]*step)-residual(parameters-np.eye(size)[i]*step))/(2*step) for i in range(size)])
  result=least_squares(residual,np.zeros(size),jac=derivative,bounds=(-bounds,bounds),loss='soft_l1',f_scale=1,max_nfev=250)
  if not result.success:raise ValueError('Fitting did not converge: '+result.message)
  if np.any(result.active_mask):raise ValueError('A fitting parameter reached its bound. Inspect the correspondence instead of publishing this fit.')
  parameters=result.x
 coefficients=parameters[:len(NAMES)]
 new=bind+np.einsum('vik,k->vi',B,coefficients)
 deformation=np.tile(np.eye(3),(len(bind),1,1));epsilon=1e-5
 for axis in range(3):
  step=np.eye(3)[axis]*epsilon
  derivative=np.einsum('vik,k->vi',basis(bind+step)-basis(bind-step),coefficients)/(2*epsilon)
  derivative[eyes]=0;deformation[:,:,axis]+=derivative
 determinants=np.linalg.det(deformation)
 if determinants.min()<=0:raise ValueError('The fitted deformation folds the mesh.')
 if not np.array_equal(bind[eyes],new[eyes]):raise ValueError('The fit changed an eyeball surface.')
 n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);data=bytearray(raw[28+n:])
 primitive=doc['meshes'][mesh['source']['meshIndex']]['primitives'][mesh['source']['primitiveIndex']]
 def stream(name):
  a=doc['accessors'][primitive['attributes'][name]];v=doc['bufferViews'][a['bufferView']]
  if a['componentType']!=5126 or a['type']!='VEC3' or a['count']!=len(bind):raise ValueError('Unsupported native head stream.')
  return a,a.get('byteOffset',0)+v.get('byteOffset',0),v.get('byteStride',12)
 position,ps,pt=stream('POSITION');_,ns,nt=stream('NORMAL')
 for i,xyz in enumerate(new):
  original=np.array(struct.unpack_from('<3f',data,ps+i*pt))
  if not np.array_equal(original,bind[i]):raise ValueError(f'Surface vertex {i} does not match the model.')
  struct.pack_into('<3f',data,ps+i*pt,*xyz)
  normal=np.array(struct.unpack_from('<3f',data,ns+i*nt));normal=np.linalg.solve(deformation[i].T,normal);normal/=np.linalg.norm(normal)
  struct.pack_into('<3f',data,ns+i*nt,*normal)
 position['min']=new.min(axis=0).tolist();position['max']=new.max(axis=0).tolist()
 report={'schemaVersion':1,'sourceModelSha256':source_hash,'cameraMode':args.camera_mode,'parameters':parameters.tolist(),
  'coefficientsMillimetres':dict(zip(NAMES,coefficients.tolist())),
  'minimumJacobian':float(determinants.min()),'maximumVertexMovementMetres':float(np.linalg.norm(new-bind,axis=1).max()),
  'modifiedVertices':int(np.sum(np.linalg.norm(new-bind,axis=1)>1e-6)),
  'method':'Shared geometric head fit; checked physical nose/mouth points and visible per-view jaw/cheek contours. Camera adjustments are analysis-only.',
  'limitations':ref['limitations'],'before':residual(np.zeros(size),True),'after':residual(parameters,True)}
 doc.setdefault('extras',{})['vicePresidentShapeFit']={k:v for k,v in report.items() if k not in ['before','after','parameters']}
 header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4);data+=b'\0'*(-len(data)%4)
 args.output.parent.mkdir(parents=True,exist_ok=True)
 args.output.write_bytes(struct.pack('<III',0x46546c67,2,len(header)+len(data)+28)+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(data),0x004e4942)+data)
 args.output.with_suffix('.fit.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in ['before','after','parameters','limitations']}))

if __name__=='__main__':main()
