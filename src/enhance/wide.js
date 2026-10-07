// The things a wide view's margins show (Stage 4, M8: docs/enhancements.md, Stage 4 as built). The game's draw list (render/scene.js
// sceneRecords) holds only what its 320 columns show: view.js culls every point outside its fan, its box and its cone, besides the filters
// that switch things off (a taken or consumed object, a racer gone after a head-on crash, the duck game's gone and skipped ducks, no starter in
// the duck game, the shoot-out or once the start has decided the lion is not seen, the intro's human, the wreck's pictures, the countdown's
// glances). The margins' records come from that same function, so every filter applies and nothing of the game is written again:
// - the main list (sceneRecords from the camera, as the reference draws it) decides every thing it holds, one record a thing;
// - every other thing that may be drawn (the racers, the ducks or the other human, the intro's human, the objects, the active shots, the
//   starter at starterPoint) is projected through the wide projection (project.js projectAt: the equiangular continuation outside the fan). It
//   is a candidate when its column lies outside the reference columns or within WIDE.seam of their edges (where the game's whole-unit column
//   and the enhancer's can differ), the middle of its widest picture within the picture's refW columns ([-m - h, 319 + m + h], h half the
//   width of its class 0 picture) and its distance within the game's 80..1122. A seam candidate inside the reference columns must also lie in
//   the game's box (view.js viewSetup): the game decides what its 320 columns show, and only the rounding of its column is second-guessed, so
//   a far thing the box culls appears at the reference edges (columns 0 and 319), where the margins begin;
// - a candidate not yet known this tick is asked about with an aimed probe: sceneRecords from a camera WIDE.probeDistance back from it along
//   the TRIG entry nearest its bearing, facing along that entry. The candidate then stands at about column 160 and distance 400 of the probe,
//   inside every cull, so a probe that does not return it means a game filter dropped it. Every record a probe returns makes its thing known
//   for the tick (so one probe usually serves its neighbours); the probe's own car is dropped. What is known is kept per world, tick and seat,
//   because the filters and the frame bytes are the tick's state;
// - a known thing becomes a margin record: the probe's identity, frame bytes and shape (its picture's .INF shape, blit.js shapeOf), placed by
//   the wide projection from the main camera: its distance (the VIEW word continued past the table), its size class clamp(trunc((d -
//   sizeBase) / sizeStep), 0, maxSize), its bottom row from the row table and its column, the picture whole (no clip; the blit cuts it).
// The probes' frames follow the heading the main list's do (frames.heading: the tick's), and every record field but the projection is
// independent of the camera (racers' frames by that heading, ducks by the car's, the lion by heading 0 and its frame, objects by objectFrame,
// shots by their block and frame), so a margin record has the frame the game would choose. The order: the game's own selection sort decides
// the main list's order as it always did; the margin records, sorted the same way among themselves, are merged into it by distance, after
// the main records of the same distance (mergeOrder). Merging before the sort (the plan's wording) could reorder main records of equal
// distance, since the selection sort is not stable, and so change pixels the standard view draws.
import { sceneRecords } from '../render/scene.js';
import { starterPoint } from '../game/start.js';
import { viewRacers } from '../game/versus.js';
import { viewSetup } from '../game/view.js';
import { shapeOf } from './blit.js';
import { projectAt, toCamera, headingVector, roundWord } from './project.js';
import { WIDE } from './config.js';
import { models } from './models.js';

const wrap16 = v => v - 65536 * Math.round(v / 65536); // @math world words are 16 bits: the shortest signed difference

// The thing a draw record shows, for the one-record-a-thing rule: 'r' and the racer's index in its list (the intro's human is racer 0), 'o'
// and the object's, 's' and the shot's, 'lion' for the starter; null for the own car (always the main list's).
export const recordKey = r => (r.type === 0 ? null : r.shot !== undefined ? `s${r.shot}` : r.object >= 0 ? `o${r.object}` : r.type === 1 ? `r${r.racer}` : 'lion');

// The things of a present state that may be drawn, each { key, x, y, half } (half: half the width of its class 0 picture, rounded down).
export function wideCandidates(P) {
  const world = P.world, car = world.carShape[0].w >> 1, out = []; // @math half the width
  if (P.intro) out.push({ key: 'r0', x: P.car.px, y: P.car.py, half: car });
  const racers = P.versus ? viewRacers(P) : P.ai?.racers ?? [];
  for (let n = 1; n < racers.length; n++) out.push({ key: `r${n}`, x: racers[n].x, y: racers[n].y, half: car });
  (P.player?.objects ?? []).forEach((o, i) => { const shape = world.shapes?.get(world.sprites?.[o.id]?.shape); if (shape?.length) out.push({ key: `o${i}`, x: o.x, y: o.y, half: shape[0].w >> 1 }); }); // @math half the width
  if (world.start) { const p = starterPoint(world.start); out.push({ key: 'lion', x: p.x, y: p.y, half: car }); }
  (P.shots ?? []).forEach((s, i) => { if (s.active) out.push({ key: `s${i}`, x: s.x, y: s.y, half: world.shotShape[0].w >> 1 }); }); // @math half the width
  return out;
}

