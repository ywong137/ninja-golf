"""Author separate ring/sickle attacks without changing shared motion data or assets."""
import argparse, importlib.util, json, math, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('kaede_helpers', ROOT/'tools/author-kaede-motion.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)
NAMES = ['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']
HITS = [[.15],[.16],[.20],[.20,.38],[.36],[.30],[.28,.53],[.47]]
BASE = {'r':[-.22,0,0], 'l':[.22,.07,0]}
# Each row gives prepare/contact/follow-through grips and the corresponding shaft vectors.
RING = [
 ([.08,-.12,1.42],[-.24,-.42,1.24],[-.38,-.12,1.13],[.56,.18,.22],[-.52,-.36,.12],[-.53,.22,-.08]),
 ([-.37,-.10,1.16],[-.14,-.42,1.32],[.09,-.16,1.44],[-.57,.19,-.05],[.40,-.43,.20],[.54,.20,.24]),
 ([-.32,-.12,.99],[-.23,-.40,1.25],[-.13,-.14,1.51],[-.40,.12,-.42],[-.20,-.38,.46],[.16,.18,.56]),
 ([.09,-.08,1.18],[-.25,-.42,1.15],[-.40,-.08,1.20],[.56,.24,0],[-.52,-.38,0],[-.53,.25,.10]),
 ([-.06,-.09,1.53],[-.22,-.42,1.09],[-.35,-.16,.99],[.39,.20,.47],[-.35,-.39,-.38],[-.50,.12,-.30]),
 ([-.36,-.07,.98],[-.22,-.41,1.22],[.02,-.16,1.48],[-.46,.18,-.32],[.12,-.42,.44],[.50,.11,.33]),
 ([-.41,-.06,1.20],[-.17,-.43,1.18],[.10,-.08,1.24],[-.55,.23,.10],[.47,-.41,.03],[.55,.25,.08]),
 ([.01,-.12,1.53],[-.23,-.41,1.00],[-.38,-.12,.95],[.41,.20,.42],[-.20,-.46,-.37],[-.52,.13,-.25]),
]
SICKLE = [
 ([-.35,-.08,1.34],[-.19,-.45,1.17],[-.24,-.19,1.02],[-.30,.22,.51],[.29,-.47,-.24],[-.39,.24,-.39]),
 ([-.15,-.20,1.03],[-.32,-.44,1.20],[-.31,-.13,1.31],[.40,.12,-.40],[-.44,-.40,.11],[-.45,.23,.26]),
 ([-.29,-.08,.87],[-.20,-.43,1.16],[-.22,-.17,1.39],[-.30,.18,-.51],[.12,-.43,.46],[-.27,.20,.53]),
 ([-.38,-.09,1.04],[-.19,-.46,1.03],[-.19,-.16,.97],[-.47,.23,-.18],[.44,-.43,-.13],[-.35,.31,-.38]),
 ([-.25,-.07,1.47],[-.19,-.44,1.02],[-.21,-.15,.90],[-.18,.22,.55],[.16,-.46,-.42],[-.31,.21,-.49]),
 ([-.34,-.10,.85],[-.20,-.44,1.14],[-.24,-.15,1.40],[-.30,.22,-.50],[.25,-.40,.42],[-.26,.23,.50]),
 ([-.38,-.05,1.01],[-.18,-.45,1.02],[-.17,-.12,.94],[-.50,.24,-.10],[.47,-.42,-.08],[-.25,.34,-.45]),
 ([-.22,-.07,1.48],[-.18,-.44,.93],[-.22,-.13,.83],[-.19,.22,.56],[.18,-.44,-.42],[-.29,.24,-.49]),
]
STEPS = {
 'Ring_': [('l',[.15,-.065,0],-.18),('r',[-.16,-.06,0],.18),('l',[.11,-.12,0],-.12),('r',[-.20,-.035,0],.24),('l',[.18,-.11,0],-.22),('r',[-.13,-.17,0],.18),('l',[.22,-.045,0],-.26),('r',[-.17,-.14,0],.20)],
 'Sickle_': [('r',[-.025,-.17,0],.08),('l',[.025,-.16,0],-.08),('r',[-.035,-.18,0],.10),('l',[.065,-.12,0],-.16),('r',[-.035,-.24,0],.09),('l',[.04,-.22,0],-.08),('r',[-.075,-.18,0],.17),('l',[.035,-.25,0],-.10)]}
def length(v): return math.sqrt(sum(x*x for x in v))
def ring_rising_return(grip,t):
 # The original downward return crosses the shoulder. Carry the ring forward
 # and outside it, retaining the original endpoints and endpoint velocities.
 if .36<t<.72:
  arc=math.sin(math.pi*(t-.36)/.36)**2
  return [grip[0]-.18*arc,grip[1]-.26*arc,grip[2]]
 return grip
def recovery_clearance(name,pose,t):
 # These local recovery arcs avoid two different IK singularities. Return's
 # wrist passed within 84 mm of its shoulder. Rising and the final sickle
 # recovery passed across their elbow pole, reversing the bend plane.
 # Offsets use source coordinates (X, forward-negative Y, Z-up).
 config={
  'Ring_Cut_Return':(.215,.43,'grip',[.10,-.10,0]),
  'Ring_Heavy_Rising':(.37,.72,'elbowR',[.30,-.30,.10]),
  'Sickle_Musou_Flow':(2.885,3.3,'elbowR',[-.10,.10,.20]),
 }
 if name not in config:return pose
 start,end,key,offset=config[name]
 if start<t<end:
  weight=math.sin(math.pi*(t-start)/(end-start))**2
  for target in ([key,'tip'] if key=='grip' else [key]):
   pose[target]=[pose[target][k]+offset[k]*weight for k in range(3)]
 return pose

def direction(keys,t,size):
 # The common interpolator performs spherical direction interpolation at length .62.
 return [x*size/.62 for x in u.shaft(keys,t)]
def build_pose(t,duration,hip,chest,bend,shift,grip,axis,off,feet,roll,low):
 p=u.assemble(t,duration,hip,chest,bend,shift,grip,axis,off,feet,roll)
 p['pelvisBend']=bend*.48
 p['freeHand']=.92 if low else .72
 p['offRoll']=.10 if low else -.45
 return p

def regular(prefix,index,old):
 low=prefix=='Sickle_';duration=old['duration'];hits=old.get('impacts',HITS[index]);hit=hits[0];heavy=index>=4
 initial=old['poses'][0];ready=initial['grip'];ready_axis=[b-a for a,b in zip(ready,initial['tip'])];size=length(ready_axis)
 roll=initial.get('roll',.2 if low else -.7);a,b,c,sa,sb,sc=(SICKLE if low else RING)[index]
 side,delta,yaw=STEPS[prefix][index];sign=-1 if index in [1,6] else 1
 prep=hit*.32;release=hit-.055;follow=hit+.055;recovery=max(hits[-1]+.07,duration-.15)
 events={'r':[],'l':[]};target=[BASE[side][k]+delta[k] for k in range(3)]
 events[side]=[(.012,hit-.035,target,yaw,.065 if low else .075),(recovery,duration-.012,BASE[side],0,.065 if low else .07)]
 load=(.19 if heavy else .15) if low else (.12 if heavy else .08)
 settle=.12 if low else .07
 transfer=[delta[0]*.50,delta[1]*.53,-load*.74]
 hands=[(0,ready),(prep,a),(release,a),(hit,b),(follow,c)]
 axes=[(0,ready_axis),(prep,sa),(release,sa),(hit,sb),(follow,sc)]
 hips=[(0,0),(prep,-.18*sign),(hit-.095,-.10*sign),(hit-.065,.27*sign),(follow,.32*sign)]
 chests=[(0,0),(prep,-.34*sign),(release,-.30*sign),(hit,.12*sign),(follow,.45*sign)]
 shifts=[(0,[0,0,-settle]),(prep,[-delta[0]*.10,.012,-load]),(release,[transfer[0]*.6,transfer[1]*.6,-load]),(hit,transfer),(follow,[transfer[0],transfer[1]*.65 if low else transfer[1],-settle])]
 bends=[(0,.25 if low else .18),(prep,.34 if low else .23),(release,.39 if low else .27),(hit,.44 if low else .29),(follow,.39 if low else .27)]
 free=[(0,[.27,-.18,1.21]),(prep,[.24,-.20,1.15]),(release,[.30,-.10,1.12]),(hit,[.33,.08,1.14]),(follow,[.23,-.08,1.19] if low else [.37,.11,1.27])]
 if len(hits)>1:
  second=hits[1];last=second+.04
  hands.extend([(second-.09,c),(second,[-.25,-.40,1.06] if low else [-.12,-.42,1.23]),(last,a)])
  axes.extend([(second-.09,sc),(second,[-sb[0],sb[1],sb[2]]),(last,sa)])
  hips.extend([(second-.105,.19*sign),(second-.065,-.29*sign),(last,-.34*sign)])
  chests.extend([(second-.08,.36*sign),(second,-.12*sign),(last,-.44*sign)])
  shifts.extend([(second,[transfer[0]*-.25,transfer[1],-load*.8]),(last,[0,transfer[1]*.6,-settle])])
  bends.extend([(second,.41 if low else .30),(last,.36 if low else .26)])
  free.extend([(second,[.31,-.09,1.19]),(last,[.26,-.17,1.22])])
 tracks=[(hands,ready),(axes,ready_axis),(hips,0),(chests,0),(shifts,[0,0,-settle]),(bends,.25 if low else .18),(free,[.27,-.18,1.21])]
 for keys,value in tracks:keys.append((duration,value));keys.sort(key=lambda row:row[0])
 times=sorted({round(x,9) for x in [i*duration/300 for i in range(301)]+hits+[v for es in events.values() for e in es for v in e[:2]]})
 poses=[]
 for t in times:
  ch=u.track(chests,t);feet={s:u.foot_at(BASE[s],events[s],t) for s in BASE};shift=u.track(shifts,t)
  if not low and index in [3,6]:
   # Keep the pelvis inside the wider support base through the return cut.
   # Torso reversal must not pull the hip away from the lateral planting foot.
   spread=abs(feet['l'][0][0]-feet['r'][0][0])-.44
   loading=u.smooth(max(0,spread)/.16)
   shift[2]-=.065*loading
   support_center=(feet['r'][0][0]+feet['l'][0][0])*.5
   shift[0]=shift[0]*(1-loading*.8)+support_center*loading*.8
  grip=u.track(hands,t)
  if prefix=='Ring_' and index==5:grip=ring_rising_return(grip,t)
  poses.append(recovery_clearance(prefix+NAMES[index],build_pose(t,duration,u.track(hips,t),ch,u.track(bends,t),shift,grip,direction(axes,t,size),u.track(free,t),feet,roll+ch*(.55 if low else .95),low),t))
 return dict(duration=duration,twoHanded=False,athleticAttack=True,nativeReachLimit=.94 if low else .95,rootAdvance=0,impacts=hits,nativeSampleRate=120,footPlants={s:u.plants(events[s],duration) for s in BASE},poses=poses)

def musou(prefix,old):
 low=prefix=='Sickle_';duration=old['duration'];hits=old['impacts'];headings=[0,-.60,.45,-.85,.35,0] if low else [0,.85,1.85,3.05,4.55,math.tau]
 base=BASE;events={'r':[],'l':[]};heading_keys=[(0,0)]
 for i in range(1,6):
  start=hits[i-1]+.085;end=hits[i]-.075;mid=(start+end)/2;first='l' if i%2 else 'r'
  for side,a,b in [(first,start,mid),('r' if first=='l' else 'l',mid,end)]:
   target=u.turn(base[side],headings[i]);target[1]-=.045*(i%2) if low and i<5 else 0
   events[side].append((a,b,target,headings[i],.065 if low else .10))
  heading_keys.extend([(start,headings[i-1]),(end,headings[i])])
 heading_keys.append((duration,headings[-1]));initial=old['poses'][0];ready=initial['grip'];ready_axis=[b-a for a,b in zip(ready,initial['tip'])];size=length(ready_axis);roll=initial.get('roll',.2 if low else -.7)
 poses=[];order=[0,1,2,3,6,7] if low else [3,1,2,6,0,7]
 for i in range(793):
  t=i*duration/792;j=min(range(6),key=lambda j:abs(t-hits[j]));hit=hits[j];start=hit-.22;prep=hit-.16;release=hit-.065;follow=hit+.065;end=hit+.16;q=max(start,t);sign=-1 if j%2 else 1
  heading=u.track(heading_keys,t);feet={s:u.foot_at(base[s],events[s],t) for s in base}
  center=[(feet['r'][0][k]+feet['l'][0][k])*.5 for k in range(2)];origin=u.turn([0,.035,0],heading)
  support='l' if feet['r'][0][2]>.005 else 'r' if feet['l'][0][2]>.005 else None
  if support:
   weight=.55*u.smooth(max(feet['r'][0][2],feet['l'][0][2])/.05)
   center=[center[k]*(1-weight)+feet[support][0][k]*weight for k in range(2)]
  center=[center[k]-origin[k] for k in range(2)]
  hip=u.track([(start,0),(prep,-.18*sign),(hit-.10,-.08*sign),(hit-.07,.25*sign),(follow,.31*sign),(end,0)],q)
  chest=u.track([(start,0),(prep,-.33*sign),(release,-.27*sign),(hit,.13*sign),(follow,.44*sign),(end,0)],q)
  a,b,c,sa,sb,sc=(SICKLE if low else RING)[order[j]]
  grip=u.track([(start,ready),(prep,a),(release,a),(hit,b),(follow,c),(end,ready)],q)
  axis=direction([(start,ready_axis),(prep,sa),(release,sa),(hit,sb),(follow,sc),(end,ready_axis)],q,size)
  load=u.track([(start,.12 if low else .07),(prep,.20 if low else .13),(release,.22 if low else .14),(hit,.17 if low else .09),(follow,.15 if low else .08),(end,.12 if low else .07)],q)
  balance=u.turn(u.track([(start,[0,0,0]),(prep,[.025*sign,.015,0]),(hit,[-.035*sign,-.045,0]),(follow,[-.025*sign,-.025,0]),(end,[0,0,0])],q),heading)
  center=[center[k]+balance[k] for k in range(2)]
  off=u.track([(start,[.27,-.18,1.21]),(prep,[.23,-.18,1.10]),(release,[.30,-.06,1.13]),(hit,[.35,.07,1.18]),(follow,[.24,-.08,1.20] if low else [.37,.12,1.29]),(end,[.27,-.18,1.21])],q)
  grip=u.turn(grip,heading);axis=u.turn(axis,heading);off=u.turn(off,heading)
  for p in [grip,off]:
   for k in range(2):p[k]+=center[k]
  bend=u.track([(start,.25 if low else .18),(prep,.34 if low else .24),(hit,.43 if low else .30),(follow,.39 if low else .27),(end,.25 if low else .18)],q)
  poses.append(recovery_clearance(prefix+'Musou_Flow',build_pose(t,duration,heading+hip,u.track(heading_keys,max(0,t-.035))+chest,bend,[*center,-load],grip,axis,off,feet,roll+chest*(.55 if low else .95),low),t))
 return dict(duration=duration,twoHanded=False,athleticAttack=True,nativeReachLimit=.94 if low else .95,rootAdvance=0,impacts=hits,headings=headings,nativeSampleRate=120,footPlants={s:u.plants(events[s],duration) for s in base},poses=poses)

def audit(records,original):
 report=[]
 for name,r in records.items():
  assert r['duration']==original[name]['duration'];assert r['impacts']==original[name].get('impacts',HITS[NAMES.index(name.split('_',1)[1])] if 'Musou' not in name else [])
  size=length([b-a for a,b in zip(original[name]['poses'][0]['grip'],original[name]['poses'][0]['tip'])]);max_error=max(abs(length([b-a for a,b in zip(p['grip'],p['tip'])])-size) for p in r['poses']);assert max_error<1e-6,(name,max_error)
  for hit in r['impacts']:
   assert all(any(a<=hit<=b for a,b in r['footPlants'][s]) for s in ['r','l']),(name,'unplanted impact',hit)
  drift=0
  for side,key in [('r','footR'),('l','footL')]:
   for a,b in r['footPlants'][side]:
    ps=[p[key] for p in r['poses'] if a+.001<=p['t']*r['duration']<=b-.001]
    if ps:drift=max(drift,max(length([x-y for x,y in zip(p,ps[0])]) for p in ps))
  assert drift<1e-6,(name,drift)
  for a,b in zip(r['poses'],r['poses'][1:]):
   assert b['t']-a['t']>1e-8,(name,'duplicate phase')
   for side in ['R','L']:
    key='foot'+side
    if math.hypot(a[key][0]-b[key][0],a[key][1]-b[key][1])>1e-5:
     assert min(a[key][2],b[key][2])>.025,(name,'moving foot clearance',side,b['t'])
  assert max(abs(p['chest']-p['hip']) for p in r['poses'])<.9,(name,'torso twist')
  for side in ['r','l']:
   for a,b in r['footPlants'][side]:
    ps=[p for p in r['poses'] if a+1e-7<=p['t']*r['duration']<=b-1e-7]
    if len(ps)>1:
     for p in ps:
      assert abs(p['yaw'+side.upper()]-ps[0]['yaw'+side.upper()])<1e-6,(name,'planted twist')
  if name.endswith('Heavy_Sweep'):
   axes=[]
   for hit in r['impacts']:
    p=next(p for p in r['poses'] if abs(p['t']*r['duration']-hit)<1e-7)
    v=[b-a for a,b in zip(p['grip'],p['tip'])];axes.append([x/length(v) for x in v])
   assert sum(a*b for a,b in zip(*axes))<.45,(name,'second cut direction')
  for p in r['poses']:
   t=p['t']*r['duration']
   assert any(any(a-1e-8<=t<=b+1e-8 for a,b in r['footPlants'][s]) for s in ['r','l']),(name,'no grounded support',t)
  leads=[]
  for hit in r['impacts']:
   peak={}
   for key in ['hip','chest']:
    rates=[]
    for a,b in zip(r['poses'],r['poses'][1:]):
     t=b['t']*r['duration'];dt=(b['t']-a['t'])*r['duration']
     if hit-.11<=t<=hit+.025 and dt>0:rates.append((abs(b[key]-a[key])/dt,t))
    peak[key]=max(rates)[1]
   leads.append(peak['chest']-peak['hip'])
  assert min(leads)>.015,(name,'hip/chest sequencing',leads)
  assert all(math.isfinite(v) for p in r['poses'] for value in p.values() for v in (value if isinstance(value,list) else [value]))
  report.append(dict(clip=name,samples=len(r['poses']),shaftLength=size,maxShaftError=max_error,plantDrift=drift,impacts=r['impacts'],nativeReachLimit=r['nativeReachLimit'],hipLeadSeconds=leads))
 return report
def generate(original):
 records={}
 for prefix in ['Ring_','Sickle_']:
  for i,name in enumerate(NAMES):records[prefix+name]=regular(prefix,i,original[prefix+name])
  records[prefix+'Musou_Flow']=musou(prefix,original[prefix+'Musou_Flow'])
 return records

def repeat_error(a,b):
 if isinstance(a,dict):
  assert a.keys()==b.keys()
  return max(repeat_error(a[k],b[k]) for k in a)
 if isinstance(a,list):
  assert len(a)==len(b)
  return max((repeat_error(x,y) for x,y in zip(a,b)),default=0)
 return abs(a-b)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',default='/tmp/ninja-agile-motion.json');parser.add_argument('--audit',default='/tmp/ninja-agile-motion-audit.json');args=parser.parse_args()
 original=json.loads((ROOT/'src/motion-data.json').read_text());records=generate(original);report=audit(records,original)
 repeated=records
 for _ in range(5):
  repeated=generate({**original,**repeated})
  error=repeat_error(records,repeated)
  assert error<1e-12,('repeat authoring drift',error)
 pathlib.Path(args.output).write_text(json.dumps(records,separators=(',',':'))+'\n');pathlib.Path(args.audit).write_text(json.dumps(report,indent=2)+'\n');print(f'Authored and audited {len(records)} clips: {args.output}; five repeat passes differ by at most {error:.3g}')
