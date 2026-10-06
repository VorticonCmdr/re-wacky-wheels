// The last step of the Enhanced presentation: the indexed picture through the frame's palette (the palette cycle and the demo's fade
// included), then on the world's pixels only the shadows on the ground, the distance fog and the particles. The pixels the overlays drew
// (the HUD, the overhead map, the finish labels, the messages, the menus, the split screen's strips) are taken as they are: the overlay
// code draws a second time into a buffer of sentinels, and whatever it wrote there is the mask.
import { KIND } from './project.js';
import { floorDepths } from './project.js';
import { FOG, SHADOW, SUN } from './config.js';
import { models } from './models.js';

export const SENTINEL = 0x100; // @math one past the largest palette index: a pixel no overlay wrote

// The atmospheric colour of a track: the mean of the top rows of its horizon strip (the sky just above the scenery, the colour the
// distance fades into), pulled toward its own grey.
const fogCache = new WeakMap();
export function fogColor(world) {
  let c = fogCache.get(world.par);
  if (c) return c;
  const S = models().sky, sum = [0, 0, 0], count = S.parRowPixels * FOG.stripRows;
  for (let i = 0; i < count; i++) { const v = world.par[i]; for (let k = 0; k < 3; k++) { const x = world.palette[v * 3 + k]; sum[k] += (x << 2) | (x >> 4); } } // @math three components; 6 bits widened to 8
  const mean = sum.map(s => s / count), grey = (mean[0] + mean[1] + mean[2]) / 3; // @math the mean of three components
  c = mean.map(m => m + (grey - m) * FOG.neutral);
  fogCache.set(world.par, c);
  return c;
}

// The fog's blend by distance (a table over the whole units of the distance the draw list sorts by): nothing to `start` of the floor's
// farthest distance, `amount` at the floor's far edge, the same beyond it.
export function fogRamp(world, strength) {
  const V = models().view, far = floorDepths(world).far, near = far * FOG.start, table = new Float32Array(V.maxDistance + 2); // @math every whole distance to the farthest drawn, and one past it
  for (let d = 0; d < table.length; d++) { const t = Math.min(Math.max((d - near) / (far - near), 0), 1); table[d] = FOG.amount * strength * t ** FOG.curve; }
  return table;
}

// The mask of the overlay pixels: 1 where the overlay pass wrote into the sentinel buffer.
export function overlayMask(buffer, mask) {
  for (let i = 0; i < buffer.length; i++) mask[i] = buffer[i] !== SENTINEL ? 1 : 0;
  return mask;
}

const mixInto = (c, target, t) => [c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t]; // @math the three components

// out: RGBA bytes of the screen. `index` the indexed picture with the overlays, `mask` the overlay pixels, `L` the composed layers, `palette`
// the RGBA palette of the frame, `effects` { shadow: strength or 0, fog: { color, ramp, horizon } or null, cap: the largest component
// (the demo's fade) }, `splats` the particle discs with `map` (the row of the viewer's picture to the screen row, or -1).
export function composite(out, { index, mask, L, palette, width, effects, splats = [] }) {
  const { shadow, fog, cap = 255 } = effects, darken = SHADOW.opacity * shadow, sunDarken = SUN.opacity * shadow; // @math the brightest 8-bit component
  const fogC = fog ? fog.color.map(v => Math.min(v, cap)) : null, ramp = fog?.ramp, last = ramp ? ramp.length - 1 : 0;
  for (let i = 0; i < index.length; i++) {
    const p = index[i] * 4, o = i * 4; // @math four bytes a colour
    let r = palette[p], g = palette[p + 1], b = palette[p + 2]; // @math the three components
    if (!mask[i]) {
      const kind = L.kind[i];
      if (kind === KIND.floor) { // the ground: the shadows (the darker of contact and sun), then the skid marks
        const dark = Math.max(L.shade[i] * darken, L.cast[i] * sunDarken), m = (1 - dark) * (1 - L.mark[i]);
        if (m !== 1) { r *= m; g *= m; b *= m; }
      }
      if (fogC && kind !== KIND.sky) {
        const t = kind === KIND.horizon ? fog.horizon : ramp[Math.min(Math.round(L.depth[i]), last)];
        r += (fogC[0] - r) * t; g += (fogC[1] - g) * t; b += (fogC[2] - b) * t; // @math the three components
      }
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; // @math opaque
  }
  const height = index.length / width;
  for (const s of splats) {
    const base = s.color.map(v => Math.min(v, cap)), color = fogC ? mixInto(base, fogC, ramp[Math.min(Math.round(s.depth), last)]) : base;
    const y0 = Math.floor(s.y - s.r), y1 = Math.ceil(s.y + s.r), x0 = Math.max(Math.floor(s.x - s.r), 0), x1 = Math.min(Math.ceil(s.x + s.r), width - 1);
    for (let y = y0; y <= y1; y++) {
      const row = s.map(y);
      if (row < 0 || row >= height) continue;
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - s.x) / s.r, v = (y + 0.5 - s.y) / s.r, q = u * u + v * v; // @math the pixel's middle
        if (q >= 1) continue;
        const i = row * width + x;
        if (mask[i] || (L.kind[i] === KIND.sprite && L.depth[i] < s.depth)) continue; // under the overlays, behind a nearer picture
        const a = s.alpha * (s.soft ? 1 - q : 1), o = i * 4; // @math four bytes a colour
        out[o] += (color[0] - out[o]) * a; out[o + 1] += (color[1] - out[o + 1]) * a; out[o + 2] += (color[2] - out[o + 2]) * a; // @math the three components
      }
    }
  }
  return out;
}
