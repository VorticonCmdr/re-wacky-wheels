import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ list: expected('view.draw-list-observed'), proj: expected('view.object-projection'), order: expected('view.draw-order'), car: expected('view.player-car-draw'), rows: expected('view.row-table') });

// The row table of view.row-table, from its claim values (the check obs-projtable proves it equals the live one).
function rowTable(R) {
  const out = [R.first];
  for (let d = 1; d < R.entries; d++) {
    let b = Math.floor(R.numerator / d);
    if (R.numerator - b * d > Math.floor(d / 2)) b++; // @math half the distance, the rounding threshold
    b = Math.min(Math.max(b, R.minimum), R.maximum);
    out.push(R.base - (b >> 1) + b); // @math the halved size
  }
  return out;
}

const dword = (rec, at) => (rec[at] & 0xffff) + rec[at + 1] * 65536; // @math a dword from two words, the low one unsigned

function validate(dat, r, V, { sizeBase = V.proj.sizeBase, sizeStep = V.proj.sizeStep, sort = true } = {}) {
  assertArchive(r, dat);
  const L = V.list, F = L.fieldWords, T = rowTable(V.rows), classes = Array(V.proj.maxSize + 1).fill(0);
  assert.equal(r.listAt, V.order.listAt);
  assert.equal(r.recordBytes, V.order.recordBytes);
  assert.equal(r.samples.length, L.samples, 'the samples');
  let records = 0, others = 0, player = 0;
  for (const s of r.samples) {
    assert.equal(s.records.length, s.count, 'the count word is the number of records read');
    const dist = s.records.map(rec => dword(rec, F.distance));
    if (sort) for (let i = 1; i < dist.length; i++) assert.ok(dist[i - 1] >= dist[i], 'falling order of distance');
    for (const rec of s.records) {
      records++;
      const d = dword(rec, F.distance);
      if (rec[F.type] === V.car.type) {
        player++;
        assert.equal(d, L.playerDistance, 'the player\'s car is at 0x7c');
        assert.equal(L.playerDistance, V.car.distance);
        assert.equal(rec[F.left] + (rec[F.width] >> 1), V.car.centre, 'centred on the column 0xa0'); // @math half the width, rounded down
      } else {
        others++;
        const size = d < sizeBase ? 0 : Math.min(Math.floor((d - sizeBase) / sizeStep), V.proj.maxSize);
        assert.equal(rec[F.sizeClass], size, `the size class of the distance ${d}`);
        classes[size]++;
        assert.equal(rec[F.top] + rec[F.height] + dword(rec, F.skip) / 4, T[d], `the bottom row of the distance ${d}`); // @math the skip bytes are four a row
        assert.ok(d >= V.proj.minDistance && d <= V.proj.maxDistance || d === L.playerDistance, 'within the drawn range');
      }
    }
  }
  assert.equal(Math.max(...r.samples.flatMap(s => s.records.map(rec => rec[F.top] + rec[F.height]))), L.bottomRows + 1, 'the lowest row any record reaches is the last screen row'); // @math rows are numbered from 0, so the end is one past
  assert.equal(records, L.records, 'the records');
  assert.equal(others, L.others, 'the records of other things');
  assert.equal(player, L.player, 'the player\'s records');
  assert.deepEqual(classes.slice(0, L.classes.length), L.classes, 'the records of each size class');
}

export default {
  id: 'obs-drawlist',
  claims: ['view.draw-list-observed'],
  obs: ['drawlist-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('drawlist-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('drawlist-1'), V = values();
    const swapped = { ...r, samples: r.samples.map((s, i) => (i === r.samples.findIndex(x => x.records.length > 1) ? { ...s, records: [...s.records].reverse() } : s)) };
    const K2 = 2; // @math a sample with at least three records
    const tweak = (patch, fn) => ({ ...r, samples: r.samples.map((s, i) => (i === r.samples.findIndex(x => x.records.length > K2) ? { ...s, records: s.records.map((rec, k) => (k === 1 ? fn(rec) : rec)) } : s)) });
    const row = rec => rec.map((v, i) => (i === V.list.fieldWords.top ? v + 1 : v)), cls = rec => rec.map((v, i) => (i === V.list.fieldWords.sizeClass ? v + 1 : v));
    return [
      { label: 'a list in rising order', fn: () => validate(dat, swapped, V) },
      { label: 'a top row one lower', fn: () => validate(dat, tweak(null, row), V) },
      { label: 'a size class one higher', fn: () => validate(dat, tweak(null, cls), V) },
      { label: 'the size base 0x7b', fn: () => validate(dat, r, V, { sizeBase: V.proj.sizeBase - 1 }) },
      { label: 'the size step 0x45', fn: () => validate(dat, r, V, { sizeStep: V.proj.sizeStep - 1 }) },
      { label: 'a player distance of 0x7d', fn: () => validate(dat, r, { ...V, list: { ...V.list, playerDistance: V.list.playerDistance + 1 } }) },
      { label: 'a centre of 0x9f', fn: () => validate(dat, r, { ...V, car: { ...V.car, centre: V.car.centre - 1 } }) },
      { label: 'a smaller class count', fn: () => validate(dat, r, { ...V, list: { ...V.list, classes: [...V.list.classes.slice(0, -1), V.list.classes.at(-1) - 1] } }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
