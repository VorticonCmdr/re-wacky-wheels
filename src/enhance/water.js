// The moving water of the Enhanced presentation (docs/enhancements.md, Stage 3): the surfaces a car sinks into (the game's own reading,
// terrain.special-values: the surface a stopped car is drawn shorter on and the two of the pit state) ripple, catch highlights and, for water,
// mirror the sky. Which texels are liquid is worked out once per track from its tiles; the floor draw (project.js drawFloor) marks the
// liquid pixels and asks this module for their light; composite.js mixes the colours (WATER in config.js).
import { WATER } from './config.js';
import { cloudField, sample, bayer } from './clouds.js';
import { floorDepths, pixelsPerUnit } from './project.js';
import { tileSurfaces } from '../game/surface.js';
import { models } from './models.js';

export const LIQUID = { none: 0, water: 1, red: 2 }; // @math the kinds of a texel

// The liquids of a world: { texels, kinds, any }. `texels` holds per tile id and texel (id x tile bytes + the texel's offset in the tile)
// the kind of liquid there; `kinds` maps the liquid surface values to their kind. A liquid is water unless its mean colour on the track is
// redder than blue; a surface the game does not treat specially is drawn as a liquid whose mean colour lies within WATER.similar of its own.
// A track whose map has no sinking surface has none (`any` false, no table).
const liquidCache = new WeakMap();
export function liquidsOf(world) {
  let out = liquidCache.get(world.tiles);
  if (out) return out;
  const F = models().floor, special = models().special, ids = world.sin.length, uses = new Uint32Array(ids), sinking = [special.stopped, ...special.pit];
  for (const id of world.tiles) uses[id]++;
  const pairs = tileSurfaces(world);
  if (!pairs.some(([zero, one], id) => uses[id] && (sinking.includes(zero) || sinking.includes(one)))) { out = { texels: new Uint8Array(0), kinds: new Map(), any: false }; liquidCache.set(world.tiles, out); return out; }
  const rgb = Uint8Array.from(world.palette, v => (v << 2) | (v >> 4)), sums = new Map(); // @math 6 bits widened to 8 by repeating the top bits
  const add = (v, s, n) => { if (!s[3]) return; const t = sums.get(v) ?? [0, 0, 0, 0]; for (let k = 0; k < 4; k++) t[k] += s[k] * n; sums.set(v, t); }; // @math three components and the count
  for (let id = 0; id < ids; id++) { // the colours of each used tile's texels, by its two surfaces, weighted by how often the map uses it
    if (!uses[id]) continue;
    const sheet = world.sheets[Math.floor(id / F.sheetCount)], mask = world.maskSheets[Math.floor(id / F.sheetCount)], base = (id % F.sheetCount) * F.tileBytes, zero = [0, 0, 0, 0], one = [0, 0, 0, 0]; // @math three components and the count
    for (let t = base; t < base + F.tileBytes; t++) { const p = sheet[t] * 3, s = mask[t] === 0 ? zero : one; s[0] += rgb[p]; s[1] += rgb[p + 1]; s[2] += rgb[p + 2]; s[3]++; } // @math three components a colour
    add(pairs[id][0], zero, uses[id]); add(pairs[id][1], one, uses[id]);
  }
  const mean = v => { const s = sums.get(v); return s && s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : null; }; // @math three components over the count
  const kinds = new Map();
  for (const v of sinking) { const m = mean(v); kinds.set(v, m && m[0] > m[2] ? LIQUID.red : LIQUID.water); } // @math red against blue
  const never = new Set([special.boost, special.wall, special.fall, ...sinking]);
  for (const v of sums.keys()) {
    if (never.has(v)) continue;
    const m = mean(v);
    for (const w of sinking) { const n = mean(w); if (n && Math.hypot(m[0] - n[0], m[1] - n[1], m[2] - n[2]) < WATER.similar) { kinds.set(v, kinds.get(w)); break; } } // @math the three components' distance
  }
  const texels = new Uint8Array(ids * F.tileBytes);
  let any = false;
  for (let id = 0; id < ids; id++) {
    const zero = kinds.get(pairs[id][0]) ?? LIQUID.none, one = kinds.get(pairs[id][1]) ?? LIQUID.none;
    if (!zero && !one) continue;
    const mask = world.maskSheets[Math.floor(id / F.sheetCount)], base = (id % F.sheetCount) * F.tileBytes;
    for (let t = 0; t < F.tileBytes; t++) { const k = mask[base + t] === 0 ? zero : one; texels[id * F.tileBytes + t] = k; if (k && uses[id]) any = true; }
  }
  out = { texels, kinds, any };
  liquidCache.set(world.tiles, out);
  return out;
}

// How much each screen column looks toward the sun (0 away from it, up to WATER.sun straight at it): `sun` the shadows' direction in the
// camera's terms (shadows.js sunDirection), the sun the other way. Into `out`, one value a column.
export function sunGlitter(sun, out) {
  const V = models().view, size = Math.hypot(sun.f, sun.l) || 1;
  for (let c = 0; c < out.length; c++) {
    const r = ((c - V.center) * V.tan) / (V.center * 2 ** V.fixedBits), along = -(sun.f + sun.l * r) / (Math.hypot(1, r) * size); // @math the column's ray: one ahead, r to the side (project.js cameraPoint); the tangent is 16.16
    out[c] = along > 0 ? WATER.sun * along ** WATER.sunPower : 0;
  }
  return out;
}

