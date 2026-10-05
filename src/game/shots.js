// The fire key and the shots (item.shot-rules, STATIC): the fire routine (obj1+0x14364), the 61 shot records with their spawn, move, update and explosion, the shot test against the wall,
// the objects and the racers, the stun of a hit computer racer and the hit on the human. Shots are plain objects in a fixed list; the functions return new values.
import { K } from '../evidence/k.js';
import { straightMove } from './car.js';
import { walkLine } from './walk.js';
import { terrainAt } from './surface.js';
import { MODEL } from './car-model.js';
import { projectPoint } from './view.js';
import { clipPicture } from './objects.js';

const RULES = () => K({
  fireRoutine: 0x14364, jumpTable: 0x14340, spawner: 0x1d548, moveRoutine: 0x15e6c, updateRoutine: 0x1602c, testRoutine: 0x118a4, walkRoutine: 0x12230, hitHandler: 0x189ec, racerWords: 0x161fc,
  slots: 61, listAt: 0x1f2b0, recordBytes: 0x22,
  hold: { ticks: 20, item: 8 },
  spawn: { step: 10, devilStep: 16, limit: 1000, afterStep: 100 },
  headings: { lane: 0x1e, side: 0x1e0, back: 0x3c0 },
  radius: { object: 14, racer: 18 },
  frames: { bytes: 0xea, explosion: 3, hog: 3, single: 1, ice: 3 },
  blocks: { explosion: 0, hog: 0x2be, fan: 0x57c, devil: 0x666, mineA: 0x750, mineB: 0x83a, mineC: 0x924, ice: 0x1506 },
  types: { hog: 0, devil: 1, mineA: 2, mineB: 3, mineC: 4, ice: 5 },
  items: { fan: 3, devils: 4, mineA: 5, mineB: 6, mineC: 7, ice: 8 },
  volley: { hog: 1, fan: 3 },
  sounds: { hog: 0x14, fan: 0x13, other: 0x17, ice: 0x14, click: 0x1a, explosion: 0x12, hit: 0x11, ice2: 0x19, ice3: 0x18 },
  stun: { hit: 33, ice: 50 },
  hitStates: { hit: 1, ice: 2, iceBack: 3 },
  iceSounds: { ice2: 13, ice3: 6 },
  spin: { frames: 8, last: 7 },
  explode: { collision: 1 },
}, 'item.shot-rules');
const CODES = { wall: 1, object: 2, racer: 3 }; // @math the collision words of car.collision-test
const EXPLODING = 0xff; // @math the state word of an exploded record (obj1+0x161c1)
const CONSUMED = 0xffff; // @math the consumed marker of the .SPW word +2 (atr.kind-effects)

// The sounds whose ending the game asks about (obj1+0x1bbc): the two ice sounds. A clock holds the call at which each stops (their lengths are measured, item.shot-rules).
export const createSoundClock = () => ({ until: new Map() });
export const playing = (clock, id, tick) => (clock.until.get(id) ?? 0) > tick;
export function play(clock, id, tick) {
  const R = RULES(), length = id === R.sounds.ice2 ? R.iceSounds.ice2 : id === R.sounds.ice3 ? R.iceSounds.ice3 : 0;
  if (length) clock.until.set(id, tick + length);
}

const idle = () => ({ active: 0 });
export const createShots = () => Array.from({ length: RULES().slots }, idle);

const wrap = (v, turn) => ((v % turn) + turn) % turn; // @math a heading index modulo a turn

