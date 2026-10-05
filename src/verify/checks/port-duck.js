import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { routeEntries } from '../../game/ai.js';
import { createDuckAi, stepDuckAi, animateDucks, roundOver } from '../../game/duck.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ observed: expected('duck.motion-observed') });
const RACERS = 7; // @math the seven ducks (duck.race-rules)
const ENGINE = 2; // @math the duck game's engine word (duck.race-rules)
const MIDDLE = 0.5; // @math the middle of the interval a draw of the route entry stands for
const CRASHED = 2; // @math the state word of a crashed racer (duck.racers)

// The record's samples as rows by column name.
const rowsOf = record => record.samples.map(s => Object.fromEntries(record.columns.map((c, i) => [c, s[i]])));

// The end of every pass of the game (the race frame loop: the racers' step, the draw group with the animation words, the round check) as the port computes it from the start of a round:
// the pokes of the record are applied after the pass whose frame counter they name, a new round takes its entry draw from `draws`. Returns the states of the passes 0 to `frames`.
function simulate(world, record, draws, frames, { stun, level, gap, noAnim = false, noRound = false } = {}) {
  let round = 0, ai = createDuckAi(world, { round, rng: () => ((draws[round] ?? 0) + MIDDLE) / world.route.length, player: record.words.driver, gap }), score = 0; // a round whose entry is not found yet takes the first
  const hist = [{ ai, score, round }];
  for (let frame = 1; frame <= frames; frame++) {
    const out = stepDuckAi(ai, { human: null, tick: frame, score, stunFrames: stun, level }); // the logic group
    ai = out.ai; score = out.score;
    if (!noAnim) ai = animateDucks(ai); // the animation words, after the draw
    if (!noRound && roundOver(ai)) { round++; ai = createDuckAi(world, { round, rng: () => ((draws[round] ?? 0) + MIDDLE) / world.route.length, player: record.words.driver, gap }); }
    for (const p of record.pokes.filter(q => q.frame === frame)) ai = { ...ai, racers: ai.racers.map(r => (r.n === p.racer ? { ...r, hit: 1, hitStamp: frame, hitSpin: p.frameWord } : r)) }; // the poke is written between two passes
    hist.push({ ai, score, round });
  }
  return hist;
}

// Whether a row of the record is the state of the pass its frame counter names. A pause that falls inside the racers' loop (a duck's walk reads its points one at a time) shows some ducks a few
// points short of the pass; such samples are listed in the claim (`unmatched`) and are the only ones that differ.
function matches(entries, hist, row) {
  const state = hist[row.frame];
  if (state.score !== row.score || state.round !== row.round || row.count !== RACERS) return false;
  for (let n = 1; n <= RACERS; n++) {
    const r = state.ai.racers[n], len = entries[r.entry].points.length;
    if (r.x !== row[`x${n}`] || r.y !== row[`y${n}`] || r.entry !== row[`entry${n}`] || len - r.index !== row[`left${n}`]) return false;
    if ((r.crashed ? CRASHED : 0) !== row[`state${n}`] || r.slot !== row[`slot${n}`] || r.crashPic !== row[`crash${n}`] || r.hit !== row[`hit${n}`] || r.hp !== row[`hitPoints${n}`]) return false;
    if (r.hit !== 0 && r.hitStamp !== row[`stamp${n}`]) return false;
  }
  return true;
}

const mismatches = (entries, hist, rows) => rows.filter(row => !matches(entries, hist, row)).map(row => row.frame);

// The game draws the route entry of every round at random, which is not replayable: the entry of a round is the one whose replay reproduces the record best (the others reproduce none of it).
// Rounds are found one after the other.
function findDraws(world, record, rows, options, limit) {
  const entries = routeEntries(world.route), draws = [], frames = rows.at(-1).frame, rounds = [...new Set(rows.map(r => r.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    const upto = rows.filter(r => r.round <= round), scored = [];
    for (let e = 0; e < entries.length; e++) { draws[round] = e; scored.push([mismatches(entries, simulate(world, record, draws, frames, options), upto).length, e]); }
    scored.sort((a, b) => a[0] - b[0]);
    assert.ok(scored[0][0] <= limit, `${record.id}: a route entry reproduces the round ${round} (the best leaves ${scored[0][0]} samples)`);
    assert.ok(scored[1][0] > limit, `${record.id}: only one route entry reproduces the round ${round}`);
    draws[round] = scored[0][1];
  }
  return draws;
}

function run(dat, record, R, options = {}) {
  assertArchive(record, dat);
  assert.equal(record.words.track, R.track); assert.equal(record.words.driver, R.driver);
  const world = loadTrack(dat, String(R.track), ENGINE, R.driver), rows = rowsOf(record), entries = routeEntries(world.route);
  assert.equal(rows.length, R.samples, `${record.id}: the samples`);
  const draws = findDraws(world, record, rows, options, R.unmatched.length), hist = simulate(world, record, draws, rows.at(-1).frame, options);
  assert.equal(draws.length, R.rounds, `${record.id}: the rounds the record shows`);
  assert.deepEqual(mismatches(entries, hist, rows), R.unmatched, `${record.id}: the samples that are not the state of a pass`);
  return { draws, hist, rows };
}

export default {
  id: 'port-duck',
  claims: ['duck.motion-observed'],
  obs: ['duck-1', 'duck-2'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) {
    const O = values().observed, dat = await ctx.open('WACKY.DAT');
    assert.deepEqual(O.records.map(r => r.id), ['duck-1', 'duck-2']);
    for (const R of O.records) {
      const out = run(dat, ctx.obs(R.id), R);
      assert.equal(out.rows.at(-1).score, R.score, `${R.id}: the score at the end`);
    }
  },
  async discriminate(ctx) {
    const O = values().observed, dat = await ctx.open('WACKY.DAT'), [first, second] = O.records;
    const go = (R, options) => () => run(dat, ctx.obs(R.id), R, options);
    return [
      { label: 'ducks 259 route points apart', fn: go(first, { gap: 259 }) }, // @math one point off the observed 260
      { label: 'ducks that walk 13 points a frame', fn: go(first, { level: 13 }) }, // @math one point off the observed 14
      { label: 'a stun of 3 frames', fn: go(second, { stun: 3 }) }, // @math one frame short of the observed 4
      { label: 'a stun of 5 frames', fn: go(second, { stun: 5 }) }, // @math one frame over the observed 4
      { label: 'crash pictures that do not go on', fn: go(second, { noAnim: true }) },
      { label: 'no new round once every duck is gone', fn: go(second, { noRound: true }) },
    ];
  },
};
