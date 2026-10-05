// The Wacky Duck Shoot's racers (duck.race-rules, duck.racers, duck.pictures, STATIC): seven ducks that follow the zone track's route at one speed, 260 route points apart from a random
// point of it, a plain one that a hog stuns for 4 frames before it explodes and a helmeted one that takes two, the score of their explosions, and the new round once all are gone. The
// race around them (the player's car, the shots, the HUD) is the single player race with the duck rules switched on (race.js, car.js, control.js).
import { RULES, RACERS, PICTURES, GLANCE } from './duck-rules.js';
import { routeEntries } from './ai.js';
import { blinkStart } from './blink.js';
import { CONTACT } from './contact.js';
import { nextSpin } from './shots.js';

export { duckRules, duckPictures, duckSounds, duckGlance } from './duck-rules.js';

// The track of a zone (1 to 6) of the regular or the bonus pack's zones (the zone word of the chooser plus 10, or plus 0x1f).
export const duckTrack = (zone, bonus = false) => (bonus ? RULES().bonusTrack : RULES().firstTrack) + zone - 1; // @math zones count from 1

// The two slots of the ducks (obj1+0x227e0): the plain duck's is the lowest driver number that is not the player's, the helmeted duck's the lowest that is neither.
export function duckSlots(player) {
  const drivers = RULES().racers + 1; // @math the seven computer racers and the player
  const free = Array.from({ length: drivers }, (_, n) => n).filter(n => n !== player);
  return { plain: free[0], helmeted: free[1] };
}

// The route point a duck that has read `steps` points from the cursor `from` stands on, and its cursor after them (obj1+0x6d68: the walker reads x, then y, and goes on to the next entry when the
// entry's points are used up, the entry after the last being the first).
export function walkRoute(entries, from, steps) {
  const last = entries.length - 1;
  let { entry, index } = from, x = null, y = null;
  for (let s = 0; s < steps; s++) {
    const p = entries[entry].points[index]; x = p[0]; y = p[1]; index++;
    if (index >= entries[entry].points.length) { entry = entry + 1 > last ? 0 : entry + 1; index = 0; }
  }
  return { entry, index, x, y };
}

const duckRacer = (n, at, entries, slot, helmeted, speed) => ({
  n, x: at.x, y: at.y, blink: blinkStart(), hit: 0, hitStamp: 0, hitSpin: 0, entry: at.entry, index: at.index, compass: entries[at.entry].compass, lap: 0, prev: 0, key1: 0, key2: 0, place: 0,
  mode: 0, lateral: 0, state: RACERS().state, first: 0, second: 0, level: speed, fast: speed, slow: speed, slot, helmeted, hp: RACERS().hitPoints, flicker: 0, crashed: false, crashPic: 0,
});

// The ducks of a round (obj1+0x6f90, +0x6f24, +0xbf00): `rng()` is a number from 0 up to 1 (the game draws a route entry at random), `round` the round word, `player` the player's driver.
export function createDuckAi(world, { round = 0, rng = Math.random, player = 0, gap = null } = {}) { // `gap` replaces the 260 points between the ducks (for the check's variants)
  const R = RULES(), D = RACERS(), entries = routeEntries(world.route), last = entries.length - 1, speed = world.aiSpeeds[D.speedEntry], slots = duckSlots(player);
  const helmeted = Math.min(round + D.helmetedFirst, D.helmetedLimit), start = Math.min(Math.floor(rng() * (last + 1)), last);
  const second = world.gam.starts[1], bias = world.start.x - world.gam.starts[0].x; // the second start pair and its bias (racer.init: the start tables hold the pairs plus 0x3e0)
  const racers = [{ n: 0, x: world.start.x, y: world.start.y, blink: blinkStart(), hit: 0, hitStamp: 0, hitSpin: 0, entry: 0, index: 0, compass: entries[0].compass, lap: 0, prev: 0, key1: 0, key2: 0, place: 0, mode: 0, lateral: 0, state: D.state, first: 0, second: 0, level: speed, fast: speed, slow: speed, slot: player, helmeted: false, hp: 0, flicker: 0, crashed: false, crashPic: 0 }];
  let cursor = { entry: start, index: 0 };
  for (let n = 1; n <= R.racers; n++) {
    const at = n === 1 ? { x: second.x + bias, y: second.y + bias, ...cursor } : { ...walkRoute(entries, cursor, gap ?? D.gap) }; // racer 1 stands where the start table puts it until its first step
    if (n > 1) cursor = { entry: at.entry, index: at.index };
    racers.push(duckRacer(n, at, entries, n <= helmeted ? slots.helmeted : slots.plain, n <= helmeted, speed));
  }
  return { racers, entries, last, level: R.level, speeds: world.aiSpeeds, threshold: 0, finished: 0, slots, round };
}

