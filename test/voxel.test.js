import test from 'node:test';
import assert from 'node:assert/strict';
import { voxelMesh } from '../src/voxel/mesh.js';
import { createVoxelKarts } from '../src/voxel/karts.js';

const cube = { size: 4, voxels: [[1, 1, 1, 255, 0, 0]] };
test('voxel meshing removes shared faces and preserves colors and ground pivot', () => {
  const one = voxelMesh(cube);
  assert.equal(one.count, 36);
  const two = voxelMesh({ size: 4, voxels: [...cube.voxels, [2, 1, 1, 0, 255, 0]] });
  assert.equal(two.count, 60);
  assert.deepEqual(two.bounds, [2, 1, 1]);
  const points = Array.from({length: two.count}, (_, i) => Array.from(two.vertices.slice(i * 10, i * 10 + 10)));
  assert.equal(Math.min(...points.map(p => p[1])), 0);
  assert.equal(Math.min(...points.map(p => p[0])), -1);
  assert.equal(Math.max(...points.map(p => p[0])), 1);
  assert(points.every(p => p.slice(3, 6).filter(n => n !== 0).length === 1));
  assert(points.some(p => p[6] === 1));
  assert(points.some(p => p[7] === 1));
});
test('voxel files reject invalid coordinates, duplicate cells and oversized grids', () => {
  for (const project of [null, {size: 129, voxels: cube.voxels}, {size: 4, voxels: []}, {size: 4, voxels: [[4, 0, 0, 255, 0, 0]]}, {size: 4, voxels: [[0, 0, 0, 256, 0, 0]]}, {size: 4, voxels: [cube.voxels[0], cube.voxels[0]]}]) assert.throws(() => voxelMesh(project));
});
test('live kart capture preserves simulation and falls back for missing models and unsupported states', () => {
  const karts = createVoxelKarts({mapping: () => ({}), racerOf: () => ({slot: 7, direction: 0}), headingVectorAt: () => [1, 0]});
  karts.install(7, cube); karts.enabled = true; karts.available = true;
  const P = {world: {}, car: {heading: 0, lean: 2, pic: {table: 'lean'}}, humanSlot: 7};
  const r = {type: 0, picture: {w: 38, h: 28}, left: 141, top: 164, firstColumn: 0, distance: 124};
  const fine = {seats: [{dir: 0}]}, camera = {heading: 0}, G = {s: 1}, before = structuredClone(P);
  karts.begin(P, true);
  assert.equal(karts.capture(r, P, fine, 0, camera, G), true);
  const frame = karts.frame(new Float32Array(1), new Uint8Array(1));
  assert.equal(frame.items.length, 1);
  assert.equal(frame.items[0].x, 160);
  assert.equal(frame.items[0].y, 192);
  assert.deepEqual(P, before);
  assert.equal(karts.capture(r, {...P, humanSlot: 0}, fine, 0, camera, G), false);
  for (const changed of [{fx: {pit: true}}, {fx: {crash: {table: 'flight', row: 2}}}, {car: {...P.car, wrecked: true}}, ...['lean','drift','spin','bump','wobble','pose','flight','fall'].map(table=>({car:{...P.car,pic:{table,row:2}}}))]) assert.equal(karts.capture(r, {...P, ...changed}, fine, 0, camera, G), true);
  karts.begin({...P, versus: {}}, true);
  assert.equal(karts.capture(r, P, fine, 0, camera, G), false);
  assert.equal(karts.frame([], []), null);
  karts.begin(P, false);
  assert.equal(karts.capture(r, P, fine, 0, camera, G), false);
});

test('ambient occlusion leaves isolated cubes bright and darkens sheltered corners', () => {
  const isolated = voxelMesh(cube);
  for (let i = 9; i < isolated.vertices.length; i += 10) assert.equal(isolated.vertices[i], 1);
  const sheltered = voxelMesh({size: 4, voxels: [...cube.voxels, [2, 2, 1, 255, 0, 0], [1, 2, 2, 255, 0, 0]]});
  const ao = Array.from({length: sheltered.count}, (_, i) => sheltered.vertices[i * 10 + 9]);
  assert(ao.some(v => v === 0));
  assert(ao.some(v => v === 1));
  assert(ao.every(v => v >= 0 && v <= 1));
});

