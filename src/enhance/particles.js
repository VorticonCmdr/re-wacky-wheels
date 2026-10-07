// Surface particles: short-lived puffs, drops and sparks in world space. They are emitted from completed ticks only, from events the game
// itself classifies (no surface is given a meaning here):
//  - dust where the surface under a wheel has a wheel-dust picture the loader read for the track (effects.ground-dust), coloured by it;
//  - drops while a car is in the pit state of the surfaces 6 and 15 (effects.pit), coloured by its picture or the floor under it;
//  - sparks when a wall or racer contact starts the spark word (effects.sparks), coloured by SPARK.SP.
// Dust is laid along the path a car travelled in the tick, at even spacing, each puff born at the time the car passed its spot, so the
// number of particles follows the distance driven, never the display's refresh rate. A particle's place is a function of its age on the
// presentation clock; the pool is bounded and has its own random source, never the game's.
import { PARTICLES, MOTION } from './config.js';
import { surfacePicture, sparkShift } from '../game/effects.js';
import { terrainAt } from '../game/surface.js';
import { RACE } from '../game/versus-rules.js';
import { projectAt, pixelsPerUnit, texelAt, paletteColor, headingVector } from './project.js';
import { models } from './models.js';

const wrap16 = v => v - 65536 * Math.round(v / 65536); // @math world words are 16 bits: the shortest signed difference
const MS = 1000; // @math milliseconds in a second

// xorshift32: the visual random source (deterministic from its seed, independent of everything the game draws from).
export function createRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 2 ** 32; }; // @math the xorshift32 shifts; 32-bit state to [0, 1)
}

// The mean colour of the opaque pixels of a picture (the brightest half for sparks), lightened toward white by `lighten`.
function meanColor(world, bytes, brightest = false, lighten = 0) {
  const colors = [];
  for (const v of bytes) if (v !== 0) colors.push(paletteColor(world, v));
  if (!colors.length) return null;
  const luma = c => c[0] + c[1] + c[2]; // @math the three components
  const used = brightest ? colors.sort((a, b) => luma(b) - luma(a)).slice(0, Math.max(colors.length >> 1, 1)) : colors; // @math the brightest half
  return [0, 1, 2].map(k => { const m = used.reduce((s, c) => s + c[k], 0) / used.length; return m + (255 - m) * lighten; }); // @math three components; white
}

