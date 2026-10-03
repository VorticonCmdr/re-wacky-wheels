import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseRoute } from '../../formats/track-files.js';
import { rasterSegment } from '../../formats/route.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ follow: expected('ai.route-follow'), route: expected('rd.route') });

// The points the game's loader builds from the track's .RD (rd.route), as "x,y" strings.
function routePoints(dat, track, R) {
  const rd = parseRoute(parseDatDirectory(dat).find(e => e.name === `${track}.RD`).data), [ax, ay, bx, by] = R.coordWords.map(w => w / 2), points = new Set(); // @math word offsets to word indices
  for (const record of rd) for (const [x, y] of rasterSegment(record[ax] + R.coordBias, record[ay] + R.coordBias, record[bx] + R.coordBias, record[by] + R.coordBias)) points.add(`${x},${y}`);
  return points;
}

// Cross-validate the `progress` record: in every sample the followers stand on route points and the others do not.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const F = V.follow, points = routePoints(dat, record.names.track, V.route);
  assert.equal(record.countWord + 1, F.racers, 'the racers the claim covers');
  let followerSamples = 0, otherSamples = 0;
  record.samples.forEach((sample, k) => sample.racers.forEach(([x, y], i) => {
    const on = points.has(`${x},${y}`);
    if (i >= F.firstFollower) { assert.ok(on, `sample ${k} racer ${i} at (${x}, ${y}) is a route point`); followerSamples++; }
    else { assert.ok(!on, `sample ${k} racer ${i} at (${x}, ${y}) is not a route point`); otherSamples++; }
  }));
  assert.equal(followerSamples, F.followerSamples, 'how many follower positions were checked (24 samples of 7 racers)');
  assert.ok(otherSamples > 0, 'racer 0 was sampled too');
  assert.ok(points.size > record.samples.length * F.racers, 'the route has far more points than there are samples, so a hit is not chance');
}

export default {
  id: 'obs-route',
  claims: ['ai.route-follow'],
  obs: ['progress-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('progress-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('progress-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { ...V, follow: { ...V.follow, ...patch } }) });
    const route = patch => () => validate(dat, record, { ...V, route: { ...V.route, ...patch } });
    return [
      tweak('racer 0 follows the route too', { firstFollower: V.follow.firstFollower - 1 }),
      tweak('racer 1 does not follow the route', { firstFollower: V.follow.firstFollower + 1 }),
      tweak('9 racers', { racers: V.follow.racers + 1 }),
      { label: 'route points without the 0x400 bias', fn: route({ coordBias: V.route.coordBias - 1 }) },
      { label: 'route points with the bias off by one', fn: route({ coordBias: V.route.coordBias + 1 }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
