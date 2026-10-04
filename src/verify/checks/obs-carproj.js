import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSpw } from '../../formats/track-files.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ car: expected('view.car-column-observed'), obj: expected('view.object-column-observed'), proj: expected('view.object-projection'), list: expected('view.draw-list-observed'), player: expected('view.player-car-draw') });
const FIX = 16; // @math the 16.16 fixed point shift of the vector words and of the tangent factor
const TOOL = { x: 0xaaa6, y: 0xaaa8, heading: 0xaaaa, stride: 0x68, count: 0x28c40 }; // @math the racer words and the count word the horizon spec of observe.mjs reads

const dword = (rec, at) => (rec[at] & 0xffff) + rec[at + 1] * 65536; // @math a dword from two words, the low one unsigned

function isqrt(n) {
  if (n <= 1) return n;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return n - r * r >= r - 1 ? r + 1 : r;
}

function project(C, P, table, tan, viewRound, x, y) {
  const dx = x - C.x, dy = y - C.y;
  const f = Number((BigInt(C.a) * BigInt(dx) + BigInt(C.b) * BigInt(dy)) >> BigInt(FIX)), l = Number((BigInt(C.a) * BigInt(dy) - BigInt(C.b) * BigInt(dx)) >> BigInt(FIX));
  const div = Number((BigInt(f) * BigInt(tan)) >> BigInt(FIX)), col = div === 0 ? P.center : P.center + Math.trunc(l * P.center / div);
  if (col < 0 || col > P.maxColumn) return { col };
  return { col, distance: Math.floor((isqrt(f * f + l * l) * table[col] + viewRound) / (1 << P.viewShift)) }; // @math the shift right as a division
}

function validate(dat, record, V, { tan = V.proj.tan, carWidth = V.car.carWidth } = {}) {
  assert.equal(V.car.frames, 1, 'one frame, one record'); // @math the single recorded frame
  const K = V.car, P = V.proj, F = V.list.fieldWords, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assertArchive(record, dat);
  const h = record.horizon, C = h.camera, view = members.get(V.obj.viewMember), dv = new DataView(view.buffer, view.byteOffset, view.byteLength), table = Array.from({ length: V.obj.viewDwords }, (_, i) => dv.getUint32(i * 4, true)); // @math four bytes a dword
  assert.deepEqual([K.racerWords.x, K.racerWords.y, K.racerWords.heading, K.racerWords.stride], [TOOL.x, TOOL.y, TOOL.heading, TOOL.stride], 'the words the tool read');
  assert.equal(C.racers.length, K.racers, 'the racers');
  assert.deepEqual(C.racers.map(([x, y]) => [x, y]), K.positions, 'the positions');
  assert.deepEqual([C.x, C.y], K.camera, 'the camera');
  assert.equal(h.heading, K.heading, 'the heading');
  assert.equal(P.center - (K.carWidth >> 1), K.player.left, 'the player is centred'); // @math half the width, rounded down
  const cars = h.drawList.filter(w => w[F.type] !== -1), objects = h.drawList.filter(w => w[F.type] === -1); // @math the object type
  assert.equal(h.drawList.length, K.records, 'the records');
  assert.equal(objects.length, K.objectRecords, 'the object records');
  const player = cars.find(w => w[F.racer] === 0); // @math racer 0 is the player
  assert.deepEqual([dword(player, F.distance), player[F.left], player[F.type]], [K.player.distance, K.player.left, 0], 'the player\'s record'); // @math the player's type word
  assert.equal(K.player.distance, V.player.distance, 'the distance of view.player-car-draw');
  const drawn = [], dropped = [];
  C.racers.forEach(([x, y], k) => {
    if (k === 0) return; // @math the player is the special case
    const p = project(C, P, table, tan, P.viewRound, x, y), rec = cars.find(w => w[F.racer] === k);
    if (p.distance === undefined || p.distance < P.minDistance || p.distance > P.maxDistance) { assert.ok(!rec, `racer ${k} (column ${p.col}) has no record`); dropped.push(k); return; }
    assert.ok(rec, `racer ${k} has a record`);
    assert.equal(rec[F.left], p.col - (carWidth >> 1), `racer ${k}: left column`); // @math half the width, rounded down
    assert.equal(dword(rec, F.distance), p.distance, `racer ${k}: distance`);
    assert.equal(rec[F.sizeClass], Math.min(Math.max(Math.floor((p.distance - P.sizeBase) / P.sizeStep), 0), P.maxSize), `racer ${k}: size class`);
    assert.equal(rec[F.width], carWidth, `racer ${k}: picture width`);
    drawn.push(k);
  });
  assert.deepEqual(drawn, K.projected, 'the cars drawn');
  assert.deepEqual(dropped, K.dropped, 'the cars dropped');
  assert.equal(cars.length, drawn.length + 1, 'every car record belongs to a racer'); // @math the player's record
  assert.ok(cars.every(w => w[F.sizeClass] === K.classes), 'all cars have size class 0');
  // The one object record is the projection of none of the track's .SPW objects (the starting lights and their figure are the likely source, not established).
  const spw = parseSpw(members.get(`${h.track}.SPW`)), [[x0, x1], [y0, y1]] = V.obj.boxPairs.map(([a, b]) => [C.box[a], C.box[b]]);
  const fits = spw.filter(o => {
    const x = o[V.obj.spwWords[0]] + V.obj.worldOffset, y = o[V.obj.spwWords[1]] + V.obj.worldOffset, p = project(C, P, table, tan, P.viewRound, x, y);
    return x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1) && p.distance !== undefined && p.distance >= P.minDistance && p.distance <= P.maxDistance && objects.some(w => w[F.left] === p.col - (w[F.width] >> 1) && dword(w, F.distance) === p.distance); // @math half the width, rounded down
  });
  assert.equal(fits.length, K.explainedObjects, 'no .SPW object of the track gives the object record');
}

export default {
  id: 'obs-carproj',
  claims: ['view.car-column-observed'],
  obs: ['grid-1', 'grid-7'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const dat = await ctx.open('WACKY.DAT'), V = values(); validate(dat, ctx.obs('grid-1'), V); validate(dat, ctx.obs('grid-7'), { ...V, car: { ...V.car, ...V.car.second } }); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('grid-1'), V = values();
    return [
      { label: 'tangent factor off by 0x100', fn: () => validate(dat, r, V, { tan: V.proj.tan + 0x100 }) }, // @math a visible step of the factor
      { label: 'a car width of 40', fn: () => validate(dat, r, V, { carWidth: V.car.carWidth + 2 }) }, // @math two pixels more
      { label: 'a racer moved by 20', fn: () => validate(dat, { ...r, horizon: { ...r.horizon, camera: { ...r.horizon.camera, racers: r.horizon.camera.racers.map((p, i) => (i === 2 ? [p[0] + 20, p[1], p[2]] : p)) } } }, V) }, // @math the third racer
      { label: 'a record altered', fn: () => validate(dat, { ...r, horizon: { ...r.horizon, drawList: r.horizon.drawList.map((w, i) => (i === 1 ? w.map((x, n) => (n === V.list.fieldWords.left ? x + 1 : x)) : w)) } }, V) }, // @math the second record
      { label: 'the second track\'s cars with a width of 40', fn: () => validate(dat, ctx.obs('grid-7'), { ...V, car: { ...V.car, ...V.car.second } }, { carWidth: V.car.carWidth + 2 }) }, // @math two pixels more
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
