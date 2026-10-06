// Smooth motion: the numbers the draw reads that move between two completed ticks (the cameras, the cars' points, the horizon offset, the
// computer racers and the shots), captured after every tick and blended for the picture shown between them. Gameplay stays on the ticks:
// nothing here is written back, the sprite frames, sizes and animation words are the state's own, and a jump larger than any move (a race
// start, a restart, the next round, a respawn) is shown at once instead of travelled through.
import { MOTION } from './config.js';
import { roundWord } from './project.js';
import { skidding } from './marks.js';
import { models } from './models.js';

const wrap16 = v => v - 65536 * Math.round(v / 65536); // @math world words are 16 bits: the shortest signed difference

// The seats in seat order (player one first): the car and the frame's "before the answer" camera of each.
function seatEntries(state) {
  const own = { car: state.car, pre: state.beforeAnswer };
  if (!state.versus || !state.seat2) return [own];
  const other = { car: state.seat2.car, pre: state.seat2.beforeAnswer };
  return state.versus.viewer === 1 ? [other, own] : [own, other];
}

// The snapshot of a completed tick. `time` is the presentation clock of the tick (ms), `sounds` the tick's sounds (for the brake's skid;
// a split screen's sounds are not told apart by seat, so there only the skid states count).
export function capture(state, time = 0, sounds = null) {
  const heard = state.versus ? null : sounds;
  return {
    world: state.world, tick: state.tick, time,
    seats: seatEntries(state).map(({ car, pre }) => (car ? { cx: pre?.cx ?? car.cx, cy: pre?.cy ?? car.cy, heading: pre?.heading ?? car.heading, tickHeading: pre?.heading ?? car.heading, dir: car.heading, px: car.px, py: car.py, horizon: car.horizon, sky: car.horizon, surface: car.surface, speed: car.speed, jump: car.jump, special: car.special, specialValue: car.specialValue, spark: car.spark, sparkCount: car.sparkCount, skid: skidding(car, heard), crashed: Boolean(car.crashed || car.wrecked) } : null)),
    racers: (state.ai?.racers ?? []).map(r => ({ x: r.x, y: r.y, crashed: Boolean(r.crashed) })),
    shots: (state.shots ?? []).map(s => (s.active ? { x: s.x, y: s.y } : null)),
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

// The shortest turn from heading a to heading b (compass units, one turn = view.model's turn).
export function turnDelta(a, b) {
  const turn = models().view.turn, half = turn / 2; // @math half a turn either way
  let d = (((b - a) % turn) + turn) % turn;
  if (d > half) d -= turn;
  return d;
}
export const wrapHeading = h => { const turn = models().view.turn; return ((h % turn) + turn) % turn; };

// The horizon offset between two ticks: the strip repeats every bounds[2] - bounds[0] offsets (horizon.js wraps 0 -> 160 and 240 -> 80),
// so the step is taken the short way round and the result put back into 0 to bounds[3].
export function blendHorizon(a, b, t) {
  const [first, , third, fourth] = models().horizon, period = third - first;
  let d = b - a;
  if (d > period / 2) d -= period; else if (d < -period / 2) d += period; // @math half the period either way
  let h = a + d * t;
  while (h < first) h += period;
  while (h > fourth) h -= period;
  return h;
}

// The step of the horizon offset from one tick to the next, the short way round its period (the wraps 240 -> 80 and 0 -> 160 are no step).
export function horizonStep(a, b) {
  const [first, , third] = models().horizon, period = third - first;
  let d = b - a;
  if (d > period / 2) d -= period; else if (d < -period / 2) d += period; // @math half the period either way
  return d;
}

// `sky`: how far the sky has turned (in horizon offsets) since the scene began, the strip's offset without its wraps: what the clouds move by.
function carrySky(prev, cur) {
  cur.seats.forEach((s, i) => { const p = prev.seats[i]; if (s && p) s.sky = p.sky + horizonStep(p.horizon, s.horizon); });
}

function pointBlend(p, c, t) {
  if (!p || !c) return c;
  const dx = wrap16(c.x - p.x), dy = wrap16(c.y - p.y);
  if (Math.hypot(dx, dy) > MOTION.snapDistance) return c;
  return { ...c, x: p.x + dx * t, y: p.y + dy * t };
}

function seatBlend(p, c, t) {
  if (!p || !c) return c;
  const dx = wrap16(c.cx - p.cx), dy = wrap16(c.cy - p.cy), dh = turnDelta(p.heading, c.heading);
  if (Math.hypot(dx, dy) > MOTION.snapDistance || Math.abs(dh) > MOTION.snapTurn) return c; // a discontinuity of the view: shown at once
  const car = pointBlend({ x: p.px, y: p.py }, { x: c.px, y: c.py }, t);
  return { ...c, cx: p.cx + dx * t, cy: p.cy + dy * t, heading: p.heading + dh * t, px: car.x, py: car.y, horizon: blendHorizon(p.horizon, c.horizon, t), sky: p.sky + (c.sky - p.sky) * t };
}

// The picture between two snapshots: t = 0 is `prev`, t = 1 is `cur`. Another world or an earlier tick is a new scene: `cur` alone.
export function blend(prev, cur, t) {
  if (!prev || prev === cur || prev.world !== cur.world || prev.tick > cur.tick || t >= 1) return cur;
  return {
    world: cur.world, tick: cur.tick, time: lerp(prev.time, cur.time, t),
    seats: cur.seats.map((c, i) => seatBlend(prev.seats[i], c, t)),
    racers: cur.racers.map((c, i) => pointBlend(prev.racers[i], c, t)),
    shots: cur.shots.map((c, i) => pointBlend(prev.shots[i], c, t)),
  };
}

// The present state: a shallow copy of the state in which each seat's frame is drawn from the blend's camera (its "before the answer"
// camera, which the reference renderer draws from) and its car stands at the blend's point, rounded to the words the reconstructed renderer
// takes; the cars keep the tick's headings (the other human's direction frame follows its compass word) and copies are made of everything
// the draw would otherwise share and change (the seats, the viewer word).
export function present(state, fine) {
  const P = { ...state };
  const camera = f => ({ cx: roundWord(f.cx), cy: roundWord(f.cy), heading: wrapHeading(Math.round(f.heading)) });
  const put = (holder, car, f) => { if (car && f) { holder.car = { ...car, px: roundWord(f.px), py: roundWord(f.py) }; holder.beforeAnswer = camera(f); } };
  if (state.versus && state.seat2) {
    P.versus = { ...state.versus }; P.seat2 = { ...state.seat2 };
    const [mine, other] = state.versus.viewer === 1 ? [1, 0] : [0, 1]; // @math the seats of the state's car and of the waiting seat
    put(P, state.car, fine.seats[mine]); put(P.seat2, state.seat2.car, fine.seats[other]);
  } else put(P, state.car, fine.seats[0]);
  if (state.ai) P.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (fine.racers[n] ? { ...r, x: roundWord(fine.racers[n].x), y: roundWord(fine.racers[n].y) } : r)) };
  if (state.shots) P.shots = state.shots.map((s, i) => (s.active && fine.shots[i] ? { ...s, x: roundWord(fine.shots[i].x), y: roundWord(fine.shots[i].y) } : s));
  return P;
}

