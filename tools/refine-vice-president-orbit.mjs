#!/usr/bin/env node
// Offline, conforming refinement. Original streams remain in the binary prefix.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {readModel,packedStream,serializeModel} from './preserve-vice-president-head.mjs';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const TYPES={POSITION:['VEC3',5126,3,4],NORMAL:['VEC3',5126,3,4],TEXCOORD_0:['VEC2',5126,2,4],JOINTS_0:['VEC4',null,4,null],WEIGHTS_0:['VEC4',5126,4,4]};
const BOXES=[new T.Box3(new T.Vector3(.016,1.685,.095),new T.Vector3(.061,1.709,.3)),new T.Box3(new T.Vector3(-.061,1.685,.095),new T.Vector3(-.016,1.709,.3))];
const FOLD_FLOOR=1.6876; // The sculpt field is exactly zero below this crease boundary.

// Every case preserves the original triangle winding. Two split edges leave a
// quad; its shorter diagonal avoids unnecessary narrow triangles.
export function splitOrbitTriangle(ids,midpoints,positions){
 const [a,b,c]=ids,m=ids.map((v,i)=>midpoints.get(edgeKey(v,ids[(i+1)%3]))),count=m.filter(v=>v!==undefined).length;
 if(!count)return [ids];
 if(count===3)return [[a,m[0],m[2]],[m[0],b,m[1]],[m[2],m[1],c],[m[0],m[1],m[2]]];
 if(count===1){const i=m.findIndex(v=>v!==undefined),u=ids[i],v=ids[(i+1)%3],w=ids[(i+2)%3];return [[u,m[i],w],[m[i],v,w]];}
 const i=m.findIndex((v,j)=>v!==undefined&&m[(j+1)%3]!==undefined);
 const p=ids[i],u=ids[(i+1)%3],n=ids[(i+2)%3],mp=m[i],mn=m[(i+1)%3];
 const corner=[u,mn,mp];
 return distance(positions[p],positions[mn])<=distance(positions[mp],positions[n])
  ?[corner,[p,mp,mn],[p,mn,n]]:[corner,[p,mp,n],[mp,mn,n]];
}

