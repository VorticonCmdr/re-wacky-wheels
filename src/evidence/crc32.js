// CRC-32 (IEEE, reflected) for citation fingerprints: fp = crc32 of the 16 pre-fixup bytes at the
// cited object offset, printed as 8 lowercase hex digits.
const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) { // @math table size: one entry per byte value
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; // @math IEEE 802.3 reflected polynomial
  TABLE[n] = c >>> 0;
}

export function crc32(data) {
  let c = 0xffffffff; // @math CRC-32 initial value and final xor
  for (const b of data) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); // @math byte mask and shift
  return (c ^ 0xffffffff) >>> 0; // @math CRC-32 final xor
}

export const FP_LENGTH = 16; // @math citation fingerprint width, fixed by docs/evidence.md
export const hex8 = n => n.toString(16).padStart(8, '0'); // @math 32-bit hex width

// CRC-32 of a stretch with the masked bytes zeroed.
export function maskedCrc(bytes, mask) {
  const copy = Uint8Array.from(bytes);
  mask.forEach((m, i) => { if (m) copy[i] = 0; });
  return hex8(crc32(copy));
}
