import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { view } from '../../binary.js';
import { assertArchive, crc, words16 } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ state: expected('audio.speaker-state'), mode: expected('audio.mode-select'), player: expected('audio.speaker-player') });

// The CFG the game was started with is an installed WACKY.CFG with the sound-mode dword set to the first-bank mode.
async function findCfg(ctx, record, V) {
  for (const path of ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p))) {
    const bytes = Uint8Array.from(await ctx.openPath(path));
    view(bytes).setInt32(V.mode.modeFileOffset, V.mode.otherMode, true);
    if (createHash('sha1').update(bytes).digest('hex') === record.cfg.sha1) return bytes;
  }
  throw new Error('no installed WACKY.CFG, with the sound mode set, has the SHA-1 the record names');
}

// Cross-validate a `speaker` record: the run configuration, the device word equal to the sound mode, the player's idle words and its table.
async function validate(ctx, record, V) {
  const S = V.state, w = record.words;
  assertArchive(record, await ctx.open('WACKY.DAT'));
  assert.equal(record.cfg.offset, V.mode.modeFileOffset, 'the record names the CFG offset of the sound mode');
  await findCfg(ctx, record, V);
  assert.deepEqual(w.mode, [V.mode.modeAt, V.mode.otherMode], 'the sound mode word holds the first-bank mode');
  assert.deepEqual(w.device, [S.deviceAt, w.mode[1]], 'the library\'s device word equals the sound mode');
  assert.equal(S.device, w.mode[1], 'and that is the device the player dispatch names');
  assert.equal(S.device, V.player.speakerDevice, 'the PC-speaker device of audio.speaker-player');
  assert.deepEqual(w.byteMode, [S.byteModeAt, S.byteMode], 'the player is in byte mode');
  assert.deepEqual(w.callback, [S.callbackAt, 0], 'no completion callback is set');
  assert.deepEqual(w.error, [S.errorAt, 0], 'no library error is recorded');
  assert.equal(w.handle[0], S.handleAt);
  assert.ok(w.handle[1] >= 1, 'the handle counter is never below 1'); // @math the counter is reset to at least 1 (obj1+0x37282)
  for (const [at, name] of S.idle.map((a, i) => [a, ['remaining', 'pointer', 'priority'][i]])) assert.deepEqual(w[name], [at, 0], `${name}: no sound was playing`);
  assert.equal(record.tableOffset, S.tableAt);
  assert.equal(record.tableBytes, S.tableEntries * Uint16Array.BYTES_PER_ELEMENT, 'the table holds one word per byte value');
  assert.equal(S.tableStep, V.player.divisorStep, 'the step of audio.speaker-player');
  assert.equal(record.tableCrc, crc(words16(Array.from({ length: S.tableEntries }, (_, k) => k * S.tableStep))), 'the table holds 60 times its index');
}

export default {
  id: 'obs-speaker',
  claims: ['audio.speaker-state'],
  obs: ['speaker-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { await validate(ctx, ctx.obs('speaker-1'), values()); },
  async discriminate(ctx) {
    const record = ctx.obs('speaker-1'), V = values();
    const rec = patch => ({ ...record, ...patch }), word = (name, v) => rec({ words: { ...record.words, [name]: [record.words[name][0], v] } });
    const st = patch => ({ ...V, state: { ...V.state, ...patch } });
    return [
      { label: 'device word 6', fn: () => validate(ctx, word('device', 6), V) }, // @math a neighbouring device value
      { label: 'sound mode 2', fn: () => validate(ctx, word('mode', V.mode.secondBankMode), V) },
      { label: 'word mode', fn: () => validate(ctx, word('byteMode', 0), V) },
      { label: 'callback set', fn: () => validate(ctx, word('callback', 1), V) },
      { label: 'a sound playing', fn: () => validate(ctx, word('remaining', 1), V) },
      { label: 'handle counter 0', fn: () => validate(ctx, word('handle', 0), V) },
      { label: 'table step 59', fn: () => validate(ctx, record, st({ tableStep: V.state.tableStep - 1 })) },
      { label: 'table step 61', fn: () => validate(ctx, record, st({ tableStep: V.state.tableStep + 1 })) },
      { label: 'table of 255 entries', fn: () => validate(ctx, record, st({ tableEntries: V.state.tableEntries - 1 })) },
      { label: 'other CFG', fn: () => validate(ctx, rec({ cfg: { ...record.cfg, sha1: crc(new Uint8Array(1)) } }), V) },
    ];
  },
};
