import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { parseMap } from '../../formats/track-files.js';
import { view } from '../../binary.js';
import { assertArchive, crc, slice } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ m: expected('floor.detail-modes-observed'), obs: expected('floor.render-observed'), loop: expected('floor.render-loop'), trig: expected('trig.layout'), ndist: expected('ndist.layout'), map: expected('m.read'), sheet: expected('tiles.sheet-split'), buffer: expected('tiles.buffer'), gam: expected('gam.read') });
const IDS = ['floor-4', 'floor-5'];

// The columns that floor.render-loop's coarser variants draw: every step-th ray is cast (angle and NDIST group both advance by the step) and its pixel is repeated over the step columns;
// the angle index goes up by the step and is set back to 0 (not wrapped round) once it passes the last entry.
function predicted(dat, record, V, { step, reset = true, group = step } = {}) {
  const F = record.floor, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), O = V.obs;
  const g = parseGam(members.get(`${F.track}.GAM`)), map = parseMap(members.get(`${F.track}.M`));
  const sheets = g.tilesets.map(n => slice(decodePcxMember(members.get(V.gam.prefix + n.toUpperCase())), V.sheet)), tileBytes = V.buffer.tileBytes;
  const trig = view(members.get('TRIG.DAT')), nd = view(members.get('NDIST')), [camX, camY] = F.camera, out = [];
  let angle = (((F.heading - O.angleBias) % O.wrap) + O.wrap) % O.wrap;
  for (let c = 0; c < O.columns; c += step) {
    const v0 = trig.getUint32(angle * V.trig.entryBytes, true), v1 = trig.getUint32(angle * V.trig.entryBytes + V.trig.entryBytes / 2, true); // @math the two dwords of an entry
    const col = new Uint8Array(O.steps);
    for (let k = 0; k < O.steps; k++) {
      const n = nd.getUint32((c / step * group * O.groupDwords + k) * V.ndist.dwordBytes, true);
      const dx = (Math.imul(v0, n) >>> 16), dy = (Math.imul(v1, n) >>> 16); // @math the low 32 bits of the product, shifted right by 16
      const x = (dx + camX) & 0xffff, y = (dy + camY) & 0xffff; // @math 16-bit sums
      const mr = (y >> V.loop.tileShift) - V.map.mapOrigin, mc = (x >> V.loop.tileShift) - V.map.mapOrigin, inside = mr >= 0 && mr < V.map.rows && mc >= 0 && mc < V.map.columns;
      const id = inside ? map.tiles[mr * V.map.columns + mc] : 0, sheetOf = Math.floor(id / V.sheet.count);
      col[O.steps - 1 - k] = sheets[sheetOf][(id % V.sheet.count) * tileBytes + ((y & V.loop.tileMask) << V.loop.tileShift) + (x & V.loop.tileMask)];
    }
    const hash = crc(col);
    for (let i = 0; i < step; i++) out.push(hash);
    angle += step;
    if (angle >= O.wrap) angle = reset ? V.m.resetTo : angle - O.wrap;
  }
  return out;
}

const ranges = list => { const out = []; for (const c of list) { const last = out.at(-1); if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]); } return out; };

function validate(dat, records, V, options = {}) {
  const O = V.obs, M = V.m;
  assert.equal(records.length, M.frames, 'the frames');
  assert.deepEqual(M.modes.map(m => M.steps[m - M.modes[0]]), M.steps, 'one step per mode');
  const mismatching = [];
  records.forEach((r, i) => {
    assertArchive(r, dat);
    const F = r.floor;
    assert.deepEqual([F.mode, F.track, F.camera, F.heading], [M.modes[i], M.tracks[i], M.cameras[i], M.headings[i]], 'the mode, the track, the camera and the heading');
    const got = predicted(dat, r, V, { step: options.step ?? M.steps[i], ...options }), bad = got.map((c, k) => (c === F.columns[k] ? -1 : k)).filter(k => k >= 0);
    mismatching.push(ranges(bad));
    const covered = new Set();
    for (const w of F.drawList) if (w[3] + w[1] > O.firstRow) for (let x = w[2]; x < w[2] + w[0]; x++) covered.add(x); // @math top row + height reaches the first floor row; words 0 to 3 are width, height, left, top
    for (let x = O.speedometerColumns[0]; x <= O.speedometerColumns[1]; x++) covered.add(x);
    assert.ok(bad.every(k => covered.has(k)), `every differing column is under an overlay (${r.id}: differing ${JSON.stringify(ranges(bad))}, drawn ${JSON.stringify(F.drawList.map(w => [w[2], w[2] + w[0] - 1]))})`); // @math the left column and the last column
  });
  assert.deepEqual(mismatching, M.mismatching, `the columns that differ from the prediction (got ${JSON.stringify(mismatching)})`);
}

export default {
  id: 'obs-floormodes',
  claims: ['floor.detail-modes-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), M = V.m;
    return [
      { label: 'the angle wrapped round instead of reset', fn: () => validate(dat, records, V, { reset: false }) },
      { label: 'a step of 1 in both modes', fn: () => validate(dat, records, V, { step: 1 }) }, // @math the high detail step
      { label: 'a step of 3 in both modes', fn: () => validate(dat, records, V, { step: M.steps[0] + 1 }) },
      { label: 'the NDIST group advancing by 1', fn: () => validate(dat, records, V, { group: 1 }) }, // @math one group per ray
      { label: 'the camera words changed', fn: () => validate(dat, records.map((r, i) => (i === 0 ? { ...r, floor: { ...r.floor, camera: [r.floor.camera[0] + 1, r.floor.camera[1]] } } : r)), V) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
