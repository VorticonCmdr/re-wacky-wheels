import test from 'node:test';
import assert from 'node:assert/strict';
import { createWakes, wakeHeight, wakeUniforms, MAX_WAKES } from '../src/voxel/wakes.js';
import { createVoxelKarts } from '../src/voxel/karts.js';

function race() {return {world:{},tick:0,car:{px:20,py:20,jump:0},ai:{racers:[{}, {x:40,y:20}]}};}
const water=(_w,x)=>x>=10?1:0;
function move(state,effects,x,y,time) {state.tick++;state.car.px=x;state.car.py=y;effects.tick(state,time);}
test('moving player and AI leave world-fixed speed-sensitive ripples with deterministic age',()=>{
 const state=race(),effects=createWakes(water);effects.tick(state,0);
 move(state,effects,24,20,100);assert.equal(effects.frame(100).length,1);
 const first=effects.frame(100)[0];assert.deepEqual([first.dx,first.dz],[1,0]);
 state.ai.racers[1].y=24;move(state,effects,32,20,200);
 const events=effects.frame(300);assert.equal(events.length,3);
 assert.equal(events[0].x,24);assert.equal(events[0].age,.2);
 assert(events[1].strength>events[0].strength);assert.deepEqual([events[2].dx,events[2].dz],[0,1]);
 assert.deepEqual(effects.frame(300),effects.frame(300));
 effects.tick(state,200);assert.equal(effects.frame(300).length,3);
 const count=events.length;move(state,effects,32,20,400);assert.equal(effects.frame(400).length,count);
 assert.equal(effects.frame(2200).length,0);
});
test('wakes exclude air, hidden karts, land crossings, respawns, pauses and world changes',()=>{
 const state=race(),effects=createWakes((_w,x)=>x>=10&&!(x>25&&x<30)?1:0);effects.tick(state,0);
 move(state,effects,40,20,100);assert.equal(effects.frame(100).length,0); // crossed a dry strip
 move(state,effects,400,20,200);assert.equal(effects.frame(200).length,0); // teleport
 state.car.jump=1;move(state,effects,410,20,300);assert.equal(effects.frame(300).length,0);
 state.car.jump=0;move(state,effects,414,20,400);assert.equal(effects.frame(400).length,0); // first landing sample
 state.fx={hidden:true};move(state,effects,418,20,500);assert.equal(effects.frame(500).length,0);
 state.fx=null;move(state,effects,422,20,600);move(state,effects,426,20,700);assert.equal(effects.frame(700).length,1);
 move(state,effects,430,20,2000);assert.equal(effects.frame(2000).length,1); // no stale movement after a long gap
 state.world={};move(state,effects,434,20,2100);assert.equal(effects.frame(2100).length,0);
 move(state,effects,438,20,2200);assert.equal(effects.frame(2200).length,1);
 effects.reset();effects.tick(state,2300);assert.equal(effects.frame(2300).length,0);
});
test('wake buffers and displacement remain bounded and comparison is independent',()=>{
 const state=race(),effects=createWakes(()=>2);state.ai.racers=Array.from({length:8},(_,i)=>({x:40+i*5,y:30}));effects.tick(state,0);
 for(let n=1;n<=30;n++){state.ai.racers.forEach(r=>r.y+=5);move(state,effects,20+n*5,20,n*100);}
 const events=effects.frame(3000);assert.equal(events.length,MAX_WAKES);
 const data=wakeUniforms(events);assert.equal(data.count,MAX_WAKES);assert.equal(data.centers.length,MAX_WAKES*4);
 assert(data.centers.every(Number.isFinite));assert(data.directions.every(Number.isFinite));
 for(const e of events)for(let dx=-30;dx<=30;dx+=2){const h=wakeHeight(e.x+dx,e.y,e);assert(Number.isFinite(h)&&Math.abs(h)<=.5);}
 const e={x:0,y:0,dx:1,dz:0,kind:1,age:.5,strength:1};
 assert(Math.abs(wakeHeight(-8,0,e))>Math.abs(wakeHeight(8,0,e)));
 assert.equal(wakeHeight(100,100,e),0);assert.deepEqual(wakeUniforms([]).count,0);
 const karts=createVoxelKarts({mapping:()=>({}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
 assert.equal(karts.wakes,true);karts.wakes=false;assert.equal(karts.water,'waves');assert.equal(karts.reflections,true);
 karts.water='flat';assert.equal(karts.wakes,false);
});

test('wake spacing is stable across tick rates and follows reverse travel',()=>{
 const run=step=>{
  const state=race(),effects=createWakes(()=>1);effects.tick(state,0);
  for(let t=step;t<=500;t+=step)move(state,effects,20-t*.04,20,t);
  return effects.frame(500);
 };
 assert.deepEqual(run(50),run(100));
 assert(run(50).every(e=>e.dx===-1&&e.dz===0));
});
