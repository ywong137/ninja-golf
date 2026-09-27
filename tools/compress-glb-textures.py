"""Compress embedded textures without changing geometry, skinning, or animation."""
import struct,json,io,pathlib,argparse
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--max-size',type=int,default=1024);parser.add_argument('--alpha-size',type=int,default=512);parser.add_argument('files',nargs='+');args=parser.parse_args()
for filename in args.files:
 path=pathlib.Path(filename);raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);data=raw[28+n:];images={i['bufferView']:i for i in doc.get('images',[]) if 'bufferView' in i};out=bytearray()
 for index,view in enumerate(doc['bufferViews']):
  chunk=data[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  if index in images:
   im=Image.open(io.BytesIO(chunk));im.thumbnail((args.max_size,args.max_size));has_alpha='A' in im.getbands() and im.getchannel('A').getextrema()[0]<250;buffer=io.BytesIO()
   if has_alpha:im.thumbnail((args.alpha_size,args.alpha_size));im.save(buffer,format='PNG',optimize=True);mime='image/png'
   else:im.convert('RGB').save(buffer,format='JPEG',quality=86,optimize=True);mime='image/jpeg'
   chunk=buffer.getvalue();images[index]['mimeType']=mime
  view['byteOffset']=len(out);view['byteLength']=len(chunk);out.extend(chunk);out.extend(b'\0'*((-len(out))%4))
 doc['buffers'][0]['byteLength']=len(out);header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*((-len(header))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(header)+len(out))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(out),0x004e4942)+out;path.write_bytes(result);print(path.name,len(raw),'->',len(result))
