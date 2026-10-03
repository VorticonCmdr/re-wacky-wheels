// PCX members as the game's image loader and decoders read them (obj1+0x7060 and the two decoders;
// other loaders are untraced): header skipped, a fixed-size RLE picture, palette in the last bytes
// of the member (claims pcx.*). Stricter than the game where the game is silent: a run
// that overshoots the picture, a zero-count run, or a wrong trailer is an error, not a guess.
// decodePcx in src/pcx.js uses this decoder first and keeps a lenient general decoder for loose PCX files (manual pages) with other sizes.
import { bytes, need } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ header: 0x80, palette: 0x300, marker: 0x0c, runMask: 0xc0, countMask: 0x3f, width: 0x140, height: 0xc8 }, 'pcx.layout');
const SCALE = () => K({ shift: 0x02, bytes: 0x300 }, 'pcx.palette-scale');
const SHEET = () => K({ count: 0x36, size: 0x20, columns: 0x0a }, 'tiles.sheet-split');

// `layout` is exposed so the check can show that wrong rules are rejected on the real archive.
export function decodePcxWith(data, layout) {
  const b = bytes(data), L = layout;
  need(b, 0, L.header + L.palette, 'PCX member');
  const streamEnd = b.length - L.palette, total = L.width * L.height, indices = new Uint8Array(total);
  let at = L.header, out = 0;
  while (out < total) {
    if (at >= streamEnd) throw new Error('PCX stream ends before the picture is complete');
    const code = b[at++];
    if ((code & L.runMask) === L.runMask) {
      const count = code & L.countMask;
      if (!count) throw new Error(`PCX run with zero count at ${at - 1}`);
      if (at >= streamEnd) throw new Error('PCX run has no value byte');
      if (out + count > total) throw new Error('PCX run overshoots the picture');
      indices.fill(b[at++], out, out + count);
      out += count;
    } else indices[out++] = code;
  }
  if (streamEnd - at !== 1) throw new Error(`PCX stream leaves ${streamEnd - at} bytes before the palette, expected 1`);
  if (b[at] !== L.marker) throw new Error(`PCX trailer byte ${b[at]} is not the marker`);
  return { width: L.width, height: L.height, indices, palette: b.slice(streamEnd) };
}

// The 6-bit values the game's palette routine leaves in its buffer (each file byte >> shift).
export function vgaQuantize(palette) {
  const { shift } = SCALE();
  return Uint8Array.from(palette, v => v >> shift);
}

// `palette` is the file's 8-bit triplets; `vga` is what the game's palette buffer holds.
export function decodePcxMember(data) {
  const image = decodePcxWith(data, LAYOUT());
  return { ...image, vga: vgaQuantize(image.palette) };
}

// A decoded sheet cut into tiles, in the game's order (left to right, then top to bottom).
export function splitTiles({ width, height, indices }) {
  const { count, size, columns } = SHEET();
  if (Math.floor(width / size) < columns || Math.ceil(count / columns) * size > height) throw new Error('Image is too small for a tile sheet');
  return Array.from({ length: count }, (_, t) => {
    const tile = new Uint8Array(size * size), x0 = (t % columns) * size, y0 = Math.floor(t / columns) * size;
    for (let y = 0; y < size; y++) tile.set(indices.subarray((y0 + y) * width + x0, (y0 + y) * width + x0 + size), y * size);
    return tile;
  });
}