// The controller of a race's snapshots: `tick` after each completed tick, `view` for every picture. A picture whose blend went back
// without a tick in between (the page restarts its accumulator when the in-race menu closes) carries on from the picture last shown.
export function createMotion() {
  let prev = null, cur = null, last = 0, ticked = false, time = 0;
  const delay = { sum: 0, count: 0 };
  return {
    reset() { prev = null; cur = null; last = 0; ticked = false; },
    tick(state, tickMs, sounds = null) { time += tickMs; prev = cur; cur = capture(state, time, sounds); if (!prev || prev.world !== cur.world || prev.tick > cur.tick) prev = cur; else carrySky(prev, cur); ticked = true; return { prev, cur }; },
    view(state, alpha, tickMs) {
      if (!cur || cur.world !== state.world) { cur = capture(state, time); prev = cur; }
      const t = Math.min(Math.max(alpha, 0), 1);
      if (!ticked && t < last) prev = blend(prev, cur, last);
      ticked = false; last = t;
      delay.sum += (1 - t) * tickMs; delay.count++;
      return blend(prev, cur, t);
    },
    // The mean delay the blend adds to the picture (ms) since the last call.
    takeDelay() { const d = delay.count ? delay.sum / delay.count : 0; delay.sum = 0; delay.count = 0; return d; },
    get snapshots() { return { prev, cur }; },
  };
}
