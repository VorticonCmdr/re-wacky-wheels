import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { view } from '../../binary.js';
import { setupNames } from '../setup-keys.js';
import { expected } from '../expect.js';

const values = () => ({ n: expected('cfg.key-names'), keys: expected('cfg.default-keys'), cfg: expected('cfg.read') });

function validate(setup, file, V, name) {
  const N = V.n, K = V.keys, at = V.cfg.parts.slice(0, K.piece).reduce((s, p) => s + p.bytes, 0), names = setupNames(setup, N), words = view(file);
  assert.equal(file.length, V.cfg.size, `${name}: the file size of cfg.read`);
  const flat = K.players.flat();
  assert.equal(flat.length, N.entries, 'one name for each key word');
  flat.forEach((sc, i) => {
    const raw = file.subarray(N.tableAt + i * N.entryBytes, N.tableAt + (i + 1) * N.entryBytes), end = raw.indexOf(0), text = String.fromCharCode(...(end < 0 ? raw : raw.subarray(0, end)));
    assert.equal(words.getUint16(at + i * K.wordBytes, true), sc, `${name}: key word ${i}`);
    assert.ok(names.has(sc), `SETUP.EXE names scancode ${sc}`);
    assert.ok(names.get(sc).includes(text), `${name}: the name of key word ${i} is ${text}, SETUP names scancode ${sc} ${names.get(sc)}`);
  });
}

export default {
  id: 'cfg-key-names',
  claims: ['cfg.key-names'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const V = values(), setup = await ctx.open('SETUP.EXE'), paths = ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p));
    assert.equal(paths.length, V.keys.files, 'the installed WACKY.CFG files');
    for (const path of paths) validate(setup, await ctx.openPath(path), V, path);
  },
  async discriminate(ctx) {
    const V = values(), setup = await ctx.open('SETUP.EXE'), path = ctx.list().find(p => /(^|\/)wacky\.cfg$/i.test(p)), file = await ctx.openPath(path), n = patch => () => validate(setup, file, { ...V, n: { ...V.n, ...patch } }, path);
    return [
      { label: 'record code at +0x27', fn: n({ recordCodeOffset: V.n.recordCodeOffset - 1 }) },
      { label: 'record code at +0x29', fn: n({ recordCodeOffset: V.n.recordCodeOffset + 1 }) },
      { label: 'names at 0x7b3', fn: n({ tableAt: V.n.tableAt - 1 }) },
      { label: 'entries of 13 bytes', fn: n({ entryBytes: V.n.entryBytes - 1 }) },
      { label: 'entries of 15 bytes', fn: n({ entryBytes: V.n.entryBytes + 1 }) },
      { label: 'builder range ends early', fn: n({ to: V.n.from + V.n.nameBytes }) },
      { label: 'names of 3 bytes', fn: n({ nameBytes: 3 }) }, // @math too short for the longer names
    ];
  },
};
