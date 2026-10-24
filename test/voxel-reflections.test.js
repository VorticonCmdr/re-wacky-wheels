import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrackPass } from '../src/voxel/track-gpu.js';
import { voxelMesh } from '../src/voxel/mesh.js';
import { createVoxelKarts } from '../src/voxel/karts.js';
import { createReflectionTarget, reflectionSize } from '../src/voxel/reflections.js';

// Records render ordering and bindings; this is not a GPU shader/visual test.
function context(complete=true) {
  let id=0,unit='TEXTURE0',fbo=null;
  const uniforms={},textures=new Map(),attachments=new Map(),calls=[],draws=[];
  const gl=new Proxy({}, {get:(_,k)=>{
    if(/^[A-Z0-9_]+$/.test(k))return k;
    if(k.startsWith('create'))return ()=>({id:++id});
    if(k==='getShaderParameter'||k==='getProgramParameter')return ()=>true;
    if(k==='getUniformLocation')return (_p,name)=>name;
    if(k==='checkFramebufferStatus')return ()=>complete?'FRAMEBUFFER_COMPLETE':'INCOMPLETE';
    return (...args)=>{
      calls.push([k,...args]);
      if(k==='activeTexture')unit=args[0];
      if(k==='bindTexture')textures.set(unit,args[1]);
      if(k==='bindFramebuffer')fbo=args[1];
      if(k==='framebufferTexture2D')attachments.set(fbo,args[3]);
      if(k.startsWith('uniform'))uniforms[args[0]]=args.length===2?structuredClone(args[1]):args.slice(1);
      if(k==='drawArrays') {
        // WebGL forbids sampling any texture attached to the current draw FBO,
        // even when a branch would not actually read that sampler this draw.
        for(const name of ['image','liquidMask','reflectionImage','headlightDepth']) {
          const texture=textures.get(`TEXTURE${uniforms[name]}`);
          assert.notEqual(texture,attachments.get(fbo),`feedback through ${name}`);
        }
        draws.push({...structuredClone(uniforms),fbo,count:args[2]});
      }
    };
  }});
  return {gl,calls,draws};
}
function fixture() {
  const sin=[[0,0],[6,6]].map(a=>{const kept=new Uint8Array(8),v=new DataView(kept.buffer);a.forEach((n,i)=>v.setUint32(i*4,n,true));return {kept};});
  const palette=new Uint8Array(768);palette.set([4,20,58],3);
  const tiles=new Uint8Array(4096);tiles[100]=1;
  const sheets=[new Uint8Array(54*1024)];sheets[0].fill(1,1024,2048);
  const object={id:0,x:1500,y:1500,frame:0,consumed:0};
  const world={palette,sin,tiles,sheets,maskSheets:[new Uint8Array(54*1024)],objects:[object],sprites:[{name:'OB1.SP',width:28,height:28}]};
  const mesh=voxelMesh({size:4,voxels:[[1,1,1,255,80,20]]});
  const racer={mesh,position:[1500,2,1550],yaw:.4,units:1,wheels:{spin:2,steer:.2},animation:{tilt:[.1,.2],head:.3}};
  return {cap:255,lighting:'sunny',scene:{world,richSky:false,scenery:'studio',weapons:'studio',water:'waves',reflections:true,
    wakes:[{x:1500,y:1500,dx:1,dz:0,kind:1,age:.3,strength:.8}],camera:[1500,38,1400],forward:[0,1],sun:[1,2,1],time:500,racers:[racer],objects:[object],shots:[]}};
}
test('track shaders agree on the shared wake counter precision at race startup',()=>{
  const {gl,calls}=context();createTrackPass(gl);
  const sources=calls.filter(c=>c[0]==='shaderSource').map(c=>c[2]);
  assert.equal(sources.length,2);
  // GLSL ES defaults integers to highp in vertices, mediump in fragments.
  // A shared uniform with different precision prevents the program linking.
  const precision=sources.map((source,index)=>{
    const declaration=source.match(/uniform\s+(?:(lowp|mediump|highp)\s+)?int\s+wakeCount\s*;/);
    assert(declaration,'wake counter must be declared in both stages');
    return declaration[1] ?? source.match(/precision\s+(lowp|mediump|highp)\s+int\s*;/)?.[1] ?? (index===0?'highp':'mediump');
  });
  assert.equal(precision[0],precision[1]);
});
test('headlight depth maps draw blockers, feed lighting and skip all work in comparison mode',()=>{
  const {gl,draws,calls}=context(),pass=createTrackPass(gl),frame=fixture();
  // Put a second kart directly in front of the emitting kart.
  const own=frame.scene.racers[0];own.yaw=0;own.position=[1500,0,1500];
  frame.scene.racers.push({...own,position:[1500,0,1540]});
  frame.scene.objects[0].y=1580;frame.scene.reflections=false;
  pass.draw({id:'output'},320,200,frame);
  const maps=draws.filter(d=>d.headlightDepthPass);
  assert(maps.length>=2,'nearby karts and scenery cast into light maps');
  assert(maps.some(d=>d.origin[2]===1540));assert(maps.some(d=>d.origin[2]===1580));
  assert(draws.some(d=>!d.headlightDepthPass&&d.headlightShadowsOn));
  assert(calls.some(c=>c[0]==='texImage2D'&&c[3]==='DEPTH_COMPONENT24'));
  const start=draws.length;
  pass.draw({id:'output'},320,200,{...frame,scene:{...frame.scene,headlightShadows:false}});
  assert(draws.slice(start).every(d=>!d.headlightDepthPass&&!d.headlightShadowsOn));
  assert(draws.slice(start).every(d=>d.headlightCount===2),'unshadowed beams remain for comparison');
});
test('water reflection reuses live poses, has independent depth and never samples its own render target',()=>{
  const {gl,draws,calls}=context(),pass=createTrackPass(gl),frame=fixture(),target={id:'world'};
  pass.draw(target,320,200,frame);
  const mirrored=draws.filter(d=>d.reflectionPass),ordinary=draws.filter(d=>!d.reflectionPass&&!d.shadow&&!d.waterPass&&d.material===0);
  assert.equal(mirrored.length,20);assert.equal(ordinary.length,20); // kart, scenery, lamps and 16 wake-spray droplets
  const pose=d=>({origin:d.origin,yaw:d.yaw,units:d.units,kartTilt:d.kartTilt,angles:d.angles,count:d.count});
  assert.deepEqual(mirrored.map(pose),ordinary.map(pose));
  assert.notEqual(mirrored[0].fbo,ordinary[0].fbo);
  assert(draws.find(d=>d.waterPass).reflectionsOn);
  assert.equal(draws.find(d=>d.waterPass).wakeCount,1);
  assert(draws.every(d=>d.headlightCount===1), 'beams reach both reflected and ordinary draws');
  const allocations=()=>calls.filter(c=>c[0]==='texImage2D'&&c[4]===160&&c[5]===100).length;
  assert.equal(allocations(),1);pass.draw(target,320,200,frame);assert.equal(allocations(),1);
  const start=draws.length;pass.draw(target,640,400,frame);
  assert(draws.slice(start).some(d=>d.reflectionPass));
  assert(calls.some(c=>c[0]==='viewport'&&c[3]===640&&c[4]===400));
  for(const comparison of [{reflections:false},{water:'flat'}]) {
    const before=draws.length;pass.draw(target,320,200,{...frame,scene:{...frame.scene,...comparison}});
    assert(draws.slice(before).every(d=>!d.reflectionPass&&!d.reflectionsOn));
    if(comparison.water==='flat')assert(draws.slice(before).every(d=>d.wakeCount===0));
  }
  const before=draws.length;
  pass.draw(target,320,200,{...frame,scene:{...frame.scene,world:{...frame.scene.world,tiles:new Uint8Array(4096)}}});
  assert(draws.slice(before).every(d=>!d.reflectionPass));
  const off=draws.length;
  pass.draw(target,320,200,{...frame,scene:{...frame.scene,headlights:false}});
  assert(draws.slice(off).every(d=>d.headlightCount===0), 'comparison clears previous light uniforms');
});
test('incomplete reflection buffer falls back to sky-only water and target resources resize/release safely',()=>{
  const {gl,draws}=context(false);createTrackPass(gl).draw({id:'output'},320,200,fixture());
  assert(draws.some(d=>d.waterPass));assert(draws.every(d=>!d.reflectionPass&&!d.reflectionsOn));
  const good=context(),target=createReflectionTarget(good.gl);
  const a=target.ensure(321,201),b=target.ensure(640,400);
  assert.deepEqual(reflectionSize(321,201),[161,101]);assert.equal(a.texture,b.texture);
  target.dispose();assert.equal(good.calls.filter(c=>c[0]==='deleteTexture').length,1);
  assert.notEqual(target.ensure(320,200).texture,a.texture);
  const karts=createVoxelKarts({mapping:()=>({}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
  assert.equal(karts.reflections,true);karts.reflections=false;
  assert.equal(karts.water,'waves');assert.equal(karts.reflections,false);
});

test('detailed sky draws mirrored into the reflection target and comparison skips it',()=>{
 const {gl,calls}=context(),pass=createTrackPass(gl),frame=fixture();
 frame.scene.richSky=true;frame.scene.world.par=new Uint8Array(1280*20).fill(245);
 pass.draw({id:'output'},320,200,frame);
 assert.deepEqual(calls.filter(c=>c[0]==='uniform1i'&&c[1]==='mirrored').map(c=>c[2]),[0,1]);
 const start=calls.length;frame.scene.reflections=false;pass.draw({id:'output'},320,200,frame);
 assert.deepEqual(calls.slice(start).filter(c=>c[0]==='uniform1i'&&c[1]==='mirrored').map(c=>c[2]),[0]);
});
