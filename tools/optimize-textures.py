"""Remove unused metadata and optimize shipping JPEGs without reducing dimensions.
Source images remain attributable through public/textures/SOURCES.json.
"""
from pathlib import Path
from PIL import Image
for path in Path('public/textures').glob('*-2k.jpg'):
    original=path.stat().st_size
    with Image.open(path) as im:im.convert('RGB').save(path,'JPEG',quality=90,subsampling=0,optimize=True)
    print(path.name,original,'->',path.stat().st_size)
