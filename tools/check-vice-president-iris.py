"""Check the decoded iris repair without changing either image."""
import argparse,json,pathlib
import numpy as np
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--base',type=pathlib.Path,default=ROOT/'assets/characters/vice-president-face-baked.jpg')
p.add_argument('--result',type=pathlib.Path,default=ROOT/'assets/characters/vice-president-face-warm-eyes.png')
p.add_argument('--report',type=pathlib.Path)
a=p.parse_args()
base=np.asarray(Image.open(a.base).convert('RGB')).astype(int)
result=np.asarray(Image.open(a.result).convert('RGB')).astype(int)
if base.shape!=(2048,2048,3) or result.shape!=base.shape:raise ValueError('Both atlases must be 2048-pixel RGB images.')
y,x=np.mgrid[:2048,:2048];r=np.hypot(x-539.2,y-1910.0);error=np.max(abs(result-base),axis=2)
outside=int(error[r>=39].max());pupil=int(error[r<=12].max())
if outside:raise AssertionError(f'Pixels outside the iris changed by up to {outside} code values.')
if pupil:raise AssertionError(f'The preserved pupil changed by up to {pupil} code values.')
iris=result[(r>16)&(r<32)];red_green=float(np.median(iris[:,0]-iris[:,1]));green_blue=float(np.median(iris[:,1]-iris[:,2]))
if red_green<10 or green_blue<5:raise AssertionError('The isolated iris does not have the reviewed warm brown color.')
report={'outsideIrisMaximumCodeError':outside,'pupilMaximumCodeError':pupil,'changedPixelCount':int((error>0).sum()),'medianIrisRedMinusGreen':red_green,'medianIrisGreenMinusBlue':green_blue}
if a.report:a.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
