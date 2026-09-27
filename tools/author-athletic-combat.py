"""Author the bounded six-clip combat pilot without changing other motion records."""
import argparse,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
PILOT=['Cut_Diagonal','Heavy_Cleave','Heavy_Sweep','Fan_Cut_Diagonal','Fan_Heavy_Cleave','Fan_Heavy_Sweep']
GESTURES={
 'Cut_Diagonal':([-.28,-.13,1.57],[-.54,.18,2.58],[.02,-.49,1.17],[.65,-1.29,.77],[.34,-.28,.99],[1.29,-.40,.59]),
 'Heavy_Cleave':([-.06,-.08,1.73],[-.10,.36,2.72],[0,-.48,1.11],[.02,-1.35,.46],[.03,-.39,.91],[.15,-1.23,.33]),
 'Heavy_Sweep':([-.32,-.13,1.20],[-1.26,.10,1.19],[.01,-.46,1.15],[.72,-1.20,1.17],[.34,-.20,1.21],[1.39,-.12,1.27]),
 'Fan_Cut_Diagonal':([-.31,-.10,1.50],[-.19,-.02,2.08],[-.05,-.42,1.39],[.39,-.78,1.56],[.33,-.22,1.47],[.78,-.17,1.85]),
 'Fan_Heavy_Cleave':([0,-.12,1.70],[.10,0,2.30],[-.02,-.43,1.22],[.01,-.95,.92],[.16,-.31,1.03],[.50,-.72,.80]),
 'Fan_Heavy_Sweep':([.28,-.10,1.20],[.76,.03,1.05],[-.03,-.44,1.23],[-.56,-.73,1.31],[-.36,-.09,1.38],[-.71,.08,1.85])}
def ease(value):
 value=max(0,min(1,value));return value*value*(3-2*value)
