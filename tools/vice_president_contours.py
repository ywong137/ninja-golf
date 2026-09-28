"""Camera-dependent geometric contours, with full-head triangle visibility."""
import numpy as np
class Contour:
 def __init__(self,bind,triangles,patch):
  self.tri=np.asarray(triangles,dtype=int)
  # Weld only exact coincident source seams. Never join unrelated features.
  _,canonical=np.unique(np.round(bind,6),axis=0,return_inverse=True)
  buckets={}
  for ti,t in enumerate(self.tri):
   for j in range(3):
    a,b=int(t[j]),int(t[(j+1)%3]);key=tuple(sorted([int(canonical[a]),int(canonical[b])]))
    if key[0]!=key[1]:buckets.setdefault(key,[]).append((ti,a,b))
  patch_set=set(patch['triangleIds']);pairs=[];edges=[]
  for rows in buckets.values():
   if len(rows)!=2 or any(r[0] not in patch_set for r in rows):continue
   a,b=rows[0][1:];mid=(bind[a]+bind[b])/2
   if not(mid[1]<1.650 and mid[2]>.028 and (abs(mid[0])>.033 or mid[1]<1.591)):continue
   pairs.append([rows[0][0],rows[1][0]]);edges.append([a,b])
  self.pairs=np.array(pairs);self.edges=np.array(edges)
 def edges_in_view(self,points,pixels,rotation,translation,origin):
  camera=(points-origin)@rotation.T+translation
  v=camera[self.tri];normal=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);facing=np.einsum('ij,ij->i',normal,v[:,0])>0
  edges=self.edges[facing[self.pairs[:,0]]!=facing[self.pairs[:,1]]]
  # Verify visible geometric edges against the whole head, including the neck.
  q=pixels[edges].mean(axis=1)
  uv=pixels[self.tri];a=uv[:,0];u=uv[:,1]-a;w=uv[:,2]-a
  det=u[:,0]*w[:,1]-u[:,1]*w[:,0];valid=np.abs(det)>1e-10;det=np.where(valid,det,1)
  d=q[:,None,:]-a[None,:,:]
  b1=(d[:,:,0]*w[None,:,1]-d[:,:,1]*w[None,:,0])/det
  b2=(u[None,:,0]*d[:,:,1]-u[None,:,1]*d[:,:,0])/det;b0=1-b1-b2
  inside=(b0>=-1e-7)&(b1>=-1e-7)&(b2>=-1e-7)&valid
  inv_depth=b0/v[None,:,0,2]+b1/v[None,:,1,2]+b2/v[None,:,2,2]
  closest=np.max(np.where(inside,inv_depth,-np.inf),axis=1)
  # The screen midpoint has the harmonic, not arithmetic, endpoint depth.
  edge_depth=2/(1/camera[edges[:,0],2]+1/camera[edges[:,1],2])
  visible=closest<=1/edge_depth+2e-4
  return edges[visible]
 def distances(self,points,pixels,rotation,translation,origin,photo_curve):
  edges=self.edges_in_view(points,pixels,rotation,translation,origin)
  if len(edges)==0:raise ValueError('No visible jaw/cheek contour edges in the fitted camera')
  seg=pixels[edges];a=seg[:,0];d=seg[:,1]-a;v=photo_curve[:,None,:]-a
  t=np.clip(np.einsum('nsi,si->ns',v,d)/np.maximum(np.sum(d*d,axis=1),1e-12),0,1)
  closest=a[None,:,:]+t[:,:,None]*d[None,:,:]
  delta=closest-photo_curve[:,None,:];which=np.argmin(np.sum(delta*delta,axis=2),axis=1)
  return delta[np.arange(len(photo_curve)),which],edges,closest[np.arange(len(photo_curve)),which]
