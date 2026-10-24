import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirtEffects } from '../src/voxel/dirt.js';
const world={},terrain={heightAt:()=>6,waterAt:()=>0,roadCells:new Uint8Array(65536),types:new Uint8Array(65536).fill(19)};
const point={x:1200,z:1200,yaw:0,time:0,terrain,contacts:[[-5,-6],[5,-6]],grounded:true};
function trail(hz,overrides={}) {
 const dirt=createDirtEffects();dirt.begin(world,0);dirt.sample('kart',{...point,...overrides});
 for(let i=1;i<=hz;i++){const time=i*1000/hz;dirt.begin(world,time);dirt.sample('kart',{...point,...overrides,x:1200+i*80/hz,time});}
 return dirt;
}
test('off-road trails originate at both rear tyres at terrain height and follow distance, not frame count',()=>{
 const a=trail(30).frame(1000),b=trail(144).frame(1000);
 assert(Math.abs(a.length-b.length)<=2);assert(a.length>=38&&a.length<=40);
 assert(a.every(p=>p.height===6&&p.z===1194));assert(a.some(p=>p.x<1200));
 assert.equal(trail(60,{grounded:false}).frame(1000).length,0);
 assert.equal(trail(60,{terrain:null}).frame(1000).length,0);
 for(const floor of [{...terrain,roadCells:new Uint8Array(65536).fill(1)},{...terrain,waterAt:()=>1},{...terrain,types:new Uint8Array(65536).fill(3)}])assert.equal(trail(60,{terrain:floor}).frame(1000).length,0);
});
test('idle, teleported and reset karts leave no trail; particles expire and stay bounded',()=>{
 const dirt=createDirtEffects();dirt.begin(world,0);dirt.sample('kart',point);
 dirt.begin(world,100);dirt.sample('kart',{...point,time:100});assert.equal(dirt.frame(100).length,0);
 dirt.begin(world,200);dirt.sample('kart',{...point,x:1500,time:200});assert.equal(dirt.frame(200).length,0);
 const moving=trail(60);assert(moving.frame(1000).length>0);assert.equal(moving.frame(2200).length,0);
 moving.begin({},1000);assert.equal(moving.frame(1000).length,0);
 const crowded=createDirtEffects();crowded.begin(world,0);
 for(let n=0;n<8;n++)crowded.sample(String(n),point);
 for(let i=1;i<=10;i++){
  crowded.begin(world,i*50);
  for(let n=0;n<8;n++)crowded.sample(String(n),{...point,x:1200+i*10,time:i*50});
 }
 assert.equal(crowded.frame(500).length,128);crowded.reset();assert.equal(crowded.frame(500).length,0);
});
