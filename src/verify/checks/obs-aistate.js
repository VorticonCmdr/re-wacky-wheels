import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ machine: expected('ai.state-machine'), speeds: expected('ai.race-speeds'), setup: expected('ai.speed-setup') });

// Columns of a racer row in an `aistate` record: the words +0, +2, +4, +6, +8, +0xa, +0xc, +0xe, +0x10, +0x14, +0x1c.
const col = (record, offset) => record.columns.indexOf(offset);

function validate(dat, record, V) {
  assertArchive(record, dat);
  const M = V.machine, S = V.speeds, U = V.setup, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  const state = col(record, M.stateWord), c6 = col(record, M.firstCounterWord), cE = col(record, M.secondCounterWord), s8 = col(record, S.speedWords[0]), sA = col(record, S.speedWords[1]), sC = col(record, S.fixedWord);
  assert.ok([state, c6, cE, s8, sA, sC].every(i => i >= 0), 'the record has the columns');
  assert.equal(record.levelAt, U.levelAt);
  const racers = record.countWord + 1, followers = Array.from({ length: racers - S.firstFollower }, (_, k) => k + S.firstFollower);
  // The state machine (ai.step-rules) leaves these relations at every pause, for every racer it moves.
  record.samples.forEach((sample, k) => followers.forEach(n => {
    const row = sample.racers[n], st = row[state];
    assert.ok(M.states.includes(st), `sample ${k} racer ${n}: state ${st} is one of the observed ones`);
    if (st === M.states[0]) assert.ok(row[c6] >= 1 && row[c6] <= U.phaseOneFrames, `sample ${k} racer ${n}: first-phase counter while in the first state`);
    else assert.equal(row[c6], 0, `sample ${k} racer ${n}: first-phase counter is spent once past the first state`);
    if (st === M.states[1]) assert.ok(row[cE] >= 1 && row[cE] <= U.counters[n], `sample ${k} racer ${n}: second-phase counter while in the second state`);
    if (st === M.states.at(-1)) assert.equal(row[cE], 0, `sample ${k} racer ${n}: second-phase counter is spent in the third state`);
    if (k > 0) assert.ok(st >= record.samples[k - 1].racers[n][state], `sample ${k} racer ${n}: the state never goes back`);
    if (n > followers[0]) assert.ok(record.samples[k].racers[n - 1][state] >= st, `sample ${k}: a lower racer number is never behind in state (its counter is smaller)`);
  }));
  const first = record.samples[0], last = record.samples.at(-1);
  assert.ok(followers.every(n => first.racers[n][state] === M.states[0]), 'the first pause is before any racer left the first state');
  assert.ok(followers.every(n => last.racers[n][state] === M.states.at(-1)), 'the last pause is after every racer reached the last state');
  // The speed words: as initialised (indices), then once replaced by the table values (ai.race-speeds); racer 0 and word +0xc never.
  const vel = members.get('VEL.TAB'), dv = new DataView(vel.buffer, vel.byteOffset, vel.byteLength), word = i => dv.getInt16(i * 2, true); // @math a word index into the table
  assert.equal(record.velTable.offset, S.tableAt);
  assert.equal(record.velTable.bytes, vel.length, 'the live table is as long as VEL.TAB');
  assert.equal(record.velTable.crc, crc(vel), 'the live speed table equals VEL.TAB');
  const index = (n, which) => (which === 0 ? record.samples[0].level : record.samples[0].level + U.fastBonus - U.rankStep * (racers - 1 - n)); // @math racers are numbered from 0
  const form = sample => followers.every(n => sample.racers[n][s8] === index(n, 0) && sample.racers[n][sA] === index(n, 1)) ? 'indices' : followers.every(n => sample.racers[n][s8] === word(index(n, 0)) && sample.racers[n][sA] === word(index(n, 1))) ? 'table values' : 'neither';
  const forms = record.samples.map(form);
  assert.ok(!forms.includes('neither'), 'every pause shows the initial indices or the looked-up table values');
  assert.equal(forms[0], 'indices'); assert.equal(forms.at(-1), 'table values');
  assert.equal(forms.filter((f, k) => k > 0 && f !== forms[k - 1]).length, 1, 'the words are replaced once');
  record.samples.forEach((sample, k) => {
    assert.equal(sample.racers[0][s8], index(0, 0), `sample ${k}: racer 0's word +8 is never replaced`);
    assert.equal(sample.racers[0][sA], index(0, 1), `sample ${k}: racer 0's word +0xa is never replaced`);
    racersFixed(sample, followers.concat(0), sC, index, k);
  });
  function racersFixed(sample, all, column) { all.forEach(n => assert.equal(sample.racers[n][column], record.samples[0].level - U.slowOffset - U.rankStep * (racers - 1 - n), `racer ${n}: word +0xc is never replaced`)); } // @math racers are numbered from 0
  assert.ok(word(index(1, 0)) !== index(1, 0), 'the replacement is visible: a table value differs from its index');
}

export default {
  id: 'obs-aistate',
  claims: ['ai.state-machine', 'ai.race-speeds'],
  obs: ['aistate-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('aistate-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('aistate-1'), V = values();
    const m = patch => () => validate(dat, record, { ...V, machine: { ...V.machine, ...patch } }), s = patch => () => validate(dat, record, { ...V, speeds: { ...V.speeds, ...patch } });
    return [
      { label: 'states swapped (1 and 2)', fn: m({ states: [V.machine.states[0], V.machine.states.at(-1), V.machine.states[1]] }) }, // @math exchange the last two
      { label: 'state word +6 instead of +4', fn: m({ stateWord: V.machine.firstCounterWord }) },
      { label: 'counter words swapped', fn: m({ firstCounterWord: V.machine.secondCounterWord, secondCounterWord: V.machine.firstCounterWord }) },
      { label: 'speed words swapped', fn: s({ speedWords: [V.speeds.speedWords[1], V.speeds.speedWords[0]] }) },
      { label: 'racer 0 also looked up', fn: s({ firstFollower: V.speeds.firstFollower - 1 }) },
      { label: 'table 2 bytes on', fn: s({ tableAt: V.speeds.tableAt + 2 }) }, // @math one word on
      { label: 'fixed word +8 instead of +0xc', fn: s({ fixedWord: V.speeds.speedWords[0] }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
