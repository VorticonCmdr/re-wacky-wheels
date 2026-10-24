import test from 'node:test';
import assert from 'node:assert/strict';
import { kartLampGlows } from '../src/voxel/lamp-glow.js';

const mesh={bounds:[30,27,32],wheelRadius:4.4};
const racer={mesh,position:[10,2,20],yaw:1,units:.5,animation:{tilt:[.1,.2]}};
const night={grade:'night'};
test('lamp halos respect night strength, comparison and individual lamp switches',()=>{
  assert.equal(kartLampGlows([racer],{grade:'none'}).length,0);
  assert.equal(kartLampGlows([racer],night,{lampGlow:false}).length,0);
  assert.equal(kartLampGlows([racer],night,{headlights:false,taillights:false}).length,0);
  const full=kartLampGlows([racer],night),dusk=kartLampGlows([racer],{grade:'dusk'});
  assert.equal(full.length,2);assert(full[0].animation.opacity>dusk[0].animation.opacity);
  assert.deepEqual(kartLampGlows([racer],night,{headlights:false})[0],full[1]);
  assert.deepEqual(kartLampGlows([racer],night,{taillights:false})[0],full[0]);
});
test('braking widens and brightens rear halos while preserving pose and cached geometry',()=>{
  const idle=kartLampGlows([racer],night),brake=kartLampGlows([{...racer,braking:true}],night);
  assert.equal(idle[0].mesh,brake[0].mesh);
  assert(brake[1].animation.opacity>idle[1].animation.opacity);
  const span=m=>Math.max(...m.vertices.filter((_,i)=>i%10===0))-Math.min(...m.vertices.filter((_,i)=>i%10===0));
  assert(span(brake[1].mesh)>span(idle[1].mesh));
  assert.equal(brake[1].mesh,kartLampGlows([{...racer,braking:true}],night)[1].mesh);
  assert.deepEqual(brake[1].position,racer.position);assert.deepEqual(brake[1].animation.tilt,racer.animation.tilt);
  assert.equal(brake[1].yaw,racer.yaw);assert.equal(brake[1].units,racer.units);
  assert.deepEqual(racer.animation,{tilt:[.1,.2]},'rendering must not mutate the kart pose');
});
