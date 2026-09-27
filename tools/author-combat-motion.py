"""Author athletic blade actions in armature coordinates; preserve golf landmarks."""
import json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
path=ROOT/'src/motion-data.json';data=json.loads(path.read_text())
def turn(v,a):
 c,s=math.cos(a),math.sin(a);return [round(v[0]*c-v[1]*s,6),round(v[0]*s+v[1]*c,6),v[2]]
def pose(t,grip,tip,hip=0,chest=0,load=.06,advance=0,yaw=0,off=None,lift=0):
 # Chest follows the pelvis. Local grip distances leave flexion in both elbows.
 g=turn(grip,yaw);d=turn(tip,yaw);shift=turn([-.035*math.sin(hip),-advance*.4,-load],yaw)
 p=dict(t=t,grip=g,tip=d,hip=hip+yaw,chest=chest+yaw,bend=.10+load,shift=shift,heel=max(0,advance),step=advance)
 p['offGrip']=turn(off or [.24,-.28,1.30],yaw)
 p['offTip']=turn([.30,-.70,2.15] if off is None else [off[0]-.3,off[1]-.72,off[2]+.46],yaw)
 p['elbowR']=turn([-.48,-.12,1.03],yaw);p['elbowL']=turn([.48,-.12,1.05],yaw)
 p['footR']=turn([-.22,-advance,lift],yaw);p['footL']=turn([.22,.07,0],yaw)
 # Horizontal coordinates are absolute; height is above the resting ankle.
 p['yawR']=yaw+hip*.6;p['yawL']=yaw+hip*.3
 return p
G=[-.06,-.34,1.21];T=[-.03,-1.20,1.85]
def guard(t,yaw=0):return pose(t,G,T,yaw=yaw)
# Every attack has preparation, hip initiation, contact, follow-through, then recovery.
sets={
 'Diagonal':([-.28,-.13,1.57],[-.54,.18,2.58],[.02,-.49,1.17],[.65,-1.29,.77],[.34,-.28,.99],[1.29,-.40,.59]),
 'Return':([.30,-.20,1.44],[.88,.04,2.22],[-.04,-.48,1.24],[-.77,-1.22,1.11],[-.34,-.20,1.10],[-1.33,-.30,.82]),
 'Rising':([-.25,-.24,.86],[-.80,-.50,.14],[.02,-.45,1.20],[.62,-1.12,1.85],[.25,-.18,1.65],[.59,-.14,2.67]),
 'Sweep':([-.32,-.13,1.20],[-1.26,.10,1.19],[.01,-.46,1.15],[.72,-1.20,1.17],[.34,-.20,1.21],[1.39,-.12,1.27]),
 'Cleave':([-.06,-.08,1.73],[-.10,.36,2.72],[.00,-.48,1.11],[.02,-1.35,.46],[.03,-.39,.91],[.15,-1.23,.33]),
 'Slam':([-.11,-.04,1.73],[-.35,.40,2.68],[.03,-.46,.99],[.30,-1.30,.26],[.16,-.34,.86],[.73,-1.16,.23])}
for name,clip in list(data.items()):
 if not (name.startswith(('Cut_','Heavy_','Twin_Cut_','Twin_Heavy_'))):continue
 kind=name.split('_')[-1];a,b,c,d,e,f=sets[kind];heavy='Heavy' in name;sign=-1 if kind=='Return' else 1
 hit=next((p['t'] for p in clip['poses'] if p['step']>.09),.40)
 if kind=='Sweep':hit=.43
 load=.13 if heavy else .095
 poses=[guard(0),pose(hit*.50,a,b,-.30*sign,-.59*sign,load),pose(hit*.78,a,b,.02*sign,-.38*sign,load+.015,advance=.06,lift=.045),pose(hit,c,d,.34*sign,.18*sign,.09,.17 if heavy else .11),pose(hit+.15,e,f,.48*sign,.66*sign,.065,.18 if heavy else .12),pose(.86,[v*.65+w*.35 for v,w in zip(e,G)],[v*.65+w*.35 for v,w in zip(f,T)],.22*sign,.36*sign,.07,.05,lift=.035),guard(1)]
 clip['poses']=poses
 # The second sword guards the head during the dominant cut, then counters during recovery.
 if name.startswith('Twin'):
  for i,p in enumerate(poses):
   if i in [4,5]:p['offGrip']=[-.04,-.43,1.26] if i==4 else [-.23,-.34,1.10];p['offTip']=[-.77,-1.07,1.41] if i==4 else [-1.12,-.61,.77]
