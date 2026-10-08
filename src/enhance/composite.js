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

// compositeAt's lighting grade of the output row Y at every `step`-th column (grade.js gradePixel, inlined as composite has it): not over the
// overlays (`mask`, or null for none), not over sky rows that are not the track's sky; the pictures and the red liquid get its weaker part.
function gradeRow(out, Y, step, W, mask, kinds, wet, grade, cap) {
  const world = grade.lut, worldSat = grade.saturation, pictures = grade.sprite.lut, picturesSat = grade.sprite.saturation, masked = mask !== null;
  for (let X = 0, o = Y * W, oo = o * 4; X < W; X += step, o += step, oo += step * 4) { // @math four bytes a colour
    if (masked && mask[o]) continue;
    const kind = kinds[o];
    if (kind === KIND.sky && !grade.trackSky) continue;
    const weak = kind === KIND.sprite || (kind === KIND.floor && wet[o] === 2), t = weak ? pictures : world, sat = weak ? picturesSat : worldSat; // @math the red liquid (wet 2) glows: lit as the pictures are
    const r = t[out[oo]], g = t[256 + out[oo + 1]], b = t[512 + out[oo + 2]], grey = 0.299 * r + 0.587 * g + 0.114 * b; // @math the green and blue tables follow the red one; the Rec. 601 luma weights
    out[oo] = Math.min(grey + (r - grey) * sat, cap); out[oo + 1] = Math.min(grey + (g - grey) * sat, cap); out[oo + 2] = Math.min(grey + (b - grey) * sat, cap); // @math the three components
  }
}

