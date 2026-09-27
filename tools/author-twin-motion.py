"""Generate nine Twin_ attacks and their matching ready record without changing shared motion data or assets.

Run: python3 tools/author-twin-motion.py --output /tmp/ninja-twin-motion.json
The CPU checks validate source contracts. Native baking and visual review remain required.
"""
import argparse
import copy
import importlib.util
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = 'twin-standing-3'
spec = importlib.util.spec_from_file_location('kaede_helpers', ROOT / 'tools/author-kaede-motion.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
track, turn, foot_at, plants = helpers.track, helpers.turn, helpers.foot_at, helpers.plants
NAMES = ['Cut_Diagonal', 'Cut_Return', 'Cut_Rising', 'Cut_Sweep', 'Heavy_Cleave', 'Heavy_Rising', 'Heavy_Sweep', 'Heavy_Slam']
HITS = [[.15], [.16], [.20], [.20, .38], [.36], [.30], [.28, .53], [.47]]
BASE = {'r': [-.22, 0, 0], 'l': [.22, .07, 0]}
# The feet keep their lateral order. Cross-steps stagger fore/aft instead of
# passing one shin through the other. Directions use Blender X/Y/Z coordinates.
STEPS = [
 ('r', [-.25, -.20, 0], .14, 'Right advance with a left-blade cover'),
 ('l', [.27, -.19, 0], -.18, 'Left advance into the return cut'),
 ('r', [-.13, -.27, 0], .20, 'Narrow staggered step and rising body drive'),
 ('l', [.37, -.08, 0], -.28, 'Left lateral step through alternating sweeps'),
 ('r', [-.28, -.29, 0], .13, 'Deep right receiving step under descending blades'),
 ('l', [.14, -.27, 0], -.18, 'Left staggered cross-step from a low load'),
 ('r', [-.38, -.09, 0], .32, 'Wide right traverse and counter-rotating return'),
 ('l', [.29, -.30, 0], -.12, 'Left receiving step into a compact crouched finish'),
]

def sample(old, seconds):
    t = max(0, min(1, seconds / old['duration']))
    result={key: track([(p['t'], p[key]) for p in old['poses']], t)
            for key in old['poses'][0] if key != 't'}
    rows=old['poses'];index=0
    while index<len(rows)-2 and t>rows[index+1]['t']:index+=1
    a,b=rows[index:index+2];u=helpers.smooth((t-a['t'])/(b['t']-a['t']))
    for grip,tip in [('grip','tip'),('offGrip','offTip')]:
        va=[a[tip][k]-a[grip][k] for k in range(3)];vb=[b[tip][k]-b[grip][k] for k in range(3)]
        la,lb=magnitude(va),magnitude(vb);va=[x/la for x in va];vb=[x/lb for x in vb]
        dot=max(-1,min(1,sum(x*y for x,y in zip(va,vb))));angle=math.acos(dot)
        if angle<1e-6:direction=va
        elif math.pi-angle<1e-5:
            axis=[-va[1],va[0],0] if abs(va[2])<.9 else [0,-va[2],va[1]];length=magnitude(axis);axis=[x/length for x in axis]
            direction=[math.cos(math.pi*u)*va[k]+math.sin(math.pi*u)*axis[k] for k in range(3)]
        else:direction=[(math.sin((1-u)*angle)*va[k]+math.sin(u*angle)*vb[k])/math.sin(angle) for k in range(3)]
        result[tip]=[result[grip][k]+direction[k]*(la+(lb-la)*u) for k in range(3)]
    return result

def hand_time(name, seconds):
    # Broaden the two compressed seed strokes without moving their impacts.
    knots = ([(0,0),(.055,.075),(.085,.117),(.15,.15),(.4,.4)]
             if name == 'Twin_Cut_Diagonal' else
             [(0,0),(2.48,2.48),(2.58,2.63),(2.68,2.745),(2.82,2.82),(3.3,3.3)]
             if name == 'Twin_Musou_Flow' else None)
    if not knots:return seconds
    for (a,x),(b,y) in zip(knots,knots[1:]):
        if seconds <= b:return x+(y-x)*(seconds-a)/(b-a)
    return seconds

def magnitude(v):
    return math.sqrt(sum(x*x for x in v))

def body_pose(p, feet, hip, chest, shift, load):
    # Translate both hands with the changed body center. Keep each independent
    # blade vector, its original length, and its original roll unchanged.
    delta = [shift[k] - p['shift'][k] for k in range(3)]
    for key in ['grip', 'tip', 'offGrip', 'offTip']:
        p[key] = [p[key][k] + delta[k] for k in range(3)]
    p.update(hip=hip, chest=chest, shift=shift, bend=.17+load*.72,
             pelvisBend=(.17+load*.72)*.40, heel=0, step=0,
             footR=feet['r'][0], footL=feet['l'][0],
             yawR=feet['r'][1], yawL=feet['l'][1])
    for side, sign in [('R', -1), ('L', 1)]:
        pole = turn([sign*.45, -.16, 1.03-load*.35], chest)
        p['elbow'+side] = [pole[k]+(shift[k] if k < 2 else 0) for k in range(3)]
    return p

def regular(name, old, index):
    duration = old['duration']; hits = old.get('impacts', HITS[index]); first, last = hits[0], hits[-1]
    side, landing, yaw, description = STEPS[index]; other = 'l' if side == 'r' else 'r'
    heavy = index >= 4; entry = (.012, first-.04); recovery = max(last+.06, duration-.15)
    events = {'r': [], 'l': []}
    events[side] = [(entry[0], entry[1], landing, yaw, .09 if heavy else .08),
                    (recovery, duration-.01, BASE[side], 0, .075)]
    # Heavy receiving steps widen the rear support before the strike. It returns
    # after the lead foot, never while that foot is airborne.
    if heavy:
        split = first*.34
        rear = [BASE[other][0]*1.12, BASE[other][1]+.055, 0]
        events[other] = [(.008, split, rear, -yaw*.35, .065)]
        events[side][0] = (split+.012, first-.04, landing, yaw, .10)
        recovery = max(last+.055, duration-.34)
        middle = recovery+(duration-.01-recovery)*.65
        events[side][1] = (recovery, middle, BASE[side], 0, .075)
        events[other].append((middle+.004, duration-.005, BASE[other], 0, .065))
    sign = 1 if side == 'r' else -1
    hips = [(0, 0)]; chest = [(0, 0)]; loads = [(0, .06)]
    for j, hit in enumerate(hits):
        s = sign*(-1 if j%2 else 1); beginning = max(hips[-1][0]+.001, hit-.13)
        hips.extend([(beginning, -.18*s), (hit-.065, .30*s), (hit+.035, .36*s)])
        chest.extend([(beginning, -.30*s), (hit-.04, -.22*s), (hit+.035, .38*s)])
        loads.extend([(beginning, .18 if heavy else .12), (hit, .115 if heavy else .07), (hit+.04, .10 if heavy else .06)])
    for keys, end in [(hips, 0), (chest, 0), (loads, .06)]: keys.append((duration, end))
    poses=[]
    times=sorted({round(t, 9) for t in [i*duration/360 for i in range(361)]+hits+[v for es in events.values() for e in es for v in e[:2]]})
    for sec in times:
        p=sample(old, hand_time('Twin_'+name,sec)); feet={s: foot_at(BASE[s], events[s], sec) for s in BASE}
        center=[sum(feet[s][0][k]-BASE[s][k] for s in BASE)*.43 for k in range(2)]
        # Shift toward the remaining support during a transfer.
        for swing, support in [('r','l'),('l','r')]:
            transfer=helpers.smooth(feet[swing][0][2]/.07)*.055
            center[0]+=(-1 if support=='r' else 1)*transfer
        load=track(loads,sec); shift=center+[-load]
        p=body_pose(p,feet,track(hips,sec),track(chest,sec),shift,load);p['t']=sec/duration
        if sec in [0,duration]:
            # Exact existing ready pose, including both wrists and weapon vectors.
            p=copy.deepcopy(old['poses'][0 if sec==0 else -1]);p['t']=sec/duration;p['pelvisBend']=p['bend']*.40
        poses.append(p)
    result=copy.deepcopy(old);result.update(poses=poses, impacts=hits, athleticAttack=True,
        nativeReachLimit=.95, rootAdvance=0, footPlants={s:plants(events[s],duration) for s in BASE}, choreography=description)
    return result

def musou(old):
    duration=old['duration']; hits=old['impacts']; headings=old['headings']; events={'r':[],'l':[]}; keys=[(0,0)]
    for i in range(1,len(hits)):
        start=hits[i-1]+.065; end=hits[i]-.07; middle=(start+end)/2
        first='r' if i%2 else 'l'; second='l' if first=='r' else 'r'
        for side,a,b in [(first,start,middle),(second,middle+.004,end)]:
            events[side].append((a,b,turn(BASE[side],headings[i]),headings[i],.115))
        keys.extend([(start,headings[i-1]),(end,headings[i])])
    keys.append((duration,math.tau));poses=[]
    for i in range(793):
        sec=i*duration/792;p=sample(old,hand_time('Twin_Musou_Flow',sec));feet={s:foot_at(BASE[s],events[s],sec) for s in BASE}
        heading=track(keys,sec);j=min(range(len(hits)),key=lambda j:abs(sec-hits[j]));hit=hits[j];sign=1 if j%2==0 else -1
        start=hit-.21;t=max(start,sec)
        hip=track([(start,0),(hit-.14,-.17*sign),(hit-.08,.28*sign),(hit+.055,.38*sign),(hit+.14,0)],t)
        chest=track([(start,0),(hit-.12,-.30*sign),(hit-.04,-.20*sign),(hit+.06,.43*sign),(hit+.14,0)],t)
        load=track([(start,.075),(hit-.13,.16),(hit,.11),(hit+.075,.075),(hit+.15,.075)],t)
        if j==5:load=track([(start,.075),(hit-.13,.22),(hit,.24),(hit+.08,.18),(duration,.06)],t)
        origin=turn([0,.035,0],heading);center=[sum(feet[s][0][k] for s in BASE)*.5-origin[k] for k in range(2)]
        # Keep the center above the supporting leg during each turn.
        for swing,support in [('r','l'),('l','r')]:
            w=helpers.smooth(feet[swing][0][2]/.07)*.35
            for k in range(2):center[k]=center[k]*(1-w)+(feet[support][0][k]-origin[k])*w
        p=body_pose(p,feet,heading+hip,track(keys,max(0,sec-.025))+chest,center+[-load],load);p['t']=sec/duration;poses.append(p)
    # Existing pose at the endpoints is physically equivalent after the full turn.
    poses[0]=copy.deepcopy(old['poses'][0]);poses[-1]=copy.deepcopy(old['poses'][-1])
    for p in [poses[0],poses[-1]]:p['footR']=BASE['r'][:];p['footL']=BASE['l'][:];p['pelvisBend']=p['bend']*.40
    result=copy.deepcopy(old);result.update(poses=poses, athleticAttack=True,nativeReachLimit=.95,rootAdvance=0,
        footPlants={s:plants(events[s],duration) for s in BASE},nativeSampleRate=120,
        choreography='Alternating paired-blade cuts with sequential turning steps and a low final receiving stance')
    return result

def generate(data):
    records={}
    for index,name in enumerate(NAMES+['Musou_Flow']):
        key='Twin_'+name;old=data[key]
        # Reuse validated output from this exact authoring version. Re-sampling
        # generated curves would otherwise progressively soften the blade paths.
        if old.get('twinAuthorVersion')==VERSION:record=copy.deepcopy(old)
        else:record=musou(old) if name=='Musou_Flow' else regular(name,old,index)
        for pose in record['poses']:
            pose.setdefault('roll',0);pose.setdefault('offRoll',0);pose.setdefault('freeHand',0)
        record['nativeSampleRate']=120
        record['twinAuthorVersion']=VERSION;records[key]=record
    ready=copy.deepcopy(records['Twin_Cut_Diagonal']['poses'][0])
    rows=[]
    for t in [0,.5,1]:
        pose=copy.deepcopy(ready);pose['t']=t;rows.append(pose)
    records['Twin_Ready']=dict(duration=2,twoHanded=False,nativeAttackReady=True,
        nativeReachLimit=.95,rootAdvance=0,footPlants={'r':[[0,2]],'l':[[0,2]]},
        poses=rows,twinAuthorVersion=VERSION)
    return records

def validate(records,source):
    summary={}
    for name,clip in records.items():
        if name=='Twin_Ready':
            assert clip['nativeAttackReady'] and not clip.get('athleticAttack')
            endpoint=records['Twin_Cut_Diagonal']['poses'][0]
            for pose in clip['poses']:
                assert {k:v for k,v in pose.items() if k!='t'}=={k:v for k,v in endpoint.items() if k!='t'},'Ready pose does not match attack'
            summary[name]={'samples':len(clip['poses']),'duration':clip['duration'],'exactAttackEndpoint':True}
            continue
        old=source[name];assert clip['duration']==old['duration'];duration=clip['duration']
        assert clip['impacts']==old.get('impacts',HITS[NAMES.index(name[5:])] if name[5:] in NAMES else None)
        assert all(a['t']<b['t'] for a,b in zip(clip['poses'],clip['poses'][1:])),name
        minimum=10;max_speed=0
        for i,p in enumerate(clip['poses']):
            assert all(math.isfinite(v) for value in p.values() for v in (value if isinstance(value,list) else [value])),name
            distance=magnitude([p['footL'][k]-p['footR'][k] for k in range(3)]);minimum=min(minimum,distance);assert distance>.24,(name,'feet overlap',distance)
            assert abs(p['chest']-p['hip'])<.9,(name,'torso twist')
            assert all(k in p for k in ['offGrip','offTip','roll','offRoll','freeHand']),(name,'missing hand field')
            assert math.hypot(*p['grip'][:2])<.85,(name,'unreachable hand')
            for side,key in [('r','footR'),('l','footL')]:
                assert p[key][2]>=-1e-8
                if any(a+1e-6<=p['t']*duration<=b-1e-6 for a,b in clip['footPlants'][side]):assert abs(p[key][2])<1e-7,(name,'planted foot lifted')
            prior=sample(old,hand_time(name,p['t']*duration) if old.get('twinAuthorVersion')!=VERSION else p['t']*duration)
            for grip,tip in [('grip','tip'),('offGrip','offTip')]:
                length=magnitude([p[tip][k]-p[grip][k] for k in range(3)])
                expected=magnitude([prior[tip][k]-prior[grip][k] for k in range(3)])
                assert abs(length-expected)<1e-7,(name,'shaft length changed')
            if i:
                prev=clip['poses'][i-1];dt=(p['t']-prev['t'])*duration
                max_speed=max(max_speed,*[magnitude([p[f][k]-prev[f][k] for k in range(3)])/dt for f in ['footR','footL']])
                for foot in ['footR','footL']:
                    if math.dist(p[foot][:2],prev[foot][:2])>1e-5:assert min(p[foot][2],prev[foot][2])>.025,(name,'travel without clearance',foot)
        for side,key in [('r','footR'),('l','footL')]:
            for a,b in clip['footPlants'][side]:
                support=[p[key] for p in clip['poses'] if a+1e-6<p['t']*duration<b-1e-6]
                if support:assert all(magnitude([v[k]-support[0][k] for k in range(3)])<1e-7 for v in support),(name,'support drifts')
            for hit in clip['impacts']:assert any(a<=hit<=b for a,b in clip['footPlants'][side]),(name,'unplanted strike',side,hit)
        for key in ['grip','tip','offGrip','offTip']:
            assert magnitude([clip['poses'][-1][key][k]-old['poses'][-1][key][k] for k in range(3)])<1e-7,(name,'ready recovery')
        assert max_speed<5.9,(name,'excessive source foot speed',max_speed)
        assert all(set(p)==set(clip['poses'][0]) for p in clip['poses']), (name,'inconsistent pose fields')
        summary[name]={'samples':len(clip['poses']),'minimumFootDistance':round(minimum,3),'maximumFootSpeed':round(max_speed,3),'impacts':clip['impacts']}
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=pathlib.Path,default=ROOT/'src/motion-data.json');parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/ninja-twin-motion.json'));args=parser.parse_args()
    data=json.loads(args.source.read_text());records=generate(data)
    summary=validate(records,data);again=generate({**data,**records});assert records==again,'Repeated authoring changed output'
    validate(again,{**data,**records})
    args.output.write_text(json.dumps(records,separators=(',',':'))+'\n');print(json.dumps(summary,indent=2));print('Wrote',args.output)
if __name__=='__main__':main()
