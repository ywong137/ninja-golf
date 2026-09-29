import {Vector3} from 'three';

const EPSILON=1e-10;
const DEG=180/Math.PI;

function finiteVector(value,label){
 if(!value?.isVector3||![value.x,value.y,value.z].every(Number.isFinite))
  throw new TypeError(`${label} must be a finite THREE.Vector3.`);
 return value.clone();
}

function direction(value,label){
 if(value.lengthSq()<EPSILON)throw new Error(`${label} has no usable direction.`);
 return value.normalize();
}

/**
 * Measure each PIP knuckle around a handle, relative to its cutting edge.
 * All inputs must use one coordinate system. Positive angles follow the
 * right-hand rule around shaftAxis. These are geometry measurements, not
 * anatomical limits or a certificate of palm contact.
 */
export function measureGripEdgeAlignment({shaftOrigin,shaftAxis,edgeDirection,knuckles}){
 const origin=finiteVector(shaftOrigin,'shaftOrigin');
 const axis=direction(finiteVector(shaftAxis,'shaftAxis'),'shaftAxis');
 const edge=finiteVector(edgeDirection,'edgeDirection');
 edge.addScaledVector(axis,-edge.dot(axis));direction(edge,'Transverse cutting edge');
 const entries=Object.entries(knuckles??{});
 if(!entries.length)throw new Error('Supply named PIP knuckle positions. MCP knuckles are different landmarks.');
 const measurements={};
 let cosine=0,sine=0;
 for(const [name,point]of entries){
  const offset=finiteVector(point,`knuckles.${name}`).sub(origin);
  const along=offset.dot(axis);
  const radial=offset.addScaledVector(axis,-along);
  const radius=radial.length();direction(radial,`PIP knuckle ${name} relative to the shaft`);
  const cos=edge.dot(radial),sin=axis.dot(new Vector3().crossVectors(edge,radial));
  measurements[name]={clockDegrees:Math.atan2(sin,cos)*DEG,radius,along};
  cosine+=cos;sine+=sin;
 }
 const concentration=Math.hypot(cosine,sine)/entries.length;
 if(concentration<EPSILON)throw new Error('The knuckles have no common radial direction. Inspect the landmarks before fitting a blade frame.');
 return{
  knuckles:measurements,
  meanClockDegrees:Math.atan2(sine,cosine)*DEG,
  concentration,
  maxAbsoluteClockDegrees:Math.max(...Object.values(measurements).map(m=>Math.abs(m.clockDegrees))),
 };
}

const wrappedDegrees=value=>Math.atan2(Math.sin(value/DEG),Math.cos(value/DEG))*DEG;

/** Separate a rigid hand rotation from differences in finger arrangement. */
export function compareGripClock(reference,measured,{mirrorReference=false}={}){
 const names=Object.keys(reference?.knuckles??{}),actual=Object.keys(measured?.knuckles??{});
 if(!names.length||names.length!==actual.length||names.some(name=>!actual.includes(name)))
  throw new Error('Compare the same named PIP knuckles in both hands.');
 const differences={};let sine=0,cosine=0;
 for(const name of names){
  const from=reference.knuckles[name].clockDegrees,to=measured.knuckles[name].clockDegrees;
  if(!Number.isFinite(from)||!Number.isFinite(to))throw new TypeError(`PIP clock ${name} must be finite.`);
  const delta=wrappedDegrees(to-(mirrorReference?-from:from));
  differences[name]=delta;sine+=Math.sin(delta/DEG);cosine+=Math.cos(delta/DEG);
 }
 if(Math.hypot(sine,cosine)<EPSILON)throw new Error('The finger differences do not define one shared hand rotation.');
 const rotationDegrees=Math.atan2(sine,cosine)*DEG;
 const residuals=Object.fromEntries(names.map(name=>[name,wrappedDegrees(differences[name]-rotationDegrees)]));
 return{rotationDegrees,residuals,maxShapeResidualDegrees:Math.max(...Object.values(residuals).map(Math.abs))};
}
