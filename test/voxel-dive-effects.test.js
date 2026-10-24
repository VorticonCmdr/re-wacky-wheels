import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiveEffects, diveFragments, bubbleMesh } from '../src/voxel/dive-effects.js';

const state=()=>({world:{},tick:1,car:{}});
test('dive bubbles emit at a bounded cadence and resurfacing makes one small burst at the last wet point',()=>{
  const fx=createDiveEffects(),s=state(),p={x:10,y:20};
  fx.sample(s,0,0,p,false);
  for(let t=100;t<=600;t+=100)fx.sample(s,t,t/600,p,true);
  const bubbles=fx.frame(600);assert(bubbles.length>=6&&bubbles.length<=8);
  assert(bubbles.every(e=>e.kind==='bubble'));
  fx.sample(s,700,1,p,true);assert.equal(fx.frame(700).length,bubbles.length);
  fx.sample(s,800,.8,p,true);fx.sample(s,900,.5,{x:12,y:20},false);
  fx.sample(s,1000,.2,{x:14,y:20},false);fx.sample(s,1100,0,{x:16,y:20},false);
  const splash=fx.frame(1100).filter(e=>e.kind==='surface');assert.equal(splash.length,1);
  assert.deepEqual([splash[0].x,splash[0].y],[10,20]);
  const paused=fx.frame(1100);fx.sample(s,1100,0,{x:16,y:20},false);assert.deepEqual(fx.frame(1100),paused);
  assert.equal(fx.frame(2200).length,0);
});
test('loading underwater, resets, teleports and crashes do not create resurfacing bursts',()=>{
  const fx=createDiveEffects(),s=state(),p={x:0,y:0};
  fx.sample(s,0,1,p,true);assert.equal(fx.frame(0).length,0);
  fx.sample(s,100,0,{x:500,y:0},false);assert.equal(fx.frame(100).length,0);
  fx.sample(s,200,.5,{x:500,y:0},true);assert(fx.frame(200).length);
  s.car.crashed=true;fx.sample(s,300,0,{x:500,y:0},false);assert.equal(fx.frame(300).length,0);
  fx.reset();assert.equal(fx.frame(300).length,0);
});
test('bubble and splash trajectories are finite, repeatable, fade out and use reusable geometry',()=>{
  const b={kind:'bubble',x:10,y:20,time:0,seed:3,age:.2};
  const first=diveFragments(b)[0],later=diveFragments({...b,age:.5})[0];
  assert(later.position[1]>first.position[1]);assert(later.opacity<first.opacity);
  assert.deepEqual(diveFragments(b),diveFragments(b));
  const splash=diveFragments({...b,kind:'surface'});assert.equal(splash.length,24);
  assert(splash.every(p=>p.position.every(Number.isFinite)&&p.units>0));
  assert.equal(diveFragments({...b,kind:'surface',age:1.1}).length,0);
  assert.equal(bubbleMesh(),bubbleMesh());assert(bubbleMesh().vertices.every(Number.isFinite));
});
