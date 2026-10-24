import test from 'node:test';
import assert from 'node:assert/strict';
import { openGameFolder } from '../src/vfs/node.js';
import { loadTrack } from '../src/game/track-data.js';
import { classifyLiquids } from '../src/liquids.js';
import { terrainAt } from '../src/game/surface.js';
import { routeEntries } from '../src/game/ai.js';
import { trackTerrain } from '../src/voxel/terrain.js';
import { waterSurface } from '../src/voxel/water.js';

test('track 1 terrain preserves its road and route, adds exposed relief and keeps gameplay data unchanged',async()=>{
  const dat=await(await openGameFolder()).open('WACKY.DAT'),world=loadTrack(dat,'1');
  const original=world.tiles.slice(),terrain=trackTerrain(world);
  assert.equal(trackTerrain(world),terrain);
  assert(terrain.mesh.vertices.every(Number.isFinite));assert(terrain.mesh.count>6);
  for(let i=0;i<terrain.types.length;i++)if(terrain.types[i]===0)assert.equal(terrain.heights[i],0);
  for(const entry of routeEntries(world.route))for(const [x,z] of entry.points)assert.equal(terrain.heightAt(x,z),0,`route at ${x},${z}`);
  assert(terrain.heights.includes(1.5),'raised curb blocks');
  assert(terrain.heights.some((h,i)=>h===12&&terrain.types[i]===19),'raised infield');
  assert.equal(terrain.heightAt(1860,2110),-18,'recessed basin');
  assert.equal(terrain.waterAt(world.start.x,world.start.y),0);
  assert.deepEqual(world.tiles,original);
  assert(trackTerrain({...world,name:'2'}),'terrain also supports the other tracks');
  const pond=waterSurface(world,terrain),flat=waterSurface(world);
  assert.equal(pond.at(1860,2110),1);assert.equal(flat.at(1860,2110),0);
  assert.equal(pond.level,-8);assert(pond.heightAt(1860,2110,1000)<-6);
  assert(pond.heightAt(1860,2110,1000)>terrain.heightAt(1860,2110));
});


test('all 42 layouts preserve dry racing routes, bound their terrain, and retain water/red-liquid classification',async()=>{
  const dat=await(await openGameFolder()).open('WACKY.DAT');
  for(let n=1;n<=42;n++) {
    const world=loadTrack(dat,String(n)),terrain=trackTerrain(world),liquids=classifyLiquids(world);
    assert(terrain,`track ${n}`);
    assert(terrain.mesh.vertices.every(Number.isFinite));
    assert(terrain.heights.every(h=>h>=-18&&h<=12));
    for(let i=0;i<terrain.roadCells.length;i++)if(terrain.roadCells[i])assert.equal(terrain.heights[i],0,`road track ${n}`);
    for(const entry of routeEntries(world.route))for(const [x,z] of entry.points) {
      if(!liquids.kinds.has(terrainAt(world,x,z)))assert.equal(terrain.heightAt(x,z),0,`route track ${n}: ${x},${z}`);
    }
    let wet=0;
    for(let z=1028;z<3072;z+=8)for(let x=1028;x<3072;x+=8) {
      const kind=terrain.waterAt(x,z);
      if(kind){wet++;assert(terrain.heightAt(x,z)<terrain.waterLevelAt(x,z));if(n!==1)assert.equal(kind,liquids.kinds.get(terrainAt(world,x,z)),`liquid track ${n}`);}
    }
    if(!liquids.any&&n!==1)assert.equal(wet,0,`no invented pond on track ${n}`);
  }
});

test('beach crossings sit just below the road while diving pools stay recessed',async()=>{
 const dat=await(await openGameFolder()).open('WACKY.DAT'),world=loadTrack(dat,'2'),terrain=trackTerrain(world),water=waterSurface(world,terrain);
 let shallow=0,deep=0;
 for(let z=1028;z<3072;z+=8)for(let x=1028;x<3072;x+=8){
  if(!terrain.waterAt(x,z))continue;
  if(terrain.types[((z-1024)>>3)*256+((x-1024)>>3)]===5){
   shallow++;assert.equal(terrain.heightAt(x,z),-2);assert.equal(terrain.waterLevelAt(x,z),-.6);
   const encoded=water.pixels[((z-1024)*2048+x-1024)*4+1]*32/255;
   assert(Math.abs(encoded-1.4)<.07,'shallow depth is carried to the water shader');
   assert(water.heightAt(x,z,1000)>-.6&&water.heightAt(x,z,1000)<0);
  }else if(terrain.types[((z-1024)>>3)*256+((x-1024)>>3)]===6){deep++;assert.equal(terrain.waterLevelAt(x,z),-8);}
 }
 assert(shallow>0&&deep>0);
});
