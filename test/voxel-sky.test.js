import test from 'node:test';
import assert from 'node:assert/strict';
import { panoramaPixels } from '../src/voxel/sky.js';
import { openGameFolder } from '../src/vfs/node.js';
import { loadTrack } from '../src/game/track-data.js';
test('panoramas keep skyline colors and mask the archive sky ramp on all tracks',async()=>{
 const dat=await(await openGameFolder()).open('WACKY.DAT');
 for(let n=1;n<=42;n++){
  const world=loadTrack(dat,String(n)),pixels=panoramaPixels(world);
  assert.equal(pixels.length,1280*20*4);
  for(let i=0;i<world.par.length;i++){
   assert.equal(pixels[i*4+3],world.par[i]>=230?0:255);
   for(let c=0;c<3;c++)assert.equal(pixels[i*4+c],Math.floor(world.palette[world.par[i]*3+c]*255/63));
  }
 }
});
