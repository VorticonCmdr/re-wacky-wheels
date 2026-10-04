import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ hz: expected('horizon.render-observed'), par: expected('par.upload'), timer: expected('hud.timer-observed') });
const IDS = ['horizon-1', 'horizon-2', 'horizon-14'];
const TOOL = { firstRow: 110, rows: 20, pointerAt: 0x1d860, boundWords: [0x1d824, 0x1d828, 0x1d82c, 0x1d830] }; // @math what observe.mjs read: 20 rows from row 110, the pointer word and the four bound words

const ranges = list => { const out = []; for (const c of list) { const last = out.at(-1); if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]); } return out; };

function validate(dat, records, V, { rowPixels = V.hz.rowPixels, pixelsPerByte = V.hz.pixelsPerByte, base = V.hz.base } = {}) {
  const H = V.hz, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assert.equal(records.length, H.frames, 'the frames');
  assert.deepEqual([H.firstRow, H.rows, H.pointerAt, H.boundWords], [TOOL.firstRow, TOOL.rows, TOOL.pointerAt, TOOL.boundWords], 'what the tool read');
  assert.equal(H.base, 0xa0000 + V.par.vramOffset, 'the strip lives where par.upload put the file'); // @math the start of the video window
  assert.equal(H.rowPixels, H.pixelsPerByte * 320, 'a row of 1280 pixels is 320 video bytes'); // @math 320 bytes a row
  assert.equal(H.rows * H.rowPixels, V.par.bytes, 'the 20 rows are the whole file');
  assert.deepEqual(H.bounds.map(b => b - H.base), [0, 0x50, 0xa0, 0xf0], 'the bounds as offsets: a window of 80 bytes (320 pixels) in a 240-byte range'); // @math the offsets of the four bounds in video bytes
  assert.deepEqual(records.map(r => r.horizon.heading), H.headings, 'the headings');
  const matching = [];
  records.forEach((r, i) => {
    assertArchive(r, dat);
    const h = r.horizon, par = members.get(`${h.track}.PAR`), off = h.pointer - base;
    assert.equal(off, H.offsets[i], 'the pointer\'s offset');
    assert.ok(off >= 0 && off <= H.bounds[3] - H.base - 80, 'inside the range, a whole window'); // @math the window is 80 bytes wide
    assert.deepEqual(h.bounds, H.bounds, 'the bounds');
    let good = 0; const bad = [];
    for (let c = 0; c < H.columns; c++) {
      const col = new Uint8Array(H.rows); for (let j = 0; j < H.rows; j++) col[j] = par[rowPixels * j + pixelsPerByte * off + c];
      if (crc(col) === h.columns[c]) good++; else bad.push(c);
    }
    matching.push(good);
    const covered = new Set();
    for (const w of h.drawList) if (w[3] + w[1] > H.firstRow) for (let x = w[2]; x < w[2] + w[0]; x++) covered.add(x); // @math top row + height reaches the strip; words 0 to 3 are width, height, left, top
    for (let x = H.timerColumns[0]; x <= H.timerColumns[1]; x++) covered.add(x);
    assert.ok(bad.every(c => covered.has(c)), `every differing column of frame ${i} is under an overlay: ${JSON.stringify(ranges(bad))}`);
  });
  assert.deepEqual(matching, H.matching, 'the columns that equal the file');
  assert.equal(H.timerColumns[1] - H.timerColumns[0] + 1, V.timer.places * V.timer.advance, 'the timer\'s width'); // @math both ends count
}

export default {
  id: 'obs-horizon',
  claims: ['horizon.render-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), H = V.hz;
    return [
      { label: 'rows of 640 pixels', fn: () => validate(dat, records, V, { rowPixels: H.rowPixels / 2 }) }, // @math the file's own row width
      { label: 'two pixels a byte', fn: () => validate(dat, records, V, { pixelsPerByte: H.pixelsPerByte / 2 }) }, // @math half
      { label: 'a base one byte off', fn: () => validate(dat, records, V, { base: H.base + 1 }) }, // @math one byte
      { label: 'a column altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, horizon: { ...r.horizon, columns: r.horizon.columns.map((c, k) => (k === 0 ? '00000000' : c)) } } : r)), V) }, // @math the first column
      { label: 'a smaller timer', fn: () => validate(dat, records, { ...V, hz: { ...H, timerColumns: [H.timerColumns[0], H.timerColumns[1] - 1] } }) },
      { label: 'a count one too high', fn: () => validate(dat, records, { ...V, hz: { ...H, matching: [H.matching[0] + 1, H.matching[1]] } }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
