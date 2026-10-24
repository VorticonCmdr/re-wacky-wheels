import test from 'node:test';
import assert from 'node:assert/strict';
import { kartHeadlights, MAX_HEADLIGHTS } from '../src/voxel/headlights.js';

const mesh={bounds:[30,27,32],wheelRadius:4.4};
const racer=(extra={})=>({mesh,position:[100,0,200],yaw:0,units:.5,animation:{tilt:[0,0]},...extra});
const night={grade:'night',gradeStrength:1};
test('headlights follow each kart nose and heading, have bounded range and strengthen at night',()=>{
  const forward=kartHeadlights([racer()],night),turned=kartHeadlights([racer({yaw:Math.PI/2})],night);
  assert.equal(forward.count,1);assert.equal(forward.origins[0],100);assert.equal(forward.origins[2],208.5);
  assert.deepEqual([...forward.directions.slice(0,3)],[0,1,280]);
  assert.equal(turned.origins[0],108.5);assert.equal(turned.origins[2],200);
  assert.equal(turned.directions[0],1);assert(Math.abs(turned.directions[1])<1e-6);
  assert(forward.origins[3]>kartHeadlights([racer()],{grade:'none'}).origins[3]);
  assert.equal(forward.solids[0].noShadow,true);assert.equal(forward.solids[0].mesh.parts[0].emission,1);
  assert.equal(forward.solids[0].mesh,turned.solids[0].mesh,'lamp geometry is cached per model');
});
test('headlights clear when disabled and avoid floating beams during jumps, sinking and rolls',()=>{
  const off=kartHeadlights([racer()],night,false);
  assert.equal(off.count,0);assert.equal(off.solids.length,0);assert(off.origins.every(v=>v===0));
  for(const r of [racer({position:[100,12,200]}),racer({position:[100,-8,200]}),racer({animation:{tilt:[0,.8]}})]) {
    const lights=kartHeadlights([r],night);assert.equal(lights.count,0);assert.equal(lights.solids.length,1);
    assert.equal(lights.solids[0].animation,r.animation);
  }
  const many=kartHeadlights(Array.from({length:20},()=>racer()),night);
  assert.equal(many.count,MAX_HEADLIGHTS);assert.equal(many.solids.length,MAX_HEADLIGHTS);
  assert.equal(kartHeadlights([],night).count,0);
});
