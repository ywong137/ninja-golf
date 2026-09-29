// CMU Acclaim reference data, in metres. Points are distal segment endpoints.
// This module does not infer a prop, hand contact, or an animation's intent.
import {Quaternion,Vector3} from 'three';

const AXES={X:new Vector3(1,0,0),Y:new Vector3(0,1,0),Z:new Vector3(0,0,1)};
const lines=text=>text.split(/\r?\n/).map(s=>s.split('#')[0].trim()).filter(Boolean);
const fail=message=>{throw new Error('Acclaim reference: '+message);};
const numbers=(tokens,count,label)=>{
 const result=tokens?.map(Number);
 if(!result||result.length!==count||!result.every(Number.isFinite))fail(`${label} requires ${count} finite numbers.`);
 return result;
};
const field=(rows,name)=>{
 const found=rows.filter(row=>row.split(/\s+/)[0]===name);
 if(found.length>1)fail(`Duplicate ${name} field.`);
 return found[0]?.split(/\s+/).slice(1);
};

/** Acclaim uses fixed axes: XYZ applies X first, then Y, then Z. */
export function acclaimRotation(order,degrees){
 if(order.length!==degrees.length||!degrees.every(Number.isFinite)||!/^[XYZ]*$/.test(order))
  fail('Rotation channels require matching XYZ axes and finite angles.');
 const result=new Quaternion();
 for(let i=0;i<order.length;i++)result.premultiply(new Quaternion().setFromAxisAngle(AXES[order[i]],degrees[i]*Math.PI/180));
 return result.normalize();
}

export function parseAcclaimSkeleton(text){
 const sections={};let section;
 for(const line of lines(text)){
  if(line.startsWith(':')){section=line.slice(1).split(/\s+/)[0];if(sections[section])fail(`Duplicate :${section} section.`);sections[section]=[];}
  else if(section)sections[section].push(line);
 }
 for(const name of ['units','root','bonedata','hierarchy'])if(!sections[name])fail(`Missing :${name} section in ASF.`);
 const lengthUnit=numbers(field(sections.units,'length'),1,'ASF length unit')[0];
 if(lengthUnit<=0||field(sections.units,'angle')?.join(' ')!=='deg')fail('ASF requires positive length units and angle deg.');
 // CMU documents length as 1/0.45 inches per unit. Do not treat it as metres.
 const scale=.0254/lengthUnit;
 if(field(sections.root,'order')?.join(' ')!=='TX TY TZ RX RY RZ'||field(sections.root,'axis')?.join(' ')!=='XYZ')
  fail('Supported root convention is TX TY TZ RX RY RZ with XYZ axes.');
 const rootPosition=numbers(field(sections.root,'position'),3,'Root position');
 const rootOrientation=numbers(field(sections.root,'orientation'),3,'Root orientation');
 if([...rootPosition,...rootOrientation].some(x=>x!==0))fail('Nonzero ASF root offsets need an explicit calibration; they are not supported.');
 const bones=Object.create(null);let block=null;
 for(const line of sections.bonedata){
  if(line==='begin'){if(block)fail('Nested bone blocks.');block=[];}
  else if(line==='end'){
   if(!block)fail('Bone end without begin.');
   const name=field(block,'name')?.[0];
   if(!name||name==='root'||bones[name])fail('Missing, duplicate, or reserved bone name: '+name);
   const direction=numbers(field(block,'direction'),3,name+' direction'),length=numbers(field(block,'length'),1,name+' length')[0];
   if(length<0||Math.abs(new Vector3(...direction).length()-1)>1e-4)fail(name+' needs a unit direction and nonnegative length.');
   const axis=field(block,'axis'),axisOrder=axis?.[3];
   if(!axisOrder||axisOrder.length!==3||new Set(axisOrder).size!==3||!/^[XYZ]{3}$/.test(axisOrder))fail(name+' has an invalid axis order.');
   const angles=numbers(axis?.slice(0,3),3,name+' axis'),dof=field(block,'dof')||[];
   if(dof.some(k=>!/^r[xyz]$/.test(k))||new Set(dof).size!==dof.length)fail(name+' has unsupported or duplicate DOF channels.');
   const axisAngles=axisOrder.split('').map(k=>angles['XYZ'.indexOf(k)]);
   bones[name]={direction,length:length*scale,axis:angles,axisOrder,dof,frame:acclaimRotation(axisOrder,axisAngles).toArray()};block=null;
  }else{if(!block)fail('Bone properties outside a bone block.');block.push(line);}
 }
 if(block||!Object.keys(bones).length)fail('Incomplete or empty bone data.');
 const children=Object.create(null),parents=Object.create(null);
 for(const line of sections.hierarchy){
  if(line==='begin'||line==='end')continue;
  const [parent,...list]=line.split(/\s+/);
  if((parent!=='root'&&!bones[parent])||children[parent]||!list.length)fail('Invalid or duplicate hierarchy parent: '+parent);
  children[parent]=list;
  for(const child of list){
   if(!bones[child]||parents[child]!==undefined)fail('Unknown bone or multiple parents: '+child);
   parents[child]=parent;bones[child].parent=parent;
  }
 }
 const order=[],visiting=new Set(),visited=new Set();
 const visit=parent=>{
  if(visiting.has(parent))fail('Cycle in the ASF hierarchy at '+parent);
  visiting.add(parent);
  for(const child of children[parent]||[]){if(visited.has(child))fail('Repeated child: '+child);order.push(child);visit(child);}
  visiting.delete(parent);visited.add(parent);
 };
 visit('root');
 if(order.length!==Object.keys(bones).length)fail('The ASF hierarchy has a disconnected bone or cycle.');
 return{scale,bones,children,order};
}

