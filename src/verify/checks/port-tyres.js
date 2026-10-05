import assert from 'node:assert/strict';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { createCar } from '../../game/car.js';
import { createStart, stepStart, lionBytes } from '../../game/start.js';
import { createPlayer, stepPlayer } from '../../game/player.js';
import { liveObjects } from '../../game/pickups.js';
import { stepEffects } from '../../game/effects.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ tyres: expected('pickup.tyres-observed'), spw: expected('spw.read') });
const CONSUMED_WORD = -1; // @math the consumed marker 0xffff as the record's 16-bit word reads it
const KEY_TICK = 35; // @math the frame the accelerate key goes down in the port's run, as in port-contact: the record starts at the throttle 50 and does not pin it
const PICKED = 0xffff, GAP = 0xb; // @math the state word the pickup stores and the rows between the strips (effects.tyres)
const FRAMES = 160; // @math frames enough to cover the 60 samples of the record (about 40 ms a sample at 88 ms a frame, the key down from the frame 35)

// The port's player from the countdown with the accelerate key down from `keyTick`, the draw's effects after each call (a sample of the record is taken between the machine of one
// call and the logic of the next, or between that logic and the next draw): the state after the logic and after the effects of every frame counter value, in the columns of the record.
function states(dat, record, V, { keyTick = KEY_TICK, tyreKind = true } = {}) {
  const members = archiveMembers(dat), world = { ...loadTrack(dat, String(record.build.track)), lion: lionBytes(members) };
  const objects = liveObjects(world);
  objects[0] = { ...objects[0], id: record.build.spw.sprite, x: record.build.spw.x + V.spw.coordBias, y: record.build.spw.y + V.spw.coordBias };
  const w = tyreKind ? world : { ...world, sprites: world.sprites.map(s => ({ ...s, kind: 0 })) };
  let player = createPlayer(createCar(world.start, w), objects), start = createStart();
  const read = p => { const c = p.car; return { throttle: c.throttle, y: c.py, word: p.word, object: p.objects[0].consumed === 0xffff ? CONSUMED_WORD : p.objects[0].consumed, state: c.tyreState, words: [...c.tyreWords] }; }; // @math the consumed marker as 16 bits
  const out = [read(player)];
  for (let t = 1; t <= FRAMES; t++) {
    const next = stepStart(start); start = next.start;
    const moved = stepPlayer(player, { accelerate: t >= keyTick }, w, { racing: next.racing, racers: [] });
    out.push(read(moved.player)); // a pause between the logic and the next call's draw sees the words not yet stepped
    const fx = stepEffects(moved.player.car, { world: w, track: record.build.track, entryNumber: -1, racing: next.racing, finished: false, geometry: { left: 0, top: 0 } });
    player = { ...moved.player, car: fx.car };
    out.push(read(player));
  }
  return out;
}

// Every sample of the record is one of the port's states, in order (the pauses fall between frames; a state can be seen twice).
function replay(dat, record, V, options = {}) {
  assertArchive(record, dat);
  const sequence = states(dat, record, V, options), ix = Object.fromEntries(record.columns.map((c, i) => [c, i]));
  let at = 0;
  const kept = [];
  record.samples.forEach((s, n) => {
    const want = { throttle: s[ix.throttle], y: s[ix.row], word: s[ix.collision], object: s[ix.objectHit], state: s[ix.tyreState], words: [s[ix.tyreA], s[ix.tyreB], s[ix.tyreC]] };
    const fits = state => Object.entries(want).every(([k, v]) => JSON.stringify(state[k]) === JSON.stringify(v));
    let j = at;
    while (j < sequence.length && !fits(sequence[j])) j++;
    assert.ok(j < sequence.length, `sample ${n} of ${record.id}: no state of the port is ${JSON.stringify(want)} from frame ${at} on`);
    at = j; kept.push(j);
  });
  return { sequence, kept };
}

export default {
  id: 'port-tyres',
  claims: ['effects.tyres'],
  obs: ['tyres-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs('tyres-1'), out = replay(dat, record, V);
    const T = V.tyres, first = out.sequence.findIndex(s => s.state !== 0);
    assert.equal(out.sequence[first].state, PICKED, 'the call of the contact leaves the state word 0xffff');
    assert.deepEqual(out.sequence[first + 1].words, T.firstStrips, 'the strips after the first step');
    assert.deepEqual(out.sequence[first].words.map((w, i) => w - out.sequence[first].words[0] - i * GAP), [0, 0, 0], 'a stack\'s strips start 0xb rows apart');
    const last = out.sequence.findLast(s => s.state === T.states.at(-1));
    assert.deepEqual(last.words, T.finalStrips, 'and where they end');
    assert.equal(out.sequence.slice(first).find(s => s.state === 0).state, 0, 'the state returns to 0');
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs('tyres-1');
    const alter = (n, k, f) => ({ ...record, samples: record.samples.map((s, i) => (i === n ? s.map((v, j) => (j === k ? f(v) : v)) : s)) });
    const column = name => record.columns.indexOf(name);
    return [
      { label: 'every object an obstacle', fn: () => replay(dat, record, V, { tyreKind: false }) },
      { label: 'a recorded strip word altered', fn: () => replay(dat, alter(16, column('tyreA'), v => v + 1), V) }, // @math the 16th sample, in the rising state
      { label: 'a recorded state altered', fn: () => replay(dat, alter(14, column('tyreState'), () => 1), V) }, // @math the 14th sample, the first of state 2
    ];
  },
};
