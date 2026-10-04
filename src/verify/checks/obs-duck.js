import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseRoute } from '../../formats/track-files.js';
import { rasterSegment } from '../../formats/route.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('route.placement-observed'), place: expected('route.placement'), rt: expected('rd.route'), rd: expected('rd.layout') });

// Where each racer stands among the route's points: [entry, index in the entry], the point array being the rasterised .RD segments (rd.route).
function locate(points, x, y) {
  const hits = [];
  points.forEach((p, e) => p.forEach((q, k) => { if (q[0] === x && q[1] === y) hits.push([e, k]); }));
  return hits;
}

function validate(dat, r, V, { lag = V.place.lagSteps } = {}) {
  const D = V.d, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assertArchive(r, dat);
  assert.equal(r.names.track, D.track, 'the track');
  assert.deepEqual([r.branch, r.gridFlag, r.countWord], [D.branch, D.gridFlag, D.count], 'the branch word, the shootout word and the racer count');
  const route = parseRoute(members.get(`${r.names.track}.RD`)), wb = V.rd.wordBytes;
  const points = route.map(rec => rasterSegment(...V.rt.coordWords.map(o => (rec[o / wb] + V.rt.coordBias) % 0x10000))); // @math 16-bit word wrap
  assert.equal(points.length, D.entries, 'the route entries');
  const at = r.racers.slice(V.place.firstPlaced).map(([x, y, , index]) => {
    const hits = locate(points, x, y);
    assert.equal(hits.length, 1, 'a racer stands on exactly one route point');
    assert.equal(hits[0][0], index, 'the racer\'s route index word is its entry');
    return hits[0];
  });
  assert.deepEqual(at, D.hits, 'the route points the racers stand on');
  // from the second placed racer on, each is `lag` points further along the route than the one before, over the entries' ends and round to the first
  for (let i = 1; i < at.length; i++) {
    let [e, k] = at[i - 1];
    for (let s = 0; s < lag; s++) { k++; if (k >= points[e].length) { k = 0; e = e + 1 >= points.length ? 0 : e + 1; } }
    assert.deepEqual(at[i], [e, k], `racer ${i + 1} is ${lag} points after racer ${i}`);
  }
}

export default {
  id: 'obs-duck',
  claims: ['route.placement-observed'],
  obs: ['start-3'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('start-3'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('start-3'), V = values(), P = V.place;
    return [
      { label: 'a lag one point short', fn: () => validate(dat, r, V, { lag: P.lagSteps - 1 }) },
      { label: 'a lag one point long', fn: () => validate(dat, r, V, { lag: P.lagSteps + 1 }) },
      { label: 'a racer moved one unit', fn: () => validate(dat, { ...r, racers: r.racers.map((p, i) => (i === 3 ? [p[0] + 1, ...p.slice(1)] : p)) }, V) }, // @math the fourth racer
      { label: 'the branch word 0', fn: () => validate(dat, { ...r, branch: 0 }, V) }, // @math the other value of the word
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
