import {Vector3} from 'three';
import {alignedKnee} from '../src/knee-alignment.js';

// Offline only: find the smallest body shift that gives loaded knees room to
// follow their shoes. The ankle anchors and native segment lengths stay fixed.
export function balanceStance(legs){
 const cost=offset=>{
  let result=offset.lengthSq();
  for(const leg of legs){
   if(!leg.loaded)continue;
   const hip=leg.hip.clone().add(offset),knee=alignedKnee(hip,leg.ankle,leg.upper,leg.lower,leg.forward);
   const shin=knee.clone().sub(leg.ankle),medial=-shin.dot(leg.outward);
   const inward=Math.max(0,medial-.006),backward=Math.max(0,-.02-shin.dot(leg.forward));
   const highKnee=leg.posture?Math.max(0,.06-(hip.y-knee.y)):0;
   const reach=Math.max(0,hip.distanceTo(leg.ankle)-(leg.upper+leg.lower)*.985);
   result+=400*(inward*inward+(leg.posture?backward*backward:0)+highKnee*highKnee+reach*reach);
  }
  return result;
 };
 let offset=new Vector3(),best=cost(offset);
 if(best<1e-10)return offset;
 const directions=[];
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new Vector3(x,y,z));
 for(const step of [.04,.02,.01,.005,.0025,.00125,.000625])for(let iteration=0;iteration<8;iteration++){
  let next=offset;
  for(const direction of directions){
   const candidate=offset.clone().addScaledVector(direction,step);
   if(candidate.length()>.14||candidate.y>.035||candidate.y<-.12)continue;
   const score=cost(candidate);if(score<best-1e-12){best=score;next=candidate;}
  }
  if(next===offset)break;offset=next;
 }
 return offset;
}
