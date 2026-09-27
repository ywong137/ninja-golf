"""Author distinct odachi and naginata combat; write selected records without changing shipping data.

Usage: python3 tools/author-heavy-motion.py [--output /tmp/ninja-heavy-motion.json]
"""
import argparse,importlib.util,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('support',ROOT/'tools/author-kaede-motion.py');support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
turn,track,foot_at,plants=support.turn,support.track,support.foot_at,support.plants
NAMES=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']
HITS=[[.15],[.16],[.20],[.20,.38],[.36],[.30],[.28,.53],[.47]]
BASE={'r':[-.22,0,0],'l':[.22,.07,0]}
# Each gesture defines shared-handle midpoints and shaft directions at preparation, contact and follow-through.
ODACHI={
 'Cut_Diagonal':([[-.18,-.13,1.44],[.03,-.38,1.13],[.20,-.23,1.00]],[[-.30,.14,.94],[.66,-.69,-.30],[.94,-.10,-.33]]),
 'Cut_Return':([[.18,-.15,1.29],[-.02,-.38,1.20],[-.22,-.20,1.31]],[[.81,.22,.54],[-.75,-.60,.28],[-.87,.18,.46]]),
 'Cut_Rising':([[-.20,-.16,.94],[.00,-.38,1.20],[.17,-.16,1.48]],[[-.55,-.22,-.80],[.41,-.63,.66],[.35,.07,.93]]),
 'Cut_Sweep':([[-.23,-.12,1.15],[.02,-.39,1.12],[.21,-.18,1.17]],[[-.94,.31,.07],[.77,-.63,.04],[.96,.26,.08]]),
 'Heavy_Cleave':([[.00,-.11,1.51],[.00,-.37,1.05],[.07,-.29,.96]],[[.00,.28,.96],[.04,-.78,-.62],[.20,-.75,-.63]]),
 'Heavy_Rising':([[-.19,-.15,.92],[.02,-.39,1.20],[.10,-.12,1.49]],[[-.35,-.28,-.89],[.32,-.67,.67],[.12,.11,.99]]),
 'Heavy_Sweep':([[.20,-.11,1.18],[-.01,-.40,1.15],[-.23,-.17,1.10]],[[.94,.33,.07],[-.83,-.55,-.08],[-.97,.21,-.11]]),
 'Heavy_Slam':([[-.06,-.08,1.51],[.00,-.38,.99],[.05,-.28,.91]],[[-.11,.34,.93],[.09,-.65,-.76],[.21,-.56,-.80]])}
NAGINATA={
 'Cut_Diagonal':([[.15,-.12,1.32],[-.03,-.38,1.14],[-.19,-.19,1.03]],[[.84,.26,.48],[-.77,-.60,-.21],[-.94,.10,-.32]]),
 'Cut_Return':([[-.20,-.15,1.08],[.01,-.38,1.16],[.20,-.18,1.29]],[[-.97,.13,-.18],[.85,-.51,.15],[.88,.22,.41]]),
 'Cut_Rising':([[.18,-.13,.98],[-.02,-.38,1.22],[-.12,-.15,1.43]],[[.72,.03,-.69],[-.53,-.58,.62],[-.45,.20,.87]]),
 'Cut_Sweep':([[.20,-.10,1.12],[-.02,-.40,1.09],[-.23,-.16,1.11]],[[.96,.27,.04],[-.88,-.46,.05],[-.97,.23,.03]]),
 'Heavy_Cleave':([[.17,-.10,1.42],[-.04,-.39,1.08],[-.20,-.22,.98]],[[.74,.30,.60],[-.73,-.59,-.34],[-.85,.15,-.50]]),
 'Heavy_Rising':([[.15,-.13,.94],[-.03,-.39,1.23],[-.12,-.12,1.46]],[[.64,.07,-.76],[-.55,-.51,.66],[-.39,.24,.89]]),
 'Heavy_Sweep':([[-.21,-.11,1.15],[.01,-.41,1.10],[.23,-.14,1.13]],[[-.97,.23,.02],[.91,-.40,.08],[.95,.30,.06]]),
 'Heavy_Slam':([[.10,-.10,1.46],[-.01,-.38,.99],[-.13,-.24,.95]],[[.35,.27,.90],[-.43,-.56,-.70],[-.59,.05,-.81]])}
