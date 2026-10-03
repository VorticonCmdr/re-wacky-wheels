import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ n: expected('cfg.key-names'), keys: expected('cfg.default-keys'), cfg: expected('cfg.read') });

// SETUP.EXE's key table builder (a run of `mov edi, dst; mov esi, name; ... movs` blocks and `mov byte [addr], code` stores):
// the record that starts at dst holds the name copied from obj2+name and the scancode stored at dst + recordCodeOffset.
function setupNames(setup, N) {
  const { le } = locateLe(setup), code = le.objects[0].data, data = le.objects[1].data, dv = view(code), byCode = new Map(), stores = new Map(), blocks = [];
  for (let i = N.from; i < N.to;) {
    if (code[i] === N.movEdi && code[i + N.movLength] === N.movEsi) { blocks.push({ at: i, dst: dv.getUint32(i + 1, true), src: dv.getUint32(i + 1 + N.movLength, true) }); i += 2 * N.movLength; continue; } // @math the two movs
    if (code[i] === N.store[0] && code[i + 1] === N.store[1]) { stores.set(dv.getUint32(i + 2, true), code[i + N.storeLength - 1]); i += N.storeLength; continue; } // @math opcode + modrm, then the address dword; the immediate ends the instruction
    i++;
  }
  assert.equal(blocks[0].at, N.from, 'the builder starts with its first block');
  assert.equal(blocks.at(-1).at + 2 * N.movLength, N.to, 'and ends with its last block'); // @math the two movs
  for (const { dst, src } of blocks) {
    if (src + N.nameBytes <= data.length && stores.has(dst + N.recordCodeOffset)) assert.equal(data[src + N.nameBytes - 1], 0, 'a name field ends with a NUL in its last byte');
    const sc = stores.get(dst + N.recordCodeOffset); if (sc === undefined) continue;
    const name = String.fromCharCode(...data.subarray(src, src + N.nameBytes).filter((b, k, a) => a.indexOf(0) < 0 || k < a.indexOf(0))).trimEnd();
    byCode.set(sc, [...(byCode.get(sc) ?? []), name]); // the keypad keys share the scancodes of the cursor keys
  }
  return byCode;
}

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
