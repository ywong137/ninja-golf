"""Create fitted, skinned samurai costumes over Quaternius' CC0 human topology.
Run with Blender 5: blender --background --python tools/build-warriors.py
"""
import bpy, math, pathlib, json, bmesh
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source'
# The source package uses different suffixes for these two image references.
for stem in ['T_Hair_1_Normal','T_Eye_Normal']:
    dest=SOURCE/(stem+'_png.png')
    if not dest.exists():dest.write_bytes((SOURCE/(stem+'.png')).read_bytes())

def mat(name,color,rough=.65,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m

def bind(o,bone=None):
    bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
    if bone=='core':
        levels=[(.99,'pelvis'),(1.14,'spine_01'),(1.29,'spine_02'),(1.44,'spine_03')]
        for v in o.data.vertices:
            z=v.co.z
            j=next((i for i in range(3) if z<levels[i+1][0]),2)
            t=max(0,min(1,(z-levels[j][0])/(levels[j+1][0]-levels[j][0])))
            for name,w in [(levels[j][1],1-t),(levels[j+1][1],t)]:
                vg=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);vg.add([v.index],w,'REPLACE')
    elif bone:
        g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    else:
        groups={g.index:g.name for g in base.vertex_groups}
        for v in o.data.vertices:
            _,index,_=tree.find(v.co)
            for g in base.data.vertices[index].groups:
                name=groups[g.group];vg=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);vg.add([v.index],g.weight,'REPLACE')
    uv=o.data.uv_layers.new(name='ClothUV')
    for poly in o.data.polygons:
        for index in poly.loop_indices:
            v=o.data.vertices[o.data.loops[index].vertex_index].co
            uv.data[index].uv=(math.atan2(v.y,v.x)*2.5,v.z*10)
    mod=o.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;o.parent=rig
    for p in o.data.polygons:p.use_smooth=True
    parts.append(o);return o

def mesh(name,verts,faces,material,bone=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(material);bind(o,bone);return o

def uv_sphere(name,loc,scale,material,bone=None,segments=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material);bind(o,bone);return o

def curve(name,points,radius,material,bone):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=2;data.bevel_depth=radius;data.bevel_resolution=2;s=data.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);o.data.materials.append(material);bind(o,bone);return o

def torso(name,rings,material,fold=.004,bone=None,N=48):
    verts=[]
    for j,(z,rx,ry) in enumerate(rings):
        for i in range(N):
            a=i*math.tau/N;f=fold*(math.sin(a*13+j*.64)+.35*math.sin(a*23-j*.71));verts.append(((rx+f)*math.cos(a),.025+(ry+f)*math.sin(a),z))
    faces=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(len(rings)-1) for i in range(N)]
    return mesh(name,verts,faces,material,bone)

def sleeve(side,material):
    verts=[];N=32
    for j in range(22):
        t=j/21;x=side*(.2+t*.52);rr=.084*(1-t)+.049*t
        for i in range(N):
            a=math.tau*i/N;fold=.009*math.sin(a*8+t*15)*(1-t);verts.append((x,.066+(rr+fold)*math.sin(a),1.455+(rr+fold)*math.cos(a)))
    return mesh('Woven sleeve',verts,[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(21) for i in range(N)],material)

def trousers(side,material):
    verts=[];N=40
    for j in range(30):
        t=j/29;z=1.03-t*.89;rx=.115 if t<.52 else .115-(t-.52)*.11;ry=rx*.87;cx=side*(.113+math.sin(t*math.pi)*.01)
        for i in range(N):
            a=math.tau*i/N;fold=.012*math.sin(a*9+t*6)*(1-.45*t)+.005*math.sin(t*43+a*2);verts.append((cx+(rx+fold)*math.cos(a),.04+(ry+fold)*math.sin(a),z))
    o=mesh('Pleated hakama',verts,[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(29) for i in range(N)],material)
    # Each trouser leg follows its own leg, including where the cloth overlaps at the crotch.
    o.vertex_groups.clear();suffix='l' if side>0 else 'r'
    thigh=o.vertex_groups.new(name='thigh_'+suffix);calf=o.vertex_groups.new(name='calf_'+suffix)
    for v in o.data.vertices:
        w=max(0,min(1,(v.co.z-.43)/.25));thigh.add([v.index],w,'REPLACE');calf.add([v.index],1-w,'REPLACE')
    return o

