import assert from 'node:assert/strict';
import { setupNames } from '../setup-keys.js';
import { assertSetupExe } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ c: expected('setup.cfg-observed'), names: expected('cfg.key-names'), keys: expected('cfg.default-keys') });
const map = r => new Map(r.changes.map(([at, from, to]) => [at, [from, to]]));

function validate(setup, a, b, V, { keyAt = V.c.keys.at, step = V.c.volumes.step } = {}) {
  const C = V.c, ca = map(a), cb = map(b);
  assertSetupExe(a, setup); assertSetupExe(b, setup);
  assert.equal(a.cfg.size, expected('cfg.read').size, 'the file size of cfg.read');
  // Detail levels run (setup-3): exactly the two words change.
  assert.deepEqual([...cb.keys()].sort((x, y) => x - y), [C.detail.single.at, C.detail.split.at], 'the detail run changes exactly the two detail words');
  assert.deepEqual(cb.get(C.detail.single.at), [C.detail.single.from, C.detail.medium], 'single screen: Medium stored as 2');
  assert.deepEqual(cb.get(C.detail.split.at), [C.detail.split.from, C.detail.low], 'split screen: Low stored as 3');
  // Sound and keys run (setup-2): the named words, and nothing else but the key names.
  const names = [...Array(V.keys.words).keys()].map(k => V.names.tableAt + k * V.names.entryBytes);
  const expectedAt = [...Array(V.keys.words).keys()].map(k => keyAt + k * V.keys.wordBytes);
  const known = [...expectedAt, C.music.at, C.music.companion.at, C.voices.at, C.mixing.at, C.volumes.fx.at, C.volumes.music.at, C.volumes.engine.at];
  const nameBytes = [...ca.keys()].filter(at => !known.includes(at)).sort((x, y) => x - y);
  assert.deepEqual(nameBytes, names.flatMap(at => [at, at + 1]), 'the other changed bytes are the first two bytes of the six key names'); // @math each new name is a letter and a NUL over the old name's first two bytes
  assert.equal(ca.size, known.length + nameBytes.length, 'no other byte changed');
  assert.deepEqual(ca.get(C.music.at), [C.music.from, C.music.value], 'music device Adlib is the card number 2');
  assert.deepEqual(ca.get(C.music.companion.at), [C.music.companion.from, C.music.companion.value], 'its companion word');
  assert.deepEqual(ca.get(C.voices.at), [C.voices.from, C.voices.value], 'Two voices stores 2');
  assert.deepEqual(ca.get(C.mixing.at), [C.mixing.from, C.mixing.value], 'Eight bit mixing stores 8');
  for (const [name, v] of Object.entries(C.volumes).filter(([n]) => n !== 'step')) {
    assert.deepEqual(ca.get(v.at), [v.from, v.to], `the ${name} volume`);
    assert.equal(v.from - v.to, v.taps * step, `${name}: ${v.taps} presses of LEFT lower it by ${step} each`);
  }
  // The keys: the six words hold the scancodes of the letters Q to Y in SETUP's own table, and each name's first byte is that letter.
  const codes = new Map(setupNames(setup, V.names)), letters = C.keys.letters;
  expectedAt.forEach((at, k) => {
    assert.deepEqual(ca.get(at), [C.keys.from[k], C.keys.to[k]], `key word ${k}`);
    assert.ok(codes.get(C.keys.to[k])?.includes(letters[k]), `SETUP names the scancode ${C.keys.to[k]} ${letters[k]}`);
    assert.equal(ca.get(names[k])[1], letters[k].charCodeAt(0), `the name of key ${k} starts with ${letters[k]}`);
    assert.equal(ca.get(names[k] + 1)[1], 0, 'and ends there');
    assert.equal(C.keys.from[k], V.keys.players[0][k], 'the old word was the default key');
  });
  assert.deepEqual(C.keys.labels, ['Steer   left', 'Steer   right', 'Button1 accelerate', 'Button2 fire', 'Button3 brake', 'Button4 hand brake turn'], 'the six controls of the screen, in the order of the key words');
}

export default {
  id: 'obs-setupcfg',
  claims: ['setup.cfg-observed'],
  obs: ['setup-2', 'setup-3'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('SETUP.EXE'), ctx.obs('setup-2'), ctx.obs('setup-3'), values()); },
  async discriminate(ctx) {
    const setup = await ctx.open('SETUP.EXE'), a = ctx.obs('setup-2'), b = ctx.obs('setup-3'), V = values(), C = V.c;
    return [
      { label: 'a step of 4 per press', fn: () => validate(setup, a, b, V, { step: C.volumes.step - 1 }) },
      { label: 'the key words 2 bytes on', fn: () => validate(setup, a, b, V, { keyAt: C.keys.at + 2 }) }, // @math the next word
      { label: 'a voice count altered', fn: () => validate(setup, { ...a, changes: a.changes.map(c => (c[0] === C.voices.at ? [c[0], c[1], c[2] + 2] : c)) }, b, V) }, // @math the next choice
      { label: 'an extra changed byte', fn: () => validate(setup, { ...a, changes: [...a.changes, [0x100, 0, 1]] }, b, V) }, // @math a byte the run did not change
      { label: 'the detail run with a third change', fn: () => validate(setup, a, { ...b, changes: [...b.changes, [0x100, 0, 1]] }, V) }, // @math a byte the run did not change
      { label: 'another program', fn: () => validate(setup, { ...a, exe: { ...a.exe, sha1: '0'.repeat(40) } }, b, V) }, // @math a SHA-1 is 40 hex digits
    ];
  },
};
