// The moving water of the Enhanced presentation (docs/enhancements.md, Stage 3): the surfaces a car sinks into (the game's own reading,
// terrain.special-values: the surface a stopped car is drawn shorter on and the two of the pit state) ripple, catch highlights and, for water,
// mirror the sky. Which texels are liquid is worked out once per track from its tiles; the floor draw (project.js drawFloor) marks the
// liquid pixels and asks this module for their light; composite.js mixes the colours (WATER in config.js).
import { WATER } from './config.js';
import { cloudField, sample, bayer } from './clouds.js';
import { floorDepths, pixelsPerUnit, rayRatio } from './project.js';
import { models } from './models.js';

export { LIQUID } from '../liquids.js';
import { LIQUID, classifyLiquids } from '../liquids.js';
export const liquidsOf = world => classifyLiquids(world, WATER.similar);

// How much each screen column looks toward the sun (0 away from it, up to WATER.sun straight at it): `sun` the shadows' direction in the
// camera's terms (shadows.js sunDirection), the sun the other way. Into `out`, one value a column; `x0` is the reference column of out[0]
// (Stage 4's wide view: -m, its margins' columns looking along the ray the floor continues there, project.js rayRatio).
export function sunGlitter(sun, out, x0 = 0) {
  const V = models().view, size = Math.hypot(sun.f, sun.l) || 1;
  for (let c = 0; c < out.length; c++) {
    const col = c + x0, r = col >= 0 && col <= 2 * V.center ? ((col - V.center) * V.tan) / (V.center * 2 ** V.fixedBits) : rayRatio(col), along = -(sun.f + sun.l * r) / (Math.hypot(1, r) * size); // @math the column's ray: one ahead, r to the side (project.js cameraPoint), the fan's columns as always; the tangent is 16.16
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
// palette itself (then the water gets only the highlights), `glitter` per column (sunGlitter) from the reference column `x0`. The hook is
// called (kind, x, y, c, k, column): c and k the sample's column and step in the floor's tables, `column` the sample's own reference column,
// whose glitter and dither cell it takes (c itself but in Stage 4's wide margins, where the tables are the edge column's: caster.js).
export function waterShader(world, { time, strength, beach, glitter, x0 = 0 }) {
  const size = WATER.texture, a = cloudField(WATER.seed, size), b = cloudField(WATER.seed + 1, size), seconds = time / 1000, steps = models().floor.steps, e = WATER.scale; // @math ms to seconds; the second field its own; a world unit in texels
  const { half: halves, fade: fades } = sampleTables(world), levels = WATER.levels - 1, [fa, fb] = WATER.flow, redLine = WATER.red.line / WATER.line;
  const steep = Math.SQRT2 * (steepest(a, size) + steepest(b, size)) * e * (1 + Math.max(...glitter) * WATER.sunWidth) * Math.max(redLine, 1); // the steepest the fields' difference can rise over a world unit, times the widest a line gets
  return (kind, x, y, c, k, column = c) => {
    const at = c * steps + k, fade = fades[at];
    if (fade === 0) return 0; // too far for either
    const red = kind === LIQUID.red, speed = red ? WATER.red.speed * seconds : seconds, u = x * e, v = y * e, u1 = u + fa[0] * speed, v1 = v + fa[1] * speed, u2 = u + fb[0] * speed, v2 = v + fb[1] * speed;
    const n1 = sample(a, size, u1, v1), n2 = sample(b, size, u2, v2), d = n1 - n2;
    if (Math.abs(d) < steep * halves[at]) { // a line where the two fields meet: its distance in world units is the difference over its slope, its half width WATER.line pixels (none where the difference is too large for any slope)
      const dx = sample(a, size, u1 + e, v1) - sample(b, size, u2 + e, v2) - d, dy = sample(a, size, u1, v1 + e) - sample(b, size, u2, v2 + e) - d, slope = Math.sqrt(dx * dx + dy * dy), g = glitter[column - x0];
      const half = halves[at] * (red ? redLine : 1) * (1 + g * WATER.sunWidth), line = slope > 0 ? 1 - Math.abs(d) / slope / half : 0;
      if (line > 0) { const lit = Math.min(Math.floor(Math.min(line * WATER.core, 1) * Math.min(1 + g, 2) * fade * levels + bayer(column, k)), levels) / levels; if (lit > 0) return lit * strength; } // @math at most twice as bright toward the sun
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