// The fire routine for the human (obj1+0x14364). `fire` is the sampler's fire word, `volley` the racer word +0x12, `env` { tick }. Returns the car, the volley, the shots to spawn
// ({ type, lane or heading, block, frames, owner }) and the sounds it asks for.
export function fireStep(car0, volley0, fire, env, { shareware = false } = {}) {
  const R = RULES(), turn = MODEL().turn, car = { ...car0 }, out = { spawns: [], sounds: [] };
  let volley = volley0, key = fire;
  const done = () => ({ car, volley, ...out });
  if (key && (car.crashed || car.wrecked)) return done();
  if (!key) { car.firePress = env.tick; car.fireLatch = 0; return done(); }
  if (car.fireLatch === 0) { car.fireLatch = 1; car.firePress = env.tick; } else key = false; // a held key does not repeat
  if (env.tick - car.firePress >= R.hold.ticks) { // a long hold gives the ice
    car.firePress = env.tick;
    if (car.held !== R.hold.item && !shareware) { out.sounds.push('driver'); car.held = R.hold.item; }
    key = false;
  }
  if (!key || car.jump !== 0 || volley !== 0) return done();
  if (car.held === 0 && car.counter === 0) { out.sounds.push({ id: R.sounds.click, guard: true }); return done(); }
  const H = car.heading, owner = env.owner ?? 0, sel = car.held; // the shot's owner is the viewer's index (obj1+0x1453a)
  const add = (type, lane, block, frames) => out.spawns.push({ type, lane, block, frames, owner });
  const T = R.types, B = R.blocks, F = R.frames, side = R.headings.side, back = R.headings.back;
  let sound = 0;
  if (sel === 0) { add(T.hog, 0, B.hog, F.hog); sound = R.sounds.hog; volley = R.volley.hog; }
  else if (sel === R.items.fan) { for (const lane of [0, 1, 2]) add(T.hog, lane, B.fan, F.single); sound = R.sounds.fan; volley = R.volley.fan; } // @math the lanes 0, 1 and 2: straight, less and more than the heading
  else if (sel === R.items.devils) { add(T.devil, wrap(H + side, turn), B.devil, F.single); add(T.devil, wrap(H - side, turn), B.devil, F.single); sound = R.sounds.other; volley = 0; }
  else if (sel === R.items.mineA) { add(T.mineA, wrap(H + back, turn), B.mineA, F.single); sound = R.sounds.other; volley = 0; }
  else if (sel === R.items.mineB) { add(T.mineB, wrap(H + back, turn), B.mineB, F.single); sound = R.sounds.other; volley = 0; }
  else if (sel === R.items.mineC) { add(T.mineC, wrap(H + back, turn), B.mineC, F.single); sound = R.sounds.other; volley = 0; }
  else if (sel === R.items.ice) { add(T.ice, 0, B.ice, F.ice); sound = R.sounds.ice; volley = 0; }
  if (sound) out.sounds.push({ id: sound, guard: true }); // the shot's sound waits for the last voice of its number (obj1+0x147c9)
  if (car.held === 0) car.counter -= 1; else car.held = 0;
  return done();
}

// The step of a record along a heading (the rounded vector of the TRIG table).
const stepOf = (world, heading, length) => straightMove(world.trig, heading, length);

// The heading a record moves along (obj1+0x15e6c): the types 0 and 5 follow the owner's heading with their lane, the others have their own.
function headingOf(shot, ownerHeading, turn) {
  const R = RULES();
  if (shot.type === R.types.hog || shot.type === R.types.ice) return shot.lane === 0 ? ownerHeading : shot.lane === 1 ? wrap(ownerHeading - R.headings.lane, turn) : wrap(ownerHeading + R.headings.lane, turn); // @math the lane words 1 and 2: less and more than the heading
  return shot.lane;
}

// The move of a record. mode 0 is the one step of the spawner (no test), mode 1 the move of an update. `test(point)` is the shot test. Returns the record with its position and the
// length of the step used.
function move(world, shot, mode, ownerHeading, test) {
  const R = RULES(), turn = MODEL().turn, still = shot.type > R.types.devil && shot.type !== R.types.ice; // @math the types 2, 3 and 4 stand still
  const h = headingOf(shot, ownerHeading, turn);
  let end = { x: shot.x, y: shot.y };
  if (!(mode === 1 && still)) { const d = stepOf(world, h, shot.step); end = { x: (shot.x + d.dx) & 0xffff, y: (shot.y + d.dy) & 0xffff }; } // @math 16-bit world words
  if (mode === 0) return { ...shot, x: end.x, y: end.y, used: shot.step, code: 0 };
  let code = 0;
  const found = walkLine({ x: shot.x, y: shot.y }, end, point => { code = test(point, shot); return code; });
  const at = code === CODES.racer && shot.type === R.types.devil ? end : found ? found.point : end;
  return { ...shot, x: at.x, y: at.y, used: shot.step, code };
}

