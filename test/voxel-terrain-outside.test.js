import test from 'node:test';
import assert from 'node:assert/strict';
import { outsideTerrain } from '../src/voxel/terrain-outside.js';
test('decorative exterior surrounds but never covers the racing map and is cached',()=>{
 const world={},terrain={heightAt:()=>6},mesh=outsideTerrain(world,terrain);
 assert.equal(outsideTerrain(world,terrain),mesh);assert.equal(outsideTerrain(world,null),null);
 assert(mesh.count>0&&mesh.count<800000);assert(mesh.vertices.every(Number.isFinite));
 let west=false,east=false,north=false,south=false;
 for(let i=0;i<mesh.vertices.length;i+=30){
  const v=mesh.vertices,x=(v[i]+v[i+10]+v[i+20])/3,z=(v[i+2]+v[i+12]+v[i+22])/3;
  assert(!(x>1024&&x<3072&&z>1024&&z<3072),'no decorative triangles in the playable map');
  west ||= x<1024;east ||= x>3072;north ||= z<1024;south ||= z>3072;
 }
 assert(west&&east&&north&&south);
});

import { outsideScenery,outsideSceneryModels } from '../src/voxel/outside-scenery.js';
test('all exterior themes keep deterministic tree, rock and bush footprints outside the track',()=>{
 for(const theme of ['grass','sand','snow','dirt']){
  const objects=outsideScenery(theme,()=>12),repeat=outsideScenery(theme,()=>12);
  assert.deepEqual(objects,repeat);assert(objects.length>50&&objects.length<180);
  assert.deepEqual(new Set(objects.map(o=>o.kind)),new Set(['tree','rock','bush']));
  for(const o of objects){
   assert.equal(o.position[1],12);assert(o.mesh.vertices.every(Number.isFinite));
   const radius=Math.hypot(o.mesh.bounds[0],o.mesh.bounds[2])*o.units/2;
   const [x,,z]=o.position;
   assert(x+radius<1024||x-radius>3072||z+radius<1024||z-radius>3072);
   assert(radius<32,'footprint stays on its supporting terrace');
  }
 }
 assert.notDeepEqual(outsideSceneryModels('grass').tree.vertices,outsideSceneryModels('snow').tree.vertices);
});
