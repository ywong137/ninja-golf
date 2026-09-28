"""Author a single-sword scout cut from the current dual-sword body choreography.

Run with --output /tmp/ninja-scout-motion.json. This never writes shared data
unless the caller explicitly supplies that path.
"""
import argparse,copy,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
VERSION='scout-single-sword-1'
def turn(v,angle):
 c,s=math.cos(angle),math.sin(angle)
 return [v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]]
def author(data):
 record=copy.deepcopy(data['Twin_Cut_Diagonal'])
 for key in ['twinAuthorVersion','twinArmPathVersion','lightRecoveryVersion']:record.pop(key,None)
 for p in record['poses']:
  offset=turn([0,-.04,-.03],p['chest'])
  for key in ['grip','tip']:p[key]=[p[key][i]+offset[i]for i in range(3)]
  guard=turn([.30,-.34,1.00+p['shift'][2]],p['chest'])
  p['offGrip']=[guard[i]+(p['shift'][i]if i<2 else 0)for i in range(3)]
  p['offTip']=[p['offGrip'][0],p['offGrip'][1],p['offGrip'][2]-1]
  for side,x in [('R',-.75),('L',.65)]:
   pole=turn([x,-.65,.95+p['shift'][2]*.4],p['chest'])
   p['elbow'+side]=[pole[i]+(p['shift'][i]if i<2 else 0)for i in range(3)]
  p['freeHand']=.65
 record['scoutAuthorVersion']=VERSION
 record['choreography']='Single katana cut with a low empty-hand guard and a receiving step'
 record['twoHanded']=False;record['nativeReachLimit']=.94
 return {'Enemy_Scout_Cut':record}
def validate(records,data):
 clip=records['Enemy_Scout_Cut'];old=data['Twin_Cut_Diagonal']
 assert clip['duration']==old['duration']and clip['impacts']==old['impacts']
 for a,b in zip(old['poses'],clip['poses']):
  for key in a:
   if key not in ['grip','tip','offGrip','offTip','elbowR','elbowL','freeHand']:assert a[key]==b[key],key
  assert math.dist([a['tip'][i]-a['grip'][i]for i in range(3)],[b['tip'][i]-b['grip'][i]for i in range(3)])<1e-12
 assert records==author({**data,**records}),'Repeated authoring changed scout clip'
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source',type=pathlib.Path,default=ROOT/'src/motion-data.json')
 parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/ninja-scout-motion.json'))
 args=parser.parse_args();data=json.loads(args.source.read_text());records=author(data);validate(records,data)
 args.output.write_text(json.dumps(records,separators=(',',':'))+'\n');print('Wrote',args.output)
