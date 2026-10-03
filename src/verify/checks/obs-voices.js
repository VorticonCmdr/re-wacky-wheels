import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseVoc } from '../../formats/voc.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ o: expected('voc.rate-observed'), p: expected('voc.library-player') });

// The rate the library's VOC walker (voc.library-player) gives a type-1 block with this time constant.
const rateOf = (tc, P) => Math.floor(P.rateDividend / (P.rateBase - (tc << P.rateShift))); // @math time constant to the high byte of the divisor

// Cross-validate a `voices` record: every voice holding a rate plays one block of an archive VOC (found by its type, length and the CRC-32 of
// its samples), and the rate is the library's rule applied to the time constant in memory, except that a voice started before the observer
// changed that byte holds the rate of the byte it had.
function validate(dat, record, V) {
  const O = V.o, P = V.p, members = new Map();
  assertArchive(record, dat);
  assert.equal(record.voicesPointerOffset, O.voicesPointerAt);
  assert.equal(record.countOffset, O.countAt);
  assert.equal(record.recordBytes, O.recordBytes);
  assert.equal(record.rateOffset, O.rateAt);
  assert.equal(record.dataPointerOffset, O.dataPointerAt);
  assert.equal(record.count, O.voices);
  for (const e of parseDatDirectory(dat)) {
    if (!/\.VOC$/i.test(e.name)) continue;
    const b = parseVoc(e.data).blocks.find(x => x.type === 1);
    members.set(`${b.length}:${crc(b.data.subarray(P.soundHeader))}`, e.name);
  }
  const seen = [];
  for (const v of record.voices) {
    const member = members.get(`${v.blockLength}:${v.dataCrc}`);
    assert.ok(member, `voice ${v.index} plays the samples of an archive VOC`);
    assert.equal(v.codec, P.playedCodec, 'a codec the library plays');
    const now = rateOf(v.timeConstant, P), before = record.patched && v.timeConstant === record.patched.to ? rateOf(record.patched.from, P) : null;
    assert.ok(v.rate === now || v.rate === before, `voice ${v.index} (${member}) holds ${v.rate}, the rule gives ${now}`);
    seen.push({ member, rate: v.rate, timeConstant: v.timeConstant, new: v.rate === now });
  }
  return seen;
}

export default {
  id: 'obs-voices',
  claims: ['voc.rate-observed'],
  obs: ['voices-1', 'voices-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), O = V.o;
    const one = validate(dat, ctx.obs('voices-1'), V), two = validate(dat, ctx.obs('voices-2'), V);
    assert.ok(!ctx.obs('voices-1').patched, 'the first record is of an unchanged game');
    assert.deepEqual([ctx.obs('voices-2').patched.from, ctx.obs('voices-2').patched.to], [O.patched.from, O.patched.to], 'the byte the observer changed');
    assert.deepEqual([...new Set([...one, ...two].map(s => s.member))].sort(), O.members, 'the sounds the voices play');
    assert.deepEqual([...new Set([...one, ...two].map(s => s.rate))].sort((a, b) => a - b), O.rates, 'the rates the voices hold');
    const fresh = two.filter(s => s.timeConstant === O.patched.to && s.rate === rateOf(O.patched.to, V.p));
    assert.equal(fresh.length, O.patched.freshVoices, 'voices restarted with the changed byte');
    assert.equal(O.patched.rate, rateOf(O.patched.to, V.p), 'the rate of the changed byte');
    assert.notEqual(O.patched.rate, Math.round(V.p.rateDividend / (V.p.rateBase - (O.patched.to << V.p.rateShift))), 'rounding the exact quotient would give another rate'); // @math time constant to the high byte of the divisor
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r1 = ctx.obs('voices-1'), r2 = ctx.obs('voices-2'), p = patch => ({ ...V, p: { ...V.p, ...patch } });
    const voice = (r, i, patch) => ({ ...r, voices: r.voices.map((v, k) => (k === i ? { ...v, ...patch } : v)) });
    return [
      { label: 'rate off by one', fn: () => validate(dat, voice(r1, 0, { rate: r1.voices[0].rate + 1 }), V) },
      { label: 'time constant off by one', fn: () => validate(dat, voice(r1, 1, { timeConstant: r1.voices[1].timeConstant + 1 }), V) },
      { label: 'unknown samples', fn: () => validate(dat, voice(r1, 2, { dataCrc: '00000000' }), V) }, // @math the third voice
      { label: 'dividend 1000000', fn: () => validate(dat, r1, p({ rateDividend: 1000000 })) }, // @math the plain numerator
      { label: 'divisor base 255', fn: () => validate(dat, r1, p({ rateBase: V.p.rateBase - 256 })) }, // @math one time-constant step
      { label: 'shift 7', fn: () => validate(dat, r1, p({ rateShift: V.p.rateShift - 1 })) },
      { label: 'the changed byte forgotten', fn: () => validate(dat, { ...r2, patched: null }, V) },
      { label: 'a rate of the rounded value', fn: () => validate(dat, voice(r2, 5, { rate: 13158 }), V) }, // @math rounding 13157.89 up
    ];
  },
};