test('voxel ground shadows follow model heading, stay grounded during hops and do not stack', async () => {
  const { stampKartShadow } = await import('../src/voxel/shadows.js');
  const item = {mesh: {bounds: [12, 10, 24]}, x: 64, y: 70, groundY: 70, w: 48, h: 40, yaw: 0, scale: 1, referenceWidth: 48, referenceDistance: 124, distance: 124};
  const draw = (changes = {}, scale = 1) => {
    const shade = new Float32Array(128 * 128);
    stampKartShadow(shade, 128, 128, {...item, ...changes}, scale);
    const points = Array.from(shade, (value, i) => ({value, x: i % 128, y: Math.floor(i / 128)})).filter(p => p.value > 0);
    return {shade, points, width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))};
  };
  const base = draw(), side = draw({yaw: Math.PI / 2}), hop = draw({y: 46});
  assert(side.width > base.width);
  assert(side.height < base.height);
  assert(hop.points.length < base.points.length);
  assert(Math.max(...hop.shade) < Math.max(...base.shade));
  const centreY = points => points.reduce((sum, p) => sum + p.y * p.value, 0) / points.reduce((sum, p) => sum + p.value, 0);
  assert(Math.abs(centreY(base.points) - centreY(hop.points)) < .2);
  const before = base.shade.slice();
  stampKartShadow(base.shade, 128, 128, item);
  assert.deepEqual(base.shade, before);
  // Equivalent output and reference grids stamp exactly the same footprint.
  assert.deepEqual(draw({x: 128, y: 140, groundY: 140, w: 96, h: 80, scale: 2}, .5).shade, before);
  const clipped = draw({x: -2});
  assert(clipped.points.length > 0 && clipped.points.length < base.points.length);
  assert(clipped.shade.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
});

test('kart scale matches opaque rear sprite width without shrinking tall drivers or changing on turns', async () => {
  const { kartProjection } = await import('../src/voxel/shadows.js');
  const { carFrame } = await import('../src/game/control.js');
  const karts = createVoxelKarts({mapping: () => ({rear: 0}), racerOf: () => ({slot: 0, direction: 0}), headingVectorAt: () => [1, 0]});
  karts.install(0, cube); karts.enabled = true; karts.available = true;
  const cars = new Uint8Array((carFrame(0, 0) + 1) * 24);
  // Six source columns, of which four are opaque; column-major 6x4 frame.
  cars.fill(1, 4, 20);
  const P = {world: {carShape: [{w: 6, h: 4}], carFrames: {cars}}, car: {heading: 0, lean: 2, pic: {table: 'lean'}}, humanSlot: 0};
  karts.begin(P, true);
  karts.capture({type: 0, picture: {w: 6, h: 4}, left: 0, top: 5, firstColumn: 0, distance: 124}, P, {seats: []}, 0, {heading: 0}, {s: 1}, {ground: 12});
  const item = karts.frame([], []).items[0];
  assert.equal(item.referenceWidth, 4);
  assert.equal(item.groundY, 12);
  assert.equal(item.y, 9);
  const short = {...item, mesh: {bounds: [40, 20, 41]}, referenceWidth: 36};
  const tall = {...short, mesh: {bounds: [40, 60, 41]}, yaw: Math.PI / 2};
  assert.equal(kartProjection(short).pixels, .9);
  assert.equal(kartProjection(tall).pixels, .9);
});

test('sun shadows project away from light and lengthen with lower sunlight', async () => {
  const { sunShadowSlope } = await import('../src/voxel/shadows.js');
  assert.deepEqual(sunShadowSlope([0, 1, 0]), [0, 0]);
  const high = sunShadowSlope([1, 2, -1]), low = sunShadowSlope([1, .5, -1]);
  assert.deepEqual(high, [.5, -.5]);
  assert.deepEqual(low, [2, -2]);
  // A point five units above the floor travels opposite the sun's X/Z components.
  assert(-5 * low[0] < 0 && -5 * low[1] > 0);
  assert.deepEqual(sunShadowSlope([-1, .5, 1]), low.map(v => -v));
  assert(sunShadowSlope([1, 0, 1]).every(Number.isFinite));
});