// Spawns a record in the first free slot (obj1+0x1d548): the car's point, one step of the spawn move, the travel and the frame set to 0.
export function spawnShot(world, shots, spawn, point, ownerHeading) {
  const R = RULES(), slot = shots.findIndex(s => !s.active);
  if (slot < 0) return shots;
  const type = spawn.type, step = type === R.types.devil ? R.spawn.devilStep : R.spawn.step;
  let shot = { active: 1, owner: spawn.owner, type, state: 0, overlap: 1, x: point.x, y: point.y, lane: spawn.lane, step, limit: R.spawn.limit, travel: 0, frame: 0, frames: spawn.frames, block: spawn.block };
  shot = { ...move(world, shot, 0, ownerHeading, () => 0), travel: 0, frame: 0 };
  const next = shots.slice(); next[slot] = shot; return next;
}

const manhattan = (x, y, px, py) => Math.abs(x - px) + Math.abs(y - py);
const s16 = v => ((v + 0x8000) & 0xffff) - 0x8000; // @math a 16-bit world word as signed

// One update of all records (obj1+0x1602c), after the AI step. `ctx` is { world, objects, racers, ownerHeading(owner), tick, sounds, effects }: `racers` are working copies
// ({ x, y, hit, hitStamp, hitSpin, human, airborne, wrecked, crashed, inverted }) that the test changes; `objects` the live .SPW records ({ x, y, consumed }). Returns the records, the
// racers, the owners that lost a volley count and the effects on the human.
export function stepShots(shots0, ctx) {
  const R = RULES(), turn = MODEL().turn, shots = shots0.map(s => ({ ...s })), volleys = [], sounds = [], effects = [], racers = ctx.racers;
  const test = (point, shot) => { // obj1+0x118a4: the wall, an object, then a racer
    if (terrainAt(ctx.world, point.x, point.y) === 3) return CODES.wall; // @math the wall terrain value (car.bounce-rules)
    for (const o of ctx.objects) if (o.consumed !== CONSUMED && manhattan(s16(point.x), s16(point.y), s16(o.x), s16(o.y)) < R.radius.object) return CODES.object;
    for (let n = 0; n < racers.length; n++) {
      const r = racers[n];
      if (r.wrecked || r.airborne) continue;
      let near = manhattan(s16(point.x), s16(point.y), s16(r.x), s16(r.y)) < R.radius.racer;
      if (n === shot.owner) {
        if (near) { if (shot.overlap !== 0 || shot.type === R.types.hog || shot.type === R.types.ice) near = false; }
        else if (shot.overlap !== 0) shot.overlap = 0;
      }
      if (!near) continue;
      if (r.hit !== 0) return CODES.racer; // already hit: the record is only consumed
      shot.x = r.x; shot.y = r.y;
      if (!r.human) {
        if (ctx.duck) { // the duck game's hit (obj1+0x11ab2): its sound whatever the type, then what the duck keeps of it (duck.js hitDuck)
          sounds.push(ctx.duck.sound); Object.assign(r, ctx.duck.hit(r, ctx.tick));
          return CODES.racer;
        }
        if (shot.type === R.types.ice) { r.hit = R.hitStates.ice; r.hitStamp = ctx.tick; if (!playing(ctx.clock, R.sounds.ice2, ctx.tick)) { sounds.push(R.sounds.ice2); play(ctx.clock, R.sounds.ice2, ctx.tick); } }
        else { sounds.push(R.sounds.hit); r.hit = R.hitStates.hit; r.hitSpin = r.frame ?? 0; r.hitStamp = ctx.tick; }
        return CODES.racer;
      }
      if (r.crashed) return CODES.racer;
      const kind = ctx.shoot && shot.type === R.types.ice ? R.types.hog : shot.type; // the shoot-out and the duck game take an ice shot for a hog (obj1+0x11a7f)
      if (ctx.shoot && kind <= ctx.shoot.types) { r.wrecked = true; sounds.push(ctx.shoot.sound); effects.push({ racer: n, kind: 'wreck' }); return CODES.racer; } // the shoot-out wrecks a human a shot of the first three types reaches (obj1+0x11ba2)
      if (shot.type === R.types.mineC) { if (!r.inverted) { r.inverted = true; effects.push({ racer: n, kind: 'invert' }); } return CODES.racer; }
      if (shot.type === R.types.ice) { r.hit = R.hitStates.ice; r.hitStamp = ctx.tick; effects.push({ racer: n, kind: 'ice' }); if (!playing(ctx.clock, R.sounds.ice2, ctx.tick)) { sounds.push(R.sounds.ice2); play(ctx.clock, R.sounds.ice2, ctx.tick); } return CODES.racer; }
      sounds.push(R.sounds.hit); effects.push({ racer: n, kind: 'spin' });
      return CODES.racer;
    }
    return 0;
  };
  for (let i = 0; i < shots.length; i++) {
    let shot = shots[i];
    if (!shot.active) continue;
    shot.frame += 1; // the animation: back to 0 at the frame count, which frees an exploded record
    if (shot.frame >= shot.frames) { shot.frame = 0; if (shot.state === EXPLODING) { shots[i] = idle(); continue; } }
    if (shot.state === EXPLODING) continue;
    shot = move(ctx.world, shot, 1, ctx.ownerHeading(shot.owner), test);
    let code = shot.code;
    if (shot.type === R.types.devil) {
      if (code === CODES.wall || code === CODES.object) { // a devil turns round and takes one more step
        shot.lane = wrap(shot.lane + R.headings.back, turn);
        const d = stepOf(ctx.world, shot.lane, shot.step); shot.x = (shot.x + d.dx) & 0xffff; shot.y = (shot.y + d.dy) & 0xffff; code = 0; // @math 16-bit world words
      }
    } else if (shot.type === R.types.hog || shot.type === R.types.ice) {
      shot.step = R.spawn.afterStep; shot.travel += shot.used;
      if (shot.travel >= shot.limit) code = R.explode.collision;
    }
    if (code !== 0) { // the explosion
      sounds.push(R.sounds.explosion); volleys.push(shot.owner);
      shot.state = EXPLODING; shot.frames = R.frames.explosion; shot.frame = 0; shot.block = R.blocks.explosion;
    }
    shots[i] = shot;
  }
  return { shots, racers, volleys, sounds, effects };
}

