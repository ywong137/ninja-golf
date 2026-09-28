"""Add distinct whole-body weapon guards without changing existing motion landmarks."""
import copy,json,pathlib,math
path=pathlib.Path(__file__).resolve().parents[1]/'src/motion-data.json';data=json.loads(path.read_text())
specs={
 'Odachi':([- .12,-.38,1.31],[.65,-.65,1.89],True,-.12),
 'Twin':([-.25,-.38,1.35],[.12,-.63,1.94],False,-.20),
 'Naginata':([-.21,-.42,1.26],[.73,-.52,1.70],True,.12),
 'Fan':([-.18,-.42,1.42],[-.15,-.55,2.03],False,-.22),
 'Ring':([-.15,-.42,1.27],[.22,-.58,1.79],False,.22),
 'Sickle':([-.23,-.39,1.31],[.10,-.64,1.81],False,-.28),
}
for style,(grip,tip,two,turn) in specs.items():
 base=copy.deepcopy(data[{'Fan':'Fan_Ready','Ring':'Ring_Ready','Sickle':'Sickle_Ready'}.get(style,'Cut_Diagonal')]['poses'][0])
 base.update(grip=grip,tip=tip,hip=turn*.55,chest=turn,bend=.24,shift=[0,.015,-.11],heel=0,step=0,footR=[-.19,-.035,0],footL=[.19,.13,0],yawR=turn*.4,yawL=turn*.35,roll=.45 if style=='Fan' else 0,offRoll=0,offGrip=[.24,-.40,1.36],offTip=[-.12,-.64,1.92])
 if style in ['Fan','Ring','Sickle']:base['freeHand']=.5
 def row(t,compression=0,opening=0):
  p=copy.deepcopy(base);p['t']=t;p['shift']=[.018*compression,.015+.065*compression,-.11-.045*compression+.06*opening]
  p['hip']+=.07*compression+.20*opening;p['chest']+=.19*compression+.40*opening;p['bend']+=.055*compression-.13*opening
  for field in ['grip','tip','offGrip','offTip']:
   p[field][1]+=.065*compression+.16*opening;p[field][2]-=.04*compression+.13*opening
  p['grip'][0]-=.16*opening;p['tip'][0]-=.32*opening;p['offGrip'][0]+=.18*opening;p['offTip'][0]+=.35*opening
  return p
 for kind,duration,rows in [('Loop',1.6,[row(0),row(.5,.10),row(1)]),('Impact',.30,[row(0),row(.2,1),row(.55,.45),row(1)]),('Break',.4,[row(0),row(.28,.3,1),row(.72,.1,.8),row(1,0,.45)])]:
  data[f'{style}_Guard_{kind}']=dict(duration=duration,twoHanded=two,gripSpacing=.30 if style=='Naginata' else .09,poses=rows)
 for direction,angle in [('Forward',0),('Right',math.pi/2),('Backward',math.pi),('Left',-math.pi/2)]:
  lateral=direction in ['Right','Left']
  # A .44m neutral stance plus .17m lateral travel stays below .78m wide.
  # Support moves at 4*amplitude/duration; runtime cadence uses walkSpeed.
  duration=.9;amplitude=.17 if lateral else .30;rows=[]
  for frame in range(91):
   t=frame/90;p=row(t);p['shift'][2]=-.18+.008*math.cos(t*math.tau*2);p['shift'][0]=-.025*math.sin((t+.25)*math.tau)
   p['bend']=.28;p['walkPhase']=t
   for side,offset in [('R',.25),('L',.75)]:
    phase=(t+offset)%1
    if phase<.5:travel=amplitude*(1-4*phase);lift=0
    else:
     u=(phase-.5)*2
     travel=(2*u**3-3*u*u+1)*(-amplitude)+(u**3-2*u*u+u)*(-2*amplitude)+(-2*u**3+3*u*u)*amplitude+(u**3-u*u)*(-2*amplitude)
     lift=.095*math.sin(math.pi*u)**2
    width=.22 if lateral else .23
    p['foot'+side]=[(-width if side=='R' else width)+math.sin(angle)*travel,(-.035 if side=='R' else .13)-math.cos(angle)*travel,lift]
    p['yaw'+side]=base['yaw'+side]
   rows.append(p)
  data[f'{style}_Guard_Walk_{direction}']=dict(duration=duration,twoHanded=two,gripSpacing=.30 if style=='Naginata' else .09,walkSpeed=4*amplitude/duration,poses=rows)
  if lateral:data[f'{style}_Guard_Walk_{direction}']['nativeStanceFeet']=True
path.write_text(json.dumps(data,separators=(',',':'))+'\n')
print('Authored42 weapon-specific guard and step clips')
