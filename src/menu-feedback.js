export function afterMenuPaint(operation){
  return new Promise((resolve,reject)=>requestAnimationFrame(()=>setTimeout(()=>{
    try{resolve(operation());}catch(error){reject(error);}
  },0)));
}
