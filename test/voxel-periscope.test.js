import test from 'node:test';
import assert from 'node:assert/strict';
import { underwaterKart, periscopeMesh, periscopeVisual, createDiveMotion } from '../src/voxel/periscope.js';

test('periscope follows the water replacement state, including its last picture, but not lava or crashes',()=>{
  assert.equal(underwaterKart({special:1},{},1),true);
  assert.equal(underwaterKart({special:0},{pit:{}},1),true);
  for(const kind of [0,2,undefined])assert.equal(underwaterKart({special:1},{},kind),false);
  for(const change of [{special:0},{crashed:true},{wrecked:true},{jump:1}])assert.equal(underwaterKart({special:1,...change},{},1),false);
  assert.equal(underwaterKart({special:1},{crash:{}},1),false);
});

test('dives ease in and freeze with presentation time, but resurfacing is immediate',()=>{
  const motion=createDiveMotion(),state={world:{},tick:0,car:{px:10,py:20}};
  assert.equal(motion.sample(state,0,false).amount,0);
  state.tick++;
  assert.equal(motion.sample(state,100,true).amount,0);
  const halfway=motion.sample(state,425,true);
  assert.equal(halfway.amount,.5);assert(halfway.scope>0&&halfway.scope<1);
  assert.deepEqual(motion.sample(state,425,true),halfway);
  assert.deepEqual(motion.sample(state,425,false),{amount:0,scope:0,active:false});
  assert.equal(motion.sample(state,600,false).amount,0);
  assert.equal(motion.sample(state,1075,false).amount,0);
  motion.sample(state,1100,true);
  assert.equal(motion.sample(state,1750,true).amount,1);
  assert.deepEqual(motion.sample(state,1800,false),{amount:0,scope:0,active:false});
  assert.equal(motion.sample(state,2450,false).amount,0);
});

test('dive motion clears on crashes, restarts, new tracks and teleports',()=>{
  const motion=createDiveMotion(),state={world:{},tick:10,car:{px:10,py:20}};
  assert.equal(motion.sample(state,100,true).amount,1);
  state.car.crashed=true;assert.equal(motion.sample(state,110,false).amount,0);
  state.car.crashed=false;motion.sample(state,200,true);motion.sample(state,900,true);
  state.car.px=1000;assert.equal(motion.sample(state,910,false).amount,0);
  state.world={};assert.equal(motion.sample(state,920,true).amount,1);
  state.tick=0;assert.equal(motion.sample(state,930,false).amount,0);
  motion.reset();assert.equal(motion.sample(state,1000,false).amount,0);
});
test('periscope respects splash hiding and uses repeatable continuous animation without changing state',()=>{
  const car={special:1},point={x:12,y:34};
  assert.equal(periscopeVisual(car,{hidden:true},point,1,.5,100),null);
  const first=periscopeVisual(car,{},point,1,.5,100),next=periscopeVisual(car,{},point,1,.5,110);
  assert.deepEqual(first,periscopeVisual(car,{},point,1,.5,100));
  assert.notEqual(first.position[1],next.position[1]);assert(Math.abs(first.position[1]-next.position[1])<.1);
  assert.deepEqual([first.position[0],first.position[2]],[12,34]);assert.equal(first.units,.5);
  assert.deepEqual(car,{special:1});assert.equal(first.mesh,periscopeMesh());
  assert(first.mesh.vertices.every(Number.isFinite));assert(first.mesh.bounds[1]>first.mesh.bounds[0]);
});
