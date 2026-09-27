"""Build licensed garment variants without changing source skin, UVs, or anatomy.

Run with Python and Pillow/numpy. Masks use reviewed source atlas regions and
source fabric colors. Before compression, the output keeps every unmasked source pixel unchanged.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/textures/outfits'
ROSTER=[('ronin','Male_Adult_10','m024','Club burgundy'),('shinobi','Male_Adult_09','m017','Teal woven shirt'),('monk','Male_Adult_05','m009','Ochre clubhouse'),('kaede','Female_Adult_03','f003','Indigo wave'),('ayame','Female_Adult_08','f008','Lavender argyle club'),('sora','Female_Adult_12','f012','Jade wave')]
def build():
 OUT.mkdir(parents=True,exist_ok=True);records=[]
 for old in OUT.glob('*-outfit.png'):old.unlink()
 for hero,identity,material,title in ROSTER:
  src=ROOT/'assets/source/rocketbox'/identity/'Textures'/f'{material}_body_color.tga'
  original=np.array(Image.open(src).convert('RGB'));h,w=original.shape[:2];rgb=original.astype(float)/255;r,g,b=rgb.transpose(2,0,1);y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h
  lum=rgb@np.array([.2126,.7152,.0722]);result=rgb.copy();mask=np.zeros((h,w),bool)
  def cloth(region,color,reference,pattern=None):
   nonlocal result,mask
   region=region&(lum>.035);shade=np.clip(lum/reference,.18,1.8)
   tint=np.array(color)/255;paint=shade[:,:,None]*tint
   if pattern is not None:paint*=1-pattern[:,:,None]*.17
   result[region]=np.clip(paint[region],0,1);mask|=region
  if hero=='ronin':
   region=(r>g*1.45)&(r>b*1.25)&(v<.85)
   cloth(region,[116,38,52],.17)
   stripe=(v>.40)&(v<.83)&(lum>.43)&(abs(r-g)<.07)&(abs(g-b)<.07)
   cloth(stripe,[228,216,187],.67)
  elif hero=='shinobi':
   # Central shirt island and both short sleeves. Exclude exposed forearms.
   region=((u>.33)&(u<.68)&(v<.86))|(((u<.31)|(u>.72))&(v>.445)&(v<.575))
   pattern=(np.abs(np.sin(u*180)*np.sin(v*180))<.07).astype(float)
   cloth(region,[39,82,94],.09,pattern)
  elif hero=='monk':
   region=(u>.29)&(u<.70)&(v<.76)&(r>g*1.04)&(g>b*1.08)
   cloth(region,[189,151,70],.53)
  elif hero=='kaede':
   region=(b>g*1.22)&(r>g*1.18)&(v<.92)
   # Overlapping semicircle rows suggest a woven wave repeat.
   px=u*28;py=v*28;dx=np.mod(px+np.floor(py)*.5,1)-.5;dy=np.mod(py,1)
   wave=(np.abs(np.sqrt(dx*dx+dy*dy)-.58)<.025).astype(float)
   cloth(region,[43,69,119],.23,wave)
  elif hero=='ayame':
   region=(u>.335)&(u<.665)&(v<.755)&(abs(r-g)<.11)&(abs(g-b)<.11)
   # Alternating diamonds and crossing lines form the golf argyle.
   cloth(region,[155,131,178],.47)
   diamond=(np.floor(u*12+v*8)+np.floor(u*12-v*8)).astype(int)%2==0
   cream=region&diamond&(lum>.035)
   result[cream]=np.clip((lum[cream]/.47)[:,None]*np.array([.87,.83,.72]),0,1)
   seam=region&((np.abs(np.sin((u*12+v*8)*np.pi))<.065)|(np.abs(np.sin((u*12-v*8)*np.pi))<.065))
   result[seam]*=.65
  else:
   # Hoodie's central torso; skin neckline and colored trim remain untouched.
   region=(((u>.29)&(u<.72)&(v>.30)&(v<.82))|((v>.30)&(v<.49)))&(abs(r-g)<.055)&(abs(g-b)<.055)&(lum<.30)
   wave=(np.abs(np.sin(u*105+np.sin(v*110)*1.2))<.10).astype(float)
   cloth(region,[38,97,87],.105,wave)
  output=original.copy();output[mask]=np.round(result[mask]*255).astype(np.uint8)
  target=OUT/f'{material}_body-outfit.webp';Image.fromarray(output).save(target,quality=93,method=6)
  Image.fromarray(mask.astype(np.uint8)*255).save(OUT/f'{material}_body-mask.png',optimize=True)
  assert np.array_equal(output[~mask],original[~mask])
  records.append({'hero':hero,'material':material+'_body','title':title,'identity':identity,'source':str(src.relative_to(ROOT)),'file':target.name,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':[w,h],'coverage':float(mask.mean()),'unchangedOutsideMaskBeforeCompression':True,'encoding':{'format':'WebP','quality':93}})
 (OUT/'SOURCES.json').write_text(json.dumps({'license':'MIT','sourceRepository':'https://github.com/microsoft/Microsoft-Rocketbox','description':'Garment-only color and textile variations; original source folds, seams, skin and shoes remain.','files':records},indent=2)+'\n')
 (OUT/'LICENSE.txt').write_text((ROOT/'assets/source/rocketbox/LICENSE.md').read_text())
 print('Built six WebP garment textures; unmasked source pixels verified before compression.')
if __name__=='__main__':build()
