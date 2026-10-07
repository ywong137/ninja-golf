// Retain CPU geometry only. Each world receives its own clone and owns GPU disposal.
// A fixed byte budget prevents browsing all 36 holes from retaining every mesh.
export class CourseGeometryCache {
 constructor(maxBytes=48*1024*1024){this.maxBytes=maxBytes;this.bytes=0;this.entries=[];}
 get(course,region,kind,build){
  const index=this.entries.findIndex(e=>e.course===course&&e.region===region&&e.kind===kind);
  if(index>=0){const [entry]=this.entries.splice(index,1);this.entries.push(entry);return entry.geometry.clone();}
  const geometry=build(),arrays=new Set(Object.values(geometry.attributes).map(a=>a.array));if(geometry.index)arrays.add(geometry.index.array);
  const bytes=[...arrays].reduce((sum,a)=>sum+a.byteLength,0);
  if(bytes<=this.maxBytes){
   while(this.bytes+bytes>this.maxBytes){const old=this.entries.shift();this.bytes-=old.bytes;old.geometry.dispose();}
   this.entries.push({course,region,kind,geometry:geometry.clone(),bytes});this.bytes+=bytes;
  }
  return geometry;
 }
}
