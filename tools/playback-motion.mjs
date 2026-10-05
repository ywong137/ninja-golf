import {readFile} from 'node:fs/promises';
import path from 'node:path';

// These are the pose channels read by actors, hand grips, travel poses, and foot placement.
// Joint animation stays in the native GLBs. Keep every sample and every stored number.
export const PLAYBACK_POSE_FIELDS=Object.freeze({t:1,grip:3,tip:3,offGrip:3,offTip:3,roll:1,offRoll:1,footR:3,footL:3});

export function projectPlaybackMotions(records){
  return Object.fromEntries(Object.entries(records).map(([name,clip])=>{
    if(!Number.isFinite(clip.duration)||clip.duration<=0||!Array.isArray(clip.poses)||clip.poses.length<2)
      throw Error(`Invalid motion ${name}: a positive duration and at least two poses are required.`);
    const fields=Object.keys(clip.poses[0]).filter(key=>key in PLAYBACK_POSE_FIELDS);
    if(!fields.includes('t'))throw Error(`Invalid motion ${name}: poses need a time channel.`);
    const poses=clip.poses.map((pose,index)=>{
      if(index&&pose.t<=clip.poses[index-1].t)throw Error(`Invalid motion ${name}, pose ${index}: time must increase.`);
      const output={};
      for(const field of fields){
        const value=pose[field],width=PLAYBACK_POSE_FIELDS[field];
        if(width===1?!Number.isFinite(value):!Array.isArray(value)||value.length!==width||!value.every(Number.isFinite))
          throw Error(`Invalid motion ${name}, pose ${index}: ${field} must contain ${width} finite number(s).`);
        output[field]=Array.isArray(value)?[...value]:value;
      }
      for(const field of Object.keys(pose))if(field in PLAYBACK_POSE_FIELDS&&!fields.includes(field))
        throw Error(`Invalid motion ${name}, pose ${index}: ${field} is missing from the initial pose.`);
      return output;
    });
    // Preserve all clip metadata, including support schedules, grip modes, and attack timing.
    return [name,{...clip,poses}];
  }));
}

// Shared clips occupy one asset. Character-specific clips load with their model.
export function splitPlaybackMotions(records,clipSets){
  const metadata={},bundles={},owners={};
  for(const [name,{poses,...details}]of Object.entries(records)){
    const users=Object.entries(clipSets).filter(([,names])=>names.includes(name)).map(([model])=>model);
    const group=users.length>1?'shared':users[0]??'legacy';
    metadata[name]=details;owners[name]=group;(bundles[group]??={})[name]=poses;
  }
  return{metadata,bundles,owners};
}

export function playbackMotionPlugin(){
  const virtualId='\0ninja-golf:playback-motion',loaderId='\0ninja-golf:motion-loader';
  let sourceFile,consumerFile,loaderFile,root,prepared;
  async function prepare(context){
    if(!prepared)prepared=(async()=>{
      context.addWatchFile(sourceFile);
      const records=projectPlaybackMotions(JSON.parse(await readFile(sourceFile,'utf8'))),clipSets={};
      for(const model of ['ronin','shinobi','monk','kaede','ayame','sora','enemy-cloth-ninja']){
        const file=path.join(root,'public/models',model+'.glb');context.addWatchFile(file);
        const bytes=await readFile(file),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
        clipSets[model]=(gltf.animations??[]).map(clip=>clip.name);
      }
      return splitPlaybackMotions(records,clipSets);
    })();
    return prepared;
  }
  return {
    name:'ninja-golf-playback-motion',enforce:'pre',
    apply:(_config,{command,mode})=>command==='build'&&mode!=='motion-reference',
    configResolved(config){
      root=config.root;sourceFile=path.resolve(root,'src/motion-data.json');
      consumerFile=path.resolve(root,'src/motion.js');loaderFile=path.resolve(root,'src/motion-loading.js');
    },
    buildStart(){prepared=null;},
    resolveId(source,importer){
      if(source==='ninja-golf:motion-records'||source==='./motion-data.json'&&importer?.split('?')[0]===consumerFile)return virtualId;
      if(source==='./motion-loading.js'&&path.resolve(path.dirname(importer?.split('?')[0]??root),source)===loaderFile)return loaderId;
    },
    async load(id){
      if(id!==virtualId&&id!==loaderId)return;
      const {metadata,bundles,owners}=await prepare(this);
      if(id===virtualId)return `export default JSON.parse(${JSON.stringify(JSON.stringify(metadata))});`;
      const urls=Object.entries(bundles).map(([group,poses])=>{
        const ref=this.emitFile({type:'asset',name:`motion-${group}.json`,source:JSON.stringify(poses)});
        return `${JSON.stringify(group)}:import.meta.ROLLUP_FILE_URL_${ref}`;
      });
      return `import records from 'ninja-golf:motion-records';
import {createMotionDataLoader} from ${JSON.stringify(path.resolve(root,'src/motion-data-loader.js'))};
const urls={${urls.join(',')}};
export const loadMotionData=createMotionDataLoader(records,${JSON.stringify(owners)},async group=>{
  const response=await fetch(urls[group]);
  if(!response.ok)throw Error('Motion download failed: '+response.status+'. Try again.');
  return response.json();
});`;
    },
  };
}