test('known four-wheel construction separates complete wheels and keeps boundary faces', () => {
  const voxels = [];
  for (const cx of [8, 39]) for (const cz of [12, 34]) {
    for (let x = cx - 4; x <= cx + 4; x++) for (let y = 1; y <= 11; y++) for (let z = cz - 5; z <= cz + 5; z++) {
      if ((y - 6) ** 2 + (z - cz) ** 2 <= 5.7 ** 2) voxels.push([x, y, z, 25, 28, 29]);
    }
  }
  voxels.push([13, 6, 12, 100, 100, 100]); // Body touching the left rear tire.
  const mesh = voxelMesh({size: 48, voxels});
  assert.equal(mesh.parts.length, 5);
  assert.equal(mesh.parts.filter(p => p.front).length, 2);
  assert.equal(mesh.parts.filter(p => p.wheel).length, 4);
  assert(mesh.parts.every(p => p.count > 0));
  assert.equal(mesh.parts[0].count, 36); // All six body faces remain, including the tire boundary.
  assert.equal(mesh.parts.reduce((n, p) => n + p.count, 0), mesh.count);
  assert.deepEqual(mesh.parts[1].pivot, [-15.5, 5.5, -11]);
  assert.equal(voxelMesh({size: 48, voxels: voxels.slice(1)}).parts.length, 1); // Incomplete/unknown rig stays rigid.
  const karts = createVoxelKarts({mapping: () => ({}), racerOf: () => null, headingVectorAt: () => [1, 0]});
  karts.install(0, {size: 48, voxels}); karts.enabled = true; karts.available = true;
  const state = {world: {}, tick: 0, humanSlot: 0, car: {px: 0, py: 0, heading: 0, lean: 2, pic: {table: 'lean'}}};
  const record = {type: 0, picture: {w: 38, h: 28}, left: 0, top: 0, firstColumn: 0, distance: 124};
  const capture = alpha => {
    karts.begin(state, true, alpha);
    karts.capture(record, state, {seats: []}, 0, {heading: 0}, {s: 1});
    return karts.frame([], []).items[0];
  };
  const first = capture(1);
  assert.equal(first.wheels.spin, 0);
  state.tick = 1; state.car.px = 10; state.car.lean = 4;
  const before = structuredClone(state), moving = capture(.5), paused = capture(1);
  assert(moving.wheels.spin > 0);
  assert.equal(paused.wheels.spin, moving.wheels.spin * 2);
  assert.equal(paused.wheels.steer, .45);
  assert.strictEqual(paused.mesh, first.mesh); // Animation changes uniforms, never rebuilds geometry.
  assert.deepEqual(capture(1).wheels, paused.wheels);
  assert.deepEqual(state, before);

});

test('wheel rolling follows travel, reverses, freezes while stopped and resets on discontinuities', async () => {
  const { createWheelMotion } = await import('../src/voxel/wheels.js');
  const motion = createWheelMotion(), world = {};
  const pose = (tick, z, alpha = 1) => { motion.begin(world, tick, alpha); return motion.pose('player', {x: 0, y: z}, [0, 1], 2, 8, .3); };
  assert.equal(pose(0, 0).spin, 0);
  assert.equal(pose(1, 2, .5).spin, .5);
  assert.equal(pose(1, 2, .25).spin, .5); // Repeated render cannot rewind the interpolated pose.
  assert.equal(pose(1, 2).spin, 1);
  assert.equal(pose(2, 6).spin, 3); // Twice the distance, twice the additional rotation.
  assert.equal(pose(3, 6).spin, 3);
  assert.deepEqual(pose(3, 6), pose(3, 6)); // Pause/redraw unchanged.
  assert.equal(pose(4, 4).spin, 2);
  assert.equal(pose(5, 1000).spin, 0); // Teleport, no huge wheel leap.
  assert.equal(pose(0, 0).spin, 0); // Race restart.
  motion.begin(world, 1, 1);
  assert.equal(motion.pose('another-racer', {x: 0, y: 2}, [0, 1], 2, 8).spin, 0);
});

