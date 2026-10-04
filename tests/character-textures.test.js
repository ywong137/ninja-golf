import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadCharacterTexture,awaitCharacterTextures} from '../src/character-textures.js';

test('one failed character surface does not reject another character; failed surfaces retry',async()=>{
 const original=THREE.TextureLoader.prototype.load,calls=[],pending=[];
 THREE.TextureLoader.prototype.load=function(url,done,progress,error){
  calls.push(url);const texture=new THREE.Texture();pending.push({url,done,error,texture});return texture;
 };
 const options={colorSpace:THREE.SRGBColorSpace,anisotropy:8};
 try{
  const bad=loadCharacterTexture('/test-bad.webp',options),good=loadCharacterTexture('/test-good.webp',options);
  assert.equal(loadCharacterTexture('/test-good.webp',options),good);
  const badMaterial={map:bad},goodMaterial={map:good};
  const badResult=assert.rejects(awaitCharacterTextures([badMaterial]),/test-bad/);
  pending[0].error();pending[1].done(good);await awaitCharacterTextures([goodMaterial]);await badResult;
  const retry=loadCharacterTexture('/test-bad.webp',options);assert.notEqual(retry,bad);
  pending[2].done(retry);await awaitCharacterTextures([{map:retry}]);
  assert.deepEqual(calls,['/test-bad.webp','/test-good.webp','/test-bad.webp']);
  assert.equal(retry.colorSpace,THREE.SRGBColorSpace);assert.equal(retry.flipY,false);assert.equal(retry.anisotropy,8);
 }finally{THREE.TextureLoader.prototype.load=original;}
});