// composite for a geometry G (geometry.js; Stage 4, docs/enhancements.md): `fb` the G.W x G.H indexed picture, `L` its layers, `mask` the
// overlay pixels at the same size or null for none (a world composed under a HUD layer), the effects and the splats as composite has them, the
// splats in output pixels. Every per-row table (the sky's, the strip's, the far range's and the clouds' colours, the strip's flags) is read at
// the output row's reference row (G.rowRef), and the covers of the clouds and the far range, which stay on the reference grid, at the output
// pixel's reference cell (G.rowRef, G.colRef + m); at IDENTITY it is composite byte for byte, for every effect set (the same arithmetic in
// the same order, the same three stores into the clamped bytes: the base, the splats, the grade). Above scale 1 a reference sky row (the
// sky's rows, 0 to 109) whose s output rows hold only the sky's kind, no picture pixel (`rows`, the blit's flags of the output rows it wrote,
// one a row of this geometry, fewer throw; without them no row qualifies), no splat and no overlay pixel is composed once per reference cell,
// graded, and copied over its s x s block: the sky, its covers and its per-row tables are one value a cell, so this is the per-pixel result by
// construction (test/general-paths.test.js); `slow` turns it off, for the checks. `count`, when given, has its `fast` raised by the number of
// reference sky rows composed once per cell (scripts/spike-2x.mjs: a fast path that took no row has measured nothing). `soft` (the reference
// look above 1x, config.js HD.look: scene.js createSoftLayers, refW x 200) holds the contact shadows, the sun shadows, the skid marks and the
// ground's relief light on the reference grid: they are read at the pixel's reference cell, the pictures' relief light (L.relief) at the
// pixel itself; without it every layer is read at the pixel. `L.art` (art.js createArtLayers, while an artwork pack is drawn) gives the pixels
// of RGBA art their own colour: each component within the demo's fade (min(component, cap): the widening of the palette's 6 bits is monotonic,
// so an RGBA copy of the palette fades as the palette does), partial alpha over the colour of the index beneath; and the strip's pixels their own
// sky flag (`through`, which a pack strip's 'sky here' sets), read instead of the strip's per-index flags.
export function compositeAt(out, { fb, mask = null, L, G, palette, effects, splats = [], rows = null, slow = false, count = null, soft = null }) {
  const { s, m, W, H, refW, rowRef, colRef } = G, S = models().sky;
  const { shadow, fog, sky = null, water = null, relief = false, grade = null, cap = 255 } = effects, darken = SHADOW.opacity * shadow, sunDarken = SUN.opacity * shadow; // @math the brightest 8-bit component
  const fogC = fog ? fog.color.map(v => Math.min(v, cap)) : null, ramp = fog?.ramp, last = ramp ? ramp.length - 1 : 0, skyRows = sky ? sky.rows : 0, stripRows = sky?.strip ? sky.rows + sky.stripRows : 0;
  const range = sky?.range ?? null, rangeAlpha = range?.cover.alpha, rangeTone = range?.cover.tone, rangeSnow = range?.cover.snow, rangeLit = range?.colours.lit, rangeShade = range?.colours.shade, rangeWhite = range?.colours.snow;
  const wet = water ? L.wet : null, wave = L.wave, reflect = water?.reflect ?? null, reflectLast = reflect ? reflect.length - 1 : 0, mirror = water?.sky, highlight = water?.highlight, glow = water?.glow;
  const kinds = L.kind, depths = L.depth, lights = L.relief, masked = mask !== null;
  const art = L.art ?? null, direct = art ? art.direct : null, colours = art ? art.rgba : null, beneath = art ? art.beneath : null, through = art?.strip ? art.through : null; // the artwork packs' layers (art.js), while art is drawn
  const shades = soft ? soft.shade : L.shade, casts = soft ? soft.cast : L.cast, marks = soft ? soft.mark : L.mark, ground = soft ? soft.relief : L.relief; // the soft layers: on the reference grid (read at the cell) or the output's
  if (rows && rows.length < H) throw new Error(`compositeAt: ${rows.length} row flags for ${H} output rows`); // flags of another geometry would let rows with pictures pass as clean
  // The reference sky rows composed once per cell: those whose output rows hold only the sky's kind, no flagged row, no splat, no overlay.
  const fast = s > 1 && !slow && rows ? new Uint8Array(S.skyRows).fill(1) : null, pixels = fast && out.byteOffset % 4 === 0 ? new Uint32Array(out.buffer, out.byteOffset, out.length >> 2) : null; // @math four bytes a colour: the picture's pixels as words, for the copies
  if (fast) {
    for (let r = 0; r < S.skyRows; r++) for (let q = 0; q < s; q++) if (rows[s * r + q]) fast[r] = 0;
    for (const sp of splats) for (let y = Math.floor(sp.y - sp.r); y <= Math.ceil(sp.y + sp.r); y++) { const row = sp.map(y); if (row >= 0 && row < H && rowRef[row] < S.skyRows) fast[rowRef[row]] = 0; } // every row a splat's span reaches, through its map
    for (let r = 0; r < S.skyRows; r++) if (fast[r]) for (let o = s * r * W; o < (s * r + s) * W; o++) if (kinds[o] !== KIND.sky || (masked && mask[o])) { fast[r] = 0; break; }
    if (count) for (let r = 0; r < S.skyRows; r++) count.fast += fast[r];
  }
  // Each output row: the base and the per-pixel effects at every `step`-th column from 0 (a sky row of the fast path once per cell: its first
  // output row, every s-th column, then graded and copied over the cell; every other row per pixel). The body is this function's own loop, not a
  // closure: the per-pixel work reads its tables from local variables.
  for (let Y = 0; Y < H; Y++) {
    const row = rowRef[Y], once = fast !== null && row < S.skyRows && fast[row] === 1;
    if (once && Y !== s * row) continue; // the cell's other rows are copied from its first
    const step = once ? s : 1, k = row * 3, cells = row * refW + m; // @math three components a row
      for (let X = 0, o = Y * W; X < W; X += step, o += step) {
        const p = fb[o] * 4, oo = o * 4, ci = s === 1 ? o : cells + colRef[X], so = soft ? ci : o; // @math four bytes a colour; at scale 1 an output pixel is its reference cell (the grid is refW wide)
        let r = palette[p], g = palette[p + 1], b = palette[p + 2]; // @math the three components
        if (direct !== null && direct[o] !== 0 && (!masked || !mask[o])) { // an RGBA pack's pixel (an overlay's pixel over it is the overlay's): its colour within the demo's fade, partial alpha over the colour of the index beneath it
          const a = colours[oo + 3], cr = Math.min(colours[oo], cap), cg = Math.min(colours[oo + 1], cap), cb = Math.min(colours[oo + 2], cap); // @math the alpha last; the three components
          if (a === 0xff) { r = cr; g = cg; b = cb; } // @math opaque
          else { const q = beneath[o] * 4, t = a / 0xff; r = palette[q] + (cr - palette[q]) * t; g = palette[q + 1] + (cg - palette[q + 1]) * t; b = palette[q + 2] + (cb - palette[q + 2]) * t; } // @math four bytes a colour, the three components
        }
        if (!masked || !mask[o]) {
          const kind = kinds[o];
          let ranged = false;
          if (row < skyRows && kind === KIND.sky) { // the track's sky: the lighting's gradient, the far range, then the clouds over them
            const t = sky.tint;
            if (t) { r += (t.colours[k] - r) * t.amount; g += (t.colours[k + 1] - g) * t.amount; b += (t.colours[k + 2] - b) * t.amount; } // @math the three components
            if (range && rangeAlpha[ci]) {
              if (rangeSnow[ci]) { r = rangeWhite[k]; g = rangeWhite[k + 1]; b = rangeWhite[k + 2]; } // @math the three components
              else { const v = rangeTone[ci]; r = rangeShade[k] + (rangeLit[k] - rangeShade[k]) * v; g = rangeShade[k + 1] + (rangeLit[k + 1] - rangeShade[k + 1]) * v; b = rangeShade[k + 2] + (rangeLit[k + 2] - rangeShade[k + 2]) * v; } // @math the three components
            }
            for (const c of sky.clouds) { // the banks over it
              const a = c.alpha[ci]; if (!(a > 0)) continue;
              const l = c.light[ci], cr = c.shade[k] + (c.lit[k] - c.shade[k]) * l, cg = c.shade[k + 1] + (c.lit[k + 1] - c.shade[k + 1]) * l, cb = c.shade[k + 2] + (c.lit[k + 2] - c.shade[k + 2]) * l; // @math the three components
              r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a;
            }
            r = Math.min(r, cap); g = Math.min(g, cap); b = Math.min(b, cap); // never above the demo's fade
          }
          else if (row < stripRows && kind === KIND.horizon) { // the strip's sky-coloured background: the gradient and the far range go on over it
            const t = sky.tint;
            if (through !== null ? through[o] : sky.strip[(row - sky.rows) * 256 + fb[o]]) { // @math a flag for each palette index (while art is drawn, the strip pixel's own flag: a pack strip's 'sky here' too)
              if (t) { r += (t.colours[k] - r) * t.amount; g += (t.colours[k + 1] - g) * t.amount; b += (t.colours[k + 2] - b) * t.amount; } // @math the three components
              if (range && rangeAlpha[ci]) { // the range's own haze: no strip fog over it
                ranged = true;
                if (rangeSnow[ci]) { r = rangeWhite[k]; g = rangeWhite[k + 1]; b = rangeWhite[k + 2]; } // @math the three components
                else { const v = rangeTone[ci]; r = rangeShade[k] + (rangeLit[k] - rangeShade[k]) * v; g = rangeShade[k + 1] + (rangeLit[k + 1] - rangeShade[k + 1]) * v; b = rangeShade[k + 2] + (rangeLit[k + 2] - rangeShade[k + 2]) * v; } // @math the three components
              }
              r = Math.min(r, cap); g = Math.min(g, cap); b = Math.min(b, cap); // never above the demo's fade
            }
          }
          if (relief && (kind === KIND.floor || kind === KIND.sprite)) { const f = kind === KIND.floor ? ground[so] : lights[o]; if (f !== 1) { r = Math.min(r * f, cap); g = Math.min(g * f, cap); b = Math.min(b * f, cap); } } // the relief's light, within the demo's fade
          if (kind === KIND.floor) { // the ground: the water, the shadows (the darker of contact and sun), then the skid marks
            if (wet !== null && wet[o] !== 0) {
              if (wet[o] === 1 && reflect !== null) { const t = reflect[Math.min(Math.round(depths[o]), reflectLast)]; r += (mirror[0] - r) * t; g += (mirror[1] - g) * t; b += (mirror[2] - b) * t; } // @math the three components
              const v = wave[o];
              if (v < 0) { r *= 1 + v; g *= 1 + v; b *= 1 + v; }
              else if (v > 0) { const h = wet[o] === 1 ? highlight : glow; r += (h[0] - r) * v; g += (h[1] - g) * v; b += (h[2] - b) * v; } // @math the three components
            }
            const dark = Math.max(shades[so] * darken, casts[so] * sunDarken), f = (1 - dark) * (1 - marks[so]);
            if (f !== 1) { r *= f; g *= f; b *= f; }
          }
          if (fogC && kind !== KIND.sky && !ranged) {
            const t = kind === KIND.horizon ? fog.horizon : ramp[Math.min(Math.round(depths[o]), last)];
            r += (fogC[0] - r) * t; g += (fogC[1] - g) * t; b += (fogC[2] - b) * t; // @math the three components
          }
        }
        out[oo] = r; out[oo + 1] = g; out[oo + 2] = b; out[oo + 3] = 255; // @math opaque
      }
    if (once) {
      if (grade) gradeRow(out, Y, s, W, mask, kinds, L.wet, grade, cap);
      const from = Y * W * 4; // @math four bytes a colour
      if (pixels) for (let X = 0, a = Y * W; X < W; X += s, a += s) for (let d = a + 1; d < a + s; d++) pixels[d] = pixels[a]; // the cell's first pixel along its row, as a word
      else for (let X = 0, a = from; X < W; X += s, a += s * 4) for (let d = a + 4; d < a + s * 4; d++) out[d] = out[d - 4]; // @math four bytes a colour: each byte of the cell's first pixel along its row
      for (let q = 1; q < s; q++) out.copyWithin(from + q * W * 4, from, from + W * 4); // @math four bytes a colour
    }
  }
  for (const sp of splats) {
    const base = sp.color.map(v => Math.min(v, cap)), color = fogC ? mixInto(base, fogC, ramp[Math.min(Math.round(sp.depth), last)]) : base;
    const y0 = Math.floor(sp.y - sp.r), y1 = Math.ceil(sp.y + sp.r), x0 = Math.max(Math.floor(sp.x - sp.r), 0), x1 = Math.min(Math.ceil(sp.x + sp.r), W - 1);
    for (let y = y0; y <= y1; y++) {
      const row = sp.map(y);
      if (row < 0 || row >= H) continue;
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - sp.x) / sp.r, v = (y + 0.5 - sp.y) / sp.r, q = u * u + v * v; // @math the pixel's middle
        if (q >= 1) continue;
        const i = row * W + x;
        if ((masked && mask[i]) || (kinds[i] === KIND.sprite && depths[i] < sp.depth)) continue; // under the overlays, behind a nearer picture
        const a = sp.alpha * (sp.soft ? 1 - q : 1), o = i * 4; // @math four bytes a colour
        out[o] += (color[0] - out[o]) * a; out[o + 1] += (color[1] - out[o + 1]) * a; out[o + 2] += (color[2] - out[o + 2]) * a; // @math the three components
      }
    }
  }
  if (grade) for (let Y = 0; Y < H; Y++) { const row = rowRef[Y]; if (fast === null || row >= S.skyRows || !fast[row]) gradeRow(out, Y, 1, W, mask, kinds, L.wet, grade, cap); } // the lighting, last (the fast rows are graded already)
  return out;
}
