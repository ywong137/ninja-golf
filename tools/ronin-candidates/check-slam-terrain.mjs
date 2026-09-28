#!/usr/bin/env node
// Compare the candidate planner with the independently measured 480 Hz planes.
// This check does not certify moving actors or curved terrain.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {planSlamTerrain} from './plan-slam-terrain.mjs';

const {values}=parseArgs({options:{probes:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/ronin-candidates/check-slam-terrain.mjs --probes /tmp/probes.json\nChecks the reviewed Slam V2 geometry against the independently measured stationary terrain planes. Export the probes with export-slam-probes.mjs first.');
}else{
 if(!values.probes)throw Error('Supply --probes. See --help.');
 const probes=JSON.parse(fs.readFileSync(values.probes)),radians=Math.PI/180;
 assert.equal(probes.modelSha256,'311f9ff05369dd848e5777e0c02f9e6ee94dd9403590aa37a238924117a9a14e','These plane references require the reviewed Slam V2 source model.');
 assert.equal(probes.recordSha256,'bfec3f091f287a5bcdf50db44e4d333c07a4ee02e505ac60acb5a0d442367910','Use the reviewed Slam V2 motion record.');
 const rows=[];
 for(const [x,z,heading,pitch]of [[0,0,0,0],[.12,.10,0,11.130],[.12,.10,90,11.020],[.12,.10,180,0],[.12,.10,-90,0],[-.12,.10,0,9.508],[-.12,.10,90,0],[-.12,.10,180,0],[-.12,.10,-90,12.367]]){
  const result=planSlamTerrain({probes,origin:[0,0,0],yaw:heading*radians,groundHeight:(a,b)=>x*a+z*b});
  assert.equal(result.limited,false);
  assert.ok(result.clearanceAfter>=.006);
  // The older dense reference rounds to .001 degrees. The planner's bracket
  // resolves 25/4096 degrees and must agree within that quantization interval.
  assert.ok(Math.abs(result.pitch/radians-pitch)<.007,JSON.stringify({x,z,heading,pitch,result}));
  if(pitch===0)assert.equal(result.pitch,0,'Do not change an already clear pose.');
  rows.push({slope:[x,z],heading,pitchDegrees:result.pitch/radians,minimumClearance:result.clearanceAfter,queries:result.terrainQueries});
 }
 const input={probes,origin:[0,0,0],groundHeight:()=>0};
 const corruptions=[p=>{p.samples[0].pivot[0]=NaN;},p=>{p.samples[0].feet.r.ankle[0]=NaN;},p=>{p.samples[0].feet.l.solePoints[1][1]=Infinity;},p=>{p.samples[0].blade[0][2]=NaN;},p=>{p.samples[1].time=-1;},p=>{p.samples[1].time=p.samples[0].time;},p=>{p.axes.forward='-Z';},p=>{p.duration=NaN;}];
 for(const corrupt of corruptions){
  const copy=structuredClone(probes);corrupt(copy);let calls=0;
  assert.throws(()=>planSlamTerrain({...input,probes:copy,groundHeight:()=>{calls++;return 0;}}));
  assert.equal(calls,0,'Reject corrupt data before a terrain query.');
 }
 assert.throws(()=>planSlamTerrain({...input,clearance:Infinity}));
 assert.throws(()=>planSlamTerrain({...input,groundHeight:()=>NaN}),/Non-finite terrain height/);
 assert.throws(()=>planSlamTerrain({...input,rootScale:2}),/root scale/);
 const limited=planSlamTerrain({...input,groundHeight:(x,z)=>.12*x+.10*z,maxPitch:5*radians});
 assert.equal(limited.limited,true,'An insufficient pitch bound must not claim clearance.');
 assert.ok(limited.clearanceAfter<.006);
 console.log(JSON.stringify({rows,invalidCases:corruptions.length+3,insufficientBoundReported:true},null,2));
}
