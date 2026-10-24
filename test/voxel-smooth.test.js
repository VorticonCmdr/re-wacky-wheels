import test from 'node:test';
import assert from 'node:assert/strict';
import { blend } from '../src/enhance/motion.js';
import { kartHeadlights } from '../src/voxel/headlights.js';
import { inHeadlightRange } from '../src/voxel/headlight-shadows.js';

test('camera, driver direction, lean and opponent direction interpolate across wrap without changing simulation snapshots',()=>{
  const world={},seat={cx:1000,cy:1000,px:1124,py:1000,heading:1910,dir:1910,lean:2,horizon:100,sky:100};
  const a={world,tick:1,time:0,seats:[seat],racers:[{x:1200,y:1000,direction:1910}],shots:[]};
  const b={...a,tick:2,time:88,seats:[{...seat,heading:10,dir:10,lean:4}],racers:[{x:1210,y:1000,direction:10}]};
  const mesh={bounds:[30,27,32],wheelRadius:4.4},angles=[];
  for(const alpha of [0,.25,.5,.75]) {
    const f=blend(a,b,alpha),s=f.seats[0];
    assert.equal(s.dir,1910+20*alpha);assert.equal(s.heading,s.dir);
    assert.equal(s.lean,2+2*alpha);assert.equal(f.racers[0].direction,s.dir);
    const light=kartHeadlights([{mesh,position:[s.px,0,s.py],yaw:s.dir/1920*Math.PI*2,units:.5}],{grade:'night'});
    angles.push(light.directions[0]);
  }
  assert(angles.every((v,i)=>!i||v>angles[i-1]),'light moves between ticks, not only at a tick boundary');
  assert.equal(a.seats[0].dir,1910);assert.equal(b.seats[0].dir,10);
});
test('headlight caster culling keeps crossing objects but rejects distant, behind and emissive objects',()=>{
  const object={mesh:{bounds:[10,20,10]},units:1,position:[0,0,50]};
  const source=[0,2,0],beam=[0,1,280,.22];
  assert(inHeadlightRange(object,source,beam));
  assert(inHeadlightRange({...object,position:[27,0,50]},source,beam));
  for(const position of [[0,0,-30],[0,0,400],[100,0,50]])assert(!inHeadlightRange({...object,position},source,beam));
  assert(!inHeadlightRange({...object,noShadow:true},source,beam));
});
