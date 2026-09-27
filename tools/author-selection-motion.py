"""Author relaxed selection poses separately from combat.

Run: python3 tools/author-selection-motion.py [--output src/selection-data.json]
Native hand targets use each avatar's actual shoulder and arm length. Source
palms are approximate carrier targets; runtime attachments use native palms.
"""
import argparse,copy,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROFILES={
 'ronin':('Ronin',[-.50,.70,-.50],.055,.36,.04),
 'shinobi':('Twin',[-.60,.35,-.72],-.040,.36,-.035),
 'monk':('Naginata',[-.10,.05,.99],.050,.34,.025),
 'kaede':('Fan',[-.45,.16,-.88],.045,.33,.035),
 'ayame':('Ring',[-.45,.25,-.86],-.045,.35,-.030),
 'sora':('Sickle',[-.27,.16,-.95],.035,.33,.020),
}

def normalized(v):
    length=math.sqrt(sum(x*x for x in v))
    return [x/length for x in v]

def author():
    records={}
    for hero,(prefix,shaft,weight,width,yaw) in PROFILES.items():
        shaft=normalized(shaft);dual=hero=='shinobi';duration=4.0;rows=[]
        for i in range(17):
            phase=i/16;breath=(1-math.cos(phase*math.tau))*.0015
            grip=[-.36,-.13,.96+breath];off=[.35,-.11,.94+breath]
            secondary=normalized([.60,.35,-.72] if dual else [.10,-.10,-.99])
            rows.append(dict(t=phase,grip=grip,tip=[grip[k]+shaft[k] for k in range(3)],
                offGrip=off,offTip=[off[k]+secondary[k] for k in range(3)],
                hip=yaw,chest=yaw*.5,bend=.025,pelvisBend=.01,
                shift=[weight,0,-.025+breath],heel=0,step=0,
                footR=[-width/2,-.045 if weight>0 else .045,0],
                footL=[width/2,.045 if weight>0 else -.045,0],yawR=.035,yawL=-.035,
                elbowR=[-.50,-.24,1.05],elbowL=[.50,-.23,1.04],
                roll=0,offRoll=0,freeHand=0 if dual else .65))
        rows[-1]=copy.deepcopy(rows[0]);rows[-1]['t']=1
        # Shoulder-relative wrist and elbow guides, in chest-local source axes,
        # as fractions of native upper-arm + forearm length. Target the wrist
        # directly so the palm basis cannot retract it behind the elbow.
        wrists={'r':[-.06,-.44,-.67],'l':[.06,-.44,-.67] if dual else [.06,-.08,-.92]}
        poles={'r':[-.08,.04,-.60],'l':[.08,.04,-.60]}
        # Clear the actual torso skin with a small outward arm angle. Rotate
        # wrist and guide together to retain elbow flexion and forearm direction.
        clearance={'ronin':{'r':6},'monk':{'r':14,'l':3},'sora':{'l':3}}.get(hero,{})
        for side,degrees in clearance.items():
            angle=math.radians(degrees)*(1 if side=='r' else -1)
            c,s=math.cos(angle),math.sin(angle)
            for offsets in [wrists,poles]:
                x,y,z=offsets[side];offsets[side]=[c*x+s*z,y,-s*x+c*z]
        records[prefix+'_Selection_Idle']=dict(duration=duration,twoHanded=False,
            nativeSelectionIdle=True,nativeSampleRate=30,nativeReachLimit=.94,
            selectionHero=hero,selectionWristOffsets=wrists,selectionElbowOffsets=poles,rootAdvance=0,
            selectionStandingKneeDegrees=12,
            selectionPelvisLateralCorrection={'ronin':-.015,'monk':-.005}.get(hero,0),
            footPlants={'r':[[0,duration]],'l':[[0,duration]]},poses=rows)
    return records

def validate(records):
    assert len(records)==6
    for name,clip in records.items():
        a,b=clip['poses'][0],clip['poses'][-1]
        assert {k:v for k,v in a.items() if k!='t'}=={k:v for k,v in b.items() if k!='t'}
        assert not clip.get('athleticAttack') and not clip.get('nativeAttackReady')
        for p in clip['poses']:
            for key in ['footR','footL','yawR','yawL']:assert p[key]==a[key]
            assert p['grip'][2]<1.05 and p['offGrip'][2]<1.05
            assert abs(p['bend'])<.05 and abs(p['chest'])<.03
        for offset in clip['selectionWristOffsets'].values():assert math.sqrt(sum(v*v for v in offset))<.94
    assert records==author(),'Selection authoring must be deterministic'

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=pathlib.Path,default=ROOT/'src/selection-data.json')
    args=parser.parse_args();records=author();validate(records)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(records,separators=(',',':'))+'\n')
    print('Wrote six separate selection clips to',args.output)
