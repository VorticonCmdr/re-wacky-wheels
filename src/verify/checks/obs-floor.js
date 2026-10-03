import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { parseMap } from '../../formats/track-files.js';
import { view } from '../../binary.js';
import { assertArchive, crc, slice } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ obs: expected('floor.render-observed'), loop: expected('floor.render-loop'), trig: expected('trig.layout'), ndist: expected('ndist.layout'), map: expected('m.read'), sheet: expected('tiles.sheet-split'), buffer: expected('tiles.buffer'), gam: expected('gam.read'), speed: expected('hud.place-speed-observed') });
const IDS = ['floor-1', 'floor-2'];
const TOOL = { firstRow: 130, rows: 70 }; // @math the rows observe.mjs hashes per column: 70 rows from row 130

// The columns the floor model predicts, as the CRC-32 of the 70 rows 130 to 199 (rows going down the screen, the model's steps going up).
function predicted(dat, record, V, { bias = V.obs.angleBias, swapXY = false, reverse = false, origin = V.map.mapOrigin, groupDwords = V.obs.groupDwords } = {}) {
  const F = record.floor, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), O = V.obs;
  const g = parseGam(members.get(`${F.track}.GAM`)), map = parseMap(members.get(`${F.track}.M`));
  const sheets = g.tilesets.map(n => slice(decodePcxMember(members.get(V.gam.prefix + n.toUpperCase())), V.sheet)), tileBytes = V.buffer.tileBytes;
  const trig = view(members.get('TRIG.DAT')), nd = view(members.get('NDIST')), [camX, camY] = F.camera, out = [];
  for (let c = 0; c < O.columns; c++) {
    const a = (((F.heading - bias + c) % O.wrap) + O.wrap) % O.wrap, v0 = trig.getUint32(a * V.trig.entryBytes, true), v1 = trig.getUint32(a * V.trig.entryBytes + V.trig.entryBytes / 2, true); // @math the two dwords of an entry
    const col = new Uint8Array(O.steps);
    for (let k = 0; k < O.steps; k++) {
      const n = nd.getUint32((c * groupDwords + k) * V.ndist.dwordBytes, true);
      const dx = (Math.imul(v0, n) >>> 16), dy = (Math.imul(v1, n) >>> 16); // @math the low 32 bits of the product, shifted right by 16
      const x = ((swapXY ? dy : dx) + camX) & 0xffff, y = ((swapXY ? dx : dy) + camY) & 0xffff; // @math 16-bit sums
      const mr = (y >> V.loop.tileShift) - origin, mc = (x >> V.loop.tileShift) - origin, inside = mr >= 0 && mr < V.map.rows && mc >= 0 && mc < V.map.columns;
      const id = inside ? map.tiles[mr * V.map.columns + mc] : 0, sheetOf = Math.floor(id / V.sheet.count);
      col[reverse ? k : O.steps - 1 - k] = sheets[sheetOf][(id % V.sheet.count) * tileBytes + ((y & V.loop.tileMask) << V.loop.tileShift) + (x & V.loop.tileMask)];
    }
    out.push(crc(col));
  }
  return out;
}

const ranges = list => { const out = []; for (const c of list) { const last = out.at(-1); if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]); } return out; };

function validate(dat, records, V, options) {
  const O = V.obs;
  assert.equal(records.length, O.frames, 'the frames');
  assert.deepEqual([O.firstRow, O.steps], [TOOL.firstRow, TOOL.rows], 'the rows the tool hashed');
  assert.equal(O.bottomRow, O.firstRow + O.steps - 1, 'the bottom row is the last of the 70'); // @math the first row counts
  assert.equal(O.wrap, V.trig.entries, 'the angle wraps over the TRIG entries');
  assert.deepEqual(O.speedometerColumns, [0, V.speed.panelSize[0] - 1], 'the speedometer panel\'s columns'); // @math the panel starts at column 0 and is panelSize[0] wide
  const matching = [], mismatching = [];
  records.forEach((r, i) => {
    assertArchive(r, dat);
    const F = r.floor;
    assert.deepEqual([F.camera, F.heading, F.mode], [O.cameras[i], O.headings[i], O.mode], 'the camera, the heading and the render mode');
    const got = predicted(dat, r, V, options), bad = got.map((c, k) => (c === F.columns[k] ? -1 : k)).filter(k => k >= 0);
    matching.push(O.columns - bad.length); mismatching.push(ranges(bad));
    // every mismatching column lies under something drawn over the floor
    const covered = new Set();
    for (const w of F.drawList) if (w[3] + w[1] > O.firstRow) for (let x = w[2]; x < w[2] + w[0]; x++) covered.add(x); // @math top row + height reaches the first floor row; words 0 to 3 are width, height, left, top
    for (let x = O.speedometerColumns[0]; x <= O.speedometerColumns[1]; x++) covered.add(x);
    assert.ok(bad.every(k => covered.has(k)), 'every differing column is under an overlay');
  });
  assert.deepEqual(matching, O.matching, 'the columns that equal the prediction');
  assert.deepEqual(mismatching, O.mismatching, 'and the ones that do not');
}

export default {
  id: 'obs-floor',
  claims: ['floor.render-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), O = V.obs;
    return [
      { label: 'an angle bias of 159', fn: () => validate(dat, records, V, { bias: O.angleBias - 1 }) },
      { label: 'an angle bias of 161', fn: () => validate(dat, records, V, { bias: O.angleBias + 1 }) },
      { label: 'the world column and row swapped', fn: () => validate(dat, records, V, { swapXY: true }) },
      { label: 'the rows the other way up', fn: () => validate(dat, records, V, { reverse: true }) },
      { label: 'the map origin one cell off', fn: () => validate(dat, records, V, { origin: V.map.mapOrigin - 1 }) },
      { label: 'NDIST groups of 71 dwords', fn: () => validate(dat, records, V, { groupDwords: O.groupDwords + 1 }) },
      { label: 'the camera words changed', fn: () => validate(dat, records.map((r, i) => (i === 0 ? { ...r, floor: { ...r.floor, camera: [r.floor.camera[0] + 1, r.floor.camera[1]] } } : r)), V) },
      { label: 'a bigger speedometer', fn: () => validate(dat, records, { ...V, obs: { ...O, speedometerColumns: [O.speedometerColumns[0], O.speedometerColumns[1] - 1] } }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
