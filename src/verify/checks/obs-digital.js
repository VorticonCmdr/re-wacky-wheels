import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { view } from '../../binary.js';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAudioBank } from '../../formats/audio-bank.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const dword = offset => offset / Uint32Array.BYTES_PER_ELEMENT; // the index of the dword at a byte offset of a record
const values = () => ({ D: expected('audio.digital-observed'), N: expected('audio.no-alias'), T: expected('audio.timer-observed'), R: expected('audio.speaker-rate'), L: expected('audio.load'), M: expected('audio.mode-select'), P: expected('audio.speaker-state') });

// The CFG the game was started with is an installed WACKY.CFG with the sound-mode dword set to the first-bank mode.
async function findCfg(ctx, record, V) {
  for (const path of ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p))) {
    const bytes = Uint8Array.from(await ctx.openPath(path));
    view(bytes).setInt32(V.M.modeFileOffset, V.M.otherMode, true);
    if (createHash('sha1').update(bytes).digest('hex') === record.cfg.sha1) return bytes;
  }
  throw new Error('no installed WACKY.CFG, with the sound mode set, has the SHA-1 the record names');
}

// Cross-validate a `digital` record: the run configuration, the digital flag and the pointers left unloaded, the record of NO against the user's bank, and the timer service's handler list.
async function validate(ctx, record, V) {
  const { D, N, T, R, L, M } = V, w = record.words, dat = await ctx.open('WACKY.DAT');
  assertArchive(record, dat);
  assert.equal(record.cfg.offset, M.modeFileOffset, 'the record names the CFG offset of the sound mode');
  await findCfg(ctx, record, V);
  assert.deepEqual(w.mode, [D.modeAt, D.mode], 'the sound mode is the PC speaker\'s');
  assert.deepEqual(w.device, [D.deviceAt, D.device], 'the library\'s device word equals it');
  assert.deepEqual(w.sound, [D.soundAt, D.sound], 'the sound word is on');
  assert.deepEqual(w.flag, [D.flagAt, D.flag], 'the digital sound flag is off');
  ['engine', 'horn', 'quack'].forEach((name, k) => assert.deepEqual(w[name], [D.pointers[k], 0], `the ${name} sample is not loaded`));
  assert.equal(record.voicesAt, D.voicesAt);
  assert.equal(record.voices.length, D.voices, 'the GIG pointers');
  assert.ok(record.voices.every(v => v === 0), 'no GIG voice is loaded');
  // The record of NO is the record of PUF, and PUF's is the bank's slot 18 as the user's AUDIOHED.FX has it.
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), slot = parseAudioBank(members.get('AUDIOHED.FX'), members.get('AUDIOT.FX')).slots[N.source];
  assert.equal(record.noAt, L.recordTable + N.target * L.recordBytes);
  assert.equal(record.pufAt, L.recordTable + N.source * L.recordBytes);
  assert.ok(record.bufferPointer > 0, 'the bank buffer is loaded'); // @math a loaded buffer has an address
  const [pointerAt, lengthAt, priorityAt] = N.copied.map(dword);
  for (const offset of N.copied) assert.equal(record.no[dword(offset)], record.puf[dword(offset)], `record 26 copies the dword +${offset} of record 18`);
  assert.equal(record.no[dword(N.zeroed)], 0, 'the parameter of NO is 0');
  assert.equal(record.no[dword(N.playCount)], 0, 'NO has not played');
  assert.equal(record.puf[pointerAt] - record.bufferPointer, slot.start, 'the pointer is where slot 18 starts in the bank');
  assert.equal(record.puf[lengthAt], slot.length, 'the length is the slot\'s');
  assert.equal(record.puf[priorityAt], L.priorityFirst - N.source, 'the priority is 27 less the record number');
  // The timer service: every period is the 0x12305e quotient of a rate, the speaker's is its argument's, and the divisor is the smallest period.
  assert.deepEqual(record.handlerColumns, T.columns);
  const col = { handler: T.columns.indexOf('handlerFromObject1'), period: T.columns.indexOf('period'), enabled: T.columns.indexOf('enabled') };
  assert.equal(record.listAt, T.listAt);
  assert.deepEqual(w.divisor.slice(0, 1), [T.divisorAt]);
  assert.equal(record.handlers.length, T.handlers.length, 'the registered handlers');
  record.handlers.forEach((h, k) => {
    assert.equal(h[col.handler], T.handlers[k].at, `handler ${k}`);
    assert.equal(h[col.period], Math.floor(R.periodDividend / T.handlers[k].rate), `the period of handler ${k} is the quotient of its rate`);
    assert.equal(h[col.enabled], 1, `handler ${k} is enabled`); // @math the enabled word is 1 for a handler the service runs
  });
  const speaker = record.handlers.filter(h => h[col.handler] === T.speaker);
  assert.equal(speaker.length, 1, 'one speaker handler');
  assert.equal(speaker[0][col.period], Math.floor(R.periodDividend / R.rateArgument), 'the speaker handler\'s period is the quotient of the argument 0x8c');
  assert.equal(w.divisor[1], Math.min(...record.handlers.map(h => h[col.period])), 'the divisor is the smallest period');
  assert.ok(w.divisor[1] <= speaker[0][col.period], 'the divisor is not above the speaker\'s period');
}

export default {
  id: 'obs-digital',
  claims: ['audio.digital-observed', 'audio.no-alias', 'audio.timer-observed'],
  obs: ['digital-1'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { await validate(ctx, ctx.obs('digital-1'), values()); },
  async discriminate(ctx) {
    const record = ctx.obs('digital-1'), V = values();
    const rec = patch => ({ ...record, ...patch }), word = (name, v) => rec({ words: { ...record.words, [name]: [record.words[name][0], v] } });
    const at = (name, k, v) => rec({ [name]: record[name].map((x, i) => (i === k ? v : x)) });
    const handler = (k, column, v) => rec({ handlers: record.handlers.map((h, i) => (i === k ? h.map((x, j) => (j === column ? v : x)) : h)) });
    const last = record.handlers.length - 1;
    return [
      { label: 'the digital flag on', fn: () => validate(ctx, word('flag', 1), V) },
      { label: 'sound mode 2', fn: () => validate(ctx, word('mode', V.M.secondBankMode), V) },
      { label: 'the sound word off', fn: () => validate(ctx, word('sound', 0), V) },
      { label: 'the engine sample loaded', fn: () => validate(ctx, word('engine', 1), V) },
      { label: 'a GIG voice loaded', fn: () => validate(ctx, at('voices', 2), V) }, // @math the third voice
      { label: 'the record of NO pointing one byte on', fn: () => validate(ctx, at('no', 0, record.no[0] + 1), V) }, // @math one byte
      { label: 'the record of NO with another priority', fn: () => validate(ctx, at('no', 3, record.no[3] + 1), V) }, // @math the priority word
      { label: 'the length of PUF changed', fn: () => validate(ctx, at('puf', 1, record.puf[1] + 1), V) }, // @math the length word
      { label: 'the speaker handler\'s period 8515', fn: () => validate(ctx, handler(last, 2, record.handlers[last][2] + 1), V) }, // @math the period word
      { label: 'the speaker handler disabled', fn: () => validate(ctx, handler(last, 4, 0), V) }, // @math the enabled word
      { label: 'a divisor above the smallest period', fn: () => validate(ctx, word('divisor', record.words.divisor[1] + 1), V) },
      { label: 'another CFG', fn: () => validate(ctx, rec({ cfg: { ...record.cfg, sha1: crc(new Uint8Array(1)) } }), V) },
    ];
  },
};
