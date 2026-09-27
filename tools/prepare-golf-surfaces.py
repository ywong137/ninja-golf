"""Encode verified CC0 source maps for browser delivery without changing their dimensions.
Usage: python3 tools/prepare-golf-surfaces.py /path/to/verified-source-maps
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image, ImageFile
ImageFile.MAXBLOCK=32*1024*1024
ROOT=Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);args=parser.parse_args();out=ROOT/'public/textures';records=[]
 catalog=args.source/'SOURCES.json'
 sources=json.loads(catalog.read_text()) if catalog.exists() else json.loads((out/'GOLF-SURFACES.json').read_text())['sources']
 expected={f['file']:f['sha256'] for source in sources for f in source['files']}
 files=[('Grass005_2K-JPG_Color.jpg','turf-color-2k.jpg'),('Grass005_2K-JPG_NormalGL.jpg','turf-normal-2k.jpg'),('Grass005_2K-JPG_Roughness.jpg','turf-roughness-2k.jpg'),('gravel_floor_04_diff_2k.jpg','path-color-2k.jpg'),('gravel_floor_04_nor_gl_2k.jpg','path-normal-2k.jpg'),('gravel_floor_04_rough_2k.jpg','path-roughness-2k.jpg')]
 for source,_ in files:
  if hashlib.sha256((args.source/source).read_bytes()).hexdigest()!=expected[source]:raise ValueError(f'{source}: source checksum differs from the verified catalog')
 for source,target in files:
  src=args.source/source;image=Image.open(src)
  if image.size!=(2048,2048):raise ValueError(f'{source}: expected verified 2048-square source')
  rough='roughness' in target;image=image.convert('L' if rough else 'RGB');dest=out/target;image.save(dest,quality=90 if rough else 93,subsampling=0,optimize=True)
  records.append(dict(file=target,sourceFile=source,sourceSHA256=hashlib.sha256(src.read_bytes()).hexdigest(),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),dimensions=[2048,2048],encoding='JPEG grayscale Q90' if rough else 'JPEG RGB Q93, no chroma subsampling'))
  print(target,dest.stat().st_size)
 (out/'GOLF-SURFACES.json').write_text(json.dumps(dict(sources=sources,files=records),indent=2)+'\n')
if __name__=='__main__':main()