def curve(rows,t):
 i=0
 while i<len(rows)-2 and t>rows[i+1][0]:i+=1
 a,b=rows[i:i+2];prev=rows[max(0,i-1)];nxt=rows[min(len(rows)-1,i+2)];span=b[0]-a[0];u=(t-a[0])/span
 m0=0 if i==0 else (b[1]-prev[1])/(b[0]-prev[0]);m1=0 if i+1==len(rows)-1 else (nxt[1]-a[1])/(nxt[0]-a[0])
 return (2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*span*m1
def vector_curve(rows,t):return [curve([(s,v[k]) for s,v in rows],t) for k in range(3)]
def shaft_curve(hands,tips,t):
 i=0
 while i<len(hands)-2 and t>hands[i+1][0]:i+=1
 start,end=hands[i][0],hands[i+1][0];u=max(0,min(1,(t-start)/(end-start)))
 directions=[];lengths=[]
 for j in [i,i+1]:
  v=[tips[j][1][k]-hands[j][1][k] for k in range(3)];length=math.sqrt(sum(x*x for x in v));lengths.append(length);directions.append([x/length for x in v])
 a,b=directions;dot=max(-1,min(1,sum(x*y for x,y in zip(a,b))));angle=math.acos(dot)
 if angle<.00001:direction=a
 else:direction=[(math.sin((1-u)*angle)*x+math.sin(u*angle)*y)/math.sin(angle) for x,y in zip(a,b)]
 length=lengths[0]*(1-u)+lengths[1]*u
 return [v*length for v in direction]
def make_clip(name,old):
 duration=old['duration'];fan=name.startswith('Fan_');sweep=name.endswith('Sweep');heavy='Heavy' in name;hit=.28 if sweep else .36 if heavy else .15;hits=[hit,.53] if sweep else [hit]
 prep=hit*.32;release=hit-.05;follow=hit+.065
 ready=([-.19,-.21,1.43],[-.49,-.30,1.93]) if fan else ([-.06,-.34,1.21],[-.03,-1.20,1.85])
 a,b,c,d,e,f=GESTURES[name];hand=[(0,ready[0]),(prep,a),(release,a),(hit,c),(follow,e)];tip=[(0,ready[1]),(prep,b),(release,b),(hit,d),(follow,f)]
 sign=-1 if fan and sweep else 1
 hips=[(0,0),(prep,-.25*sign),(hit-min(.10,hit*.45),-.05*sign),(hit-min(.06,hit*.20),.42*sign),(hit,.44*sign),(follow,.46*sign)]
 if not heavy:hips=[(0,0),(prep,-.22*sign),(hit-.07,.08*sign),(hit-.025,.36*sign),(hit,.40*sign),(follow,.44*sign)]
 chest=[(0,0),(prep,-.43*sign),(release,-.34*sign),(hit,.20*sign),(follow,.57*sign)]
 final=follow
 if sweep:
  # A real return stroke crosses the second hit sector, rather than replaying damage alone.
  second=hits[1];reload=second-.09;second_follow=second+.065
  hand.extend([(reload,e),(second,[-.04,-.46,1.22]),(second_follow,a)])
  tip.extend([(reload,f),(second,[-.77,-1.22,1.11] if not fan else [.49,-.75,1.31]),(second_follow,b)])
  hips.extend([(second-.13,.22*sign),(second-.075,-.28*sign),(second-.045,-.40*sign),(second,-.41*sign),(second_follow,-.45*sign)])
  chest.extend([(reload,.46*sign),(second,-.15*sign),(second_follow,-.53*sign)])
  final=second_follow
 recovery=max(final+.015,duration-.18);end=duration-.025
 hand.extend([(duration,ready[0])]);tip.extend([(duration,ready[1])]);hips.append((duration,0));chest.append((duration,0))
 entry_start=.018;entry_end=hit-.035;advance=.28 if heavy else .10;foot_yaw=.16 if heavy else .10
 load=.175 if heavy else .105;base_load=.07 if fan else .06
 load_keys=[(0,base_load),(prep,load),(hit-.05,load+.014),(hit,.095),(follow,.075)]
 if sweep:load_keys.extend([(.43,.115),(.53,.09),(.595,.075)])
 load_keys.append((duration,base_load))
 shift_keys=[(0,[0,0,-base_load]),(prep,[.018,.012,-load]),(hit,[-.055,-advance*.52,-.095]),(follow,[-.044,-advance*.55,-.075])]
 if sweep:shift_keys.extend([(.43,[-.025,-advance*.40,-.115]),(.53,[.018,-advance*.37,-.09]),(.595,[.025,-advance*.28,-.075])])
 if heavy:
  # The landed leg accepts the body before the torso finishes its cut.
  shift_keys=[(0,[0,0,-base_load]),(prep,[.026,.018,-load]),(hit-.05,[-.025,-.085,-load-.014]),(hit,[-.075,-.145,-.13]),(follow,[-.078,-.16,-.115])]
  if sweep:shift_keys.extend([(.43,[-.045,-.145,-.16]),(.53,[.025,-.145,-.13]),(.595,[.035,-.13,-.11])])
  else:shift_keys.append((duration-.15,[-.065,-.145,-.105]))
 shift_keys.append((duration,[0,0,-base_load]))
 bend_keys=[(0,.10+base_load),(prep,.20),(release,.27),(hit,.36),(follow,.40)]
 if sweep:bend_keys.extend([(.43,.29),(.53,.35),(.595,.38)])
 else:bend_keys.append((duration-.15,.34))
 bend_keys.append((duration,.10+base_load))
 free_keys=[(0,[.30,-.23,1.28]),(prep,[.36,-.17,1.35]),(release,[.43,-.10,1.17]),(hit,[.45,.02,1.12]),(follow,[.43,.10,1.20])]
 if sweep:free_keys.extend([(.43,[.37,.04,1.28]),(.53,[.27,-.26,1.21]),(.595,[.31,-.30,1.29])])
 free_keys.append((duration,[.30,-.23,1.28]))
 poses=[]
 times=sorted({round(sec,9) for sec in [i*duration/240 for i in range(241)]+hits+[entry_start,entry_end,recovery,end]})
 for sec in times:
  hip=curve(hips,sec);ch=curve(chest,sec);grip=vector_curve(hand,sec);shaft=shaft_curve(hand,tip,sec);weapon_tip=[grip[k]+shaft[k] for k in range(3)]
  if sec<entry_end:
   u=max(0,min(1,(sec-entry_start)/(entry_end-entry_start)));travel=ease((u-.2)/.6);lift=(.075 if heavy else .065)*math.sin(math.pi*u)
  elif sec>recovery:
   u=max(0,min(1,(sec-recovery)/(end-recovery)));travel=1-ease((u-.2)/.6);lift=.065*math.sin(math.pi*u)
  else:travel=1;lift=0
  off=[.30-.12*math.sin(ch),-.17-.06*math.cos(ch),1.28+.08*math.sin(ch)] if fan else [.24,-.28,1.30]
  if fan and heavy:off=vector_curve(free_keys,sec)
  pose=dict(t=sec/duration,grip=grip,tip=weapon_tip,hip=hip,chest=ch,bend=curve(bend_keys,sec) if heavy else .10+curve(load_keys,sec),shift=vector_curve(shift_keys,sec),heel=0,step=advance*travel,offGrip=off,offTip=[off[0]-.3,off[1]-.72,off[2]+.46],elbowR=[-.46+.07*math.sin(ch),-.13,1.02],elbowL=[.47-.04*math.sin(ch),-.13,1.06],footR=[-.22-(.04*travel if heavy else 0),-advance*travel,max(0,lift)],footL=[.22,.07,0],yawR=foot_yaw*travel,yawL=0)
  if fan:pose.update(roll=.65+ch*1.5,offRoll=-.3,freeHand=.85)
  poses.append(pose)
 result=dict(old);result.update(poses=poses,athleticAttack=True,rootAdvance=0,impacts=hits,footPlants={'r':[[0,entry_start],[entry_end,recovery],[end,duration]],'l':[[0,duration]]})
 return result
if __name__=='__main__':
 argparse.ArgumentParser(description=__doc__).parse_args()
 path=ROOT/'src/motion-data.json';data=json.loads(path.read_text())
 for name in PILOT:data[name]=make_clip(name,data[name])
 path.write_text(json.dumps(data,separators=(',',':'))+'\n')
 print('Authored',', '.join(PILOT))
