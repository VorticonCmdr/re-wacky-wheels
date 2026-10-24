import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrackAntialias } from '../src/voxel/antialias.js';
function context(supported=true,complete=true){
 const calls=[];let id=0;
 const gl=new Proxy({}, {get:(_,key)=>{
  if(/^[A-Z0-9_]+$/.test(key))return key;
  if(key==='getInternalformatParameter')return ()=>supported?[8,4,2]:[];
  if(key==='checkFramebufferStatus')return ()=>complete?'FRAMEBUFFER_COMPLETE':'INCOMPLETE';
  if(key.startsWith('create'))return ()=>({id:++id});
  return (...args)=>calls.push([key,...args]);
 }});return {gl,calls};
}
test('coverage target selects four samples, reuses storage and resolves at original size',()=>{
 const {gl,calls}=context(),aa=createTrackAntialias(gl),first=aa.ensure(640,400);
 assert(first);assert.equal(aa.ensure(640,400),first);
 let allocations=calls.filter(c=>c[0]==='renderbufferStorageMultisample');
 assert.equal(allocations.length,2);assert(allocations.every(c=>c[2]===4&&c[4]===640&&c[5]===400));
 aa.resolve({id:'destination'});
 assert.deepEqual(calls.find(c=>c[0]==='blitFramebuffer').slice(1),[0,0,640,400,0,0,640,400,'COLOR_BUFFER_BIT','NEAREST']);
 aa.ensure(320,200);assert.equal(calls.filter(c=>c[0]==='renderbufferStorageMultisample').length,4);
});
test('unsupported or incomplete multisampling falls back without blocking the race',()=>{
 assert.equal(createTrackAntialias(context(false).gl).ensure(320,200),null);
 const {gl,calls}=context(true,false),aa=createTrackAntialias(gl);
 assert.equal(aa.ensure(320,200),null);assert.equal(aa.ensure(320,200),null);
 assert.equal(calls.filter(c=>c[0]==='deleteRenderbuffer').length,2);
});
