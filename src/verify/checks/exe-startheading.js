import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const values = () => ({ h: expected('race.start-heading'), floor: expected('floor.render-observed') });
const IDS = ['grid-1', 'grid-7'];

// The stores in the race routine as instruction bytes built from the claim's values.
function code(exe, V, { heading = V.h.heading } = {}) {
  const H = V.h, { le } = locateLe(exe), read = (at, n) => [...objectBytes(le, 1, at, n)];
  const store = (word, value) => [0xc7, 0x05, ...d(word), ...d(value)]; // @math mov dword [word], imm32
  for (const at of H.startSites) assert.deepEqual(read(at, 10), store(H.headingAt, heading), `the start store at obj1+0x${at.toString(16)}`); // @math 10 bytes of mov dword [mem], imm32
  assert.deepEqual(read(H.finishSite, 10), store(H.headingAt, H.finishHeading), 'the finish store'); // @math 10 bytes
  assert.deepEqual(read(H.secondSite, 10), store(H.secondAt, H.secondHeading), 'the second player\'s store'); // @math 10 bytes
  // the camera of the start: the car's x, and the car's y less 0x7c
  assert.deepEqual(read(H.cameraXAt, 12), [0x66, 0xa1, ...d(H.carWords[0]), 0x66, 0xa3, ...d(H.cameraWords[0])], 'the camera x is the car x'); // @math mov ax,[car x]; mov [camera x],ax
  assert.deepEqual(read(H.cameraYAt, 6), [0x66, 0xa1, ...d(H.carWords[1])], 'the camera y starts as the car y'); // @math mov ax,[car y]
  assert.deepEqual(read(H.cameraSubAt, 3), [0x83, 0xe8, H.cameraBehind], 'less the distance behind'); // @math sub eax,imm8
  assert.deepEqual(read(H.cameraYStoreAt, 6), [0x66, 0xa3, ...d(H.cameraWords[1])], 'stored in the camera y word'); // @math mov [camera y],ax
}

// Every observed start of a played race: the heading dword is 480 and the camera is the car less 0x7c in y.
function observed(dat, records, V) {
  for (const r of records) {
    assertArchive(r, dat);
    const c = r.horizon.camera, car = c.racers[0];
    assert.equal(r.horizon.heading, V.h.heading, `${r.id}: the heading at the start`);
    assert.deepEqual([c.x, c.y], [car[0], car[1] - V.h.cameraBehind], `${r.id}: the camera is (car x, car y - 0x7c)`);
  }
}

export default {
  id: 'exe-startheading',
  claims: ['race.start-heading'],
  obs: [...IDS, 'fit-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    code(await ctx.open('WW.EXE'), V); observed(dat, IDS.map(id => ctx.obs(id)), V);
    const fit = ctx.obs('fit-1'); assertArchive(fit, dat); assert.equal(fit.fit.heading, V.h.heading, 'fit-1: the heading at the start of a single player race');
  },
  async discriminate(ctx) {
    const V = values(), exe = await ctx.open('WW.EXE'), dat = await ctx.open('WACKY.DAT'), recs = IDS.map(id => ctx.obs(id));
    return [
      { label: 'a start heading of 481', fn: () => code(exe, V, { heading: V.h.heading + 1 }) },
      { label: 'a camera 0x7b behind', fn: () => observed(dat, recs, { ...V, h: { ...V.h, cameraBehind: V.h.cameraBehind - 1 } }) },
      { label: 'a recorded heading altered', fn: () => observed(dat, recs.map((r, i) => (i === 0 ? { ...r, horizon: { ...r.horizon, heading: r.horizon.heading + 1 } } : r)), V) }, // @math the first record
    ];
  },
};
