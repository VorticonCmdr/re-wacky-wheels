// The far range of the Enhanced presentation (docs/enhancements.md, Stage 3): a second horizon of hills or mountains far behind the horizon
// strip's scenery, in the haze (RANGE in config.js). Its profile repeats every RANGE.period pixels and it turns with the strip at a part of the
// strip's scroll (without its wraps), so it moves slower than the strip's scenery and a full turn has no seam. This module works out which
// pixels it covers and their light; composite.js puts it on the track's sky and on the strip's sky-coloured pixels, behind the clouds.
import { RANGE, CLOUDS } from './config.js';
import { createRandom } from './particles.js';
import { bayer } from './clouds.js';
import { models } from './models.js';

// The profile of a shape: RANGE.period heights from its `low` to 1 (value noise over a lattice that repeats, its octaves folded into ridges
// for the mountains), from its own random source.
const profiles = new Map();
export function rangeProfile(shape) {
  if (profiles.has(shape)) return profiles.get(shape);
  const s = RANGE.shapes[shape], n = RANGE.period, out = new Float32Array(n), random = createRandom(RANGE.seed ^ (RANGE.names.indexOf(shape) + 1)), smooth = t => t * t * (3 - 2 * t); // @math smoothstep; the shapes' seeds apart
  let amplitude = 1;
  for (let o = 0, cells = s.cells; o < s.octaves; o++, cells *= 2, amplitude /= 2) { // @math twice as many cells each octave, half as strong
    const lattice = Float32Array.from({ length: cells }, () => random()), step = n / cells;
    for (let x = 0; x < n; x++) {
      const g = x / step, i = Math.floor(g), a = lattice[i % cells], b = lattice[(i + 1) % cells], v = a + (b - a) * smooth(g - i);
      out[x] += (s.ridged ? (1 - Math.abs(2 * v - 1)) ** 2 : v) * amplitude; // @math a ridge where the noise crosses its middle, sharpened by the square
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let x = 0; x < n; x++) out[x] = s.low + (1 - s.low) * ((out[x] - lo) / (hi - lo));
  profiles.set(shape, out);
  return out;
}

// The profile at a fractional position, repeating.
function at(profile, p) {
  const n = profile.length, q = ((p % n) + n) % n, i = Math.floor(q), t = q - i;
  return profile[i] + (profile[(i + 1) % n] - profile[i]) * t;
}

// The far range over the screen's rows down to the strip's last (`out` { alpha, tone, snow }, each width x (skyRows + horizonRows)): alpha 1
// where it stands (its top edge dithered by how much of the pixel it covers), its light (0 shaded, 1 lit, in RANGE.levels steps, dithered
// where the light lies near the middle between two)
// and 1 where its top is snow. `height` the track's range (0 to 1), `shape` one of RANGE.names, `scroll` how far the sky has turned (screen
// pixels, the strip's scroll without its wraps). Returns whether it stands anywhere.
export function coverRange(out, { height, shape, scroll }) {
  const S = models().sky, W = S.width, foot = S.horizonRow + S.horizonRows - 1, s = RANGE.shapes[shape], rows = s ? height * s.rows : 0, steps = RANGE.levels - 1;
  out.alpha.fill(0);
  if (!(rows > 0)) return false;
  const profile = rangeProfile(shape), snowLine = s.snow === null ? Infinity : s.snow * rows;
  for (let x = 0; x < W; x++) {
    const p = x + scroll * RANGE.parallax, h = at(profile, p) * rows, slope = ((at(profile, p + RANGE.reach) - at(profile, p - RANGE.reach)) * rows) / (2 * RANGE.reach); // @math the central difference over the reach: rows a pixel
    const crest = foot + 1 - h, light = Math.min(Math.max(0.5 + slope * RANGE.relief, 0), 1); // @math the row below the foot, less the height; half lit on the flat
    for (let y = Math.max(Math.floor(crest), 0); y <= foot; y++) {
      const d = bayer(x, y), cover = Math.min(y + 1 - crest, 1); // @math the part of the pixel's row below the crest
      if (cover < 1 && cover <= d) continue;
      const i = y * W + x;
      out.alpha[i] = 1;
      out.tone[i] = Math.min(Math.max(Math.round(light * steps + (d - 0.5) * RANGE.dither), 0), steps) / steps; // @math dithered only near the middle between two steps
      out.snow[i] = foot + 1 - y + (d - 0.5) * 2 > snowLine ? 1 : 0; // @math a dithered snow line, a pixel either way
    }
  }
  return true;
}

// The colours of the far range per row (Float32Arrays of rows x 3): `sky` the sky's colour of each row (the lighting's gradient included),
// `haze` the track's haze (its fog colour), every component at most `cap`. Returns { lit, shade, snow }.
export function rangeColours(sky, haze, cap) {
  const S = models().sky, foot = S.horizonRow + S.horizonRows - 1, n = sky.length / 3, deep = haze.map(v => v * (1 - RANGE.dark)); // @math three components a row
  const lit = new Float32Array(n * 3), shade = new Float32Array(n * 3), snow = new Float32Array(n * 3); // @math three components a row
  for (let y = 0; y < n; y++) {
    const k = y * 3, mist = RANGE.mistAmount * Math.min(Math.max(1 - (foot - y) / RANGE.mist, 0), 1), grey = (sky[k] + sky[k + 1] + sky[k + 2]) / 3 / 0xff; // @math three components a row; 8-bit to 0 to 1
    const white = RANGE.snowLight * Math.min(Math.max(grey / CLOUDS.brightSky, CLOUDS.dimLight), 1);
    for (let c = 0; c < 3; c++) { // @math the three components
      const body = sky[k + c] + (deep[c] - sky[k + c]) * RANGE.haze, mistOf = v => Math.min(v + (haze[c] - v) * mist, cap);
      lit[k + c] = mistOf(body + (sky[k + c] - body) * RANGE.lit);
      shade[k + c] = mistOf(body + (deep[c] - body) * RANGE.shade);
      const bright = sky[k + c] + (0xff - sky[k + c]) * white; // @math toward white
      snow[k + c] = mistOf(bright + (body - bright) * RANGE.snowHaze);
    }
  }
  return { lit, shade, snow };
}
