"""Retrieve CC0 Poly Haven nature sources for the offline Blender optimizer."""
import json,hashlib,sys
from pathlib import Path
from importlib import import_module
from concurrent.futures import ThreadPoolExecutor
source=import_module('download-materials')
ASSETS=['island_tree_01','quiver_tree_01','shrub_01','fern_02','boulder_01','namaqualand_boulder_02','coastal_cliff_02']
ROOT=Path('/private/tmp/ninja-nature-sources');ROOT.mkdir(exist_ok=True)
def obtain(asset):
 files=source.api('files/'+asset);spec=files['gltf']['2k']['gltf'];folder=ROOT/asset;folder.mkdir(exist_ok=True)
 for rel,item in [(asset+'.gltf',spec),*spec['include'].items()]:
  path=folder/rel;path.parent.mkdir(parents=True,exist_ok=True)
  if path.exists() and hashlib.md5(path.read_bytes()).hexdigest()==item['md5']:continue
  source.get(item['url'],path)
  if hashlib.md5(path.read_bytes()).hexdigest()!=item['md5']:raise ValueError(f'Invalid download: {path}')
 print(asset,'downloaded',round(sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())/1e6,1),'MB',flush=True)
 return {'asset':asset,'license':'CC0-1.0','source':'https://polyhaven.com/a/'+asset,'licenseSource':'https://polyhaven.com/license'}
if __name__=='__main__':
 manifest=list(ThreadPoolExecutor(max_workers=3).map(obtain,sys.argv[1:] or ASSETS))
 (ROOT/'SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')