def plate(name,center,dimensions,material,bone,angle=0,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.name=name;o.dimensions=dimensions;o.rotation_euler.z=angle;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);mod=o.modifiers.new('Forged edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name);o.data.materials.append(material);bind(o,bone);return o

def boot(side,leather,cord):
    bone='foot_l' if side>0 else 'foot_r';cx=side*.115
    # Continuous ankle, instep, toe box and flat sole. The collar overlaps the trouser cuff.
    N=24;verts=[]
    for z,rx,ry,cy in [(.015,.060,.131,-.035),(.04,.061,.132,-.035),(.075,.057,.116,-.024),(.115,.046,.069,.017),(.19,.044,.052,.034)]:
        for i in range(N):
            a=i*math.tau/N;verts.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    faces=[tuple(reversed(range(N)))]+[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(4) for i in range(N)]
    mesh('Fitted tabi boot',verts,faces,leather,bone)
    curve('Tabi toe seam',[(cx,-.166,.038),(cx,-.153,.069),(cx,-.105,.083)],.0025,cord,bone)
    curve('Ankle wrap',[(cx+.046*math.cos(i*math.tau/30),.034+.054*math.sin(i*math.tau/30),.155) for i in range(31)],.005,cord,bone)

def crest(material):
    for side in [-1,1]:
        points=[]
        for j in range(18):
            t=j/17;points.append((side*(.04+.19*math.sin(t*1.2)),-.12+.04*t,1.86+.26*t))
        curve('Kabuto gilded crest',points,.018,material,'Head')

def setup(kind):
    global base,rig,tree,parts
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);parts=[]
    bpy.ops.import_scene.gltf(filepath=str(SOURCE/'Superhero_Male_FullBody.gltf'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');base=bpy.data.objects['SuperHero_Male'];rig.name='WarriorRig'
    bpy.ops.object.select_all(action='DESELECT')
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o not in [base,bpy.data.objects.get('Eyebrows'),bpy.data.objects.get('Eyes')]:bpy.data.objects.remove(o,do_unlink=True)
    tree=KDTree(len(base.data.vertices))
    for v in base.data.vertices:tree.insert(v.co,v.index)
    tree.balance()
    red=(.18,.025,.017) if kind=='ronin' else (.025,.055,.065) if kind=='shinobi' else (.30,.17,.035)
    cloth=mat('Woven_cloth',red,.94);pants=mat('Indigo_hakama',(.024,.031,.037),.93);armor=mat('Lacquered_iron',(.035,.045,.047),.29,.7);gold=mat('Aged_brass',(.40,.27,.095),.3,.85);cord=mat('Silk_lacing',(.43,.26,.08),.74);leather=mat('Leather',(.036,.027,.022),.84)
    torso('Folded kimono',[(.94,.17,.13),(1.0,.18,.145),(1.1,.19,.15),(1.2,.23,.165),(1.32,.265,.175),(1.42,.245,.14),(1.49,.20,.095),(1.52,.09,.075),(1.555,.082,.07)],cloth,.007,'core')
    for side in [-1,1]:
        sleeve(side,cloth);trousers(side,pants)
        boot(side,leather,cord)
        # Shaped shin guards, secured by bindings.
        bone='calf_l' if side>0 else 'calf_r'
        plate('Suneate shin plate',(side*.115,-.041,.34),(.105,.035,.28),armor,bone,bevel=.02)
        for z in [.25,.43]:
            points=[(side*.115+.076*math.cos(a),.041+.077*math.sin(a),z) for a in [i*math.tau/30 for i in range(31)]];curve('Shin binding',points,.009,cord,bone)
    torso('Obi sash',[(.972,.19,.149),(.99,.191,.15),(1.02,.195,.153),(1.05,.193,.15)],leather,.003,'pelvis')
    # Crossed lapels follow the chest shape.
    for side in [-1,1]:
        curve('Kimono lapel',[(side*.08,-.055,1.52),(side*.14,-.12,1.45),(-side*.045,-.159,1.25),(-side*.13,-.147,1.13)],.018,cord,'core')
    if kind in ['ronin','shinobi','enemy-guard']:
        for j in range(7):
            z=1.105+j*.046;rx=.21+(z-1.1)*.31;ry=.19
            torso('Lamellar cuirass',[(z,rx,ry),(z+.035,rx+.007,ry+.009)],armor,0,'core',N=48)
            # Rows of silk lacing and brass rivets, with actual bevelled surfaces.
            for x in [-.145,-.075,0,.075,.145]:
                front=-math.sqrt(max(0,1-(x/rx)**2))*ry+.022
                uv_sphere('Lacing stud',(x,front-.012,z+.015),(.009,.009,.009),gold,'core',8,4)
        for side in [-1,1]:
            bn='upperarm_l' if side>0 else 'upperarm_r'
            for j in range(3):
                x=side*(.245+j*.032);plate('Sode shoulder lamella',(x,.065,1.55-j*.029),(.12,.23,.029),armor,bn,bevel=.012)
                curve('Shoulder gold rim',[(x-side*.065,-.083,1.56-j*.029),(x+side*.065,-.083,1.56-j*.029)],.004,gold,bn)
            bn='lowerarm_l' if side>0 else 'lowerarm_r';plate('Kote forearm',(side*.593,.044,1.51),(.20,.115,.055),armor,bn,bevel=.025)
            for j in range(5):
                z=.985-j*.047
                for k in [-1,0,1]:plate('Kusazuri skirt plate',(side*(.11+abs(k)*.075),-.128+k*.011,z),(.067,.035,.04),armor,'thigh_l' if side>0 else 'thigh_r',bevel=.008)
    if kind in ['ronin','enemy-guard']:
        # A shaped kabuto dome; hide the lower hemisphere rather than using a sphere helmet.
        verts=[];faces=[];N=48;R=14
        for j in range(R):
            a=(j/(R-1))*math.pi*.51
            for i in range(N):
                t=i*math.tau/N;verts.append((.116*math.sin(a)*math.cos(t),.024+.125*math.sin(a)*math.sin(t),1.737+.157*math.cos(a)))
        for j in range(R-1):
            for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
        mesh('Kabuto helmet',verts,faces,armor,'Head')
        if kind=='ronin':crest(gold)
        for j in range(4):
            # Neck guard wraps the back and sides, leaving the face open.
            verts=[]
            for z,r in [(1.745-j*.035,.128+j*.007),(1.718-j*.035,.136+j*.008)]:
                for i in range(33):a=math.pi*.04+i/32*math.pi*.92;verts.append((r*math.cos(a),.03+r*math.sin(a),z))
            mesh('Shikoro neck lamella',verts,[(i,i+1,34+i,33+i) for i in range(32)],armor,'Head')
        plate('Helmet brow',(0,-.10,1.757),(.26,.08,.022),armor,'Head',bevel=.008)
    elif kind in ['ninja','enemy-skirmisher']:
        # Cloth hood and mask preserve the eye opening and facial anatomy.
        uv_sphere('Shinobi hood',(0,.035,1.747),(.115,.116,.156),pants,'Head')
        plate('Face mask',(0,-.095,1.665),(.166,.063,.092),cloth,'Head',bevel=.022)
        curve('Headband',[(.11*math.cos(a),.024+.122*math.sin(a),1.763) for a in [i*math.tau/40 for i in range(41)]],.014,cloth,'Head')
        # Cut the front of the hood to expose the real face from cheekbones to brow.
        hood=parts[-3];bm=bmesh.new();bm.from_mesh(hood.data);kill=[v for v in bm.verts if v.co.y<-.043 and 1.69<v.co.z<1.79];bmesh.ops.delete(bm,geom=kill,context='VERTS');bm.to_mesh(hood.data);bm.free()
        if kind=='enemy-skirmisher':
            torso('High scarf',[(1.49,.13,.105),(1.57,.12,.09),(1.63,.10,.08)],cloth,.006,'spine_03')
            curve('Scarf tail',[(.09,.11,1.59),(.15,.21,1.43),(.18,.23,1.17),(.24,.25,.98)],.048,cloth,'core')
            for x in [-.14,.14]:plate('Throwing pouch',(x,-.18,1.03),(.10,.055,.16),leather,'pelvis',bevel=.014)
    elif kind=='shinobi':
        curve('Headband',[(.111*math.cos(a),.024+.122*math.sin(a),1.784) for a in [i*math.tau/40 for i in range(41)]],.012,cloth,'Head')
        uv_sphere('Tied hair',(0,.108,1.79),(.065,.060,.068),leather,'Head')
        curve('Flowing headband tail',[(.055,.12,1.77),(.10,.20,1.64),(.13,.24,1.49)],.017,cloth,'Head')
    else:
        # Woven kasa hat and a string of prayer beads.
        verts=[(0,.02,1.967)]+[(.27*math.cos(i*math.tau/64),.02+.27*math.sin(i*math.tau/64),1.803+.012*math.sin(i*math.tau/64)) for i in range(64)]
        mesh('Woven kasa',verts,[(0,i+1,(i+1)%64+1) for i in range(64)],cord,'Head')
        for i in range(22 if kind=='monk' else 0):
            a=i/21*math.pi;uv_sphere('Prayer bead',(.145*math.cos(a),-.14-.024*math.sin(a),1.43-.16*math.sin(a)),(.015,.015,.015),leather,'spine_03',10,6)
    if kind=='enemy-lancer':
        for side in [-1,1]:
            verts=[];N=18
            for j in range(9):
                z=1.03-j*.057
                for i in range(N):
                    a=-math.pi*.55+i/(N-1)*math.pi*1.1
                    verts.append((side*(.115+(.11+j*.006)*math.cos(a)),.03+(.14+j*.002)*math.sin(a),z))
            mesh('Split travel coat',verts,[(j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i) for j in range(8) for i in range(N-1)],cloth,'thigh_l' if side>0 else 'thigh_r')
    # Keep the source mesh only where skin is visible. Cloth supplies the covered silhouette.
    bm=bmesh.new();bm.from_mesh(base.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if (v.co.z<1.49 or (v.co.z<1.57 and abs(v.co.x)>.085)) and abs(v.co.x)<.713],context='VERTS');bm.to_mesh(base.data);bm.free()
    brows=bpy.data.objects.get('Eyebrows')
    if brows:
        brows.shape_key_add(name='Basis');key=brows.shape_key_add(name='Resolve')
        for v in key.data:
            v.co.z-=.012*max(0,1-abs(v.co.x)/.09)
            v.co.y-=.003
    # Compress all embedded maps once. Original UVs, normal maps, and skin weights are retained.
    for image in bpy.data.images:
        if image.type=='IMAGE' and image.size[0]>1024:image.scale(1024,1024)
    # Join costume parts into one skinned object with a small shared material palette.
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();costume=bpy.context.object;costume.name='SamuraiCostume'
    if kind in ['ninja','enemy-guard','enemy-lancer','enemy-skirmisher']:
        # One vertex-colored cloth/armor draw per ninja keeps large crowds inexpensive.
        colors=costume.data.color_attributes.new(name='CostumeColor',type='FLOAT_COLOR',domain='CORNER')
        for poly in costume.data.polygons:
            source=costume.data.materials[poly.material_index]
            color=(.65,.65,.65,1) if any(x in source.name for x in ['Woven','Indigo','Silk']) else source.diffuse_color
            for index in poly.loop_indices:colors.data[index].color=color
            poly.material_index=0
        combined=mat('Woven_ninja_palette',(.8,.8,.8),.8)
        node=combined.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='CostumeColor';combined.node_tree.links.new(node.outputs['Color'],combined.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        costume.data.materials.clear();costume.data.materials.append(combined)
    # Export base skin, eyes, brows, and costume, with a single skeleton.
    bpy.ops.object.select_all(action='SELECT')
    out=ROOT/'public/models'/f'{kind}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_image_format='JPEG',export_jpeg_quality=88,export_materials='EXPORT',export_skins=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=False,export_extras=True)
    print('EXPORTED',out,flush=True)
    return rig

for kind in ['ronin','shinobi','monk','ninja','enemy-guard','enemy-lancer','enemy-skirmisher']:setup(kind)
