// Validate every layout from the user's own archive; no game art is bundled here.
import assert from 'node:assert/strict';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack } from '../src/game/track-data.js';
import { sceneryMesh } from '../src/voxel/scenery.js';
import { trackTexture } from '../src/voxel/track.js';

const dat=await(await openGameFolder()).open('WACKY.DAT');
const names=[...archiveMembers(dat).keys()].filter(n=>/^\d+\.GAM$/.test(n))
  .map(n=>n.split('.')[0]).sort((a,b)=>Number(a)-Number(b));
assert(names.length>0,'No track layouts found');
const meshes=new Map();let placements=0;
for(const name of names) {
  const world=loadTrack(dat,name);
  assert.equal(world.tiles.length,4096);
  const texture=trackTexture(world);
  assert.equal(texture.length,2048*2048*4);
  for(let i=3;i<texture.length;i+=4)assert.equal(texture[i],255,`Track ${name}: incomplete ground texture`);
  for(const object of world.objects) {
    const sprite=world.sprites[object.id];
    if(!meshes.has(sprite.name)) {
      const mesh=sceneryMesh(world,sprite,'studio');
      assert(mesh,`Track ${name}: missing ${sprite.name}`);
      assert(mesh.vertices.every(Number.isFinite),sprite.name);
      assert(mesh.bounds.every(n=>n>0),sprite.name);
      meshes.set(sprite.name,mesh);
    }
    const mesh=meshes.get(sprite.name);
    const units=124/277*Math.min(sprite.width/mesh.bounds[0],sprite.height/mesh.bounds[1]);
    assert(Number.isFinite(units)&&units>0);
    assert(Number.isFinite(object.x)&&Number.isFinite(object.y));
    placements++;
  }
  console.log(`Track ${name}: ground and ${world.objects.length} voxel placements OK`);
}
console.log(`${names.length} layouts, ${meshes.size} model types, ${placements} placements; no missing Studio models.`);