PROFILES={
 'odachi':dict(prefix='',spacing=.09,ready=[-.015,-.30,1.19],shaft=[.02,-.79,.61],gestures=ODACHI,headings=[0,1.05,2.20,3.50,4.85,math.tau],steps=[('r',[-.035,-.20,0],.14),('l',[.035,-.17,0],-.14),('r',[-.025,-.22,0],.14),('r',[-.13,-.09,0],.26),('r',[-.05,-.29,0],.16),('l',[.025,-.25,0],-.12),('l',[.13,-.10,0],-.26),('r',[-.055,-.28,0],.16)]),
 'naginata':dict(prefix='Naginata_',spacing=.28,ready=[-.015,-.27,1.13],shaft=[-.26,-.85,.46],gestures=NAGINATA,headings=[0,1.25,2.50,3.65,4.90,math.tau],steps=[('l',[.10,-.18,0],-.21),('r',[-.12,-.11,0],.22),('l',[.05,-.22,0],-.18),('l',[.17,-.07,0],-.32),('l',[.10,-.25,0],-.21),('r',[-.06,-.23,0],.17),('r',[-.17,-.09,0],.32),('l',[.08,-.24,0],-.19)])}
def normalized(v):
 length=math.sqrt(sum(x*x for x in v));assert length>.01
 return [x/length for x in v]
def spherical(keys,t):
 # Route near-opposed blade poses through a forward arc, never through a zero shaft.
 expanded=[keys[0]]
 for a,b in zip(keys,keys[1:]):
  x,y=normalized(a[1]),normalized(b[1])
  if sum(i*j for i,j in zip(x,y))<-.95:
   middle=[0,-1,.15]
   if abs(sum(i*j for i,j in zip(x,normalized(middle))))>.85:middle=[-.8,-.4,0]
   expanded.append(((a[0]+b[0])*.5,middle))
  expanded.append(b)
 for a,b in zip(expanded,expanded[1:]):
  if t<=b[0]:
   u=support.smooth((t-a[0])/(b[0]-a[0]));x,y=normalized(a[1]),normalized(b[1]);dot=max(-1,min(1,sum(i*j for i,j in zip(x,y))));angle=math.acos(dot)
   if angle<.00001:return x
   if dot<-.98:raise ValueError('Opposed shaft landmarks need an intermediate direction')
   return [(math.sin((1-u)*angle)*i+math.sin(u*angle)*j)/math.sin(angle) for i,j in zip(x,y)]
 return normalized(keys[-1][1])
def pose(t,duration,profile,mid,direction,hip,chest,bend,shift,feet,pelvis_bend=None):
 spacing=profile['spacing'];grip=[mid[k]+direction[k]*spacing*.5 for k in range(3)];off=[mid[k]-direction[k]*spacing*.5 for k in range(3)]
 poles={side:turn([sign*.46,-.15,1.01+shift[2]*.35],chest) for side,sign in [('R',-1),('L',1)]}
 for p in poles.values():p[0]+=shift[0];p[1]+=shift[1]
 return dict(t=t/duration,grip=grip,tip=[grip[k]+direction[k]*1.15 for k in range(3)],offGrip=off,offTip=[off[k]+direction[k]*1.15 for k in range(3)],hip=hip,chest=chest,bend=bend,pelvisBend=bend*.5 if pelvis_bend is None else pelvis_bend,shift=shift,heel=0,step=0,footR=feet['r'][0],footL=feet['l'][0],yawR=feet['r'][1],yawL=feet['l'][1],elbowR=poles['R'],elbowL=poles['L'],roll=0,offRoll=0)
