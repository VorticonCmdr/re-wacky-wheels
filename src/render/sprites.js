// Scaled sprites as the game draws them (sprite.blit, inf.layout): the pictures of a shape are the ten sizes stored in its .INF member, each a
// width, a height and, for every column, height + 1 dwords: the offset in the source frame of the column's first pixel and then, after each pixel,
// the step to the next one. The blitter reads the source frame column-major through those offsets, skips the index 0 and writes the rest down
// the screen at the picture's left column and top row.
import { K } from '../evidence/k.js';

const MODEL = () => K({ pictures: 10, headerBytes: 4, deltaBytes: 4, width: 320, height: 200, maxRow: 199, headerWords: 2, wordBytes: 2 }, 'sprite.model');

// The ten pictures of an .INF member: {w, h, deltas: Int32Array of (h + 1) x w}.
export function parseInf(data) {
  const S = MODEL(), view = new DataView(data.buffer, data.byteOffset, data.byteLength), out = [];
  let at = 0;
  for (let i = 0; i < S.pictures; i++) {
    if (at + S.headerBytes > data.length) throw new Error(`INF member ends before picture ${i}`);
    const w = view.getUint16(at, true), h = view.getUint16(at + S.wordBytes, true), count = (h + 1) * w, end = at + S.headerBytes + count * S.deltaBytes; // @math h + 1 dwords for each of w columns
    if (end > data.length) throw new Error(`INF picture ${i} (${w} x ${h}) overruns the member`);
    const deltas = new Int32Array(count);
    for (let k = 0; k < count; k++) deltas[k] = view.getInt32(at + S.headerBytes + k * S.deltaBytes, true);
    out.push({ w, h, deltas, bytes: data.subarray(at, end) });
    at = end;
  }
  if (at !== data.length && data.subarray(at).some(b => b !== 0)) throw new Error('INF member has bytes after its ten pictures');
  return out;
}

// Draw `picture` with the source frame `frame` (column-major bytes, the offsets index it) at (left, top); parts outside the picture area are clipped.
export function blitPicture(fb, picture, frame, left, top) {
  const S = MODEL(), { w, h, deltas } = picture;
  for (let i = 0; i < w; i++) {
    const x = left + i;
    let source = 0, at = i * (h + 1);
    source += deltas[at++];
    for (let j = 0; j < h; j++) {
      const y = top + j, pixel = frame[source];
      if (pixel !== 0 && x >= 0 && x < S.width && y >= 0 && y <= S.maxRow) fb[y * S.width + x] = pixel;
      source += deltas[at++];
    }
  }
  return fb;
}
