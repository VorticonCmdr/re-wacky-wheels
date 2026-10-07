// The split screen of the two player modes at a geometry G of Stage 4 (geometry.js; docs/enhancements.md, Stage 4 as built): render/versus.js
// composeSplit and flipViewport for buffers of output rows. versus.layout's rows (LAYOUT: the viewers' first row, the second viewer's shift,
// an upside-down viewer's band) become s times as many output rows; a buffer holds `per` values an output row (G.W for a picture or a layer,
// 1 for the blit's row flags). At the reference geometry, for a picture or a layer, they call composeSplit and flipViewport themselves unless
// `force` (the checks' forced general path). The split screen is never wide (m = 0).
import { LAYOUT } from '../game/versus-rules.js';
import { composeSplit, flipViewport } from '../render/versus.js';
import { bandSample } from './geometry.js';

// The two viewers' output pictures cut into their halves of `out`: the first keeps its rows from s x viewRow down, the second moves up by
// s x shift rows (composeSplit's cut, s times the rows).
export function composeSplitAt(first, second, out, G, per = G.W, force = false) {
  if (G.identity && per === G.W && !force) return composeSplit(first, second, out);
  const L = LAYOUT(), s = G.s, from = s * L.viewRow * per, to = G.H * per;
  out.set(first.subarray(from, to), from);
  out.set(second.subarray(from, to), s * (L.viewRow - L.shift) * per);
  return out;
}

// The output rows of the viewer `seat` mirrored as flipViewport mirrors its band (the band's s x rows output rows from s times its first row).
export function flipViewportAt(buffer, seat, G, per = G.W, force = false) {
  if (G.identity && per === G.W && !force) return flipViewport(buffer, seat);
  const L = LAYOUT(), s = G.s, first = s * (seat === 0 ? L.flip.first : L.flip.first - L.shift), rows = s * L.flip.rows, keep = new buffer.constructor(per);
  for (let r = 0; r < rows >> 1; r++) { // @math the band's upper half swaps with its lower
    const a = (first + r) * per, b = (first + rows - 1 - r) * per;
    keep.set(buffer.subarray(a, a + per)); buffer.copyWithin(a, b, b + per); buffer.set(keep, b);
  }
  return buffer;
}

// The reference rows of the bands of the upside-down viewers (`flipped[seat]`), for geometry.js bandSample.
export function flippedBands(flipped) {
  const L = LAYOUT();
  return flipped.flatMap((f, seat) => (f ? [{ first: seat === 0 ? L.flip.first : L.flip.first - L.shift, rows: L.flip.rows }] : []));
}

// The canvas's map of the split screen once its upside-down viewers are mirrored (geometry.js bandSample).
export const splitSample = (G, flipped) => bandSample(G, flippedBands(flipped));
