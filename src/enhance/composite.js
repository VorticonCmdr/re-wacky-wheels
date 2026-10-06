// The last step of the Enhanced presentation: the indexed picture through the frame's palette (the palette cycle and the demo's fade
// included), then on the world's pixels only the track's sky (the lighting's gradient, the far range and the clouds), the water, the relief's
// light on the ground and the pictures, the shadows on the ground, the distance fog, the particles and last the lighting grade. The pixels the overlays drew (the HUD, the overhead map, the finish labels, the messages,
// the menus, the split screen's strips) are taken as they are: the overlay code draws a second time into a buffer of sentinels, and
// whatever it wrote there is the mask. The sky rows are the track's sky only in a single view of a race: the split screen's are the strips'
// picture and a demo's slide its page, which the enhancer marks by giving no `sky` and a grade without its sky.
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
// the RGBA palette of the frame, `effects` { shadow: strength or 0, fog: { color, ramp, horizon } or null, sky: the track's sky or null,
// water: the water's colours or null, relief: whether the layer `relief` lights the ground and the pictures, grade: the lighting or null,
// cap: the largest component (the demo's fade) }, `splats` the particle
// discs with `map` (the row of the viewer's picture to the screen row, or -1). `sky` is { rows, stripRows, strip, tint: { colours, amount } or
// null, range: { cover: { alpha, tone, snow }, colours: { lit, shade, snow } } or null, clouds: [{ alpha, light, lit, shade }] }: per sky row (and strip row) the colour
// the lighting mixes the sky toward, `strip` the strip's sky indices (clouds.js stripSkyIndices: the lighting's gradient and the far range go
// on over them), the far range's cover and light per pixel and its colours per row (ranges.js), per sky row each bank's lit and shaded
// colour, per pixel each bank's cover and light. `water` is { sky, highlight, glow, reflect (a table by distance) or null }: where the layer
// `wet` marks water (1) or the red liquid (2), the water mirrors `sky` by its distance, and the layer `wave` darkens (below 0) or goes toward
// `highlight` (water) or `glow` (the red liquid). `grade` is grade.js gradeOf's with `trackSky`: whether the sky rows are the track's sky.
export function composite(out, { index, mask, L, palette, width, effects, splats = [] }) {
  const { shadow, fog, sky = null, water = null, relief = false, grade = null, cap = 255 } = effects, darken = SHADOW.opacity * shadow, sunDarken = SUN.opacity * shadow; // @math the brightest 8-bit component
  const fogC = fog ? fog.color.map(v => Math.min(v, cap)) : null, ramp = fog?.ramp, last = ramp ? ramp.length - 1 : 0, skyEnd = sky ? sky.rows * width : 0, stripEnd = sky?.strip ? (sky.rows + sky.stripRows) * width : 0;
  const range = sky?.range ?? null, rangeAlpha = range?.cover.alpha, rangeTone = range?.cover.tone, rangeSnow = range?.cover.snow, rangeLit = range?.colours.lit, rangeShade = range?.colours.shade, rangeWhite = range?.colours.snow;
  const wet = water ? L.wet : null, wave = L.wave, reflect = water?.reflect ?? null, reflectLast = reflect ? reflect.length - 1 : 0, mirror = water?.sky, highlight = water?.highlight, glow = water?.glow;
  for (let i = 0; i < index.length; i++) {
    const p = index[i] * 4, o = i * 4; // @math four bytes a colour
    let r = palette[p], g = palette[p + 1], b = palette[p + 2]; // @math the three components
    if (!mask[i]) {
      const kind = L.kind[i];
      let ranged = false;
      if (i < skyEnd && kind === KIND.sky) { // the track's sky: the lighting's gradient, the far range, then the clouds over them
        const k = Math.floor(i / width) * 3, t = sky.tint; // @math three components a row
        if (t) { r += (t.colours[k] - r) * t.amount; g += (t.colours[k + 1] - g) * t.amount; b += (t.colours[k + 2] - b) * t.amount; } // @math the three components
        if (range && rangeAlpha[i]) {
          if (rangeSnow[i]) { r = rangeWhite[k]; g = rangeWhite[k + 1]; b = rangeWhite[k + 2]; } // @math the three components
          else { const v = rangeTone[i]; r = rangeShade[k] + (rangeLit[k] - rangeShade[k]) * v; g = rangeShade[k + 1] + (rangeLit[k + 1] - rangeShade[k + 1]) * v; b = rangeShade[k + 2] + (rangeLit[k + 2] - rangeShade[k + 2]) * v; } // @math the three components
        }
        for (const c of sky.clouds) { // the banks over it
          const a = c.alpha[i]; if (!(a > 0)) continue;
          const l = c.light[i], cr = c.shade[k] + (c.lit[k] - c.shade[k]) * l, cg = c.shade[k + 1] + (c.lit[k + 1] - c.shade[k + 1]) * l, cb = c.shade[k + 2] + (c.lit[k + 2] - c.shade[k + 2]) * l; // @math the three components
          r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a;
        }
        r = Math.min(r, cap); g = Math.min(g, cap); b = Math.min(b, cap); // never above the demo's fade
      }
      else if (i < stripEnd && kind === KIND.horizon) { // the strip's sky-coloured background: the gradient and the far range go on over it, as over the sky above
        const row = Math.floor(i / width), t = sky.tint;
        if (sky.strip[(row - sky.rows) * 256 + index[i]]) { // @math a flag for each palette index
          const k = row * 3; // @math three components a row
          if (t) { r += (t.colours[k] - r) * t.amount; g += (t.colours[k + 1] - g) * t.amount; b += (t.colours[k + 2] - b) * t.amount; } // @math the three components
          if (range && rangeAlpha[i]) { // the range's own haze: no strip fog over it, so it meets its part above the strip without a step
            ranged = true;
            if (rangeSnow[i]) { r = rangeWhite[k]; g = rangeWhite[k + 1]; b = rangeWhite[k + 2]; } // @math the three components
            else { const v = rangeTone[i]; r = rangeShade[k] + (rangeLit[k] - rangeShade[k]) * v; g = rangeShade[k + 1] + (rangeLit[k + 1] - rangeShade[k + 1]) * v; b = rangeShade[k + 2] + (rangeLit[k + 2] - rangeShade[k + 2]) * v; } // @math the three components
          }
          r = Math.min(r, cap); g = Math.min(g, cap); b = Math.min(b, cap); // never above the demo's fade
        }
      }
      if (relief && (kind === KIND.floor || kind === KIND.sprite)) { const f = L.relief[i]; if (f !== 1) { r = Math.min(r * f, cap); g = Math.min(g * f, cap); b = Math.min(b * f, cap); } } // the relief's light, within the demo's fade
      if (kind === KIND.floor) { // the ground: the water, the shadows (the darker of contact and sun), then the skid marks
        if (wet !== null && wet[i] !== 0) {
          if (wet[i] === 1 && reflect !== null) { const t = reflect[Math.min(Math.round(L.depth[i]), reflectLast)]; r += (mirror[0] - r) * t; g += (mirror[1] - g) * t; b += (mirror[2] - b) * t; } // @math the three components
          const v = wave[i];
          if (v < 0) { r *= 1 + v; g *= 1 + v; b *= 1 + v; }
          else if (v > 0) { const h = wet[i] === 1 ? highlight : glow; r += (h[0] - r) * v; g += (h[1] - g) * v; b += (h[2] - b) * v; } // @math the three components
        }
        const dark = Math.max(L.shade[i] * darken, L.cast[i] * sunDarken), m = (1 - dark) * (1 - L.mark[i]);
        if (m !== 1) { r *= m; g *= m; b *= m; }
      }
      if (fogC && kind !== KIND.sky && !ranged) {
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
  if (grade) { // the lighting, last: over the particles too, never over the overlays nor over sky rows that are not the track's sky (grade.js gradePixel, inlined); the pictures and the red liquid get its weaker part
    const world = grade.lut, worldSat = grade.saturation, pictures = grade.sprite.lut, picturesSat = grade.sprite.saturation;
    for (let i = 0, o = 0; i < index.length; i++, o += 4) { // @math four bytes a colour
      if (mask[i]) continue;
      const kind = L.kind[i];
      if (kind === KIND.sky && !grade.trackSky) continue;
      const weak = kind === KIND.sprite || (kind === KIND.floor && L.wet[i] === 2), t = weak ? pictures : world, s = weak ? picturesSat : worldSat; // @math the red liquid (wet 2) glows: lit as the pictures are
      const r = t[out[o]], g = t[256 + out[o + 1]], b = t[512 + out[o + 2]], grey = 0.299 * r + 0.587 * g + 0.114 * b; // @math the green and blue tables follow the red one; the Rec. 601 luma weights
      out[o] = Math.min(grey + (r - grey) * s, cap); out[o + 1] = Math.min(grey + (g - grey) * s, cap); out[o + 2] = Math.min(grey + (b - grey) * s, cap); // @math the three components
    }
  }
  return out;
}
