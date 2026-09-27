"""Crop verified Mapzen Skadi tiles into small, reproducible distant-landscape grids.

Usage: python3 tools/build-regional-terrain.py --source-dir /path/to/hgt-files
Source URLs and checksums are recorded in public/terrain/SOURCES.json.
The game adapts horizontal scale, elevation and placement. These are not course maps.
"""
import argparse, gzip, hashlib, json, math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
REGIONS = [
 ('japanese','Sanuki Hills, Shikoku, Japan','N34E134',34,134,34.34,134.16,24000),
 ('highlands','Cuillin Hills, Isle of Skye, Scotland','N57W007',57,-7,57.14,-6.25,28000),
 ('desert','Sedona, Arizona, United States','N34W112',34,-112,34.86,-111.76,24000),
]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source-dir',type=Path,required=True);args=parser.parse_args()
 out=ROOT/'public/terrain';out.mkdir(exist_ok=True);manifest=[]
 for theme,name,tile,lat,lon,cy,cx,span in REGIONS:
  source=args.source_dir/(tile+'.hgt.gz');compressed=source.read_bytes();raw=gzip.decompress(compressed)
  if len(raw)!=3601*3601*2:raise ValueError(f'{source}: expected a 3601-square signed 16-bit Skadi tile')
  dem=np.frombuffer(raw,dtype='>i2').reshape(3601,3601)
  dy=span/111320;dx=dy/math.cos(math.radians(cy));bounds=[cx-dx/2,cy-dy/2,cx+dx/2,cy+dy/2]
  x0,x1=round((bounds[0]-lon)*3600),round((bounds[2]-lon)*3600)
  y0,y1=round((lat+1-bounds[3])*3600),round((lat+1-bounds[1])*3600)
  if not(0<=x0<x1<=3601 and 0<=y0<y1<=3601):raise ValueError(f'{name}: crop exceeds tile')
  crop=dem[y0:y1,x0:x1].astype(np.float32)
  if (crop==-32768).any():raise ValueError(f'{name}: source contains unresolved no-data samples')
  grid=np.rint(np.array(Image.fromarray(crop).resize((513,513),Image.Resampling.LANCZOS))).astype('<i2')
  target=out/(theme+'.i16');target.write_bytes(grid.tobytes())
  manifest.append(dict(theme=theme,name=name,file=target.name,size=513,encoding='int16 little-endian, row-major north to south',bounds=bounds,spanMetres=span,minMetres=int(grid.min()),maxMetres=int(grid.max()),source=f'https://s3.amazonaws.com/elevation-tiles-prod/skadi/{tile[:3]}/{tile}.hgt.gz',sourceSHA256=hashlib.sha256(compressed).hexdigest(),sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
  print(theme,grid.min(),grid.max(),target.stat().st_size)
 (out/'SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
