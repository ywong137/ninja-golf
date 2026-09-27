import json,importlib.util,pathlib
spec=importlib.util.spec_from_file_location('assets',pathlib.Path(__file__).with_name('download-materials.py'));assets=importlib.util.module_from_spec(spec);spec.loader.exec_module(assets)
data=assets.api('files/pine_tree_01')
for role,key in [('color','twig_diff'),('normal','twig_nor_gl'),('alpha','twig_alpha')]:
    available=data[key]['1k'];fmt='png' if role=='alpha' and 'png' in available else 'jpg';f=available[fmt];target=assets.ROOT/'public/textures'/f'pine-{role}.{fmt}';assets.get(f['url'],target);print(target.name,target.stat().st_size,flush=True)
p=assets.ROOT/'public/textures/SOURCES.json';manifest=[m for m in json.loads(p.read_text()) if m['asset']!='pine_tree_01'];manifest.append({'asset':'pine_tree_01','parts':'twig color, normal and alpha textures','license':'CC0-1.0','source':'https://polyhaven.com/a/pine_tree_01'});p.write_text(json.dumps(manifest,indent=2)+'\n')