def metadata(profile,duration,hits,events,poses,headings=None):
 result=dict(duration=duration,twoHanded=True,gripSpacing=profile['spacing'],nativeReachLimit=.96,nativeSampleRate=120,athleticAttack=True,rootAdvance=0,impacts=hits,footPlants={s:plants(events[s],duration) for s in BASE},poses=poses)
 if headings is not None:result.update(headings=headings,nativeSampleRate=120)
 return result
def regular(profile,name,index,duration):
 heavy=index>=4;pole=profile['prefix']!='';hits=HITS[index];hit=hits[0];side,delta,yaw=profile['steps'][index];sign=-1 if side=='l' else 1
 prep=hit*.32;release=hit-(.075 if index==7 else .055);follow=hit+.055
 moving=[BASE[side][k]+delta[k] for k in range(3)];recovery=max(hits[-1]+.07,duration-.17);end=duration-.015
 events={'r':[],'l':[]};events[side]=[(.014,hit-.035,moving,yaw,.09 if heavy else .08),(recovery,end,BASE[side],0,.075)]
 handles,directions=profile['gestures'][name];a,b,c=handles;sa,sb,sc=directions
 hands=[(0,profile['ready']),(prep,a),(release,a),(hit,b),(follow,c)];shafts=[(0,profile['shaft']),(prep,sa),(release,sa),(hit,sb),(follow,sc)]
 amplitude=.48 if pole else .38
 hips=[(0,0),(prep,-.23*sign),(max(prep+.01,hit-.115),-.20*sign),(hit-.045,amplitude*sign),(follow,(amplitude+.05)*sign)]
 if index==7:hips[2]=(hit-.13,-.20*sign);hips[3]=(hit-.065,amplitude*sign)
 chest=[(0,0),(prep,-.41*sign),(release,-.33*sign),(hit,.16*sign),(follow,(.61 if pole else .52)*sign)]
 load=(.20 if heavy else .15) if index in [3,6] else .18 if heavy else .12;advance=delta[1]*.52;side_shift=delta[0]*.40+(-.045 if side=='r' else .045)
 shifts=[(0,[0,0,-.065]),(prep,[-side_shift*.4,.018,-load]),(release,[side_shift*.5,advance*.6,-load]),(hit,[side_shift,advance,-.12 if heavy else -.075]),(follow,[side_shift*1.12,advance*1.06,-.10 if heavy else -.065])]
 bends=[(0,.17),(prep,.23),(release,.28),(hit,.36 if heavy else .24),(follow,.42 if heavy else .28)]
 if index in [3,6]:
  # A wide return sweep keeps both knees loaded; the far leg must not lock as weight crosses.
  shifts[-2][1][2]=-.16 if heavy else -.13;shifts[-1][1][2]=-.15 if heavy else -.125
 if index in [2,5]:
  # Rising cuts drive upward from the loaded legs instead of raising only the arms.
  shifts[-2][1][2]=-.065;shifts[-1][1][2]=-.045;bends[-2]=(hit,.21);bends[-1]=(follow,.18)
 if index==7:shifts[-2][1][2]=-.21;shifts[-1][1][2]=-.18;bends[-2]=(hit,.43);bends[-1]=(follow,.48)
 if len(hits)>1:
  second=hits[1];reload=second-.085;last=second+.045
  hands.extend([(reload,c),(second,[-b[0],b[1],b[2]]),(last,a)])
  shafts.extend([(reload,sc),(second,[-sb[0],sb[1],sb[2]]),(last,sa)])
  hips.extend([(second-.10,.20*sign),(second-.065,-amplitude*sign),(last,-(amplitude+.03)*sign)])
  chest.extend([(reload,.48*sign),(second,-.16*sign),(last,-.54*sign)])
  shifts.extend([(second,[-side_shift*.45,advance,-.18 if heavy else -.15]),(last,[-side_shift*.6,advance*.85,-.17 if heavy else -.15])])
  if recovery>last:shifts.append((recovery,shifts[-1][1][:]))
  bends.extend([(second,.32 if heavy else .24),(last,.37 if heavy else .27)])
 for keys,value in [(hands,profile['ready']),(shafts,profile['shaft']),(hips,0),(chest,0),(shifts,[0,0,-.065]),(bends,.17)]:keys.append((duration,value))
 pelvis_keys=[(time,value*.5) for time,value in bends]
 if index==7:pelvis_keys=[(0,.085),(prep,.115),(release,.14),(hit,.135),(follow,.14),(duration,.085)]
 times=sorted({round(t,9) for t in [i*duration/360 for i in range(361)]+hits+[v for ev in events.values() for e in ev for v in e[:2]]})
 poses=[pose(t,duration,profile,track(hands,t),spherical(shafts,t),track(hips,t),track(chest,t),track(bends,t),track(shifts,t),{s:foot_at(BASE[s],events[s],t) for s in BASE},track(pelvis_keys,t)) for t in times]
 result=metadata(profile,duration,hits,events,poses)
 if pole and name=='Heavy_Rising':
  # Keep the handle in front of the right shoulder while lowering the blade.
  # Folding the wrist back beside the shoulder reverses the elbow's IK plane.
  for p in poses:
   seconds=p['t']*duration
   weight=support.smooth((seconds-follow)/.105)*(1-support.smooth((seconds-.50)/.17))
   for key in ['grip','tip','offGrip','offTip']:
    p[key][0]-=.055*weight;p[key][1]-=.12*weight
  # Steer the elbow outward before the lowering shaft approaches the old pole.
  # The wide guide keeps a nonzero projection onto the shoulder/wrist plane.
  for p in poses:
   seconds=p['t']*duration
   weight=support.smooth((seconds-.345)/.08)*(1-support.smooth((seconds-.53)/.19))
   guide=[-.8,-.2,1.0]
   p['elbowR']=[p['elbowR'][k]*(1-weight)+guide[k]*weight for k in range(3)]
 if not pole and name=='Cut_Diagonal':result['carryExitDuration']=.11
 return result
