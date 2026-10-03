import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSin, parseSpwKeepingTail, parseRoute } from '../../formats/track-files.js';
import { parseGam } from '../../formats/gam.js';
import { parseSdx } from '../../formats/static-tables.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ r: expected('track.value-ranges'), map: expected('m.read'), sheet: expected('tiles.sheet-split'), route: expected('rd.route'), spw: expected('spw.read'), sin: expected('terrain.lookup') });

const range = () => [Infinity, -Infinity];
const widen = (r, v) => { r[0] = Math.min(r[0], v); r[1] = Math.max(r[1], v); };

// Over every track of the archive: the terrain values, the object and route coordinates and the start pairs, with their exact extremes.
function validate(dat, V) {
  const R = V.r, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), seen = { sin: range(), spwX: range(), spwY: range(), rdX: range(), rdY: range(), startX: range(), startY: range(), ids: range() };
  const mapPixels = V.map.rows * V.sheet.size, used = new Set(), sdxRecords = parseSdx(members.get('WACKY.SDX')).records.length, catalogue = parseAtr(members.get('SPRITE.ATR'));
  const sinDwords = V.sin.entryBytes / 2 / 4; // @math an entry is two dwords: bytes -> dwords per property
  const [sx, sy] = V.spw.biasedWords.map(w => w / 2), id = V.spw.copiedWords[0] / 2; // @math byte offsets to word indices
  let tracks = 0, spwRecords = 0;
  for (const [name, data] of members) {
    const m = /^(\d+)\.SIN$/i.exec(name); if (!m) continue;
    const t = m[1]; tracks++;
    for (const rec of parseSin(data)) { const dv = view(Uint8Array.from(Object.values(rec.kept))); for (let k = 0; k < V.sin.entryBytes; k += V.sin.entryBytes / 2) widen(seen.sin, dv.getUint32(k, true)); } // @math two dwords per entry
    for (const r of parseSpwKeepingTail(members.get(`${t}.SPW`))) { spwRecords++; widen(seen.spwX, r[sx]); widen(seen.spwY, r[sy]); widen(seen.ids, r[id]); used.add(r[id]); }
    const g = parseGam(members.get(`${t}.GAM`)); for (const p of g.starts) { widen(seen.startX, p.x); widen(seen.startY, p.y); }
    const [ax, ay, bx, by] = V.route.coordWords.map(w => w / 2); // @math word offsets to word indices
    for (const r of parseRoute(members.get(`${t}.RD`))) { widen(seen.rdX, r[ax]); widen(seen.rdX, r[bx]); widen(seen.rdY, r[ay]); widen(seen.rdY, r[by]); }
  }
  assert.equal(tracks, R.tracks, 'the number of tracks');
  assert.equal(spwRecords, R.spwRecords, 'the number of object records');
  assert.equal(sdxRecords, R.sdxRecords, 'the SDX records');
  assert.equal(catalogue.length, R.catalogue, 'the catalogue records');
  assert.equal(mapPixels, R.mapPixels, 'the map in pixels');
  assert.ok(sinDwords > 0);
  assert.deepEqual(seen.sin, R.terrain, 'the terrain values that occur');
  assert.ok(seen.sin[1] < sdxRecords, 'every terrain value indexes an SDX record');
  assert.deepEqual([seen.spwX, seen.spwY, seen.rdX, seen.rdY, seen.startX, seen.startY], [R.spwX, R.spwY, R.rdX, R.rdY, R.startX, R.startY], 'the coordinate extremes');
  for (const [lo, hi] of [seen.spwX, seen.spwY, seen.rdX, seen.rdY, seen.startX, seen.startY]) assert.ok(lo >= 0 && hi < mapPixels, 'coordinates lie inside the map'); // @math zero is the map origin
  assert.deepEqual(seen.ids, [0, catalogue.length - 1], 'object ids span the catalogue'); // @math the catalogue indices
  assert.equal(used.size, catalogue.length, 'every catalogue sprite is placed in some track');
}

export default {
  id: 'track-ranges',
  claims: ['track.value-ranges'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r = patch => () => validate(dat, { ...V, r: { ...V.r, ...patch } });
    return [
      { label: 'terrain up to 28', fn: r({ terrain: [V.r.terrain[0], V.r.terrain[1] + 1] }) },
      { label: 'terrain from 1', fn: r({ terrain: [V.r.terrain[0] + 1, V.r.terrain[1]] }) },
      { label: 'object x one wider', fn: r({ spwX: [V.r.spwX[0] - 1, V.r.spwX[1]] }) },
      { label: 'route y one wider', fn: r({ rdY: [V.r.rdY[0], V.r.rdY[1] + 1] }) },
      { label: 'start x one narrower', fn: r({ startX: [V.r.startX[0] + 1, V.r.startX[1]] }) },
      { label: 'a map of 1024 pixels', fn: r({ mapPixels: V.r.mapPixels / 2 }) }, // @math half the map
      { label: '35 catalogue records', fn: r({ catalogue: V.r.catalogue - 1 }) },
    ];
  },
};
