// Helpers shared by the observation checks: member lookup the way the game does it (from claim
// values), CRC and little-endian packers, and tile slicing with explicit parameters.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { view } from '../binary.js';
import { crc32, hex8 } from '../evidence/crc32.js';

export const crc = bytes => hex8(crc32(bytes));
export const concat = parts => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };
export const words16 = list => { const out = new Uint8Array(list.length * 2), dv = view(out); list.forEach((v, i) => dv.setUint16(i * 2, v, true)); return out; }; // @math uint16 little-endian
export const dwords32 = list => { const out = new Uint8Array(list.length * 4), dv = view(out); list.forEach((v, i) => dv.setUint32(i * 4, v, true)); return out; }; // @math uint32 little-endian

// Find a member the way the game does, from the claim values: names at entry+nameAt (upper-cased
// request), data at the dword at entry+offsetAt plus seekBias, length from the dword at entry+sizeAt.
// `V` carries datLayout (dat.layout), lookup (dat.entry-lookup) and entrySize (dat.entry-size).
export function lookupMember(dat, name, V) {
  const L = V.datLayout, E = V.lookup, Z = V.entrySize, dv = view(dat), count = dv.getInt16(L.countAt, true);
  for (let i = 0; i < count; i++) {
    const at = L.countAt + L.countBytes + i * L.entrySize;
    let found = '';
    for (let k = E.nameAt; k < Z.sizeAt && dat[at + k] !== 0; k++) found += String.fromCharCode(dat[at + k]);
    if (found === name.toUpperCase()) {
      const start = dv.getUint32(at + E.offsetAt, true) + E.seekBias;
      return dat.subarray(start, start + dv.getUint32(at + Z.sizeAt, true));
    }
  }
  throw new Error(`${name} is not found by the lookup rule`);
}

// Cut a decoded sheet into tiles with explicit parameters (the product splitTiles uses the claim values).
export function slice(image, S) {
  const tiles = [];
  for (let t = 0; t < S.count; t++) {
    const x0 = (t % S.columns) * S.size, y0 = Math.floor(t / S.columns) * S.size, tile = new Uint8Array(S.size * S.size);
    for (let y = 0; y < S.size; y++) tile.set(image.indices.subarray((y0 + y) * image.width + x0, (y0 + y) * image.width + x0 + S.size), y * S.size);
    tiles.push(tile);
  }
  return concat(tiles);
}

// A record names the archive the game was running from. Another archive is not the observed build, so
// it fails here rather than as a wrong claim somewhere inside the record.
export function assertArchive(record, dat) {
  assert.equal(record.archive?.name, 'WACKY.DAT', 'the record names its archive');
  assert.equal(record.archive.size, dat.length, 'the archive is the size the game was run from');
  assert.equal(record.archive.sha1, createHash('sha1').update(dat).digest('hex'), 'the archive is the one the game was run from');
}
