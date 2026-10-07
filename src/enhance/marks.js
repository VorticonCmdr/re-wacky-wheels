// Skid marks: tyre tracks in world space, laid on completed ticks from the game's own skid states and drawn into the mark layer of the
// ground. A segment is one rear wheel's path over one tick, so consecutive segments join; the ring keeps the newest MARKS.cap of them and a
// reset empties it. Marks are decorative: nothing here reads back into the race.
import { MARKS, MOTION } from './config.js';
import { surfacePicture } from '../game/effects.js';
import { KIND, headingVector, toCamera, fromCameraAt } from './project.js';
import { fillQuad } from './raster.js';
import { models } from './models.js';

const wrap16 = v => v - 65536 * Math.round(v / 65536); // @math world words are 16 bits: the shortest signed difference

// Whether the car of a snapshot seat skids in its tick: the slide (the drift word, which the hand brake turn sets too), the forced turn, the
// hop, or, for a single human, a SKID among the tick's sounds (the brake with the throttle above 0, obj1+0x19553).
export function skidding(car, sounds = null) {
  if (car.drift !== 0 || car.turn !== 0 || car.hop !== 0) return true;
  const skid = models().skid;
  return Boolean(sounds?.some(s => (typeof s === 'object' ? s.id : s) === skid));
}

// The surfaces that take no marks: by design, the special values of terrain.special-values other than the boost strip (see MARKS).
function marked(surface) {
  const S = models().special;
  return surface !== S.wall && surface !== S.stopped && surface !== S.fall && !S.pit.includes(surface);
}

export function createMarks() {
  let ring = [], next = 0;
  const looseCache = new WeakMap();
  const loose = (world, surface) => {
    let m = looseCache.get(world);
    if (!m) { m = new Map(); looseCache.set(world, m); }
    if (!m.has(surface)) m.set(surface, Boolean(surfacePicture(world, surface, 'first', Number(world.name))));
    return m.get(surface);
  };
  const add = seg => { if (ring.length < MARKS.cap) ring.push(seg); else { ring[next] = seg; next = (next + 1) % MARKS.cap; } };

  return {
    clear() { ring = []; next = 0; },
    get count() { return ring.length; },

    // One completed tick (motion.js snapshots).
    emit(prev, cur) {
      if (!prev || prev === cur || prev.world !== cur.world) return;
      const world = cur.world;
      cur.seats.forEach((c, i) => {
        const p = prev.seats[i];
        if (!c || !p || !c.skid || c.crashed || c.jump !== 0 || p.jump !== 0 || !marked(c.surface)) return;
        const move = Math.hypot(wrap16(c.px - p.px), wrap16(c.py - p.py));
        if (move < MARKS.minStep || move > MOTION.snapDistance) return;
        const soft = loose(world, c.surface), [ax, ay] = headingVector(world, p.dir), [bx, by] = headingVector(world, c.dir);
        for (const side of [-1, 1]) { // the right vector of a heading (x, y) is (-y, x)
          add({ x0: p.px - ay * side * MARKS.wheelSide, y0: p.py + ax * side * MARKS.wheelSide, x1: c.px - by * side * MARKS.wheelSide, y1: c.py + bx * side * MARKS.wheelSide, born: cur.time, width: soft ? MARKS.looseWidth : MARKS.width, strength: soft ? MARKS.looseStrength : MARKS.strength });
        }
      });
    },

    // Draws the marks alive at the presentation time `now` into L.mark for a camera, on the ground pixels only (`kinds`, L's kinds by
    // default). At a geometry G (geometry.js, or any { s, m }) `L` is that grid's (width x height) and a corner at the reference column x and
    // row y lands on s (x + m), s y (at the reference geometry the very numbers it always was); fillQuad keeps its four scanlines a row of
    // the grid. The reference look (config.js HD.look) stamps them on the reference grid ({ s: 1, m }) with no kinds: the composite darkens
    // only the ground's pixels, whose kinds are the output's. With a margin (m > 0, the wide view) the corners are projected through the wide
    // projection (project.js fromCameraAt), so a mark in the margins lies on the texels the floor draws there. `trace` (the checks) gets the
    // box of each quad drawn, { x0, y0, x1, y1 } on the grid.
    stamp(L, world, camera, now, width, height, G = null, kinds = L.kind, trace = null) {
      const sc = G ? G.s : 1, m = G ? G.m : 0;
      for (const s of ring) {
        const age = now - s.born;
        if (age < 0) continue;
        const fade = age <= MARKS.holdMs ? 1 : 1 - (age - MARKS.holdMs) / MARKS.fadeMs;
        if (fade <= 0) continue;
        let a = toCamera(world, camera, s.x0, s.y0), b = toCamera(world, camera, s.x1, s.y1);
        if (a.f < MARKS.near && b.f < MARKS.near) continue;
        if (a.f < MARKS.near) a = cut(b, a); else if (b.f < MARKS.near) b = cut(a, b);
        const df = b.f - a.f, dl = b.l - a.l, len = Math.hypot(df, dl) || 1, nf = (-dl / len) * (s.width / 2), nl = (df / len) * (s.width / 2); // @math half the width either side
        const corners = [[a.f + nf, a.l + nl], [b.f + nf, b.l + nl], [b.f - nf, b.l - nl], [a.f - nf, a.l - nl]].map(([f, l]) => fromCameraAt(world, f, l, true, m));
        if (corners.some(c => !c)) continue;
        const pts = corners.map(c => [sc * (c.column + m), sc * c.bottom]);
        fillQuad(L.mark, pts, s.strength * fade, width, height, kinds, KIND.floor);
        if (trace) trace.push(boxOf(pts));
      }
    },
  };
}

// The box of a quad's corners on its grid.
const boxOf = pts => ({ x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])) });

// The point of the segment q -> p where it crosses the near limit (p is the one in front of the camera's limit).
function cut(p, q) {
  const t = (p.f - MARKS.near) / (p.f - q.f);
  return { f: MARKS.near, l: p.l + (q.l - p.l) * t };
}