test('front-wheel steering interpolates input and derives opponent turns without moving stopped tires', async () => {
  const { createWheelMotion } = await import('../src/voxel/wheels.js');
  const motion = createWheelMotion(), world = {};
  motion.begin(world, 0);
  motion.pose('player', {x: 0, y: 0}, [1, 0], 2, 8, 0);
  motion.pose('ai', {x: 0, y: 0}, [1, 0], 2, 8);
  motion.begin(world, 1, .5);
  const own = motion.pose('player', {x: 0, y: 0}, [1, 0], 2, 8, -.4);
  assert.equal(own.steer, -.2);
  assert.equal(own.spin, 0);
  const ai = motion.pose('ai', {x: 2, y: 1}, [Math.cos(.1), Math.sin(.1)], 2, 8);
  assert(ai.steer > 0 && ai.steer <= .45);
});

test('physical kart size stays fixed while body, wheel and contact projections shrink with depth', async () => {
  const { kartProjection, stampKartShadow } = await import('../src/voxel/shadows.js');
  const item = {mesh: {bounds: [40, 43, 41]}, referenceWidth: 36, referenceDistance: 124, distance: 124, scale: 1, x: 64, y: 80, groundY: 80, yaw: 0};
  const near = kartProjection(item), far = kartProjection({...item, distance: 248}), distant = kartProjection({...item, distance: 496});
  const close = (a, b) => assert(Math.abs(a - b) < 1e-10);
  close(near.pixels * 40, 36); close(far.pixels * 40, 18); close(distant.pixels * 40, 9);
  close(near.units, far.units); close(far.units, distant.units);
  close(kartProjection({...item, scale: 2}).pixels, near.pixels * 2);
  close(kartProjection({...item, scale: 2}).units, near.units);
  // Wheel radius in world units, and therefore roll per metre, ignores camera distance.
  close(5.7 * near.units, 5.7 * distant.units);
  // The local depth perspective also uses fixed units: not just a scaled flat image.
  const projectedWidth = (p, distance, localDepth) => 40 * p.pixels * distance / (distance + localDepth * p.units);
  assert(projectedWidth(near, 124, 10) > projectedWidth(far, 248, 10));
  const area = distance => {
    const shade = new Float32Array(128 * 128);
    stampKartShadow(shade, 128, 128, {...item, distance});
    return shade.filter(v => v > 0).length;
  };
  assert(area(124) > area(248) && area(248) > area(496));
});

test('voxel capture ignores sprite size bands and uses fine camera depth for opponents', async () => {
  const { kartProjection } = await import('../src/voxel/shadows.js');
  let depth = 193.9, projectedPoint;
  const karts = createVoxelKarts({mapping: () => ({}), racerOf: () => ({slot: 0, direction: 0}), headingVectorAt: () => [1, 0], projectAt: (_world, _camera, x, y, margin) => { projectedPoint = [x, y, margin]; return {distance: depth}; }});
  karts.install(0, cube); karts.enabled = true; karts.available = true;
  const state = {world: {carShape: [{w: 38, h: 28}]}, car: {}, ai: {racers: [null, {x: 200, y: 20}]}};
  const fine = {seats: [], racers: [null, {x: 200.25, y: 20.5}]};
  const capture = (w, smooth = null) => {
    karts.begin(state, true);
    karts.capture({type: 1, racer: 1, picture: {w, h: 28}, left: 100, top: 130, firstColumn: 0, distance: 194, smooth, place: {x: 100, y: 130}}, state, fine, 0, {heading: 0}, {s: 2, m: 53});
    return karts.frame([], []).items[0];
  };
  const a = capture(38), pa = kartProjection(a);
  assert.deepEqual(projectedPoint, [200.25, 20.5, 53]);
  assert.equal(a.distance, 193.9);
  depth = 194.1;
  const b = capture(35), pb = kartProjection(b);
  assert.equal(a.referenceWidth, b.referenceWidth);
  assert.equal(pa.units, pb.units);
  assert(pa.pixels > pb.pixels && pa.pixels / pb.pixels < 1.002);
  assert.equal(kartProjection(capture(35, {w: 69.5, h: 51})).pixels, pb.pixels);
});

