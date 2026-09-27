"""Download CC0 Poly Haven assets through the web-retrieval T1 header policy."""
import json, re, subprocess, hashlib, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ua_file=os.environ.get('NINJA_BROWSER_UA_FILE')
if not ua_file:sys.exit('Set NINJA_BROWSER_UA_FILE to a JSON file with the current Chrome user-agent string.')
ua=json.loads(Path(ua_file).read_text())
major=re.search(r'Chrome/(\d+)',ua).group(1)
headers=['-A',ua,'-H','Accept: */*','-H','Accept-Language: en-US,en;q=0.9',
 '-H',f'Sec-Ch-Ua: "Chromium";v="{major}", "Google Chrome";v="{major}", "Not_A Brand";v="99"',
 '-H','Sec-Ch-Ua-Mobile: ?0','-H','Sec-Ch-Ua-Platform: "macOS"','-H','Sec-Fetch-Dest: empty','-H','Sec-Fetch-Mode: cors','-H','Sec-Fetch-Site: same-site']
def get(url,path):
    subprocess.run(['curl','-fSL','--retry','2','--max-time','120','--compressed',*headers,url,'-o',str(path)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def api(path):
    out=Path('/private/tmp')/('ninja-poly-'+path.replace('/','-')+'.json');get('https://api.polyhaven.com/'+path,out);return json.loads(out.read_text())
def main():
    manifest=[]
    for asset,stem in [('grass_ground','grass'),('aerial_grass_rock','cliff'),('sand_01','sand'),('japanese_cedar_bark','bark'),('rock_boulder_dry','rock')]:
        files=api('files/'+asset);info=api('info/'+asset)
        for role,keys in [('color',['Diffuse','diff']),('normal',['nor_gl'])]:
            key=next(k for k in keys if k in files);f=files[key]['1k']['jpg'];dest=ROOT/'public/textures'/f'{stem}-{role}.jpg';get(f['url'],dest)
            assert hashlib.md5(dest.read_bytes()).hexdigest()==f['md5']
            print(dest.name,dest.stat().st_size,flush=True)
        manifest.append({'asset':asset,'author':info.get('authors',{}),'license':'CC0-1.0','source':'https://polyhaven.com/a/'+asset})
    asset='kloofendal_48d_partly_cloudy_puresky';files=api('files/'+asset);f=files['hdri']['2k']['hdr'];dest=ROOT/'public/textures/coastal-sky.hdr';get(f['url'],dest);assert hashlib.md5(dest.read_bytes()).hexdigest()==f['md5'];manifest.append({'asset':asset,'license':'CC0-1.0','source':'https://polyhaven.com/a/'+asset});print(dest.name,dest.stat().st_size,flush=True)
    (ROOT/'public/textures/SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')

if __name__ == "__main__": main()
