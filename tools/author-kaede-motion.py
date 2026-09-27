"""Author Kaede's grounded fan choreography, including explicit support intervals."""
import json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def mix(a,b,u):return [x+(y-x)*u for x,y in zip(a,b)]
def turn(v,yaw):
 c,s=math.cos(yaw),math.sin(yaw);return [v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]]
def track(keys,t):
 for i in range(len(keys)-1):
  a,b=keys[i:i+2]
  if t<=b[0]:
   u=smooth((t-a[0])/(b[0]-a[0]));return mix(a[1],b[1],u) if isinstance(a[1],list) else a[1]+(b[1]-a[1])*u
 return keys[-1][1]
def shaft(keys,t):
 for i in range(len(keys)-1):
  a,b=keys[i:i+2]
  if t<=b[0]:
   u=smooth((t-a[0])/(b[0]-a[0]));va=a[1];vb=b[1];la=math.sqrt(sum(v*v for v in va));lb=math.sqrt(sum(v*v for v in vb));va=[v/la for v in va];vb=[v/lb for v in vb];angle=math.acos(max(-1,min(1,sum(x*y for x,y in zip(va,vb)))))
   if angle<.00001:return [v*.62 for v in va]
   return [.62*(math.sin((1-u)*angle)*x+math.sin(u*angle)*y)/math.sin(angle) for x,y in zip(va,vb)]
 return keys[-1][1]
READY=[-.19,-.21,1.43];READY_SHAFT=[-.30,-.09,.50]
# Prepared, contact and follow-through hand positions, followed by shaft directions.
GESTURES={
 'Cut_Diagonal':([-.27,-.15,1.48],[-.08,-.39,1.29],[.18,-.25,1.19],[.12,.05,.60],[.48,-.45,.12],[.56,.02,.18]),
 'Cut_Return':([.14,-.23,1.34],[-.20,-.40,1.24],[-.34,-.18,1.34],[.50,.12,.24],[-.51,-.32,.14],[-.53,.15,.24]),
 'Cut_Rising':([-.26,-.18,.98],[-.15,-.39,1.30],[-.12,-.21,1.49],[-.32,-.18,-.47],[.20,-.31,.48],[.18,.10,.58]),
 'Cut_Sweep':([-.31,-.12,1.20],[-.08,-.40,1.20],[.16,-.24,1.25],[-.53,.18,.10],[.53,-.27,.06],[.52,.25,.08]),
 'Heavy_Cleave':([-.15,-.13,1.54],[-.14,-.40,1.13],[-.10,-.32,1.00],[.08,.20,.58],[.08,-.48,-.38],[.24,-.42,-.38]),
 'Heavy_Rising':([-.28,-.14,.94],[-.13,-.40,1.32],[-.11,-.19,1.53],[-.27,-.24,-.50],[.20,-.32,.47],[.12,.16,.58]),
 'Heavy_Sweep':([.13,-.16,1.23],[-.16,-.39,1.22],[-.33,-.15,1.25],[.51,.21,-.10],[-.53,-.29,.07],[-.54,.23,.12]),
 'Heavy_Slam':([-.14,-.12,1.54],[-.16,-.38,1.00],[-.20,-.25,.94],[.10,.22,.56],[.12,-.47,-.38],[-.24,-.31,-.47])}
HITS=[[.15],[.16],[.20],[.20,.38],[.36],[.30],[.28,.53],[.47]]
# Entry foot, position change, and planted yaw. Different actions transfer onto different supports.
STEPS=[('r',[-.025,-.17,0],.16),('l',[.035,-.18,0],-.18),('r',[-.02,-.21,0],.12),('r',[-.14,-.08,0],.30),('r',[-.04,-.28,0],.16),('l',[.03,-.25,0],-.12),('l',[.14,-.12,0],-.30),('r',[-.055,-.26,0],.12)]
def foot_at(base,events,t):
 position=base[:];yaw=0
 for start,end,target,target_yaw,lift in events:
  if t<=start:break
  u=min(1,(t-start)/(end-start));position=mix(position,target,smooth((u-.16)/.68));position[2]=lift*math.sin(math.pi*u);yaw+=(target_yaw-yaw)*smooth((u-.16)/.68)
  if t<end:break
 return position,yaw
def plants(events,duration):
 cursor=0;result=[]
 for a,b,*_ in events:
  if a>cursor:result.append([cursor,a])
  cursor=b
 if cursor<duration:result.append([cursor,duration])
 return result