// The main list's order kept, the margin records merged in by distance (both lists sorted farthest first by the game's sort; a margin
// record goes after the main records of its distance).
export function mergeOrder(main, margin) {
  if (!margin.length) return main;
  const out = [];
  let j = 0;
  for (const r of main) { while (j < margin.length && margin[j].distance > r.distance) out.push(margin[j++]); out.push(r); }
  while (j < margin.length) out.push(margin[j++]);
  return out;
}

// The probe camera of a thing at (x, y) seen from `camera`: WIDE.probeDistance back from it along the TRIG entry nearest its bearing, facing
// along that entry; null where its row would fail view.js's sign test (a camera row at or below 0, never on a track).
export function probeCamera(world, camera, x, y) {
  const V = models().view, { f, l } = toCamera(world, camera, x, y), t = (Math.atan2(l, f) * V.turn) / (2 * Math.PI); // @math the bearing in TRIG entries
  const e = (((Math.round(camera.heading) + Math.round(t)) % V.turn) + V.turn) % V.turn, [vx, vy] = headingVector(world, e);
  const probe = { x: roundWord(x - vx * WIDE.probeDistance), y: roundWord(y - vy * WIDE.probeDistance), heading: e };
  return wrap16(y - probe.y) < wrap16(y) ? probe : null;
}

// The wide view's records of an enhancer: `records(P, camI, frames, main, G, seat)` returns the margin records of the frame (P the present
// state, camI the whole camera the main list was made from, `frames` its frames' heading, `main` the main list), and how many probes it took;
// `reset()` forgets what is known (a new scene).
export function createWide() {
  let at = null, known = new Map();
  const probes = { count: 0 };
  return {
    reset() { at = null; known = new Map(); },
    get probes() { return probes.count; },
    records(P, camI, frames, main, G, seat = 0) {
      const V = models().view, world = P.world, { m } = G, heading = frames?.heading ?? camI.heading, last = V.maxColumn, box = viewSetup(world, camI).box;
      if (!at || at.world !== world || at.tick !== P.tick || at.seat !== seat || at.heading !== heading) { at = { world, tick: P.tick, seat, heading }; known = new Map(); }
      const inMain = new Set(main.map(recordKey)), out = [];
      for (const c of wideCandidates(P)) {
        if (inMain.has(c.key)) continue;
        const p = projectAt(world, camI, c.x, c.y, m);
        if (!p || (p.column >= WIDE.seam && p.column <= last - WIDE.seam) || p.column < -m - c.half || p.column > last + m + c.half || p.distance < V.minDistance || p.distance > V.maxDistance) continue; // inside the reference fan (the main list's), beyond the picture or the distances
        if (p.column >= 0 && p.column <= last && (c.x < box.x0 || c.x > box.x1 || c.y < box.y0 || c.y > box.y1)) continue; // at a seam inside the reference columns, culled by the game's box (view.js projectPoint's test): the game's decision there, not a rounding of its column
        if (!known.has(c.key)) {
          const cam = probeCamera(world, camI, c.x, c.y);
          if (cam) {
            probes.count++;
            for (const r of sceneRecords(P, cam, { heading })) { const k = recordKey(r); if (k !== null && !known.has(k)) known.set(k, r); }
          }
          if (!known.has(c.key)) known.set(c.key, null); // a game filter dropped it (or no probe could be made)
        }
        const R = known.get(c.key), info = R ? shapeOf(world, R.picture) : null;
        if (!info) continue;
        const d = Math.round(p.distance), k = Math.min(Math.max(Math.trunc((p.distance - V.sizeBase) / V.sizeStep), 0), V.maxSize), picture = info.shape[k];
        const column = V.center + Math.trunc(p.column - V.center), bottom = world.rows[Math.min(d, world.rows.length - 1)]; // the whole camera's place, the column whole toward the middle as the game's is
        if (bottom - picture.h > V.maxRow) continue;
        out.push({ width: picture.w, height: picture.h, left: column - (picture.w >> 1), top: bottom - picture.h, picture, firstColumn: 0, skipRows: 0, frame: R.frame, distance: d, sizeClass: k, type: R.type, racer: R.racer, object: R.object, ...(R.shot !== undefined ? { shot: R.shot } : {}), margin: true }); // @math half the width, rounded down
      }
      return out;
    },
  };
}
