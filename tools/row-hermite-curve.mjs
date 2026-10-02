// Cubic Hermite sampling for scalar or array-valued rows.
// Times and derivatives use the same caller-defined time unit.
export function sampleRowCurve(rows,t){
 let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;
 const a=rows[i],b=rows[i+1],p=rows[Math.max(0,i-1)],n=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
 // A row can retain a measured data-key derivative after a later key moves.
 const derivative=(row,key,k,fallback)=>{
  const override=row.derivatives?.[key];if(override===undefined)return fallback;
  const result=k===null?override:override[k];
  if(!Number.isFinite(result))throw Error('A row derivative needs finite values with the same shape as its data key.');
  return result;
 };
 const component=(key,k=null)=>{
  const v=row=>k===null?row[key]:row[key][k],m0=derivative(a,key,k,i===0?0:(v(b)-v(p))/(b.t-p.t)),m1=derivative(b,key,k,i+1===rows.length-1?0:(v(n)-v(a))/(n.t-a.t));
  return{value:(2*u**3-3*u*u+1)*v(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*v(b)+(u**3-u*u)*span*m1,
   derivative:((6*u*u-6*u)*v(a)+(3*u*u-4*u+1)*span*m0+(-6*u*u+6*u)*v(b)+(3*u*u-2*u)*span*m1)/span};
 };
 const curves=Object.fromEntries(Object.keys(a).filter(key=>key!=='t'&&key!=='derivatives').map(key=>[key,Array.isArray(a[key])?a[key].map((_,j)=>component(key,j)):component(key)]));
 return Object.fromEntries(['value','derivative'].map(kind=>[kind,Object.fromEntries(Object.entries(curves).map(([key,result])=>[key,Array.isArray(result)?result.map(row=>row[kind]):result[kind]]))]));
}
