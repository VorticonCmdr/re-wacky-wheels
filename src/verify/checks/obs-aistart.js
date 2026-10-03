import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ setup: expected('ai.speed-setup') });

// Racer rows in the `start` record: x, y, heading, route index, then the words +0, +2, +4 (state), +6, +8, +0xa, +0xc, +0xe.
const COLUMN = { w0: 4, w2: 5, state: 6, c6: 7, s8: 8, sA: 9, sC: 10, cE: 11 }; // @math positions in the row the observation tool writes, in the order listed above

function validate(dat, record, V) {
  assertArchive(record, dat);
  const S = V.setup, level = record.level, last = S.racers - 1;
  assert.equal(record.levelAt, S.levelAt, 'the word the speeds are built from');
  assert.equal(record.countWord + 1, S.racers, 'one row per racer');
  record.racers.forEach((row, n) => {
    const behind = last - n, at = name => row[COLUMN[name]]; // @math racers are numbered from 0; `behind` counts ranks from the last
    assert.equal(at('state'), S.startState, `racer ${n}: state word`);
    assert.equal(at('c6'), S.phaseOneFrames, `racer ${n}: first-phase counter`);
    assert.equal(at('s8'), level, `racer ${n}: word +8 is the level`);
    assert.equal(at('sA'), level + S.fastBonus - S.rankStep * behind, `racer ${n}: word +0xa`);
    assert.equal(at('sC'), level - S.slowOffset - S.rankStep * behind, `racer ${n}: word +0xc`);
    assert.equal(at('cE'), S.counters[n], `racer ${n}: second-phase counter`);
    assert.equal(at('w0'), S.effectWords[n], `racer ${n}: word +0`);
    assert.equal(at('w2'), 0, `racer ${n}: word +2`);
  });
  assert.equal(new Set(record.racers.map(r => r[COLUMN.sA])).size, S.racers, 'the speeds differ per racer, so the order is visible');
}

export default {
  id: 'obs-aistart',
  claims: ['ai.speed-setup'],
  obs: ['start-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('start-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('start-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { setup: { ...V.setup, ...patch } }) });
    return [
      tweak('rank step 9', { rankStep: V.setup.rankStep - 1 }),
      tweak('rank step 11', { rankStep: V.setup.rankStep + 1 }),
      tweak('fast bonus 0x3b', { fastBonus: V.setup.fastBonus - 1 }),
      tweak('slow offset 3', { slowOffset: V.setup.slowOffset - 1 }),
      tweak('slow offset 5', { slowOffset: V.setup.slowOffset + 1 }),
      tweak('first phase 0x17 frames', { phaseOneFrames: V.setup.phaseOneFrames - 1 }),
      tweak('start in state 1', { startState: V.setup.startState + 1 }),
      tweak('second-phase counters shifted', { counters: [...V.setup.counters.slice(1), V.setup.counters[0]] }),
      tweak('effect words reversed', { effectWords: [...V.setup.effectWords].reverse() }),
      tweak('level word 2 bytes on', { levelAt: V.setup.levelAt + 2 }), // @math one word on
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