// Per world: for every floor sample (column x step) the half width of a highlight line in world units (WATER.line pixels at its distance)
// and how much of the highlights and the shimmer is left at its distance (WATER.far).
const sampleCache = new WeakMap();
function sampleTables(world) {
  let t = sampleCache.get(world.ndist);
  if (t) return t;
  const depths = floorDepths(world).table, [near, far] = WATER.far, half = new Float32Array(depths.length), fade = new Float32Array(depths.length);
  for (let i = 0; i < depths.length; i++) { half[i] = WATER.line / pixelsPerUnit(depths[i]); fade[i] = 1 - Math.min(Math.max((depths[i] - near) / (far - near), 0), 1); }
  t = { half, fade };
  sampleCache.set(world.ndist, t);
  return t;
}

// The steepest a field changes between neighbouring texels (bilinear samples change no faster), read once per field.
const steepCache = new WeakMap();
function steepest(field, size) {
  if (steepCache.has(field)) return steepCache.get(field);
  let m = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = field[y * size + x]; m = Math.max(m, Math.abs(field[y * size + ((x + 1) % size)] - v), Math.abs(field[((y + 1) % size) * size + x] - v)); }
  steepCache.set(field, m);
  return m;
}

// The light of a liquid sample for drawFloor's hook: below 0 it darkens the pixel by that part, above 0 it goes that part of the way to the
// highlight. `time` the presentation clock (ms), `strength` the track's water (0 to 1), `beach` whether the game cycles this track's water
// palette itself (then the water gets only the highlights), `glitter` per column (sunGlitter).
export function waterShader(world, { time, strength, beach, glitter }) {
  const size = WATER.texture, a = cloudField(WATER.seed, size), b = cloudField(WATER.seed + 1, size), seconds = time / 1000, steps = models().floor.steps, e = WATER.scale; // @math ms to seconds; the second field its own; a world unit in texels
  const { half: halves, fade: fades } = sampleTables(world), levels = WATER.levels - 1, [fa, fb] = WATER.flow, redLine = WATER.red.line / WATER.line;
  const steep = Math.SQRT2 * (steepest(a, size) + steepest(b, size)) * e * (1 + Math.max(...glitter) * WATER.sunWidth) * Math.max(redLine, 1); // the steepest the fields' difference can rise over a world unit, times the widest a line gets
  return (kind, x, y, c, k) => {
    const at = c * steps + k, fade = fades[at];
    if (fade === 0) return 0; // too far for either
    const red = kind === LIQUID.red, speed = red ? WATER.red.speed * seconds : seconds, u = x * e, v = y * e, u1 = u + fa[0] * speed, v1 = v + fa[1] * speed, u2 = u + fb[0] * speed, v2 = v + fb[1] * speed;
    const n1 = sample(a, size, u1, v1), n2 = sample(b, size, u2, v2), d = n1 - n2;
    if (Math.abs(d) < steep * halves[at]) { // a line where the two fields meet: its distance in world units is the difference over its slope, its half width WATER.line pixels (none where the difference is too large for any slope)
      const dx = sample(a, size, u1 + e, v1) - sample(b, size, u2 + e, v2) - d, dy = sample(a, size, u1, v1 + e) - sample(b, size, u2, v2 + e) - d, slope = Math.sqrt(dx * dx + dy * dy);
      const half = halves[at] * (red ? redLine : 1) * (1 + glitter[c] * WATER.sunWidth), line = slope > 0 ? 1 - Math.abs(d) / slope / half : 0;
      if (line > 0) { const lit = Math.min(Math.floor(Math.min(line * WATER.core, 1) * Math.min(1 + glitter[c], 2) * fade * levels + bayer(c, k)), levels) / levels; if (lit > 0) return lit * strength; } // @math at most twice as bright toward the sun
    }
    return beach && !red ? 0 : (n1 + n2 - 1) * WATER.shimmer * fade * strength; // @math the two fields' mean about its middle
  };
}

// The water's colours of a frame: what it mirrors (`mirror`, the track's haze toward the lighting's sky), its highlight (that toward
// white) and the red liquid's glow, at most `cap`; the mirror's blend by distance (a table over the floor's distances), none on the beach
// tracks. `strength` the track's water.
export function waterColours(world, mirror, cap, strength, beach) {
  const highlight = mirror.map(v => Math.min(v + (0xff - v) * WATER.highlight, cap)), glow = WATER.red.glow.map(v => Math.min(v, cap)); // @math toward white
  return { sky: mirror.map(v => Math.min(v, cap)), highlight, glow, reflect: beach ? null : reflectRamp(world, strength) };
}

// The water's mirror by distance at a strength: a table over the whole distances (kept per world and strength).
const reflectCache = new WeakMap();
function reflectRamp(world, strength) {
  let byStrength = reflectCache.get(world.ndist);
  if (!byStrength) { byStrength = new Map(); reflectCache.set(world.ndist, byStrength); }
  if (byStrength.has(strength)) return byStrength.get(strength);
  const R = WATER.reflect, V = models().view, deepest = floorDepths(world).far, from = deepest * R.start;
  const table = Float32Array.from({ length: V.maxDistance + 2 }, (_, d) => R.amount * strength * Math.min(Math.max((d - from) / (deepest - from), 0), 1) ** R.curve); // @math every whole distance to the farthest drawn, and one past it
  byStrength.set(strength, table);
  return table;
}