export function refineVicePresidentOrbit(model,{maxEdgeMm=3.5,iterations=6,maxVertices=20000}={}){
 if(!Number.isFinite(maxEdgeMm)||maxEdgeMm<2||maxEdgeMm>8)throw Error('Use --max-edge-mm between 2 and 8.');
 if(!Number.isInteger(iterations)||iterations<1||iterations>8)throw Error('Use --iterations from 1 to 8.');
 if(!Number.isInteger(maxVertices)||maxVertices<1713||maxVertices>50000)throw Error('Use --max-vertices from 1713 to 50000.');
 const originalDoc=structuredClone(model.doc),originalBin=Buffer.from(model.bin);
 if(model.doc.buffers?.length!==1||model.doc.buffers[0].uri)throw Error('Expected one embedded GLB buffer.');
 if(model.doc.extras?.vicePresidentOrbitRefinement)throw Error('This model already contains orbital refinement. Start from the original candidate.');
 if(model.doc.extras?.vicePresidentLidCandidate)throw Error('Refine the unsculpted head before applying an eyelid field.');
 const found=model.doc.meshes.flatMap((m,mi)=>m.primitives.map((p,pi)=>({p,mi,pi}))).filter(({p})=>model.doc.materials[p.material]?.name==='m009_head');
 if(found.length!==1)throw Error('Expected exactly one m009_head primitive.');
 const {p,mi,pi}=found[0];
 if((p.mode??4)!==4||p.targets||p.extensions)throw Error('Expected uncompressed triangles without morph targets.');
 if(Object.keys(p.attributes).sort().join()!==Object.keys(TYPES).sort().join())throw Error('Unsupported head attributes; preserve them explicitly before refining.');
 const count=model.doc.accessors[p.attributes.POSITION].count;
 if(count!==1713)throw Error(`Expected the native 1713-vertex head; found ${count}.`);
 const streams={},values={};
 for(const [name,[type,component,components]]of Object.entries(TYPES)){
  const acc=model.doc.accessors[p.attributes[name]];
  if(acc.count!==count||acc.type!==type||acc.normalized||acc.sparse||(component?acc.componentType!==component:![5121,5123].includes(acc.componentType)))throw Error(`Unsupported ${name} accessor.`);
  streams[name]=packedStream(model,p.attributes[name]);
  const bytes=acc.componentType===5121?1:acc.componentType===5123?2:4;
  values[name]=Array.from({length:count},(_,i)=>Array.from({length:components},(_,k)=>{
   const offset=(i*components+k)*bytes;return bytes===1?streams[name].readUInt8(offset):bytes===2?streams[name].readUInt16LE(offset):streams[name].readFloatLE(offset);
  }));
  if(values[name].flat().some(v=>!Number.isFinite(v)))throw Error(`${name} contains non-finite data.`);
 }
 const ia=model.doc.accessors[p.indices],ib=packedStream(model,p.indices);
 if(ia.type!=='SCALAR'||![5123,5125].includes(ia.componentType)||ia.count%3)throw Error('Expected unsigned triangle indices.');
 const isize=ia.componentType===5123?2:4,ids=Array.from({length:ia.count},(_,i)=>isize===2?ib.readUInt16LE(i*2):ib.readUInt32LE(i*4));
 if(ids.some(i=>i>=count))throw Error('A head triangle references a missing vertex.');
 const sourceTriangles=Array.from({length:ids.length/3},(_,i)=>ids.slice(i*3,i*3+3));
 let triangles=sourceTriangles.map((ids,source)=>({ids,source}));
 const anatomy=JSON.parse(fs.readFileSync(new URL('../assets/characters/vice-president-fit-reference.json',import.meta.url)));
 const eyes=new Set(anatomy.excludedEyeVertices);
 if(eyes.size!==146||[...eyes].some(i=>!Number.isInteger(i)||i<0||i>=count))throw Error('The verified eyeball component does not match this topology.');
 const eyeTriangles=new Set();
 sourceTriangles.forEach((t,i)=>{const n=t.filter(v=>eyes.has(v)).length;if(n&&n!==3)throw Error('An eyeball triangle shares skin vertices.');if(n===3)eyeTriangles.add(i);});
 const skinMaps=values.JOINTS_0.map((j,i)=>{
  const result=new Map();j.forEach((id,k)=>{const w=values.WEIGHTS_0[i][k];if(w<0)throw Error('Negative skin weight.');if(w)result.set(id,(result.get(id)??0)+w);});
  const sum=[...result.values()].reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-4)throw Error('Skin weights must sum to one.');return result;
 });
 const lineage=[],passes=[],changedSources=new Set(),boxTriangle=new T.Triangle(),v3=()=>new T.Vector3();
 const intersects=ids=>{boxTriangle.set(...ids.map(i=>v3().fromArray(values.POSITION[i])));return BOXES.some(b=>b.intersectsTriangle(boxTriangle));};
 const geomEdge=(a,b)=>{const x=values.POSITION[a].join(','),y=values.POSITION[b].join(',');return x<y?`${x}|${y}`:`${y}|${x}`;};
 // Refining the stationary lower crease adds no sculpting resolution. It can
 // instead distort its tiny, mixed-weight triangles during facial expressions.
 // Protect complete source triangles and every shared edge, including UV seams.
 const protectedSources=new Set(),protectedEdges=new Set();
 sourceTriangles.forEach((ids,i)=>{if(eyeTriangles.has(i)||Math.max(...ids.map(v=>values.POSITION[v][1]))>FOLD_FLOOR)return;protectedSources.add(i);ids.forEach((a,j)=>protectedEdges.add(geomEdge(a,ids[(j+1)%3])));});
 // A triangle bordering an immutable long edge cannot satisfy a shorter edge
 // limit everywhere. Use one source-triangle transition band: shared splits
 // still propagate into it, but it does not recursively request more splits.
 const transitionSources=new Set();
 sourceTriangles.forEach((ids,i)=>{if(!protectedSources.has(i)&&ids.some((a,j)=>protectedEdges.has(geomEdge(a,ids[(j+1)%3]))))transitionSources.add(i);});
 const maxEdge=maxEdgeMm/1000;
 for(let pass=0;pass<iterations;pass++){
  const marked=new Set();let longest=0;
  for(const tr of triangles){if(eyeTriangles.has(tr.source)||protectedSources.has(tr.source)||transitionSources.has(tr.source)||!intersects(tr.ids))continue;
   tr.ids.forEach((a,j)=>{const b=tr.ids[(j+1)%3],key=geomEdge(a,b);if(protectedEdges.has(key))return;const length=distance(values.POSITION[a],values.POSITION[b]);longest=Math.max(longest,length);if(length>maxEdge+1e-10)marked.add(key);});
  }
  if(!marked.size){passes.push({pass,markedGeometricEdges:0,longestIntersectingEdgeMm:longest*1000});break;}
  const mids=new Map();
  for(const tr of triangles){if(eyeTriangles.has(tr.source))continue;
   tr.ids.forEach((a,j)=>{const b=tr.ids[(j+1)%3],key=edgeKey(a,b);if(mids.has(key)||!marked.has(geomEdge(a,b)))return;
    if(values.POSITION.length>=maxVertices)throw Error(`Refinement exceeds ${maxVertices} vertices; increase the edge target or vertex budget.`);
    const id=values.POSITION.length;mids.set(key,id);lineage.push({vertex:id,parents:[a,b]});
    for(const name of ['POSITION','TEXCOORD_0','NORMAL']){
     const row=values[name][a].map((x,k)=>(x+values[name][b][k])/2);
     if(name==='NORMAL'){const length=Math.hypot(...row);if(length<1e-8)throw Error('Opposed normal directions on a refined edge.');row.forEach((v,k)=>row[k]=v/length);}
     values[name].push(row);
    }
    const weights=new Map();for(const old of [a,b])for(const [joint,w]of skinMaps[old])weights.set(joint,(weights.get(joint)??0)+w/2);skinMaps.push(weights);
   });
  }
  const next=[];for(const tr of triangles){const parts=splitOrbitTriangle(tr.ids,mids,values.POSITION);if(parts.length>1)changedSources.add(tr.source);parts.forEach(ids=>next.push({ids,source:tr.source}));}
  triangles=next;passes.push({pass,markedGeometricEdges:marked.size,newVertices:mids.size,triangles:triangles.length,longestIntersectingEdgeMm:longest*1000});
 }
 let longest=0;const boundaryExceptions=new Map();
 for(const tr of triangles)if(!eyeTriangles.has(tr.source)&&!protectedSources.has(tr.source)&&intersects(tr.ids))tr.ids.forEach((a,j)=>{const b=tr.ids[(j+1)%3],key=geomEdge(a,b),length=distance(values.POSITION[a],values.POSITION[b]);if(protectedEdges.has(key)||transitionSources.has(tr.source)){if(length>maxEdge)boundaryExceptions.set(key,{vertices:[a,b],lengthMm:length*1000,sourceTriangle:tr.source,reason:protectedEdges.has(key)?'Shared edge of an unchanged lower-crease source triangle.':'Conforming transition triangle beside an immutable crease edge.'});}else longest=Math.max(longest,length);});
 if(longest>maxEdge+1e-8)throw Error(`Iteration budget ended with a ${(longest*1000).toFixed(3)} mm edge; increase --iterations.`);
 if([...changedSources].some(i=>protectedSources.has(i)))throw Error('Refinement changed a protected lower-crease triangle.');
 const discarded=[];
 for(let i=count;i<values.POSITION.length;i++){
  const ranked=[...skinMaps[i]].sort((a,b)=>b[1]-a[1]||a[0]-b[0]),mass=ranked.slice(4).reduce((s,v)=>s+v[1],0),keep=ranked.slice(0,4),sum=keep.reduce((s,v)=>s+v[1],0);
  if(sum<1e-8)throw Error('A new vertex has no usable skin weights.');
  values.JOINTS_0.push(Array.from({length:4},(_,k)=>keep[k]?.[0]??0));values.WEIGHTS_0.push(Array.from({length:4},(_,k)=>(keep[k]?.[1]??0)/sum));discarded.push({vertex:i,mass});
 }
 // Verify each refined face lies on its original flat triangle. This also
 // detects wrong winding in the two-edge split cases.
 let maxPlaneError=0,minNormalDot=1,maxAreaRelativeError=0;const areas=new Float64Array(sourceTriangles.length);
 for(const tr of triangles){const source=sourceTriangles[tr.source].map(i=>v3().fromArray(values.POSITION[i])),pts=tr.ids.map(i=>v3().fromArray(values.POSITION[i]));const sn=new T.Vector3().subVectors(source[1],source[0]).cross(new T.Vector3().subVectors(source[2],source[0]));const nn=new T.Vector3().subVectors(pts[1],pts[0]).cross(new T.Vector3().subVectors(pts[2],pts[0]));areas[tr.source]+=nn.length()/2;if(sn.length()<1e-14)continue;sn.normalize();minNormalDot=Math.min(minNormalDot,sn.dot(nn.clone().normalize()));pts.forEach(p=>maxPlaneError=Math.max(maxPlaneError,Math.abs(p.clone().sub(source[0]).dot(sn))));}
 sourceTriangles.forEach((ids,i)=>{const t=new T.Triangle(...ids.map(i=>v3().fromArray(values.POSITION[i]))),area=t.getArea();if(area>1e-14)maxAreaRelativeError=Math.max(maxAreaRelativeError,Math.abs(areas[i]-area)/area);});
 if(maxPlaneError>1e-10||minNormalDot<.99999999||maxAreaRelativeError>1e-8)throw Error('Subdivision changed the base surface or triangle winding.');
 const preserved={};
 const append=(bytes,accessor,target)=>{const padding=Buffer.alloc((-model.bin.length)&3),offset=model.bin.length+padding.length;model.bin=Buffer.concat([model.bin,padding,bytes]);const view=model.doc.bufferViews.length;model.doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});const id=model.doc.accessors.length;model.doc.accessors.push({...accessor,bufferView:view});return id;};
 for(const [name,[type,,components]]of Object.entries(TYPES)){
  const old=model.doc.accessors[p.attributes[name]],bytes=old.componentType===5121?1:old.componentType===5123?2:4,tail=Buffer.alloc((values[name].length-count)*components*bytes);
  for(let i=count;i<values[name].length;i++)values[name][i].forEach((v,k)=>{const at=((i-count)*components+k)*bytes;if(bytes===1)tail.writeUInt8(v,at);else if(bytes===2)tail.writeUInt16LE(v,at);else tail.writeFloatLE(v,at);});
  const stream=Buffer.concat([streams[name],tail]),accessor={componentType:old.componentType,count:values[name].length,type};
  if(name==='POSITION'){accessor.min=old.min??[0,1,2].map(k=>Math.min(...values[name].map(r=>r[k])));accessor.max=old.max??[0,1,2].map(k=>Math.max(...values[name].map(r=>r[k])));}
  p.attributes[name]=append(stream,accessor,34962);if(!stream.subarray(0,streams[name].length).equals(streams[name]))throw Error(`Original ${name} prefix changed.`);preserved[name]={originalBytes:streams[name].length,sha256:hash(streams[name])};
 }
 const indices=triangles.flatMap(t=>t.ids),indexSize=values.POSITION.length<=65535?2:4,bytes=Buffer.alloc(indices.length*indexSize);indices.forEach((i,k)=>indexSize===2?bytes.writeUInt16LE(i,k*2):bytes.writeUInt32LE(i,k*4));p.indices=append(bytes,{componentType:indexSize===2?5123:5125,count:indices.length,type:'SCALAR'},34963);model.doc.buffers[0].byteLength=model.bin.length;
 if(!model.bin.subarray(0,originalBin.length).equals(originalBin))throw Error('Original binary payload changed.');
 // Compare the entire document outside the sole primitive and append-only
 // accessor tables. This covers clips, nodes, textures, skins and other meshes.
 const check=structuredClone(model.doc);check.meshes[mi].primitives[pi]=originalDoc.meshes[mi].primitives[pi];check.accessors=check.accessors.slice(0,originalDoc.accessors.length);check.bufferViews=check.bufferViews.slice(0,originalDoc.bufferViews.length);check.buffers=originalDoc.buffers;
 if(JSON.stringify(check)!==JSON.stringify(originalDoc))throw Error('Unrelated model structure changed.');
 const boundaryEdges=new Map();sourceTriangles.forEach((t,i)=>t.forEach((a,j)=>{const b=t[(j+1)%3],key=edgeKey(a,b);if(!boundaryEdges.has(key))boundaryEdges.set(key,{vertices:[a,b],inside:0,outside:0});boundaryEdges.get(key)[changedSources.has(i)?'inside':'outside']++;}));
 let maxSerializedPlaneError=0;
 for(const tr of triangles){const source=sourceTriangles[tr.source].map(i=>v3().fromArray(values.POSITION[i])),normal=new T.Triangle(...source).getNormal(new T.Vector3());for(const i of tr.ids){const point=v3().fromArray(values.POSITION[i].map(Math.fround));maxSerializedPlaneError=Math.max(maxSerializedPlaneError,Math.abs(point.sub(source[0]).dot(normal)));}}
 if(maxSerializedPlaneError>2e-7)throw Error('Float32 conversion moved a refined point outside the expected precision bound.');
 const report={schemaVersion:1,originalVertexCount:count,vertexCount:values.POSITION.length,originalTriangleCount:sourceTriangles.length,triangleCount:triangles.length,maxEdgeMm,iterations,passes,boxes:BOXES.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),longestRefinableEdgeMm:longest*1000,creaseProtection:{maximumSourceTriangleY:FOLD_FLOOR,protectedSourceTriangles:[...protectedSources].filter(i=>intersects(sourceTriangles[i])),transitionSourceTriangles:[...transitionSources].filter(i=>intersects(sourceTriangles[i])),boundaryExceptions:[...boundaryExceptions.values()]},originalAttributePrefixes:preserved,originalBinarySha256:hash(originalBin),originalBinaryBytes:originalBin.length,sourceSurface:{maxPlaneErrorMetres:maxPlaneError,maxSerializedPlaneErrorMetres:maxSerializedPlaneError,minNormalDot,maxAreaRelativeError},normalInterpolation:'Normalized linear interpolation for new vertices; all original normals remain byte-identical.',skinInterpolation:{method:'Full joint-weight maps interpolate along each split; only final output truncates to the four largest joints and renormalizes.',maximumDiscardedMass:Math.max(0,...discarded.map(v=>v.mass)),verticesWithDiscardedMass:discarded.filter(v=>v.mass>1e-12),limitation:'The bind surface stays unchanged. Interpolated skinning need not reproduce the exact old triangle interior under arbitrary joint motion.'},excludedEyeVertexCount:eyes.size,excludedEyeTriangleCount:eyeTriangles.size,changedSourceTriangles:[...changedSources].sort((a,b)=>a-b),regionBoundaryEdges:[...boundaryEdges.values()].filter(e=>e.inside&&e.outside).map(e=>e.vertices),newVertexParents:lineage};
 model.doc.extras??={};model.doc.extras.vicePresidentOrbitRefinement={schemaVersion:1,originalVertexCount:count,vertexCount:values.POSITION.length,maxEdgeMm,protectedCreaseMaximumY:FOLD_FLOOR,sourceBinarySha256:hash(originalBin)};
 return {model,report};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values:a}=parseArgs({options:{input:{type:'string'},output:{type:'string'},'max-edge-mm':{type:'string',default:'3.5'},iterations:{type:'string',default:'6'},'max-vertices':{type:'string',default:'20000'},help:{type:'boolean'}}});
 if(a.help){console.log('node tools/refine-vice-president-orbit.mjs --input BASE.glb --output CANDIDATE.glb [--max-edge-mm 3.5] [--iterations 6] [--max-vertices 20000]\nRefine only the skin above the eyelids. Preserve triangles wholly below y=1.6876 and their shared crease edges. The edge target excludes these protected boundaries. Original vertex indices and attribute prefixes remain exact. No sculpting occurs. Output and its .json report must differ from the input. Eyeballs and unrelated binary data remain unchanged.');process.exit(0);}
 if(!a.input||!a.output)throw Error('Supply distinct --input and --output paths. See --help.');
 const input=path.resolve(a.input),output=path.resolve(a.output),reportPath=output+'.json';
 const sourceReal=fs.realpathSync(input);
 if([output,reportPath].some(p=>p===input||(fs.existsSync(p)&&fs.realpathSync(p)===sourceReal))||path.extname(output).toLowerCase()!=='.glb')throw Error('Use a separate .glb output path.');
 const raw=fs.readFileSync(input),result=refineVicePresidentOrbit(readModel(raw),{maxEdgeMm:Number(a['max-edge-mm']),iterations:Number(a.iterations),maxVertices:Number(a['max-vertices'])}),bytes=serializeModel(result.model);
 result.report.sourceFile=input;result.report.sourceSha256=hash(raw);result.report.outputSha256=hash(bytes);fs.writeFileSync(output,bytes);fs.writeFileSync(reportPath,JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify({output,report:reportPath,vertices:result.report.vertexCount,triangles:result.report.triangleCount,longestRefinableEdgeMm:result.report.longestRefinableEdgeMm,protectedLongEdges:result.report.creaseProtection.boundaryExceptions.length,discardedSkinMass:result.report.skinInterpolation.maximumDiscardedMass}));
}
