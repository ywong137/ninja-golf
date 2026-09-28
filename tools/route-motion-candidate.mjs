import fs from 'node:fs';

// Review one animation without replacing any shipping asset or metadata.
export async function routeMotionCandidate(page,{hero,model,motionRecord,replaceClip,readyRecord=null}){
 if(!model&&!motionRecord&&!replaceClip&&!readyRecord)return null;
 if(!model||!motionRecord||!replaceClip)throw Error('A candidate requires --model, --motion-record, and --replace-clip.');
 for(const file of [model,motionRecord])if(!fs.statSync(file).isFile())throw Error('Missing candidate file: '+file);
 const records=JSON.parse(fs.readFileSync(motionRecord,'utf8')),names=Object.keys(records);
 if(names.length!==1)throw Error('--motion-record must contain exactly one named motion record.');
 const name=names[0],record=records[name];
 if(!(record.duration>0)||!record.poses?.length)throw Error('The candidate motion needs a positive duration and pose samples.');
 const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8'));
 if(!motions[replaceClip])throw Error('Unknown replaced motion: '+replaceClip);
 motions[name]=record;
 let readyName=null;
 if(readyRecord){
  const ready=JSON.parse(fs.readFileSync(readyRecord,'utf8'));
  if(Object.keys(ready).length!==1)throw Error('--ready-record must contain exactly one named ready motion.');
  readyName=Object.keys(ready)[0];
  if(!(ready[readyName].duration>0)||!ready[readyName].poses?.length)throw Error('The ready motion needs a duration and pose samples.');
  Object.assign(motions,ready);
 }
 const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8').replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';');
 await page.route('**/src/motion.js*',route=>route.fulfill({contentType:'application/javascript',body:source}));
 await page.route('**/src/warriors.js*',async route=>{
  const source=await(await route.fetch()).text();
  await route.fulfill({contentType:'application/javascript',body:source+`\nWARRIORS[${hero}].motionOverrides={...WARRIORS[${hero}].motionOverrides,${JSON.stringify(replaceClip)}:${JSON.stringify(name)}};`+(readyName?`\nWARRIORS[${hero}].readyClip=${JSON.stringify(readyName)};`:'')});
 });
 const modelName=['ronin','shinobi','monk','kaede','ayame','sora'][hero];
 if(!modelName)throw Error('Candidate hero must be 0–5.');
 await page.route(`**/models/${modelName}.glb?*`,route=>route.fulfill({path:model}));
 return name;
}
