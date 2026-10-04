import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ grid: expected('racer.start-grid'), bias: expected('gam.read').startBias });

// Derive the start tables the way the claim says from the file's first coordinate pair, and compare with what the game held right after loading.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const G = V.grid, gam = parseGam(parseDatDirectory(dat).find(e => e.name === `${record.names.track}.GAM`).data), x0 = gam.starts[0].x + V.bias, y0 = gam.starts[0].y + V.bias;
  assert.equal(record.branch, G.branch, 'the branch word that selects the derived grid');
  assert.equal(record.gridFlag, G.gridFlag, 'the second word that selects it');
  assert.equal(record.countWord + 1, G.entries, 'one table entry per racer');
  const x = new Array(G.entries).fill(null);
  for (let k = 0; k < G.entries; k++) x[(((G.firstIndex - k) % G.entries) + G.entries) % G.entries] = x0 + G.xBias - k * G.xStep;
  assert.deepEqual(record.tables.x, x, 'the x table is the derived line of positions');
  assert.deepEqual(record.tables.y, new Array(G.entries).fill(y0), 'every y entry is the first pair\'s y');
  record.racers.forEach(([rx, ry], i) => { assert.equal(rx, record.tables.x[i], `racer ${i} starts at table x`); assert.equal(ry, record.tables.y[i], `racer ${i} starts at table y`); });
  assert.equal(new Set(record.tables.x).size, G.entries, 'the positions differ, so the order is visible');
}

// The same rule seen on a second track: the racers of a played race on track 7 in the countdown (a `horizon` frame: the racers' x, y and heading words).
function validateSecond(dat, r, V) {
  const G = V.grid, S = G.second, h = r.horizon, gam = parseGam(parseDatDirectory(dat).find(e => e.name === `${h.track}.GAM`).data), x0 = gam.starts[0].x + V.bias, y0 = gam.starts[0].y + V.bias;
  assertArchive(r, dat);
  assert.equal(Number(h.track), S.track, 'the second track');
  const x = new Array(G.entries).fill(null);
  for (let k = 0; k < G.entries; k++) x[(((G.firstIndex - k) % G.entries) + G.entries) % G.entries] = x0 + G.xBias - k * G.xStep;
  assert.deepEqual(h.camera.racers.map(p => p[0]), x, 'the racers stand on the derived line of positions');
  assert.deepEqual(h.camera.racers.map(p => p[0]), S.x, 'the positions seen');
  assert.ok(h.camera.racers.every(p => p[1] === y0 && p[1] === S.y), 'every racer on the first pair\'s y');
}

export default {
  id: 'obs-start',
  claims: ['racer.start-grid'],
  obs: ['start-1', 'grid-7'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { const dat = await ctx.open('WACKY.DAT'), V = values(); validate(dat, ctx.obs('start-1'), V); validateSecond(dat, ctx.obs('grid-7'), V); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('start-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { ...V, grid: { ...V.grid, ...patch } }) });
    return [
      tweak('first index 3', { firstIndex: V.grid.firstIndex - 1 }),
      tweak('first index 5', { firstIndex: V.grid.firstIndex + 1 }),
      tweak('bias 0x4f', { xBias: V.grid.xBias - 1 }),
      tweak('step 0x13', { xStep: V.grid.xStep - 1 }),
      tweak('step 0x15', { xStep: V.grid.xStep + 1 }),
      tweak('9 entries', { entries: V.grid.entries + 1 }),
      tweak('branch word 1', { branch: V.grid.branch + 1 }),
      tweak('grid flag 1', { gridFlag: V.grid.gridFlag + 1 }),
      { label: 'second track: step 0x15', fn: () => validateSecond(dat, ctx.obs('grid-7'), { ...V, grid: { ...V.grid, xStep: V.grid.xStep + 1 } }) },
      { label: 'second track: y altered', fn: () => validateSecond(dat, { ...ctx.obs('grid-7'), horizon: { ...ctx.obs('grid-7').horizon, camera: { ...ctx.obs('grid-7').horizon.camera, racers: ctx.obs('grid-7').horizon.camera.racers.map((p, i) => (i === 3 ? [p[0], p[1] + 1, p[2]] : p)) } } }, V) }, // @math the fourth racer
      { label: 'start bias 0x3df', fn: () => validate(dat, record, { ...V, bias: V.bias - 1 }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
