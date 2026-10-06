// The clouds of the Enhanced presentation (docs/enhancements.md, Stage 3): layers of a cloud field over the track's sky. The sky picture of the
// game never moves; the clouds are taken as a plane above the track seen in perspective, which moves with the horizon strip as the car turns
// (the strip's scroll without its wraps, so no seam) and which the wind moves over the plane. This module only works out how much of each
// sky pixel a layer covers; composite.js mixes the colours.
import { CLOUDS } from './config.js';
import { createRandom } from './particles.js';
import { paletteColor } from './project.js';
import { models } from './models.js';

// A cloud field: `size` x `size` values in 0 to 1 that repeat both ways (value noise summed over CLOUDS.octaves, the coarsest of CLOUDS.cells
// cells across, each twice as fine as the one before and half as strong), from its own random source.
const fields = new Map();
export function cloudField(seed, size = CLOUDS.texture) {
  const key = `${seed}:${size}`;
  if (fields.has(key)) return fields.get(key);
  const out = new Float32Array(size * size), random = createRandom(CLOUDS.seed ^ seed), smooth = t => t * t * (3 - 2 * t); // @math smoothstep
  let amplitude = 1;
  for (let o = 0, cells = CLOUDS.cells; o < CLOUDS.octaves; o++, cells *= 2, amplitude /= 2) { // @math twice as many cells each octave, half as strong
    const lattice = Float32Array.from({ length: cells * cells }, () => random()), step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = Math.floor(gy), ty = smooth(gy - y0), r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = Math.floor(gx), tx = smooth(gx - x0), c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx, bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx;
        out[y * size + x] += (top + (bottom - top) * ty) * amplitude;
      }
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo); // stretched to the whole of 0 to 1
  fields.set(key, out);
  return out;
}

// The field value above which a part `share` of the field lies (its distribution, read once per field).
const quantiles = new WeakMap();
function above(field, share) {
  let q = quantiles.get(field);
  if (!q) { const sorted = Float32Array.from(field).sort(), steps = 256; q = Float32Array.from({ length: steps + 1 }, (_, i) => sorted[Math.min(Math.round((i / steps) * (sorted.length - 1)), sorted.length - 1)]); quantiles.set(field, q); } // @math the distribution in 256 steps
  return q[Math.round(Math.min(Math.max(1 - share, 0), 1) * (q.length - 1))];
}

// The bilinear sample of a field at (u, v) texels, repeating.
function sample(field, size, u, v) {
  const x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0, m = size - 1;
  const a = (x0 & m), b = ((x0 + 1) & m), r0 = (y0 & m) * size, r1 = ((y0 + 1) & m) * size;
  const top = field[r0 + a] + (field[r0 + b] - field[r0 + a]) * tx, bottom = field[r1 + a] + (field[r1 + b] - field[r1 + a]) * tx;
  return top + (bottom - top) * ty;
}

// The ordered-dither threshold of a pixel (the 4 x 4 Bayer matrix), in (0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; // @math the 4 x 4 Bayer matrix
const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; // @math four by four cells, sixteen thresholds

// How much of a bank a sky row may hold: none above its rows, fading in down to `top` rows below their first, full down to `base` rows above
// their last (the flat base), none below.
function profile(layer, y) {
  const [first, last] = layer.rows, smooth = t => { const c = Math.min(Math.max(t, 0), 1); return c * c * (3 - 2 * c); }; // @math smoothstep
  return smooth((y - first) / layer.top) * smooth((last - y) / layer.base);
}

// The cloud banks over the sky rows, written into `out` (one { alpha, light } per bank, each a Float32Array of width x skyRows: how much of the
// sky a cloud hides there, and whether it is its lit top (1) or its shaded base (0)): `amount` the track's cloud amount (0 to 1), `speed` its
// wind (0 to 1), `scroll` how far the sky has turned (screen pixels, the strip's scroll without its wraps), `time` the presentation clock (ms).
// Returns how many banks have any cover.
export function coverClouds(out, { amount, speed, scroll, time }) {
  const S = models().sky, W = S.width, H = S.skyRows, size = CLOUDS.texture, levels = CLOUDS.levels, lightSteps = CLOUDS.lightLevels - 1, seconds = time / 1000; // @math ms to seconds
  let banks = 0;
  CLOUDS.layers.forEach((layer, n) => {
    const { alpha, light } = out[n], cover = Math.min(Math.max(amount * layer.cover, 0), 1);
    alpha.fill(0); light.fill(0);
    if (cover <= 0) return;
    banks++;
    const field = cloudField(layer.seed), threshold = above(field, CLOUDS.coverage * cover ** CLOUDS.curve), soft = CLOUDS.soft;
    const [su, sv] = layer.scale, wind = layer.wind * speed * seconds, relief = CLOUDS.relief * sv;
    for (let y = Math.max(layer.rows[0], 0); y < Math.min(layer.rows[1], H); y++) {
      const p = profile(layer, y), row = y * W, v = (y - layer.rows[0]) * sv;
      if (p <= 0) continue;
      let u = scroll * su + wind;
      for (let x = 0; x < W; x++, u += su) {
        const d = sample(field, size, u, v) - (1 - p) * CLOUDS.edge, t = Math.min(Math.max((d - threshold) / soft, 0), 1);
        if (t <= 0) continue;
        const a = t * t * (3 - 2 * t) * layer.opacity, dither = bayer(x, y); // @math smoothstep over the soft edge
        alpha[row + x] = Math.min(Math.floor(a * levels + dither), levels) / levels; // a few steps of cover, dithered between
        const lit = Math.min(Math.max(0.5 + (sample(field, size, u, v + relief) - sample(field, size, u, v - relief)) * CLOUDS.reliefGain, 0), 1); // @math half lit where the field is as dense above as below
        light[row + x] = Math.min(Math.floor(lit * lightSteps + dither), lightSteps) / lightSteps;
      }
    }
  });
  return banks;
}

// The strip's sky: for each row of the horizon strip, which indices its sky-coloured background is drawn in (those of the sky picture's row
// under it, which every track's strip shares with it), as 256 flags a row (Uint8Array of horizonRows x 256): the lighting's gradient goes
// on over them, so the sky does not end at the strip's top.
const stripSkies = new WeakMap();
export function stripSkyIndices(world) {
  let flags = stripSkies.get(world.sky);
  if (flags) return flags;
  const S = models().sky, W = S.width;
  flags = new Uint8Array(S.horizonRows * 256); // @math a flag for each palette index
  for (let j = 0; j < S.horizonRows; j++) for (let x = 0; x < W; x++) flags[j * 256 + world.sky[(S.horizonRow + j) * W + x]] = 1; // @math a flag for each palette index
  stripSkies.set(world.sky, flags);
  return flags;
}

// The mean colour of each sky row of the track's sky picture (the colour a cloud's light and shade are taken against): Float32Array of
// skyRows x 3, 8-bit components.
const skyRows = new WeakMap();
export function skyRowColours(world) {
  let c = skyRows.get(world.sky);
  if (c) return c;
  const S = models().sky, W = S.width;
  c = new Float32Array(S.skyRows * 3); // @math three components a row
  for (let y = 0; y < S.skyRows; y++) {
    const sum = [0, 0, 0];
    for (let x = 0; x < W; x++) { const rgb = paletteColor(world, world.sky[y * W + x]); for (let k = 0; k < 3; k++) sum[k] += rgb[k]; } // @math three components
    for (let k = 0; k < 3; k++) c[y * 3 + k] = sum[k] / W; // @math three components
  }
  skyRows.set(world.sky, c);
  return c;
}
