import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { parseMap, parseSin } from '../../formats/track-files.js';
import { view } from '../../binary.js';
import { slice, lookupMember, assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

function values() {
  return {
    terrain: expected('terrain.lookup'), clamp: expected('terrain.clamp'), datLayout: expected('dat.layout'), lookup: expected('dat.entry-lookup'), entrySize: expected('dat.entry-size'),
    sheet: expected('tiles.sheet-split'), buffer: expected('tiles.buffer'), map: expected('m.read'), sin: expected('sin.read'), sinLayout: expected('sin.layout'),
    rd: expected('rd.read'), spw: expected('spw.read'), gam: expected('gam.read'),
  };
}

// Predict the lookup result for a world position from the archive alone, using the claim values.
function predictor(dat, track, V) {
  const { terrain: T, sheet: S, buffer: B, map: M, sin: SN } = V, get = n => lookupMember(dat, n, V);
  const g = parseGam(get(`${track}.GAM`)), map = parseMap(get(`${track}.M`)), sinFile = get(`${track}.SIN`), recs = parseSin(sinFile);
  assert.equal(1 << T.cellBits, S.size, 'a cell is one tile wide'); // @math cell width in pixels from the shift
  assert.equal(1 << T.tileShift, B.tileBytes, 'the pointer difference shifts down to the tile id'); // @math tile bytes from the shift
  assert.equal(T.maskRegion, B.totalBytes / B.maskDivisor, 'the mask region starts after all tile pixels');
  assert.equal(T.entryBytes, SN.kept, 'one table entry per tile id');
  assert.equal(T.maskOneOffset, T.entryBytes / 2, 'the two properties are the two halves of an entry'); // @math two dwords per entry
  assert.equal(T.maskZeroOffset, 0);
  const masks = g.masks.map(n => decodePcxMember(get(V.gam.prefix + n)));
  const kept = recs.map((_, i) => sinFile.subarray(i * V.sinLayout.recordBytes + SN.skipped, (i + 1) * V.sinLayout.recordBytes));
  const maskTiles = masks.map(m => slice(m, S)), dv = e => view(e);
  const px = (id, r, c) => maskTiles[Math.floor(id / S.count)][(id % S.count) * B.tileBytes + ((r & (S.size - 1)) << T.cellBits) + (c & (S.size - 1))];
  return (row, col) => {
    const r = Math.max(0, Math.min(V.clamp.limit, row)), c = Math.max(0, Math.min(V.clamp.limit, col)), cr = r >> T.cellBits, cc = c >> T.cellBits;
    const inside = cr >= M.mapOrigin && cr < M.mapOrigin + M.rows && cc >= M.mapOrigin && cc < M.mapOrigin + M.columns;
    const id = inside ? map.tiles[(cr - M.mapOrigin) * M.columns + (cc - M.mapOrigin)] : 0; // padding cells point at tile 0
    const entry = kept[id], mask = px(id, r, c);
    return { id, mask, value: dv(entry).getUint32(mask === 0 ? T.maskZeroOffset : T.maskOneOffset, true) };
  };
}

function validate(dat, record, V, { swap = false } = {}) {
  assertArchive(record, dat);
  const T = V.terrain, predict = predictor(dat, record.names.track, V), seen = { ids: new Set(), masks: new Set(), positions: new Set() };
  assert.ok(record.samples.length >= 30, 'enough samples'); // @math minimum sample count for the observation to mean something
  for (const [row, col, result] of record.samples) {
    const p = swap ? predict(col, row) : predict(row, col);
    assert.equal(result, p.value, `position (${row}, ${col}): tile ${p.id}, mask ${p.mask}`);
    seen.ids.add(p.id); seen.masks.add(p.mask); seen.positions.add(`${row},${col}`);
  }
  assert.ok(seen.positions.size >= 30, 'at least 30 distinct positions'); // @math the observation must not be one repeated position
  assert.ok(seen.ids.size >= 5, 'several tile ids'); // @math enough tiles that a wrong id arithmetic would show
  assert.deepEqual([...seen.masks].sort(), [0, 1], 'both mask values occur');
  assert.equal(record.inputsObject, T.inputsObject);
  assert.equal(record.rowOffset, T.rowOffset);
  assert.equal(record.columnOffset, T.columnOffset);
  assert.equal(record.resultOffset, T.resultOffset);
  // World coordinates are map pixels plus the map origin in pixels; the loaders add exactly that.
  const origin = V.map.mapOrigin * V.sheet.size;
  assert.equal(V.rd.coordBias, origin);
  assert.equal(V.spw.coordBias, origin);
}

// A `terrain-4` record: the lookup's row and column forced at its entry to values on each side of both ends of the clamp. Every result must be the one the
// clamped position predicts, and every side of the range must be outside at least once, with the exact limit and its neighbours present.
function validateForced(dat, record, V) {
  assertArchive(record, dat);
  assert.equal(record.forced, true, 'the record holds forced inputs');
  const predict = predictor(dat, record.names.track, V), limit = V.clamp.limit, outside = { rowLow: false, rowHigh: false, colLow: false, colHigh: false };
  assert.equal(record.rowOffset, V.terrain.rowOffset);
  assert.equal(record.columnOffset, V.terrain.columnOffset);
  assert.equal(record.resultOffset, V.terrain.resultOffset);
  for (const [row, col, result, track] of record.samples) {
    assert.equal(String(track), record.names.track, 'every forced sample was taken in the same race');
    assert.equal(result, predict(row, col).value, `forced (${row}, ${col})`);
    outside.rowLow ||= row < 0; outside.rowHigh ||= row > limit; outside.colLow ||= col < 0; outside.colHigh ||= col > limit; // @math negative is below the range
  }
  assert.deepEqual(Object.values(outside), [true, true, true, true], 'each side of the range was exceeded');
  for (const edge of [limit - 1, limit, limit + 1]) assert.ok(record.samples.some(s => s[0] === edge) && record.samples.some(s => s[1] === edge), `both coordinates were forced to ${edge}`); // @math the limit and its neighbours
}

export default {
  id: 'obs-terrain',
  claims: ['terrain.lookup', 'terrain.clamp'],
  obs: ['terrain-3', 'terrain-4'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { const dat = await ctx.open('WACKY.DAT'), V = values(); validate(dat, ctx.obs('terrain-3'), V); validateForced(dat, ctx.obs('terrain-4'), V); },
  // Each parameter changed on its own, and the swapped coordinate roles, must fail.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('terrain-3'), V = values();
    const tweak = (label, key, patch, opts) => ({ label, fn: () => validate(dat, record, { ...V, [key]: { ...V[key], ...patch } }, opts) });
    return [
      { label: 'row and column swapped', fn: () => validate(dat, record, V, { swap: true }) },
      tweak('mask roles swapped', 'terrain', { maskZeroOffset: V.terrain.maskOneOffset, maskOneOffset: V.terrain.maskZeroOffset }),
      tweak(`cell width ${V.sheet.size / 2}`, 'terrain', { cellBits: V.terrain.cellBits - 1 }), // @math alternative: half-width cells
      tweak(`entry ${V.terrain.entryBytes / 2} bytes`, 'terrain', { entryBytes: V.terrain.entryBytes / 2 }), // @math alternative: half-size entries
      tweak('mask region 0x1A000', 'terrain', { maskRegion: V.terrain.maskRegion - V.buffer.tileBytes }),
      tweak(`map origin ${V.map.mapOrigin - 1}`, 'map', { mapOrigin: V.map.mapOrigin - 1 }),
      { label: 'clamp limit one lower', fn: () => validateForced(dat, ctx.obs('terrain-4'), { ...V, clamp: { limit: V.clamp.limit - 1 } }) },
      { label: 'clamp limit one higher', fn: () => validateForced(dat, ctx.obs('terrain-4'), { ...V, clamp: { limit: V.clamp.limit + 1 } }) },
      { label: 'clamp limit 0x1fff', fn: () => validateForced(dat, ctx.obs('terrain-4'), { ...V, clamp: { limit: V.clamp.limit * 2 + 1 } }) }, // @math the next power-of-two limit
    ];
  },
};