def musou(profile):
 duration=3.3;hits=[.42,.86,1.30,1.78,2.25,2.82];angles=profile['headings'];pole=bool(profile['prefix']);events={'r':[],'l':[]};heading_keys=[(0,0)]
 order=['Cut_Diagonal','Cut_Return','Heavy_Rising','Heavy_Sweep','Cut_Return','Heavy_Slam'] if not pole else ['Cut_Sweep','Cut_Return','Cut_Rising','Heavy_Sweep','Heavy_Cleave','Heavy_Slam']
 for j in range(1,6):
  start=hits[j-1]+.065;end=hits[j]-.080;mid=(start+end)/2;first='r' if j%2 else 'l'
  for side,a,b in [(first,start,mid),('l' if first=='r' else 'r',mid,end)]:
   # Naginata turns step wider; odachi turns keep a compact braced base.
   base=BASE[side][:];base[0]*=1.12 if pole else 1.04;events[side].append((a,b,turn(base,angles[j]),angles[j],.115 if pole else .10))
  heading_keys.extend([(start,angles[j-1]),(end,angles[j])])
 # Return to the exact ready stance after the last cut.
 for side,a,b in [('r',3.04,3.15),('l',3.15,3.27)]:events[side].append((a,b,BASE[side],math.tau,.065))
 heading_keys.append((duration,math.tau));poses=[]
 for i in range(793):
  t=i*duration/792;feet={s:foot_at(BASE[s],events[s],t) for s in BASE};heading=track(heading_keys,t);j=max([0]+[n for n in range(6) if t>=hits[n]-.28]);hit=hits[j];start=hit-.28;prep=hit-.16;release=hit-.075;follow=hit+.075;sec=max(start,t);sign=1 if j%2==0 else -1
  h=track([(start,0),(prep,-.21*sign),(hit-.10,-.07*sign),(hit-.065,.32*sign),(follow,.38*sign),(hit+.15,0)],sec)
  ch=track([(start,0),(prep,-.37*sign),(release,-.29*sign),(hit,.15*sign),(follow,(.60 if pole else .52)*sign),(hit+.15,0)],sec)
  handles,directions=profile['gestures'][order[j]];a,b,c=handles;sa,sb,sc=directions
  mid=track([(start,profile['ready']),(prep,a),(release,a),(hit,b),(follow,c),(hit+.15,profile['ready'])],sec)
  direction=spherical([(start,profile['shaft']),(prep,sa),(release,sa),(hit,sb),(follow,sc),(hit+.15,profile['shaft'])],sec)
  load=track([(start,.065),(prep,.16),(release,.17),(hit,.10),(follow,.08),(hit+.15,.065)],sec);pelvis_bend=track([(start,.085),(prep,.15),(release,.155),(hit,.12),(follow,.11),(hit+.15,.085)],sec)
  bend=track([(start,.17),(prep,.24),(release,.28),(hit,.32),(follow,.37),(hit+.15,.17)],sec)
  if j==2:load=track([(start,.065),(prep,.18),(release,.16),(hit,.08),(follow,.05),(hit+.15,.065)],sec)
  if j==5:
   load=track([(start,.065),(prep,.18),(release,.21),(hit,.23),(follow,.20),(3.15,.10),(duration,.065)],sec)
   bend=track([(start,.17),(prep,.25),(release,.33),(hit,.44),(follow,.50),(3.15,.25),(duration,.17)],sec)
  center=[(feet['r'][0][k]+feet['l'][0][k])*.5 for k in range(2)];active='l' if feet['r'][0][2]>.005 else 'r' if feet['l'][0][2]>.005 else None
  if active:
   weight=.50*support.smooth(max(feet['r'][0][2],feet['l'][0][2])/.055)
   center=[center[k]*(1-weight)+feet[active][0][k]*weight for k in range(2)]
  origin=turn([0,.035,0],heading);balance=turn(track([(start,[0,0,0]),(prep,[.025*sign,.015,0]),(release,[-.02*sign,-.025,0]),(hit,[-.055*sign,-.065,0]),(follow,[-.065*sign,-.075,0]),(hit+.15,[0,0,0])],sec),heading)
  center=[center[k]-origin[k]+balance[k] for k in range(2)]
  mid=turn(mid,heading);direction=turn(direction,heading)
  for k in range(2):mid[k]+=center[k]
  poses.append(pose(t,duration,profile,mid,direction,heading+h,track(heading_keys,max(0,t-.04))+ch,bend,[center[0],center[1],-load],feet,pelvis_bend))
 return metadata(profile,duration,hits,events,poses,angles)