export function parseAcclaimMotion(text,skeleton){
 const rows=lines(text);
 if(!rows.includes(':FULLY-SPECIFIED')||!rows.includes(':DEGREES'))fail('AMC requires :FULLY-SPECIFIED and :DEGREES.');
 const frames=[];let current;
 const check=()=>{
  if(!current)return;
  for(const name of ['root',...skeleton.order.filter(n=>skeleton.bones[n].dof.length)])
   if(!Object.hasOwn(current.channels,name))fail(`Frame ${current.frame} is missing ${name}.`);
 };
 for(const row of rows){
  if(row.startsWith(':')){if(![':FULLY-SPECIFIED',':DEGREES'].includes(row))fail('Unsupported AMC directive '+row);continue;}
  if(/^\d+$/.test(row)){
   check();const frame=Number(row);
   if(frame!==frames.length+1)fail('AMC frames must start at 1 and increase without gaps.');
   current={frame,channels:Object.create(null)};frames.push(current);continue;
  }
  const [name,...values]=row.split(/\s+/);
  if(!current)fail('AMC channel appears before frame 1.');
  if(Object.hasOwn(current.channels,name))fail(`Duplicate ${name} at frame ${current.frame}.`);
  const count=name==='root'?6:skeleton.bones[name]?.dof.length;
  if(count===undefined)fail('Unknown AMC bone '+name);
  current.channels[name]=numbers(values,count,`Frame ${current.frame}, ${name}`);
 }
 check();if(!frames.length)fail('AMC has no frames.');
 return frames;
}

/** Distal endpoints use the CHILD rotation, including its ASF joint-axis frame. */
export function sampleAcclaimFrame(skeleton,frame){
 const root=frame.channels.root;
 const points={root:root.slice(0,3).map(v=>v*skeleton.scale)},rotations={root:acclaimRotation('XYZ',root.slice(3)).toArray()};
 for(const name of skeleton.order){
  const bone=skeleton.bones[name],axis=new Quaternion().fromArray(bone.frame);
  const local=acclaimRotation(bone.dof.map(d=>d[1].toUpperCase()).join(''),frame.channels[name]||[]);
  const rotation=new Quaternion().fromArray(rotations[bone.parent]).multiply(axis).multiply(local).multiply(axis.clone().invert()).normalize();
  points[name]=new Vector3(...bone.direction).multiplyScalar(bone.length).applyQuaternion(rotation).add(new Vector3(...points[bone.parent])).toArray();
  rotations[name]=rotation.toArray();
 }
 return{points,rotations};
}

export function decodeAcclaimReference(asf,amc,{rate}={}){
 if(!Number.isFinite(rate)||rate<=0)fail('Supply the documented capture rate in Hz; ASF/AMC does not encode it.');
 const skeleton=parseAcclaimSkeleton(asf),motion=parseAcclaimMotion(amc,skeleton);
 return{schema:1,units:'metres',rotationFormat:'quaternion-xyzw',pointConvention:'distal-segment-endpoint',rate,
  bones:skeleton.bones,children:skeleton.children,
  frames:motion.map((frame,i)=>({frame:frame.frame,t:i/rate,...sampleAcclaimFrame(skeleton,frame)}))};
}