// Weapon visuals consume the simulation's shot state, never change hit behavior.
import { weaponKind, weaponMeshes, weaponVisuals, fireballGlows } from '../src/voxel/weapons.js';
test('voxel weapons distinguish fan fire from hedgehogs and render every shot state', () => {
  const meshes=weaponMeshes();
  const shots=[{type:0,block:0x2be},{type:0,block:0x57c},...[1,2,3,4,5].map(type=>({type}))]
    .map((shot,index)=>({...shot,index,x:1500,y:1600,yaw:.6,state:0,frame:0}));
  assert.deepEqual(shots.map(weaponKind),['hog','fire','devil','bomb','oil','inverted','ice']);
  const before=structuredClone(shots);
  const live=weaponVisuals(shots,1234,meshes);
  for(const kind of shots.map(weaponKind)) assert(live.some(o=>o.mesh===meshes[kind]));
  assert.deepEqual(live,weaponVisuals(shots,1234,meshes));
  assert.deepEqual(shots,before);
  for(let frame=0;frame<3;frame++) {
    const burst=weaponVisuals(shots.map(s=>({...s,state:255,frame,block:0})),1234,meshes);
    assert.equal(burst.length,98);
    assert(burst.some(o=>o.mesh===meshes.frost));
    assert(burst.every(o=>o.position.every(Number.isFinite)&&Number.isFinite(o.yaw)&&o.units>0&&o.noShadow));
  }
  assert.deepEqual(weaponVisuals([],1234,meshes),[]);
  const bomb=weaponVisuals([shots[3]],1234,meshes);
  assert.equal(bomb.length,2); // stationary body and lit fuse, no travel trail
  assert(live.every(o=>o.mesh.count>36&&o.mesh.vertices.every(Number.isFinite)||o.mesh.count===36));
});
test('live voxel defaults select 3D track and Studio scenery while retaining comparison choices', () => {
  const karts=createVoxelKarts({mapping:()=>({}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
  assert.equal(karts.track,true);
  assert.equal(karts.scenery,'studio');
  assert.equal(karts.enabled,false);
  karts.track=false; karts.scenery='procedural'; karts.enabled=true;
  assert.equal(karts.track,false);
  assert.equal(karts.scenery,'procedural');
});

test('Studio weapons preserve physical extent, animations and fuse attachment across comparison modes', () => {
  const procedural=weaponMeshes('procedural'), studio=weaponMeshes('studio');
  for(const kind of ['hog','fire','devil','bomb','oil','inverted','ice']) {
    assert(studio[kind].voxels>procedural[kind].voxels);
    assert(Math.abs(Math.max(...studio[kind].bounds)-Math.max(...procedural[kind].bounds))<1e-6);
    assert(studio[kind].vertices.every(Number.isFinite));
    assert.equal(studio[kind].parts.length,1);
  }
  for(const yaw of [0,Math.PI/2,Math.PI]) {
    const shot={type:2,x:1500,y:1600,yaw,state:0,index:1};
    const visual=weaponVisuals([shot],1000,studio), fuse=studio.bomb.fuse;
    assert.equal(visual[0].mesh,studio.bomb);
    assert(Math.abs(visual[1].position[1]-(.12+fuse[1]*.65))<1e-6);
    assert(Math.abs(visual[1].position[0]-(shot.x+(-Math.cos(yaw)*fuse[0]+Math.sin(yaw)*fuse[2])*.65))<1e-6);
    assert.deepEqual(visual,weaponVisuals([shot],1000,studio));
    assert.deepEqual(weaponVisuals([{...shot,state:255,frame:1}],1000,studio).map(o=>o.position),
      weaponVisuals([{...shot,state:255,frame:1}],1000,procedural).map(o=>o.position));
  }
  const karts=createVoxelKarts({mapping:()=>({}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
  assert.equal(karts.weapons,'studio');
  karts.weapons='procedural'; assert.equal(karts.scenery,'studio');
  karts.enabled=false; karts.enabled=true; assert.equal(karts.weapons,'procedural');
  karts.weapons='studio'; assert.equal(karts.weapons,'studio');
});

import { sceneryMesh, SCENERY_NAMES } from '../src/voxel/scenery.js';
test('every stock scenery type has a finite volumetric Studio mesh and retains original comparison', () => {
  assert.equal(new Set(SCENERY_NAMES).size,36);
  for(const name of SCENERY_NAMES) {
    const mesh=sceneryMesh(null,{name},'studio');
    assert(mesh, name);
    assert(mesh.vertices.every(Number.isFinite),name);
    assert(mesh.bounds.every(n=>n>1),name);
    assert.equal(mesh.parts.reduce((sum,p)=>sum+p.count,0),mesh.count,name);
    assert(mesh.parts.every(p=>p.first+p.count<=mesh.count&&p.pivot.every(Number.isFinite)),name);
    if(!['OB1.SP','OB8.SP'].includes(name))assert.equal(sceneryMesh(null,{name},'procedural'),null,name);
  }
});
test('3D scene accepts every track layout and resets cleanly between tracks', () => {
  const karts=createVoxelKarts({mapping:()=>({turn:1920}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
  for(let slot=0;slot<8;slot++)karts.install(slot,cube);
  karts.available=true;karts.enabled=true;
  for(let name=1;name<=42;name++) {
    const world={name:String(name),objects:[]},car={px:1500,py:1600,heading:0,lean:2,jump:0};
    const P={world,car,humanSlot:0,tick:1,shots:[]};
    const fine={time:100,seats:[{...car,dir:0}],racers:[],shots:[]};
    karts.begin(P,true);karts.trackScene(P,fine,{angle:0,length:1});
    const scene=karts.frame([],[]).scene;
    assert.equal(scene.world,world);assert.equal(scene.racers.length,1);
    assert(scene.camera.every(Number.isFinite));assert.equal(scene.scenery,'studio');
    assert.equal(scene.collections.length,0);assert.equal(scene.impacts.length,0);
    karts.track=false;karts.begin(P,true);karts.trackScene(P,fine,{angle:0,length:1});
    assert.equal(karts.frame([],[]),null);karts.track=true;
  }
});

import { startPresentation, starterMeshes } from '../src/voxel/start.js';
import { TRACK_CAMERA, trackKartUnits } from '../src/voxel/kart-scale.js';
test('compact track karts match the sprite width and tyre baseline with continuous perspective', () => {
  const mesh={bounds:[30,27,32]}, units=trackKartUnits(mesh), C=TRACK_CAMERA;
  // Measured outer tyre edges and contact from the imported 32-cell models.
  const point=([x,y,z],distance=C.distance)=>[160+C.focal*x*units/(distance+z*units),100+C.focal*(C.height-y*units)/(distance+z*units)];
  const width=d=>point([15,3,-14],d)[0]-point([-15,3,-14],d)[0];
  assert(Math.abs(width(C.distance)-36)<.5, '36 opaque columns in every original rear sprite');
  assert(Math.abs(point([0,0,-11])[1]-192)<.5, 'original grounded tyre baseline');
  assert(width(C.distance)>width(C.distance*2));
  assert(width(C.distance*2)>width(C.distance*4));
  assert(Math.abs(width(C.distance+1)-width(C.distance))<.4, 'no size-class jumps');
});
import { capture as captureMotion, blend as blendMotion } from '../src/enhance/motion.js';
test('fly-in uses the interpolated camera while the kart keeps its grid heading', () => {
  const vector=(_world,h)=>[Math.sin(h/1920*Math.PI*2),Math.cos(h/1920*Math.PI*2)];
  const world={start:{x:1500,y:1600,heading:480}};
  const P={world,intro:{phase:'swing'},start:{mode:1,tick:0,lion:0},lionShown:true};
  const fine={intro:true,seats:[{cx:1700,cy:1600,px:1500,py:1600,heading:960,dir:960}]};
  const a=startPresentation(P,fine,vector);
  assert.equal(a.kartHeading,480);assert.equal(a.starter.light,0);
  assert(Math.abs(a.camera[0]-1700)<1e-6);assert.equal(a.camera[2],1600);
  const end={...fine,intro:false,seats:[{...fine.seats[0],cx:1376,cy:1600,heading:480,dir:480}]};
  const countdown=startPresentation({...P,intro:null},end,vector);
  const race=startPresentation({...P,intro:null,start:{mode:2,tick:34,lion:2}},end,vector);
  assert.deepEqual(countdown.camera,race.camera);
  assert.deepEqual(countdown.forward,race.forward);
  for(const [tick,light] of [[0,0],[15,0],[16,1],[32,1],[33,2],[34,2]]) {
    const p=startPresentation({...P,start:{mode:tick>=34?2:1,tick,lion:tick>=34?2:tick>=17?1:0}},fine,vector);
    assert.equal(p.starter.light,light);
  }
  assert.equal(startPresentation({...P,lionShown:false},fine,vector).starter,null);
  const before=captureMotion({...P,tick:0,car:{...fine.seats[0],horizon:80}},100);
  const after=captureMotion({...P,intro:null,tick:0,car:{...end.seats[0],horizon:80}},120);
  assert.equal(blendMotion(before,after,.5).intro,true);
  assert.equal(blendMotion(before,after,1).intro,false);
});
test('3D frames remain present through fly-in, countdown, green and renderer comparison', () => {
  const karts=createVoxelKarts({mapping:()=>({turn:1920}),racerOf:()=>null,headingVectorAt:(_w,h)=>h===480?[1,0]:[0,-1]});
  for(let slot=0;slot<8;slot++)karts.install(slot,cube);
  karts.available=true;karts.enabled=true;
  const world={name:'2',start:{x:1500,y:1600,heading:480},objects:[]};
  const car={cx:1376,cy:1600,px:1500,py:1600,heading:480,jump:0,lean:2};
  const fine={time:100,seats:[{...car,dir:480}],racers:[],shots:[]};
  for(const [intro,mode,tick] of [[{phase:'slide'},1,0],[{phase:'swing'},1,0],[null,1,16],[null,1,33],[null,2,34],[null,2,35]]) {
    const P={world,car,humanSlot:0,tick,shots:[],intro,start:{mode,tick,lion:mode===2?2:0},lionShown:true};
    const before=structuredClone(P);
    karts.begin(P,true);karts.trackScene(P,fine,{angle:0,length:1});
    const scene=karts.frame([],[]).scene;
    assert.equal(scene.world,world);assert.equal(scene.racers.length,1);assert(scene.starter);
    assert(scene.camera.every(Number.isFinite));assert.deepEqual(P,before);
    karts.track=false;karts.begin(P,true);karts.trackScene(P,fine,{angle:0,length:1});
    assert.equal(karts.frame([],[]),null);karts.track=true;
  }
  for(const mesh of starterMeshes()) {
    assert(mesh.vertices.every(Number.isFinite));
    assert(mesh.parts[1].count>0);assert.equal(mesh.parts[1].emission,1);
    assert.equal(mesh.parts.reduce((n,p)=>n+p.count,0),mesh.count);
  }
});

import { waterSurface, waveHeight, createSplashes, splashFragments } from '../src/voxel/water.js';
test('3D water uses exact tile-mask shores, bounded waves and finite sparse meshes', () => {
  const palette=new Uint8Array(768);palette.set([0,15,55],3);palette.set([55,12,0],6);
  const sin=[[0,0],[0,6],[15,15]].map(pair=>{const kept=new Uint8Array(8),v=new DataView(kept.buffer);pair.forEach((n,i)=>v.setUint32(i*4,n,true));return {kept};});
  const sheets=[new Uint8Array(54*1024)],maskSheets=[new Uint8Array(54*1024)],tiles=new Uint8Array(4096);
  sheets[0].fill(1,1024,2048);sheets[0].fill(2,2048,3072);
  for(let y=0;y<32;y++)for(let x=16;x<32;x++)maskSheets[0][1024+y*32+x]=1;
  tiles[3]=1;tiles[4]=2;
  const world={palette,sin,sheets,maskSheets,tiles},water=waterSurface(world);
  assert.equal(waterSurface(world),water);
  assert.equal(water.at(1024+96+15,1030),0);assert.equal(water.at(1024+96+16,1030),1);
  assert.equal(water.at(1024+128,1030),2);assert.equal(water.at(0,0),0);
  assert(water.mesh.count>0&&water.mesh.count<=24*6);assert(water.mesh.vertices.every(Number.isFinite));
  for(const kind of [1,2])for(const time of [0,100,500,1000]) {
    const h=waveHeight(1150,1040,time,kind);assert(h>.1&&h<1.4);
    assert.equal(waveHeight(1150,1040,time,kind,0),.12);
    assert.equal(water.heightAt(1140,1040,time),water.heightAt(1140,1040,time));
  }
  assert.notEqual(waveHeight(1150,1040,0),waveHeight(1150,1040,500));
  const dry=waterSurface({...world,tiles:new Uint8Array(4096)});assert.equal(dry.mesh.count,0);
});
test('water splashes occur once on entry or landing, never on load, teleport or airborne crossing', () => {
  const world={},effects=createSplashes((_w,x)=>x>=10?1:0);
  const state={world,tick:0,car:{px:0,py:0,jump:0},ai:{racers:[{}, {x:0,y:0}]}};
  effects.tick(state,0);state.tick++;state.car.px=12;state.car.jump=1;effects.tick(state,100);
  assert.equal(effects.frame(100).length,0);
  state.tick++;state.car.jump=0;effects.tick(state,200);assert.equal(effects.frame(200).length,1);
  effects.tick(state,200);state.tick++;effects.tick(state,250);assert.equal(effects.frame(250).length,1);
  state.tick++;state.ai.racers[1].x=12;effects.tick(state,300);assert.equal(effects.frame(300).length,2);
  const event=effects.frame(400)[0],parts=splashFragments(event);
  assert(parts.length>16);assert(parts.every(p=>p.position.every(Number.isFinite)&&p.units>0));
  assert.deepEqual(parts,splashFragments(event));assert.equal(effects.frame(1600).length,0);
  effects.reset();effects.tick(state,1700);assert.equal(effects.frame(1700).length,0);
  state.tick++;state.car.px=0;effects.tick(state,1800);state.tick++;state.car.px=400;effects.tick(state,1900);
  assert.equal(effects.frame(1900).length,0);
  state.world={};state.tick=0;effects.tick(state,0);assert.equal(effects.frame(0).length,0);
  const karts=createVoxelKarts({mapping:()=>({}),racerOf:()=>null,headingVectorAt:()=>[0,1]});
  assert.equal(karts.water,'waves');karts.water='flat';assert.equal(karts.water,'flat');
});


test('fireball trails animate behind travel and retain their burst identity', () => {
  for (const source of ['procedural','studio']) {
    const meshes=weaponMeshes(source);
    for (const yaw of [0,Math.PI/2,Math.PI]) {
      const shot={type:0,block:0x57c,x:100,y:200,yaw,state:0,index:2};
      const before=structuredClone(shot), live=weaponVisuals([shot],1200,meshes);
      assert(live.slice(1).every(o=>(o.position[0]-shot.x)*Math.sin(yaw)+(o.position[2]-shot.y)*Math.cos(yaw)<0));
      assert.notDeepEqual(live,weaponVisuals([shot],1250,meshes));
      assert.deepEqual(live,weaponVisuals([shot],1200,meshes));
      assert.deepEqual(shot,before);
      const burst={...shot,state:255,block:0,sourceBlock:shot.block,frame:1};
      assert.equal(weaponKind(burst),'fire');
      assert(weaponVisuals([burst],1200,meshes).some(o=>o.mesh===meshes.hot));
      const early=fireballGlows([{...burst,frame:0}],1200,[0,1])[0];
      const late=fireballGlows([{...burst,frame:2}],1200,[0,1])[0];
      assert(late.units>early.units && late.animation.opacity<early.animation.opacity);
    }
  }
  assert.deepEqual(fireballGlows([{type:0,block:0x2be}],1200,[0,1]),[]);
});