// The animation words of the ducks (obj1+0x16288 to +0x162f4, the animation of the draw group that comes first in a frame): the crash pictures of the crashed racers go on one while the word is not
// above 3, and a duck that took its absorbed hit toggles its flicker word (obj1+0x154ca).
export function animateDucks(ai) {
  const D = RACERS();
  return { ...ai, racers: ai.racers.map(r => {
    if (r.n === 0) return r;
    const next = { ...r };
    if (next.hp === 0) next.flicker = 1 - next.flicker;
    if (next.crashed && next.crashPic <= D.crashPictures - 1) next.crashPic++;
    return next;
  }) };
}

// The racers' step of a frame (obj1+0x18cac in the duck): a racer that crashed does nothing; one that is stunned spins its picture and, 4 frames after the hit, explodes (BOOM, the crash
// pictures start, the score goes up by 2 for the helmeted slot or 1 for the plain one, at most 0x63); the others walk `level` route points. env = { human (the car's point or null), tick,
// score }. Returns the ducks, the racers that touched the car, the score and the sounds.
export function stepDuckAi(ai, env) {
  const D = RACERS(), range = CONTACT().range, racers = ai.racers.map(r => ({ ...r })), contacts = [], sounds = [];
  let score = env.score;
  for (let n = 1; n < racers.length; n++) {
    const r = racers[n];
    if (r.crashed) continue;
    if (r.hit !== 0) {
      r.hitSpin = nextSpin(r.hitSpin); // the stun picture goes on one of the eight frames (obj1+0x162ab)
      if (env.tick - r.hitStamp >= (env.stunFrames ?? D.stunFrames)) {
        r.hit = 0; r.crashed = true; r.crashPic = 0; sounds.push(D.sounds.boom);
        score = Math.min(score + (r.helmeted ? D.points.helmeted : D.points.plain), RULES().scoreCap);
      }
      continue;
    }
    for (let s = 0; s < (env.level ?? r.level); s++) {
      const e = ai.entries[r.entry], p = e.points[r.index];
      r.x = p[0]; r.y = p[1]; r.index++;
      if (r.index >= e.points.length) { r.entry = r.entry + 1 > ai.last ? 0 : r.entry + 1; r.index = 0; r.compass = ai.entries[r.entry].compass; }
      if (env.human && Math.abs(r.x - env.human.x) + Math.abs(r.y - env.human.y) < range && !contacts.includes(n)) contacts.push(n);
    }
  }
  return { ai: { ...ai, racers }, contacts, score, sounds };
}

// A duck that has shown its last crash picture is not drawn any more (obj1+0x157bb): it has no record in the draw list.
export const gone = racer => racer.crashed && racer.crashPic >= RACERS().crashPictures;

// Whether every duck has crashed and shown its last crash picture: the round check (obj1+0x6eac) then places the next round.
export const roundOver = ai => ai.racers.slice(1).every(gone);

// The picture of a duck for the draw: the bytes of its DIGGER.SP frame (the frame of its compass word, the helmeted duck's from the second eight) or of the crash picture; null once it is gone.
export function duckPicture(art, racer, frame) {
  const P = PICTURES(), at = (base, k) => (base + k) * P.frameBytes;
  if (racer.crashed) return racer.crashPic < RACERS().crashPictures ? art.genef.subarray(P.explosion.at + racer.crashPic * P.frameBytes, P.explosion.at + (racer.crashPic + 1) * P.frameBytes) : null;
  const start = at(racer.helmeted ? P.helmeted : P.plain, frame);
  return art.digger.subarray(start, start + P.frameBytes);
}

// Whether the draw skips a duck this pass: the one that took its absorbed hit shows on every second pass (obj1+0x154ca to +0x15516).
export const skipped = racer => racer.hp === 0 && racer.flicker === 1;

// The object table of a zone (obj1+0x113f0): every object whose catalogue kind is above 2 takes the sprite id of the first kind 2 sprite of the zone's objects (the hog crate), as the
// sprite loader (obj1+0x11310) picks it: the lowest catalogue number of the objects' sprites that has the kind 2.
export function crateObjects(world, objects) {
  const C = RULES().crates, present = new Set(objects.map(o => o.id));
  const first = world.sprites.findIndex((s, id) => present.has(id) && s.kind === C.kind);
  if (first < 0) return objects;
  return objects.map(o => (world.sprites[o.id].kind > C.aboveKind ? { ...o, id: first } : o));
}

// What a shot that reaches a duck leaves in it (obj1+0x11ab2 to +0x11b35): a duck of the helmeted slot takes one hit before the next counts (its hit points go down, its flicker word is set); a hit
// that counts stuns the duck (the hit state 1, the picture word its frame word, the stamp the frame counter). Returns the words that changed.
export function hitDuck(racer, tick) {
  const out = {};
  let counts = true;
  if (racer.helmeted) { out.flicker = 1; out.hp = racer.hp - 1; counts = out.hp < 0; }
  if (counts) { out.hit = 1; out.hitSpin = racer.frame ?? 0; out.hitStamp = tick; } // @math the hit state 1 is a stun (item.shot-rules)
  return out;
}