def ready(profile):
 duration=2.;feet={s:(BASE[s][:],0) for s in BASE};direction=normalized(profile['shaft'])
 poses=[pose(t,duration,profile,profile['ready'],direction,0,0,.17,[0,0,-.065],feet) for t in [0,1,2]]
 clip=metadata(profile,duration,[],{'r':[],'l':[]},poses);del clip['athleticAttack'];clip['nativeAttackReady']=True
 return clip
def check(records):
 report={}
 for name,clip in records.items():
  rows=clip['poses'];assert rows[0]['t']==0 and abs(rows[-1]['t']-1)<1e-9
  assert all(b['t']-a['t']>1e-7 for a,b in zip(rows,rows[1:])),name
  max_spacing_error=0;max_floor_motion=0;max_joint_target_step=0
  for p in rows:
   assert all(math.isfinite(x) for v in p.values() for x in (v if isinstance(v,list) else [v])),name
   assert abs(p['chest']-p['hip'])<.9,(name,'excessive torso twist')
   assert math.hypot(*p['grip'][:2])<.85,(name,'unbounded grip')
   direction=normalized([p['tip'][k]-p['grip'][k] for k in range(3)]);expected=[p['grip'][k]-direction[k]*clip['gripSpacing'] for k in range(3)];max_spacing_error=max(max_spacing_error,math.dist(expected,p['offGrip']))
  for side in ['r','l']:
   field='foot'+side.upper();yaw='yaw'+side.upper()
   for start,end in clip['footPlants'][side]:
    samples=[p for p in rows if start+1e-6<=p['t']*clip['duration']<=end-1e-6]
    if samples:
     assert max(math.dist(samples[0][field],p[field]) for p in samples)<1e-8,(name,side,'support drift')
     assert max(abs(samples[0][yaw]-p[yaw]) for p in samples)<1e-8,(name,side,'support yaw')
   for a,b in zip(rows,rows[1:]):
    travel=math.hypot(a[field][0]-b[field][0],a[field][1]-b[field][1])
    if travel>.00001:assert min(a[field][2],b[field][2])>.025,(name,side,'moving without clearance')
    if max(a[field][2],b[field][2])<.025:max_floor_motion=max(max_floor_motion,travel)
  for a,b in zip(rows,rows[1:]):max_joint_target_step=max(max_joint_target_step,math.dist(a['grip'],b['grip']),math.dist(a['offGrip'],b['offGrip']))
  assert max_spacing_error<1e-10,name
  assert max_floor_motion<.0005,(name,'low foot travel',max_floor_motion)
  assert max_joint_target_step<.09,(name,'discontinuous shared handle',max_joint_target_step)
  leads=[]
  for hit in clip['impacts']:
   peak={key:(0,0) for key in ['hip','chest']}
   for a,b in zip(rows,rows[1:]):
    time=b['t']*clip['duration'];dt=(b['t']-a['t'])*clip['duration']
    if not hit-.12<=time<=hit+.02:continue
    for key in peak:
     speed=abs(b[key]-a[key])/dt
     if speed>peak[key][0]:peak[key]=(speed,time)
   lead=peak['chest'][1]-peak['hip'][1];assert lead>.019,(name,'hip/chest timing',hit,lead);leads.append(lead)
  expected=[] if name.endswith('Ready') else [.42,.86,1.30,1.78,2.25,2.82] if 'Musou' in name else HITS[NAMES.index(name.removeprefix('Naginata_'))];assert clip['impacts']==expected
  report[name]={'duration':clip['duration'],'gripSpacing':clip['gripSpacing'],'poses':len(rows),'maximumGripSpacingError':max_spacing_error,'maximumLowFootStep':max_floor_motion,'maximumHandSampleStep':max_joint_target_step,'hipLeadSeconds':leads}
 for profile in PROFILES.values():
  prefix=profile['prefix'];rest=records[prefix+'Ready'];assert rest['nativeAttackReady'] and not rest.get('athleticAttack')
  for suffix in NAMES+['Musou_Flow']:
   for endpoint in [records[prefix+suffix]['poses'][0],records[prefix+suffix]['poses'][-1]]:
    for key,value in rest['poses'][0].items():
     if key=='t':continue
     target=endpoint[key]
     if isinstance(value,list):error=math.dist(value,target)
     elif key in ['hip','chest','yawR','yawL']:error=abs(math.atan2(math.sin(value-target),math.cos(value-target)))
     else:error=abs(value-target)
     assert error<1e-8,(prefix+suffix,'ready mismatch',key,error)
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',type=pathlib.Path,default=ROOT/'src/motion-data.json',help='Read clip durations from this motion mapping');parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/ninja-heavy-motion.json'));args=parser.parse_args();source=json.loads(args.input.read_text());records={}
 for profile in PROFILES.values():
  for index,name in enumerate(NAMES):records[profile['prefix']+name]=regular(profile,name,index,source[name]['duration'])
  records[profile['prefix']+'Musou_Flow']=musou(profile)
  records[profile['prefix']+'Ready']=ready(profile)
 report=check(records);args.output.write_text(json.dumps(records,separators=(',',':'))+'\n');report_path=args.output.with_suffix('.audit.json');report_path.write_text(json.dumps(report,indent=2)+'\n');print(f'Wrote {len(records)} attack/ready records to {args.output}; CPU checks: {report_path}')