def assemble(sec,duration,hip,chest,bend,shift,grip,direction,off,feet,roll):
 # Elbow poles follow the torso rather than pulling through a fixed world-space plane.
 pole_r=turn([-.44,-.18,1.03+shift[2]*.4],chest);pole_l=turn([.45,-.16,1.04+shift[2]*.4],chest)
 for pole in [pole_r,pole_l]:pole[0]+=shift[0];pole[1]+=shift[1]
 return dict(t=sec/duration,grip=grip,tip=[grip[k]+direction[k] for k in range(3)],offGrip=off,offTip=[off[0]-.3,off[1]-.72,off[2]+.46],hip=hip,chest=chest,bend=bend,shift=shift,heel=0,step=0,footR=feet['r'][0],footL=feet['l'][0],yawR=feet['r'][1],yawL=feet['l'][1],elbowR=pole_r,elbowL=pole_l,roll=roll,offRoll=-.3,freeHand=.85)
def regular(name,duration,index):
 hits=HITS[index];hit=hits[0];heavy=index>=4;side,delta,yaw=STEPS[index];sign=-1 if index in [1,6] else 1;prep=hit*.34;release=hit-(.075 if index==7 else .055);follow=hit+.065
 base={'r':[-.22,0,0],'l':[.22,.07,0]};endfoot=[base[side][k]+delta[k] for k in range(3)];recovery=duration-.16;events={'r':[],'l':[]};events[side]=[(.014,hit-.035,endfoot,yaw,.085 if heavy else .075),(recovery,duration-.015,base[side],0,.075)]
 a,b,c,sa,sb,sc=GESTURES[name];hands=[(0,READY),(prep,a),(release,a),(hit,b),(follow,c)];directions=[(0,READY_SHAFT),(prep,sa),(release,sa),(hit,sb),(follow,sc)]
 hips=[(0,0),(prep,-.22*sign),(max(prep+.01,hit-.095),-.08*sign),(hit-.065,.38*sign),(follow,.43*sign)];chest=[(0,0),(prep,-.38*sign),(release,-.32*sign),(hit,.16*sign),(follow,.52*sign)]
 target_shift=[delta[0]*.4+(-.045 if side=='r' else .045),delta[1]*.53,-(.13 if heavy else .075)];load=.17 if heavy else .12
 shifts=[(0,[0,0,-.07]),(prep,[.025 if side=='r' else -.025,.02,-load]),(release,[target_shift[0]*.6,target_shift[1]*.6,-load]),(hit,target_shift),(follow,[target_shift[0],target_shift[1]*1.07,-(.105 if heavy else .065)])]
 bends=[(0,.17),(prep,.22),(release,.27),(hit,.34 if heavy else .23),(follow,.39 if heavy else .26)]
 free=[(0,[.30,-.23,1.28]),(prep,[.22,-.11,1.08]),(release,[.24,-.04,1.04]),(hit,[.30,.035,1.04]),(follow,[.34,.10,1.10])]
 if len(hits)>1:
  second=hits[1];reload=second-.09;last=second+.045
  hands.extend([(reload,c),(second,[-.12,-.38,1.22]),(last,a)]);directions.extend([(reload,sc),(second,[-sb[0],sb[1],sb[2]]),(last,sa)])
  hips.extend([(second-.10,.20*sign),(second-.065,-.36*sign),(last,-.42*sign)]);chest.extend([(reload,.44*sign),(second,-.17*sign),(last,-.49*sign)])
  shifts.extend([(second,[target_shift[0]*-.35,target_shift[1],-.12 if heavy else -.085]),(last,[target_shift[0]*-.5,target_shift[1]*.8,-.09])]);bends.extend([(second,.31 if heavy else .23),(last,.34 if heavy else .25)]);free.extend([(second,[.22,-.17,1.09]),(last,[.25,-.12,1.15])])
 for keys,value in [(hands,READY),(directions,READY_SHAFT),(hips,0),(chest,0),(shifts,[0,0,-.07]),(bends,.17),(free,[.30,-.23,1.28])]:keys.append((duration,value))
 # Recovery begins after the final contact; keep the stance fixed through every strike.
 times=sorted({round(t,9) for t in [i*duration/300 for i in range(301)]+hits+[e for ev in events.values() for row in ev for e in row[:2]]})
 poses=[]
 for t in times:
  h=track(hips,t);ch=track(chest,t);feet={s:foot_at(base[s],events[s],t) for s in base};poses.append(assemble(t,duration,h,ch,track(bends,t),track(shifts,t),track(hands,t),shaft(directions,t),track(free,t),feet,.45+ch*.8))
 return dict(duration=duration,twoHanded=False,athleticAttack=True,nativeReachLimit=.94,rootAdvance=0,impacts=hits,footPlants={s:plants(events[s],duration) for s in base},poses=poses)
