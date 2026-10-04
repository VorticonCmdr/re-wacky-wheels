// Test inputs for pcx.rle-rule-vga (tools/dosbox/make-test-pcx.mjs writes them to the run copy, the check rebuilds them from the user's archive and compares hashes):
// a member's picture re-encoded by an encoding no archive file uses, as the game-style RLE of pcx.layout: runs of up to 63 pixels that cross the row boundaries, and optionally a run with
// the count 0 and the value 0x55 before the first pixel and after every 40th token.
import { decodePcxMember } from '../formats/pcx.js';
import { replaceMember } from './patch.js';

export const ZERO_VALUE = 0x55; // @math the value byte of the zero-count runs
export const ZERO_EVERY = 40; // @math tokens between two zero-count runs

export function encodeCrossing(indices, { zero }) {
  const tokens = [];
  for (let i = 0; i < indices.length;) {
    let n = 1; while (i + n < indices.length && n < 63 && indices[i + n] === indices[i]) n++; // @math the longest run a count of 6 bits holds
    tokens.push(n === 1 && indices[i] < 0xc0 ? [indices[i]] : [0xc0 | n, indices[i]]); // @math a literal below the run marker, else the run marker with the count
    i += n;
  }
  const stream = []; let count = 0;
  if (zero) stream.push(0xc0, ZERO_VALUE); // @math the run marker with the count 0
  for (const t of tokens) { stream.push(...t); if (zero && ++count % ZERO_EVERY === 0) stream.push(0xc0, ZERO_VALUE); } // @math the run marker with the count 0
  return Uint8Array.from(stream);
}

// The member with its RLE stream replaced; the 128 byte header and the marker plus 768 byte palette stay.
export function crossingMember(member, { zero }) {
  const { indices } = decodePcxMember(member), stream = encodeCrossing(indices, { zero }), header = member.subarray(0, 0x80), tail = member.subarray(member.length - 0x301); // @math the header and the marker byte plus the palette
  const out = new Uint8Array(header.length + stream.length + tail.length);
  out.set(header); out.set(stream, header.length); out.set(tail, header.length + stream.length);
  return out;
}

export const crossingArchive = (dat, name, member, opts) => replaceMember(dat, name, crossingMember(member, opts));
