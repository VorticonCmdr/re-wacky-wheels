import assert from 'node:assert/strict';
import { locateLe } from '../formats/le.js';
import { view } from '../binary.js';

// SETUP.EXE's key table builder (a run of `mov edi, dst; mov esi, name; ... movs` blocks and `mov byte [addr], code` stores):
// the record that starts at dst holds the name copied from obj2+name and the scancode stored at dst + recordCodeOffset.
export function setupNames(setup, N) {
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
