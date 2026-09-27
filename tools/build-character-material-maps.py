"""Convert licensed Rocketbox specular intensity into conservative PBR roughness.

This preserves the author's surface masks. It does not invent skin or eye masks.
The legacy intensity-to-roughness conversion is an approximation, not a measured scan.
"""
import hashlib,json,pathlib,math
from PIL import Image,ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/rocketbox';OUT=ROOT/'public/textures/characters';OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((SOURCE/'SOURCES.json').read_text());entries={x['path']:x for x in manifest['files']};outputs=[]
heroes={'Male_Adult_10','Male_Adult_09','Male_Adult_05','Female_Adult_03','Female_Adult_08','Female_Adult_12'}
for identity in manifest['models']:
 for source in sorted((SOURCE/identity/'Textures').glob('*_specular.tga')):
  part='head' if '_head_' in source.name else 'body';base,gain=(.72,.42) if part=='head' else (.92,.75)
  image=ImageOps.grayscale(Image.open(source));size=1024 if identity in heroes else 512;image.thumbnail((size,size),Image.Resampling.LANCZOS)
  image=image.point([round(max(.22,min(base,base-gain*math.sqrt(i/255)))*255) for i in range(256)])
  target=OUT/(source.stem.replace('_specular','')+'-roughness.png');image.save(target,optimize=True)
  relative=str(source.relative_to(SOURCE));original=entries[relative]
  outputs.append({'file':target.name,'source':original['url'],'sourceBlob':original['blob'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':list(image.size),'conversion':{'base':base,'sqrtSpecularGain':gain,'minimum':.22}})
(OUT/'SOURCES.json').write_text(json.dumps({'license':'MIT','repository':manifest['repository'],'commit':manifest['commit'],'description':'Roughness derived from original authored specular intensity; not a measured roughness map.','files':outputs},indent=2)+'\n')
(OUT/'LICENSE.txt').write_text((SOURCE/'LICENSE.md').read_text())
print('Wrote',len(outputs),'authored surface maps')
