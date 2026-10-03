import assert from 'node:assert/strict';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ keys: expected('cfg.default-keys'), cfg: expected('cfg.read') });

// The second piece of WACKY.CFG (cfg.read) holds the key table: six 16-bit scancodes for each of two players.
function validate(file, V, name) {
  const K = V.keys, piece = V.cfg.parts[K.piece], at = V.cfg.parts.slice(0, K.piece).reduce((n, p) => n + p.bytes, 0), dv = view(file);
  assert.equal(file.length, V.cfg.size, `${name}: the file size of cfg.read`);
  assert.equal(piece.offset, K.tableAt, 'the table is the piece the game reads to this address');
  assert.equal(piece.bytes, K.players.length * K.words * K.wordBytes, 'the piece is the keys of every player');
  K.players.forEach((codes, p) => {
    const keys = Array.from({ length: K.words }, (_, i) => dv.getUint16(at + (p * K.words + i) * K.wordBytes, true));
    assert.deepEqual(keys, codes, `${name}: player ${p + 1}'s key words`);
  });
}

export default {
  id: 'cfg-keys',
  claims: ['cfg.default-keys'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const V = values(), paths = ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p));
    assert.equal(paths.length, V.keys.files, 'the installed WACKY.CFG files');
    for (const path of paths) validate(await ctx.openPath(path), V, path);
  },
  async discriminate(ctx) {
    const V = values(), path = ctx.list().find(p => /(^|\/)wacky\.cfg$/i.test(p)), file = await ctx.openPath(path), k = patch => () => validate(file, { ...V, keys: { ...V.keys, ...patch } }, path);
    return [
      { label: 'players swapped', fn: k({ players: [...V.keys.players].reverse() }) },
      { label: 'first key changed', fn: k({ players: [[V.keys.players[0][0] + 1, ...V.keys.players[0].slice(1)], V.keys.players[1]] }) },
      { label: 'keys rotated by one', fn: k({ players: V.keys.players.map(p => [...p.slice(1), p[0]]) }) },
      { label: 'the first piece instead', fn: k({ piece: V.keys.piece - 1 }) },
      { label: 'wrong file size', fn: () => validate(file.subarray(1), V, path) },
    ];
  },
};
