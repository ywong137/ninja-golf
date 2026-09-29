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

export function playbackMotionPlugin(){
  const virtualId='\0ninja-golf:playback-motion';
  let sourceFile,consumerFile;
  return {
    name:'ninja-golf-playback-motion',
    enforce:'pre',
    // Development and the explicit reference build keep the complete authoring records.
    apply:(_config,{command,mode})=>command==='build'&&mode!=='motion-reference',
    configResolved(config){
      sourceFile=path.resolve(config.root,'src/motion-data.json');
      consumerFile=path.resolve(config.root,'src/motion.js');
    },
    resolveId(source,importer){
      if(source==='./motion-data.json'&&importer?.split('?')[0]===consumerFile)return virtualId;
    },
    async load(id){
      if(id!==virtualId)return;
      this.addWatchFile(sourceFile);
      const records=projectPlaybackMotions(JSON.parse(await readFile(sourceFile,'utf8')));
      // Match Vite's large-JSON strategy: parse one string rather than a large object expression.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(records))});`;
    },
  };
}
