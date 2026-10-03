import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseRoute } from '../../formats/track-files.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('rd.derived-words'), trig: expected('trig.layout'), route: expected('rd.route') });

// Every route record of every .RD member: the angle word indexes the TRIG vector that points along the segment, the length word is the segment's length
// to within 1 (rounded down), and the compass word is the angle's octant (240 entries wide, centred on multiples of 240), numbered from 6.
function validate(dat, V, { swap = false } = {}) {
  const D = V.d, members = parseDatDirectory(dat), by = new Map(members.map(e => [e.name, e.data]));
  assert.equal(D.turn, V.trig.entries, 'one turn is the number of TRIG entries');
  assert.equal(D.octant * D.compassCount, D.turn, 'eight octants make a turn');
  assert.equal(D.octantBias * 2, D.octant, 'the octants are centred on multiples of their width'); // @math half an octant
  const trig = by.get('TRIG.DAT'), dv = new DataView(trig.buffer, trig.byteOffset, trig.byteLength);
  const vector = i => [dv.getInt32(i * V.trig.entryBytes, true) / 2 ** V.trig.fixedBits, dv.getInt32(i * V.trig.entryBytes + V.trig.entryBytes / 2, true) / 2 ** V.trig.fixedBits]; // @math the two dwords of an entry, 16.16
  let records = 0, aligned = 0, minCosine = Infinity, worstLength = 0, compassOk = 0, longestSkipped = 0;
  const tracks = members.filter(e => /^\d+\.RD$/i.test(e.name));
  assert.equal(tracks.length, D.tracks, 'the .RD members');
  for (const e of tracks) for (const r of parseRoute(e.data)) {
    records++;
    const [ax, ay, bx, by] = V.route.coordWords.map(w => w / 2), dx = r[bx] - r[ax], dy = r[by] - r[ay], length = Math.hypot(dx, dy); // @math word offsets to word indices
    assert.ok(r[D.angleWord] < D.turn, 'the angle word is a TRIG index');
    worstLength = Math.max(worstLength, Math.abs(length - r[D.lengthWord]));
    if ((Math.floor((r[D.angleWord] + D.octantBias) / D.octant) + D.compassBase) % D.compassCount === r[D.compassWord]) compassOk++;
    if (length < D.minLength) { longestSkipped = Math.max(longestSkipped, length); continue; }
    const [x, y] = swap ? vector(r[D.angleWord]).reverse() : vector(r[D.angleWord]);
    minCosine = Math.min(minCosine, (dx * x + dy * y) / length);
    aligned++;
  }
  assert.equal(records, D.records, 'the number of route records');
  assert.equal(compassOk, records, 'the compass word follows the angle word in every record');
  assert.equal(aligned, D.records - D.short, 'the records at least minLength long');
  assert.equal(Math.ceil(longestSkipped), D.minLength, 'the longest skipped segment is just under minLength');
  assert.equal(Math.ceil(worstLength), D.lengthError, 'the length word is within this many units of the segment length');
  assert.equal(Math.floor(minCosine * D.ppm), D.minCosinePpm, 'the worst alignment of TRIG[angle word] with its segment, in parts per million');
}

export default {
  id: 'rd-derived',
  claims: ['rd.derived-words'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), d = patch => () => validate(dat, { ...V, d: { ...V.d, ...patch } });
    return [
      { label: 'angle in the compass word', fn: d({ angleWord: V.d.compassWord }) },
      { label: 'length in the angle word', fn: d({ lengthWord: V.d.angleWord }) },
      { label: 'octant bias 119', fn: d({ octantBias: V.d.octantBias - 1 }) },
      { label: 'octant bias 121', fn: d({ octantBias: V.d.octantBias + 1 }) },
      { label: 'compass numbered from 5', fn: d({ compassBase: V.d.compassBase - 1 }) },
      { label: 'compass numbered from 7', fn: d({ compassBase: V.d.compassBase + 1 }) },
      { label: 'TRIG components swapped (dword 1 as the column)', fn: () => validate(dat, V, { swap: true }) },
    ];
  },
};