# Six different strikes around a complete turn; yaw remains unwrapped through recovery.
impacts=[.42,.86,1.30,1.78,2.25,2.82]
def stepped(poses,angles):
 # Alternate the moving foot. Each planted foot holds its position and yaw exactly.
 def sample_row(t):
  i=0
  while i<len(poses)-2 and t>poses[i+1]['t']:i+=1
  a,b=poses[i:i+2];prev=poses[max(0,i-1)];nxt=poses[min(len(poses)-1,i+2)];span=b['t']-a['t'];u=(t-a['t'])/span
  def value(key,k=None):
   get=lambda r:r[key] if k is None else r[key][k]
   m0=0 if i==0 else (get(b)-get(prev))/(b['t']-prev['t']);m1=0 if i+1==len(poses)-1 else (get(nxt)-get(a))/(nxt['t']-a['t'])
   return (2*u**3-3*u*u+1)*get(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*get(b)+(u**3-u*u)*span*m1
  return {k:([value(k,j) for j in range(len(a[k]))] if isinstance(a[k],list) else value(k)) for k in a}
 dense=[sample_row(t) for t in sorted(set([p['t'] for p in poses]+[i/99 for i in range(100)]))]
 for p in dense:
  sec=p['t']*3.3
  for side,base in [('R',[-.22,-.10,0]),('L',[.22,.07,0])]:
   position=base[:];angle=0
   for j,target in enumerate(angles):
    if j==0:continue
    start=impacts[j-1]+.10;end=impacts[j]-.02;mid=(start+end)/2
    first='R' if j%2 else 'L';lo,hi=(start,mid) if side==first else (mid,end)
    if sec<=lo:break
    f=min(1,(sec-lo)/(hi-lo));ease=f*f*(3-2*f);goal=turn(base,target)
    position=[position[k]+(goal[k]-position[k])*ease for k in range(3)];position[2]=.085*math.sin(math.pi*f)
    angle=angle+(target-angle)*ease
    if sec<hi:break
   p['foot'+side]=position;p['yaw'+side]=angle
 dense[0]['t']=0;dense[-1]['t']=1
 return dense

for twin in [False,True]:
 poses=[guard(0)];angles=[0,1.15,2.35,3.60,4.95,math.tau];kinds=['Diagonal','Return','Rising','Sweep','Return','Slam']
 for j,(sec,yaw,kind) in enumerate(zip(impacts,angles,kinds)):
  a,b,c,d,e,f=sets[kind];sign=-1 if kind=='Return' else 1
  for dt,g,tip,h,ch,load,advance,lift in [(-.19,a,b,-.28*sign,-.55*sign,.14,.02,.065),(-.075,a,b,.10*sign,-.27*sign,.16,.10,.03),(0,c,d,.32*sign,.18*sign,.095,.17,0),(.10,e,f,.44*sign,.61*sign,.07,.16,0)]:
   p=pose((sec+dt)/3.3,g,tip,h,ch,load,advance,yaw,lift=lift)
   if twin:
    # Alternate guard and independent counter-cuts; never mirror the main blade.
    og=([.25,-.25,1.48] if dt<0 else [-.03,-.45,1.23]) if j%2==0 else ([.31,-.17,.96] if dt<0 else [.08,-.40,1.54])
    p['offGrip']=turn(og,yaw);p['offTip']=turn([og[0]-.75,og[1]-.55,og[2]+(.65 if j%2 else -.3)],yaw)
   poses.append(p)
 poses.extend([pose(3.11/3.3,[.16,-.29,1.0],[.67,-1.18,.73],.19,.32,.10,.06,math.tau,lift=.035),guard(1,math.tau)])
 dense=stepped(poses,angles)
 data[('Twin_' if twin else '')+'Musou_Flow']=dict(duration=3.3,twoHanded=not twin,impacts=impacts,headings=angles,poses=dense)
# The three women use independent silhouettes, trajectories, and recoveries.
# Each gesture names preparation, contact, and follow-through grip/shaft pairs.
styles={
 'Fan':dict(guard=([-.19,-.21,1.43],[-.49,-.30,1.93]),free=[.34,-.18,1.18],load=.07,angles=[0,.95,2.10,3.5,4.82,math.tau],roll=.65,gestures=[
  ([[-.31,-.10,1.50],[-.05,-.42,1.39],[.33,-.22,1.47]],[[.12,.08,.58],[.44,-.36,.17],[.45,.05,.38]]),
  ([[.23,-.19,1.56],[-.12,-.43,1.24],[-.36,-.16,1.21]],[[-.10,.03,.61],[-.48,-.34,.04],[-.55,.15,.10]]),
  ([[-.27,-.19,1.01],[-.12,-.40,1.39],[-.20,-.13,1.68]],[[-.44,-.12,-.20],[-.10,-.45,.40],[.15,.06,.59]]),
  ([[-.37,-.05,1.28],[-.02,-.44,1.30],[.35,-.12,1.31]],[[-.47,.20,.10],[.48,-.35,.05],[.48,.25,.10]]),
  ([[.00,-.12,1.70],[-.02,-.43,1.22],[.16,-.31,1.03]],[[.10,.12,.60],[.03,-.52,-.30],[.34,-.41,-.23]]),
  ([[-.32,-.18,1.05],[.02,-.43,1.50],[.29,-.10,1.67]],[[-.43,.01,-.27],[.20,-.37,.45],[.39,.16,.43]]),
  ([[.28,-.10,1.20],[-.03,-.44,1.23],[-.36,-.09,1.38]],[[.48,.13,-.15],[-.53,-.29,.08],[-.35,.17,.47]]),
  ([[-.27,-.04,1.69],[.03,-.41,1.09],[.25,-.20,1.05]],[[-.18,.16,.55],[.34,-.40,-.27],[.55,.06,-.10]])]),
 'Ring':dict(guard=([-.31,-.14,1.07],[-.57,-.32,1.63]),free=[.17,-.22,1.39],load=.12,angles=[0,1.4,2.6,3.8,5.05,math.tau],roll=-.7,gestures=[
  ([[-.36,-.06,.99],[-.08,-.40,1.23],[.24,-.12,1.45]],[[-.26,.16,.52],[.17,-.46,.38],[.46,.03,.30]]),
  ([[.24,-.15,1.46],[-.03,-.40,1.17],[-.34,-.14,.93]],[[.35,.03,.46],[-.40,-.39,.21],[-.47,.10,-.19]]),
  ([[-.26,-.21,.88],[-.13,-.38,1.29],[-.24,-.08,1.69]],[[-.45,-.11,.22],[.05,-.43,.48],[.12,.17,.52]]),
  ([[-.33,.03,1.19],[.02,-.40,1.15],[.32,.01,1.12]],[[-.41,.31,.20],[.45,-.35,.16],[.36,.37,.28]]),
  ([[-.20,-.06,1.65],[-.03,-.40,1.08],[.23,-.19,.94]],[[-.10,.16,.58],[.30,-.42,-.18],[.50,-.08,-.23]]),
  ([[.28,-.08,.96],[-.09,-.39,1.38],[-.25,-.10,1.64]],[[.46,.18,.22],[-.27,-.39,.42],[-.32,.12,.48]]),
  ([[.30,.03,1.38],[-.02,-.40,1.12],[-.32,.03,1.36]],[[.40,.28,.27],[-.48,-.33,.06],[-.42,.23,.33]]),
  ([[-.30,-.12,1.63],[.02,-.42,.97],[.26,-.11,1.05]],[[-.30,.02,.51],[.29,-.40,-.25],[.45,.24,-.16]])]),
 'Sickle':dict(guard=([-.31,-.08,1.17],[-.51,-.39,1.72]),free=[.19,-.39,1.21],load=.105,angles=[0,.86,2.05,3.34,4.75,math.tau],roll=.2,gestures=[
  ([[-.31,-.01,1.58],[-.02,-.45,1.28],[-.24,-.17,1.05]],[[-.21,.02,.66],[.12,-.54,-.16],[-.16,-.36,.46]]),
  ([[.18,-.20,1.22],[-.12,-.43,1.18],[-.37,-.05,1.29]],[[.38,-.38,.12],[-.32,-.49,.06],[-.40,.11,.48]]),
  ([[-.29,-.09,.95],[-.09,-.43,1.28],[-.27,-.11,1.56]],[[-.13,-.49,-.29],[.10,-.50,.30],[-.10,.00,.68]]),
  ([[-.31,.02,1.13],[.02,-.43,1.08],[.21,-.17,1.03]],[[-.47,.12,.20],[.48,-.39,.05],[.34,-.26,.30]]),
  ([[-.23,-.02,1.71],[-.06,-.44,1.13],[-.30,-.14,.97]],[[-.16,.01,.67],[.22,-.48,-.35],[-.10,-.40,.35]]),
  ([[.24,-.13,1.05],[-.02,-.45,1.41],[-.33,-.06,1.53]],[[.43,-.29,-.14],[-.14,-.48,.39],[-.17,.05,.63]]),
  ([[.24,-.12,1.42],[-.05,-.44,1.17],[-.35,-.05,1.02]],[[.36,-.08,.57],[-.50,-.31,-.16],[-.29,.05,.56]]),
  ([[-.19,.01,1.68],[.01,-.43,.98],[-.27,-.08,1.02]],[[-.08,.04,.66],[.39,-.44,-.33],[-.14,-.30,.51]])])}
base_names=['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam']
attack_hits=[[.15],[.16],[.20],[.20,.38],[.36],[.30],[.28,.53],[.47]]
def class_pose(style,t,grip,shaft,phase=0,yaw=0,heavy=False):
 st=styles[style];hip=phase*.34;chest=phase*.53
 load=st['load']+(abs(phase)*.025 if heavy else 0)
 if phase<0:hip*=.6;load+=.035
 off=st['free'][:]
 if style=='Fan':off=[.29+abs(phase)*.08,-.18,1.20+phase*.15]
 elif style=='Ring':off=[.16,-.22,1.39-abs(phase)*.08]
 else:off=[.19,-.34+.13*max(0,phase),1.23]
 p=pose(t,grip,[grip[i]+shaft[i] for i in range(3)],hip,chest,load,.12*max(0,phase),yaw,off,lift=.04 if phase<-.5 else 0)
 p['roll']=st['roll']+phase*(1.15 if style=='Fan' else 1.55 if style=='Ring' else .65);p['offRoll']=-.3;p['freeHand']=.85 if style=='Fan' else .55 if style=='Ring' else .3
 # Balance each weapon with a characteristic stance and counter-arm.
 if style=='Ring':p['shift'][0]+=.06*math.sin(yaw+phase);p['bend']+=.04
 if style=='Sickle':p['bend']+=.06;p['shift'][1]-=.025*math.cos(yaw)
 return p
def class_guard(style,t,yaw=0):
 g,tip=styles[style]['guard'];return class_pose(style,t,g,[tip[i]-g[i] for i in range(3)],yaw=yaw)
for style,st in styles.items():
 ready=[class_guard(style,0),class_guard(style,.5),class_guard(style,1)];ready[1]['shift'][2]-=.008;ready[1]['offGrip'][2]+=.012
 data[style+'_Ready']=dict(duration=2.4,twoHanded=False,poses=ready)
 for index,name in enumerate(base_names):
  duration=data[name]['duration'];hit=attack_hits[index][0]/duration;grips,shafts=st['gestures'][index];heavy=index>=4
  rows=[class_guard(style,0),class_pose(style,hit*.45,grips[0],shafts[0],-.8,heavy=heavy),class_pose(style,hit*.78,grips[0],shafts[0],-.25,heavy=heavy),class_pose(style,hit,grips[1],shafts[1],.45,heavy=heavy),class_pose(style,hit+.13,grips[2],shafts[2],1,heavy=heavy)]
  if len(attack_hits[index])>1:
   second=attack_hits[index][1]/duration
   rows.extend([class_pose(style,second,grips[1],[-shafts[1][0],shafts[1][1],shafts[1][2]],-.45,heavy=heavy),class_pose(style,second+.10,grips[0],shafts[0],-.85,heavy=heavy)])
  rows.append(class_guard(style,1));data[style+'_'+name]=dict(duration=duration,twoHanded=False,poses=rows)
 rows=[class_guard(style,0)];order={'Fan':[0,3,2,1,6,7],'Ring':[2,1,3,5,6,7],'Sickle':[0,1,5,3,4,7]}[style]
 for j,(sec,yaw,index) in enumerate(zip(impacts,st['angles'],order)):
  grips,shafts=st['gestures'][index]
  for offset,part,phase in [(-.19,0,-.8),(-.075,0,-.2),(0,1,.45),(.10,2,1)]:rows.append(class_pose(style,(sec+offset)/3.3,grips[part],shafts[part],phase,yaw,True))
 rows.extend([class_guard(style,3.15/3.3,math.tau),class_guard(style,1,math.tau)])
 dense=stepped(rows,st['angles'])
 for p in dense:
  delta=[p['tip'][i]-p['grip'][i] for i in range(3)];length=math.sqrt(sum(v*v for v in delta))
  p['tip']=[p['grip'][i]+delta[i]*.62/max(length,.001) for i in range(3)]
 data[style+'_Musou_Flow']=dict(duration=3.3,twoHanded=False,impacts=impacts,headings=st['angles'],poses=dense)

# Enemy clips gain an explicit anatomical guard and elbow poles.
for name,clip in data.items():
 if not name.startswith('Enemy'):continue
 for p in clip['poses']:
  p.update(offGrip=[.22,-.29,1.27],offTip=[.29,-.70,2.10],elbowR=[-.48,-.12,1.04],elbowL=[.48,-.12,1.04],footR=[-.22,-p['step'],0],footL=[.22,.07,0],yawR=p['hip']*.6,yawL=p['hip']*.3)
path.write_text(json.dumps(data,separators=(',',':'))+'\n')