def musou():
 duration=3.3;hits=[.42,.86,1.30,1.78,2.25,2.82];headings=[0,.95,2.10,3.5,4.82,math.tau];base={'r':[-.22,0,0],'l':[.22,.07,0]};events={'r':[], 'l':[]};heading_keys=[(0,0)]
 for i in range(1,6):
  start=hits[i-1]+.065;end=hits[i]-.065;mid=(start+end)/2;first='r' if i%2 else 'l'
  for side,a,b in [(first,start,mid),('l' if first=='r' else 'r',mid,end)]:events[side].append((a,b,turn(base[side],headings[i]),headings[i],.11))
  heading_keys.extend([(start,headings[i-1]),(end,headings[i])])
 heading_keys.append((duration,math.tau));poses=[];order=['Cut_Diagonal','Cut_Return','Cut_Rising','Heavy_Sweep','Cut_Return','Heavy_Slam']
 for i in range(661):
  t=i*duration/660;feet={s:foot_at(base[s],events[s],t) for s in base};heading=track(heading_keys,t);j=min(range(6),key=lambda j:abs(t-hits[j]));hit=hits[j];prep=hit-.18;release=hit-.075;follow=hit+.075;sign=-1 if j%2 else 1
  h=track([(hit-.23,0),(prep,-.18*sign),(hit-.095,-.08*sign),(hit-.065,.28*sign),(follow,.33*sign),(hit+.15,0)],t) if t>=hit-.23 else 0
  ch=track([(hit-.23,0),(prep,-.30*sign),(release,-.25*sign),(hit,.13*sign),(follow,.42*sign),(hit+.15,0)],t) if t>=hit-.23 else 0
  a,b,c,sa,sb,sc=GESTURES[order[j]];handkeys=[(hit-.23,READY),(prep,a),(release,a),(hit,b),(follow,c),(hit+.15,READY)];shaftkeys=[(hit-.23,READY_SHAFT),(prep,sa),(release,sa),(hit,sb),(follow,sc),(hit+.15,READY_SHAFT)]
  grip=track(handkeys,max(hit-.23,t));direction=shaft(shaftkeys,max(hit-.23,t));load=track([(hit-.23,.08),(prep,.15),(release,.16),(hit,.105),(follow,.08),(hit+.15,.08)],max(hit-.23,t))
  support='l' if feet['r'][0][2]>.005 else 'r' if feet['l'][0][2]>.005 else None
  center=[(feet['r'][0][k]+feet['l'][0][k])*.5 for k in range(2)]
  if support:
   weight=.55*smooth(max(feet['r'][0][2],feet['l'][0][2])/.055)
   for k in range(2):center[k]=center[k]*(1-weight)+feet[support][0][k]*weight
  origin=turn([0,.035,0],heading)
  center=[center[k]-origin[k] for k in range(2)]
  pelvis_bend=(.14+load)*.5
  # Each strike transfers across the support base; the final cut lowers the whole body.
  balance=track([(hit-.23,[0,0,0]),(prep,[.035*sign,.018,0]),(release,[-.025*sign,-.035,0]),(hit,[-.060*sign,-.070,0]),(follow,[-.075*sign,-.080,0]),(hit+.15,[0,0,0])],max(hit-.23,t))
  balance=turn(balance,heading)
  for k in range(2):center[k]+=balance[k]
  if j==5:load=track([(hit-.23,.08),(prep,.18),(release,.21),(hit,.24),(follow,.21),(3.15,.11),(duration,.07)],max(hit-.23,t))
  bend=track([(hit-.23,.22),(prep,.26),(release,.31),(hit,.38 if j in [0,3] else .29),(follow,.44 if j in [0,3] else .32),(hit+.15,.22)],max(hit-.23,t))
  if j==5:bend=track([(hit-.23,.22),(prep,.27),(release,.36),(hit,.46),(follow,.52),(3.15,.27),(duration,.17)],max(hit-.23,t))
  off=track([(hit-.23,[.30,-.23,1.28]),(prep,[.22,-.11,1.08]),(release,[.24,-.04,1.02]),(hit,[.31,.035,1.03]),(follow,[.34,.10,1.09]),(hit+.15,[.30,-.23,1.28])],max(hit-.23,t))
  shift=[center[0],center[1],-load];grip=turn(grip,heading);direction=turn(direction,heading);off=turn(off,heading)
  for p in [grip,off]:p[0]+=center[0];p[1]+=center[1]
  p=assemble(t,duration,heading+h,track(heading_keys,max(0,t-.035))+ch,bend,shift,grip,direction,off,feet,.45+ch*.8);p['pelvisBend']=pelvis_bend;poses.append(p)
 return dict(duration=duration,twoHanded=False,athleticAttack=True,nativeReachLimit=.94,rootAdvance=0,impacts=hits,headings=headings,nativeSampleRate=120,footPlants={s:plants(events[s],duration) for s in base},poses=poses)
def author(data):
 for index,name in enumerate(GESTURES):data['Fan_'+name]=regular(name,data['Fan_'+name]['duration'],index)
 data['Fan_Musou_Flow']=musou()
if __name__=='__main__':
 path=ROOT/'src/motion-data.json';data=json.loads(path.read_text());author(data);path.write_text(json.dumps(data,separators=(',',':'))+'\n');print('Authored all nine Kaede attacks')
