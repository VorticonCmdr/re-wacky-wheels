import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainSuspension } from '../src/voxel/suspension.js';

const world={};
const terrain=heightAt=>({heightAt,waterAt:()=>0});
const input={world,tick:1,time:0,x:0,z:0,yaw:0,width:12,length:16,grounded:true};

test('level roads stay still and slopes tilt along the kart local axes',()=>{
  const ride=createTerrainSuspension();
  const flat=terrain(()=>0);
  for(let time=0;time<2000;time+=16)assert.deepEqual(ride.sample('flat',{...input,time,x:time/10,terrain:flat}),{height:0,tilt:[0,0],cameraHeight:0});
  const slope=terrain((x,z)=>z*.2);
  const forward=ride.sample('forward',{...input,terrain:slope});
  assert(Math.abs(forward.tilt[0]+Math.atan(.2))<1e-9);
  assert.equal(forward.tilt[1],0);
  const sideways=ride.sample('sideways',{...input,yaw:Math.PI/2,terrain:slope});
  assert(Math.abs(sideways.tilt[0])<1e-9);
  assert(Math.abs(sideways.tilt[1]-Math.atan(.2))<1e-9);
});

test('a curb causes bounded rebound, settles, and resets on comparison, water and respawn',()=>{
  const ride=createTerrainSuspension(),step=terrain(x=>x>=0?6:0);
  ride.sample('kart',{...input,x:-30,terrain:step});
  let peak=0,last;
  for(let time=16;time<=2000;time+=16){
    last=ride.sample('kart',{...input,time,x:30,terrain:step});
    peak=Math.max(peak,last.height);
    assert(last.height>=5.4&&last.height<8);
  }
  assert(peak>6,'suspension rebounds after the rise');
  assert(Math.abs(last.height-6)<.001);
  assert.deepEqual(ride.sample('kart',{...input,time:2016,terrain:null}),{height:0,tilt:[0,0],cameraHeight:0});
  const wet={heightAt:()=>-18,waterAt:()=>1};
  assert.equal(ride.sample('kart',{...input,time:2032,terrain:wet}).height,0);
  const reset=ride.sample('kart',{...input,time:0,x:-30,terrain:step});
  assert.equal(reset.height,0);assert.deepEqual(reset.tilt,[0,0]);
  assert.deepEqual(ride.sample('kart',{...input,terrain:terrain(()=>6),grounded:false}).tilt,[0,0]);
});

test('suspension damping is stable across render rates and repeated timestamps',()=>{
  const run=hz=>{
    const ride=createTerrainSuspension(),floor=terrain(x=>x<0?0:4);
    ride.sample('kart',{...input,x:-30,terrain:floor});
    let last;
    for(let i=1;i<=hz;i++)last=ride.sample('kart',{...input,x:30,time:i*1000/hz,terrain:floor});
    assert.deepEqual(ride.sample('kart',{...input,x:30,time:1000,terrain:floor}),last);
    return last.height;
  };
  assert(Math.abs(run(30)-run(144))<.01);
});
