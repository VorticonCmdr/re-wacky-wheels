import test from 'node:test';
import assert from 'node:assert/strict';
import { particleMaterial,particleSurfaceAt,PARTICLE_SURFACES } from '../src/voxel/particle-surface.js';
import { openGameFolder } from '../src/vfs/node.js';
import { loadTrack } from '../src/game/track-data.js';
import { trackTerrain } from '../src/voxel/terrain.js';

test('surface colors distinguish sand, grass, dirt and snow without treating grey rock as snow',()=>{
 for(const [rgb,want] of [[[199,161,85],'sand'],[[4,164,0],'grass'],[[111,77,40],'dirt'],[[222,235,248],'snow'],[[134,134,134],'dirt']])assert.equal(particleMaterial(rgb),want);
 assert(PARTICLE_SURFACES.snow.gravity<PARTICLE_SURFACES.dirt.gravity);
});
test('each tyre samples its mask region and keeps a stable material across texture speckles',()=>{
 const mask=new Uint8Array(1024),sheet=new Uint8Array(1024),palette=new Uint8Array(768);
 palette.set([55,59,63],3);palette.set([8,42,3],6);palette.set([63,63,63],9);
 for(let i=0;i<1024;i++){mask[i]=(i%32)>=16?1:0;sheet[i]=mask[i]?2:1;}
 sheet[0]=3;
 const world={tiles:new Uint8Array(4096),sheets:[sheet],maskSheets:[mask],palette};
 assert.equal(particleSurfaceAt(world,1024,1024),'snow');assert.equal(particleSurfaceAt(world,1025,1024),'snow');
 assert.equal(particleSurfaceAt(world,1044,1024),'grass');
});
test('real track 1 sandy banks and grassy verges produce their respective materials',async()=>{
 const dat=await(await openGameFolder()).open('WACKY.DAT'),world=loadTrack(dat,'1'),terrain=trackTerrain(world),seen=new Set();
 for(let i=0;i<terrain.types.length;i++)if(!terrain.roadCells[i]&&[1,19].includes(terrain.types[i])){
  const x=1024+(i%256)*8+4,z=1024+Math.floor(i/256)*8+4;
  if(terrain.waterAt(x,z))continue;
  const material=particleSurfaceAt(world,x,z);seen.add(material);
 }
 assert(seen.has('sand'));assert(seen.has('grass'));
});
