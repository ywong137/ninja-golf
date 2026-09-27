"""Retrieve CC0 Poly Haven nature sources for the offline Blender optimizer."""
import json,hashlib,sys
from pathlib import Path
from importlib import import_module
from concurrent.futures import ThreadPoolExecutor
source=import_module('download-materials')
ASSETS=['island_tree_01','quiver_tree_01','shrub_01','fern_02','boulder_01','namaqualand_boulder_02','coastal_cliff_02','pine_tree_01','fir_tree_01','searsia_burchellii']
ROOT=Path('/private/tmp/ninja-nature-sources');ROOT.mkdir(exist_ok=True)
def obtain(asset):
 files=source.api('files/'+asset);spec=files['gltf']['2k']['gltf'];folder=ROOT/asset;folder.mkdir(exist_ok=True)
 entries=[(asset+'.gltf',spec),*spec['include'].items()]
 if asset in ['pine_tree_01','fir_tree_01']:
  # Native authoring files include needle-card LODs absent from the glTF source.
  native=files['blend']['2k']['blend']
  entries=[entry for entry in entries if not entry[0].endswith('.bin')]
  entries += [('source.blend',native),*[(rel,item) for rel,item in native['include'].items() if '_alpha_' in rel]]
 for rel,item in entries:
  path=folder/rel;path.parent.mkdir(parents=True,exist_ok=True)
  if path.exists() and hashlib.md5(path.read_bytes()).hexdigest()==item['md5']:continue
  source.get(item['url'],path)
  if hashlib.md5(path.read_bytes()).hexdigest()!=item['md5']:raise ValueError(f'Invalid download: {path}')
 print(asset,'downloaded',round(sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())/1e6,1),'MB',flush=True)
 return {'asset':asset,'license':'CC0-1.0','source':'https://polyhaven.com/a/'+asset,'licenseSource':'https://polyhaven.com/license'}
if __name__=='__main__':
 manifest=list(ThreadPoolExecutor(max_workers=3).map(obtain,sys.argv[1:] or ASSETS))
 previous=json.loads((ROOT/'SOURCES.json').read_text()) if (ROOT/'SOURCES.json').exists() else []
 merged={entry['asset']:entry for entry in previous+manifest}
 (ROOT/'SOURCES.json').write_text(json.dumps(list(merged.values()),indent=2)+'\n')