// The hit handler of the AI loop (obj1+0x189ec) for a racer whose hit word is not 0: the picture turns on (the word 1 shows the views in turn), the ice word 2 or 3 switches to the other once the
// sound of the current one has stopped and plays the new sound, and the word is cleared after 33 calls (word 1) or 50 (the others). Returns the racer.
// The next picture of a stunned racer's spin: one of the eight compass frames a frame, after the last the first (obj1+0x162ab to +0x162bd).
export const nextSpin = spin => (spin >= RULES().spin.last ? 0 : spin + 1);

export function stunStep(racer, tick, clock, sounds = []) {
  const R = RULES(), r = { ...racer }, limit = r.hit === R.hitStates.hit ? R.stun.hit : R.stun.ice;
  if (r.hit === R.hitStates.hit) r.hitSpin = r.hitSpin >= R.spin.last ? 0 : r.hitSpin + 1;
  else {
    const current = r.hit === R.hitStates.ice ? R.sounds.ice2 : R.sounds.ice3;
    if (!playing(clock, current, tick)) {
      r.hit = r.hit === R.hitStates.ice ? R.hitStates.iceBack : R.hitStates.ice;
      const next = r.hit === R.hitStates.ice ? R.sounds.ice2 : R.sounds.ice3;
      if (!playing(clock, next, tick)) { play(clock, next, tick); sounds.push(next); }
    }
  }
  if (tick - r.hitStamp >= limit) r.hit = 0;
  return r;
}

// The draw record of a shot: its HOGMIS.SP frame scaled to the size class (18X13.INF), clipped as the object pass does; null when it is not drawn.
export function shotRecord(world, view, camera, shot, index) {
  const R = RULES(), hit = projectPoint(world, view, camera, shot.x, shot.y, world.rows);
  if (!hit) return null;
  const picture = world.shotShape[hit.sizeClass], clip = clipPicture(hit, picture);
  if (!clip) return null;
  const at = shot.block + shot.frame * R.frames.bytes;
  return { ...clip, picture, frame: world.hogmis.subarray(at, at + R.frames.bytes), distance: hit.distance, sizeClass: hit.sizeClass, type: -1, racer: -1, object: -1, shot: index };
}

export function shotRecords(world, view, camera, shots) {
  const out = [];
  shots.forEach((s, i) => { if (s.active) { const r = shotRecord(world, view, camera, s, i); if (r) out.push(r); } });
  return out;
}