export function createParticles() {
  const P = PARTICLES;
  let pool = [], random = createRandom(P.seed), carry = new Map();
  const colorCache = new WeakMap();
  const range = ([lo, hi]) => lo + (hi - lo) * random();
  const add = p => { pool.push(p); if (pool.length > P.cap) pool.splice(0, pool.length - P.cap); };

  function colors(world) {
    let c = colorCache.get(world);
    if (!c) { c = { dust: new Map(), splash: new Map(), spark: meanColor(world, world.spark, true) }; colorCache.set(world, c); }
    return c;
  }
  function dustColor(world, track, surface) {
    const c = colors(world);
    if (!c.dust.has(surface)) { const pic = surfacePicture(world, surface, 'first', track); c.dust.set(surface, pic ? meanColor(world, pic.bytes, false, P.colorLighten) : null); }
    return c.dust.get(surface);
  }
  function splashColor(world, track, value, x, y) {
    const c = colors(world);
    if (!c.splash.has(value)) { const pic = surfacePicture(world, value, 'second', track); c.splash.set(value, pic ? meanColor(world, pic.bytes, true) : null); }
    return c.splash.get(value) ?? paletteColor(world, texelAt(world, x, y));
  }

  // Puffs along the segment a -> b of the tick (times ta -> tb), every `every` units, carrying the remainder per emitter `key`.
  function trail(key, a, b, ta, tb, every, spawn) {
    const dx = wrap16(b.x - a.x), dy = wrap16(b.y - a.y), length = Math.hypot(dx, dy);
    if (length < P.dust.minStep || length > MOTION.snapDistance) { carry.set(key, 0); return; }
    let acc = (carry.get(key) ?? 0) + length;
    const speed = (length * MS) / Math.max(tb - ta, 1); // world units a second
    while (acc >= every) { acc -= every; const back = acc / length; spawn(b.x - dx * back, b.y - dy * back, tb - (tb - ta) * back, dx / length, dy / length, speed); }
    carry.set(key, acc);
  }

  function dust(x, y, born, color, amount, ux = 0, uy = 0, speed = 0) {
    const D = P.dust;
    if (random() > amount) return;
    add({ kind: 'dust', x, y, vx: ux * speed * D.inherit + (random() * 2 - 1) * D.spread, vy: uy * speed * D.inherit + (random() * 2 - 1) * D.spread, vz: D.rise * (0.5 + random()), gravity: 0, drag: D.drag, born, life: D.lifeMs * (0.75 + random() / 2), size: range(D.size), grow: D.grow, color, alpha: D.alpha, fadeIn: true }); // @math a spread either way; three quarters to one and a quarter of the life
  }

  return {
    clear() { pool = []; carry = new Map(); random = createRandom(P.seed); },
    get count() { return pool.length; },

    // One completed tick: `prev` and `cur` snapshots (motion.js), the state for the world and the mode, `amount` the particle level (0 to 1).
    emit(state, prev, cur, amount = 1) {
      if (!prev || prev === cur || prev.world !== cur.world) return;
      const world = cur.world, track = Number(world.name), ta = prev.time, tb = cur.time;
      pool = pool.filter(p => tb - p.born < p.life);
      cur.seats.forEach((c, i) => {
        const p = prev.seats[i];
        if (!c || !p || c.crashed) return;
        const [fx, fy] = headingVector(world, c.dir), rx = -fy, ry = fx; // the car's forward and right vectors
        const wheel = (x, y, side) => ({ x: x - fx * P.wheelBack + rx * side * P.wheelSide, y: y - fy * P.wheelBack + ry * side * P.wheelSide });
        const color = c.jump === 0 && c.special === 0 ? dustColor(world, track, c.surface) : null;
        if (color) trail(`seat${i}`, { x: p.px, y: p.py }, { x: c.px, y: c.py }, ta, tb, P.dust.every, (x, y, born, ux, uy, speed) => { for (const side of [-1, 1]) { const w = wheel(x, y, side); dust(w.x, w.y, born, color, amount, ux, uy, speed); } });
        else carry.set(`seat${i}`, 0);
        if (c.special !== 0) { // the pit state's drops, spread over the tick
          const S = P.splash, col = splashColor(world, track, c.specialValue, c.px, c.py);
          for (let k = 0; k < Math.round(S.perTick * amount); k++) {
            const side = random() < 0.5 ? -1 : 1, w = wheel(c.px, c.py, side), speed = range(S.speed); // @math either side
            add({ kind: 'drop', x: w.x, y: w.y, vx: (rx * side - fx * 0.3) * speed, vy: (ry * side - fy * 0.3) * speed, vz: range(S.up), gravity: S.gravity, drag: 0, born: ta + (tb - ta) * random(), life: S.lifeMs, size: range(S.size), grow: 0, color: col, alpha: S.alpha, fadeIn: false }); // @math a little backward
          }
        }
        const sparked = c.spark !== 0 && c.sparkCount === 1 && !(p.spark === c.spark && p.sparkCount === 1); // @math the spark's first picture was drawn in this tick (effects.sparks counts after the draw)
        if (sparked) {
          const S = P.sparks, col = colors(world).spark, side = sparkShift(c.spark) > 0 ? 1 : -1; // the spark drawn right of the entry's left column is on the car's right
          for (let k = 0; k < Math.max(Math.round(S.perEvent * amount), 1); k++) {
            const speed = range(S.speed), spread = random() * 0.8; // @math up to 0.8 of the speed forward
            add({ kind: 'spark', x: c.px + fx * S.ahead + rx * side * P.wheelSide, y: c.py + fy * S.ahead + ry * side * P.wheelSide, vx: (rx * side + fx * spread) * speed, vy: (ry * side + fy * spread) * speed, vz: range(S.up), gravity: S.gravity, drag: 0, born: tb - (tb - ta) * random() * 0.5, life: S.lifeMs * (0.6 + random() * 0.4), size: range(S.size), grow: 0, color: col, alpha: S.alpha, fadeIn: false }); // @math born in the tick's second half; 0.6 to 1 of the life
          }
        }
      });
      if (P.dust.racers && !state.duck) { // the computer racers' dust, from the surface under their point
        const first = state.versus ? RACE().firstComputer : 1; // @math the racer 0 is the human of a single player race
        cur.racers.forEach((c, n) => {
          const p = prev.racers[n];
          if (n < first || !p || c.crashed) return;
          const color = dustColor(world, track, terrainAt(world, Math.round(c.x), Math.round(c.y)));
          if (!color) { carry.set(`racer${n}`, 0); return; }
          trail(`racer${n}`, p, c, ta, tb, P.dust.every, (x, y, born, ux, uy, speed) => { const side = random() < 0.5 ? -1 : 1; dust(x - ux * P.wheelBack - uy * side * P.wheelSide, y - uy * P.wheelBack + ux * side * P.wheelSide, born, color, amount, ux, uy, speed); }); // @math either side, behind along the motion
        });
      }
    },

    // The particles of the picture at the presentation time `now` for a camera, as screen discs: { x, y, r, depth, color, alpha, soft }. At a
    // geometry G (geometry.js) the discs are in output pixels: the reference place x, y and radius r become s (x + m), s y and s r (at the
    // reference geometry the very numbers they always were); with a margin (the wide view) a particle is placed through the wide projection
    // (project.js projectAt: the equiangular continuation outside the reference fan), so it stays over the ground the floor draws there.
    splats(world, camera, now, G = null) {
      const V = models().view, out = [], s = G ? G.s : 1, m = G ? G.m : 0;
      for (const p of pool) {
        const age = (now - p.born) / MS;
        if (age < 0 || age * MS > p.life) continue;
        const travel = p.drag ? (1 - Math.exp(-p.drag * age)) / p.drag : age;
        const x = p.x + p.vx * travel, y = p.y + p.vy * travel, z = p.drag ? p.vz * travel : Math.max(p.vz * age - (p.gravity * age * age) / 2, 0); // @math a puff billows up and slows, a drop or a spark falls under gravity
        const at = projectAt(world, camera, x, y, m);
        if (!at || at.distance < V.minDistance || at.distance > V.maxDistance) continue;
        const ppu = pixelsPerUnit(at.distance), life = 1 - (age * MS) / p.life;
        const alpha = p.alpha * life * life * (p.fadeIn ? Math.min(age * MS / P.fadeInMs, 1) : 1) * Math.min((at.distance - V.minDistance) / P.nearFade, 1);
        if (alpha <= 0) continue;
        out.push({ x: s * (at.column + m), y: s * (at.bottom - z * ppu), r: s * Math.max((p.size + p.grow * age) * ppu, P.minPixels), depth: at.distance, color: p.color, alpha, soft: p.kind === 'dust' });
      }
      return out.sort((a, b) => b.depth - a.depth);
    },
  };
}
