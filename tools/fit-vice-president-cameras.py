#!/usr/bin/env python3
"""Fit independent photo cameras to measured model anchors, without inferred depth.

Input anchors: exported surface JSON with landmarks containing id and posed.
Input photo detections: {width, height, points:[{id,x,y}]} in image pixels.
The original photographs are neither read nor embedded.
"""
import argparse,json,pathlib
import cv2
import numpy as np
from scipy.optimize import least_squares
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--anchors',type=pathlib.Path,required=True)
p.add_argument('--photo',type=pathlib.Path,action='append',required=True)
p.add_argument('--output',type=pathlib.Path,required=True)
p.add_argument('--baseline-fit',type=pathlib.Path)
a=p.parse_args()
model=json.loads(a.anchors.read_text())
anchors={int(q['id']):np.array(q['posed'],dtype=float) for q in model['landmarks'] if not q.get('missing')}
# The glasses occlude eyelids. Canthi and nasal landmarks get higher weight;
# contours and expression-dependent lips cannot determine the camera alone.
weights={33:3,133:3,362:3,263:3,168:3,6:3,197:2,195:2,5:2,4:2,1:2,2:2,
         98:2,327:2,94:2,97:1.5,326:1.5,61:1,291:1,0:1,17:1,13:.5,14:.5,
         152:1,148:.6,176:.6,149:.6,150:.6,136:.6,172:.6,58:.5,132:.5,93:.5,234:.5,
         377:.6,400:.6,378:.6,379:.6,365:.6,397:.6,288:.5,361:.5,323:.5,454:.5,
         10:.2,67:.3,297:.3,109:.3,338:.3,127:.3,356:.3}
selected=set(weights)
origin=np.mean([anchors[i] for i in [33,133,362,263] if i in anchors],axis=0)
baseline=json.loads(a.baseline_fit.read_text()) if a.baseline_fit else None
reports=[]
for file in a.photo:
 photo=json.loads(file.read_text());points={int(q['id']):np.array([q['x'],q['y']],dtype=float) for q in photo['points']}
 ids=sorted(selected&anchors.keys()&points.keys());obj=np.array([anchors[i]-origin for i in ids]);image=np.array([points[i] for i in ids]);w=np.sqrt(np.array([weights[i] for i in ids]))
 if len(ids)<12:raise ValueError(f'{file}: need at least twelve paired anatomical landmarks')
 width,height=photo['width'],photo['height'];size=max(width,height);cx,cy=width/2,height/2
 fits=[]
 for ratio in [.7,1,1.5,2,3,5,8,12]:
  focal=size*ratio;K=np.array([[focal,0,cx],[0,focal,cy],[0,0,1.]])
  ok,r,t=cv2.solvePnP(obj,image,K,None,flags=cv2.SOLVEPNP_EPNP)
  if not ok:continue
  x0=np.r_[r.ravel(),t.ravel()]
  def project(x,points=obj):return cv2.projectPoints(points,x[:3],x[3:],K,None)[0].reshape(-1,2)
  result=least_squares(lambda x:((project(x)-image)*w[:,None]).ravel(),x0,loss='soft_l1',f_scale=3,max_nfev=500)
  projected=project(result.x);error=projected-image
  fits.append({'focalPixels':focal,'focalImageRatio':ratio,'rotationVector':result.x[:3].tolist(),'translation':result.x[3:].tolist(),'cameraMatrix':K.tolist(),'weightedRmsPixels':float(np.sqrt(np.average((error**2).sum(axis=1),weights=w*w))),'residuals':[{'id':i,'observed':image[k].tolist(),'projected':projected[k].tolist(),'residualPixels':error[k].tolist(),'weight':weights[i]} for k,i in enumerate(ids)]})
 if not fits:raise ValueError(f'{file}: no camera solution')
 fits.sort(key=lambda x:x['weightedRmsPixels']);best=fits[0]
 report={'file':str(file),'width':width,'height':height,'best':best,'focalSensitivity':fits}
 if baseline:
  old=next(r['best'] for r in baseline['photos'] if r['file']==str(file))
  points=np.array([anchors[i]-np.array(baseline['modelOrigin']) for i in ids])
  projected=cv2.projectPoints(points,np.array(old['rotationVector']),np.array(old['translation']),np.array(old['cameraMatrix']),None)[0].reshape(-1,2)
  error=projected-image
  report['fixedBaselineCamera']={'weightedRmsPixels':float(np.sqrt(np.average((error**2).sum(axis=1),weights=w*w))),'residuals':[{'id':i,'projected':projected[k].tolist(),'observed':image[k].tolist(),'residualPixels':error[k].tolist()} for k,i in enumerate(ids)]}
 reports.append(report)
# Estimate only the correction supported by the independent views. A 3 mm
# displacement prior stabilizes near-frontal depth; report its conditioning.
corrections=[]
for id,anchor in anchors.items():
 if id not in selected:continue
 rows=[];targets=[];observations=[]
 for report in reports:
  fit=report['best'];res=next((r for r in fit['residuals'] if r['id']==id),None)
  if res is None:continue
  r=np.array(fit['rotationVector']);t=np.array(fit['translation']);K=np.array(fit['cameraMatrix']);point=anchor-origin
  def project(p):return cv2.projectPoints(np.array([p]),r,t,K,None)[0].reshape(2)
  J=np.column_stack([(project(point+np.eye(3)[k]*.00001)-project(point-np.eye(3)[k]*.00001))/.00002 for k in range(3)])
  scale=np.sqrt(weights[id]);rows.extend(J*scale);targets.extend(-np.array(res['residualPixels'])*scale)
  observations.append({'file':report['file'],'residualPixels':res['residualPixels']})
 if len(observations)<2:continue
 J=np.array(rows);target=np.array(targets);u,s,vh=np.linalg.svd(J,full_matrices=False)
 correction=np.linalg.lstsq(np.vstack([J,np.eye(3)*1000/3]),np.r_[target,np.zeros(3)],rcond=None)[0]
 corrections.append({'id':id,'posed':anchor.tolist(),'regularizedCorrectionMetres':correction.tolist(),'singularValuesPixelsPerMetre':s.tolist(),'condition':float(s[0]/max(s[-1],1e-9)),'observations':observations})
result={'sourceAnchors':str(a.anchors),'modelOrigin':origin.tolist(),'method':'Fixed focal sensitivity sweep; independent rigid camera fits; robust weighted reprojection; paired residual triangulation with 3 mm displacement prior. MediaPipe z is unused.','limitations':['Principal point assumed at each image center. Cropping and focal length are uncertain.','Occluded landmarks and expression-dependent contours need manual visual confirmation.','Camera fitting can absorb some real shape differences. Corrections are measurements, not automatic sculpt targets.'],'photos':reports,'corrections':corrections}
a.output.write_text(json.dumps(result,indent=2));print(json.dumps({'output':str(a.output),'fits':[{'file':r['file'],'bestRmsPixels':r['best']['weightedRmsPixels'],'fixedBaselineRmsPixels':r.get('fixedBaselineCamera',{}).get('weightedRmsPixels'),'focalRatio':r['best']['focalImageRatio']} for r in reports],'pairedLandmarks':len(corrections)}))
