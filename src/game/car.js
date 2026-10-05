// The player car on the straight road, as far as it is proven: car.step-observed (throttle, speed from VEL.TAB, the move per axis),
// car.steer-step-observed (the heading) and car.turn-move (the camera turns about the point NDIST[0] ahead of it).
// The state is the camera words (the position the game moves) and the heading; the car record's position is the camera plus the
// rounded step of 0x7c along the heading. The walk of the move, the wall's bounce, the racers' contact and the wreck follow car.drive-observed and its neighbours.
import { K } from '../evidence/k.js';
import { horizonStart, nextRamp, scrollHorizon } from './horizon.js';
import { terrainAt } from './surface.js';
import { MODEL, LEAN } from './car-model.js';
import { walkLine } from './walk.js';
import { zonesOf } from './zones.js';
import { racerRecord, frameTable } from './racers.js';
import { viewSetup } from './view.js';
import { playerRecord } from './player-car.js';
import { CONTACT } from './contact.js';
import { createControl, controlStep, lookupEffects, boostAfterMove, animate, drawStep, startJump, forcedRamp } from './control.js';

export { stepLean } from './control.js';

// The blocked move (car.bounce-rules, STATIC; car.drive-observed for what a played race shows of it): the walk of the move stops at the first step whose lookup point is the
// wall, the throttle is cleared, the car is thrown back the width of two cells and the two probes either side of the heading turn it away from a wall they still see.
const BOUNCE = () => K({ walkRoutine: 0x11de0, testRoutine: 0x116a0, moveRoutine: 0x137e4, wallTerrain: 3, hitCode: 1, thrownBack: 0x20, halfTurn: 0x3c0, probeTurn: 0x12, probeDistance: 0x7c, nudge: 1 }, 'car.bounce-rules');
// What the walk finds besides the wall (car.collision-test, STATIC; car.racer-hit-observed and car.object-observed for what is seen of them): a .SPW object or another racer with the
// sum of the absolute differences of its x and y words from the lookup point below 14.
const TOUCH = () => K({ walkRoutine: 73184, testRoutine: 71328, collisionWordAt: 166830, oldWords: [166820, 166850], newWords: [166822, 166852], offsetWords: [166760, 166762], fallTerrain: 10, wallTerrain: 3, codes: { wall: 1, object: 2, racer: 3, fall: 4 }, touchDistance: 14, objectCountWord: 166798, racerCountWord: 166976, ownIndexWord: 166782, probeOffset: 18, headingVectorRoutine: 99236 }, 'car.collision-test');
export const collisionCodes = () => TOUCH().codes;
// The wreck after a fast hit on an obstacle (car.crash-observed): the car turns 18 and rolls back along its heading for a number of calls.
const CRASH = () => K({ record: 'object-1', turn: 18, rollSteps: 9, rollFirst: 63, rollBack: 64, wreckSpeed: 40 }, 'car.crash-observed');
// The surfaces whose effect is not ported: the throttle bump of 12 and 15 (terrain.effects-observed; its cause was not found). The boost 2, the special states 6 and 15 and the pit 10 follow car.control-rules.
const UNPORTED_SURFACES = [12, 15]; // @math the terrain values named by the claim above
const PLAYER_SLOT = 7; // @math the player's driver slot: CARS.SP frame 88 is the entry 4 of the slot 7 (car.player-frames-observed, car.control-rules)
const LEVEL_ZONE = 3, MIDDLE_ZONE = 3; // @math the row zone of a record on the car's row and the column zone of one in the middle (car.object-zones)
const SWIPE = 22, CLANG = 21, SPARK_LEFT = 4, SPARK_RIGHT = 3; // @math the sound CLANG (audio.race-sounds) and the values of the spark word +0x46 for the first and the second probe (car.move-step)
const CONSUMED = 0xffff; // @math the consumed marker of the .SPW word +2 (atr.kind-effects)

const wrap16 = v => ((v % 0x10000) + 0x10000) % 0x10000; // @math 16-bit world words

// The rounded step along a heading: (TRIG vector x distance + 0x8000) >> 16 for each axis (signed).
export function straightMove(trig, heading, distance) {
  const C = MODEL(), half = C.trigEntryBytes / 2; // @math the second dword of a TRIG entry is half an entry on
  const vx = trig.getInt32(heading * C.trigEntryBytes, true), vy = trig.getInt32(heading * C.trigEntryBytes + half, true);
  const scale = 2 ** C.fixedBits; // @math 16.16 fixed point
  return { dx: Math.floor((vx * distance + C.rounding) / scale), dy: Math.floor((vy * distance + C.rounding) / scale) };
}

// The pivot offset of the turn (the routine obj1+0x27a21): the low 16 bits of (TRIG vector x the first NDIST dword + 0x8000) >> 16, per axis.
export function pivotOffset(world, heading) {
  const C = MODEL(), half = C.trigEntryBytes / 2, first = world.ndist.getUint32(0, true); // @math the first NDIST dword
  const lo = (v) => Number(((BigInt(v) * BigInt(first) + BigInt(C.rounding)) & 0xffffffffn) >> BigInt(C.fixedBits)); // @math the low 32 bits of the product, shifted right
  return [lo(world.trig.getInt32(heading * C.trigEntryBytes, true)), lo(world.trig.getInt32(heading * C.trigEntryBytes + half, true))];
}

// The camera of a car: the car record's position less the rounded step of 0x7c along the heading.
export function cameraOf(car, world) {
  const C = MODEL(), { dx, dy } = straightMove(world.trig, car.heading, C.cameraBehind);
  return { x: wrap16(car.x - dx), y: wrap16(car.y - dy), heading: car.heading };
}

// A car from its record position and heading (the throttle and the speed start at 0 unless given). `surface` is the terrain value under it. `px` and `py` are the car record's
// position words: the game rewrites them when the car moves, so a turn without a move leaves them where they were (car.crash-observed).
export function createCar({ x, y, heading, throttle = 0, speed = 0, rampLeft = 0, rampRight = 0, horizon = horizonStart(), lean = LEAN().straight, surface = null }, world) {
  const camera = cameraOf({ x, y, heading }, world), control = createControl();
  return { ...control, row: lean, target: lean, lean, pic: { table: 'lean', row: lean }, cx: camera.x, cy: camera.y, px: x, py: y, heading, throttle, speed, rampLeft, rampRight, horizon, surface: surface ?? terrainAt(world, x, y), crashed: false, crash: 0, counter: 0, held: 0 };
}

// The car record's position of a car.
export function carPosition(car, world) {
  const C = MODEL(), { dx, dy } = straightMove(world.trig, car.heading, C.cameraBehind);
  return { x: wrap16(car.cx + dx), y: wrap16(car.cy + dy) };
}

const signed16 = v => ((v + 0x8000) & 0xffff) - 0x8000; // @math the difference of two 16-bit world words as a signed number

// What the lookup point `r` touches (obj1+0x116a0): the pit's fall (a car that is not jumping), the wall, then, for a car that is not jumping, an object that is not consumed and another racer
// (the player is racer 0).
function touching(world, r, objects, racers, jumping) {
  const B = BOUNCE(), T = TOUCH(), terrain = terrainAt(world, r.x, r.y);
  if (terrain === T.fallTerrain && !jumping) return { code: T.codes.fall };
  if (terrain === B.wallTerrain) return { code: T.codes.wall };
  if (jumping) return null;
  const near = o => Math.abs(r.x - o.x) + Math.abs(r.y - o.y) < T.touchDistance;
  for (let i = 0; i < objects.length; i++) if (objects[i].consumed !== CONSUMED && near(objects[i])) return { code: T.codes.object, index: i };
  for (let n = 1; n < racers.length; n++) if (!racers[n].crashed && near(racers[n])) return { code: T.codes.racer, index: n }; // a crashed racer is passed (obj1+0x11838)
  return null;
}

// The walk of the move (obj1+0x11de0, game/walk.js): from the old camera point to the candidate, stopping at the first step whose lookup point (the step plus `probe`, 0x7c ahead of it)
// touches something. A walk of no length looks at the point itself (the countdown shows the racers' contact). Returns the step point and what it touched.
function walk(world, from, to, probe, objects, racers, jumping) {
  const found = walkLine(from, to, point => touching(world, { x: point.x + probe.dx, y: point.y + probe.dy }, objects, racers, jumping));
  return found && { point: found.point, ...found.hit };
}

// The wall feelers (obj1+0x13a34 to +0x13b99 after a blocked move, obj1+0x13e98 to +0x14061 in every other call): two probes 0x7c ahead of the camera, 0x12 either side of the heading, both
// looked at before either turn; a probe that sees the wall turns the car 0x12 away from it and moves the camera one unit along the new heading. After a blocked move a car whose probes both
// see the wall (or none) turns not at all (obj1+0x13ab9 to +0x13aec, the collision word being 1); in the other calls both seeing probes turn the car both ways.
function feelers(world, x, y, heading, blocked) {
  const B = BOUNCE(), C = MODEL();
  const left = straightMove(world.trig, (heading + B.probeTurn) % C.turn, B.probeDistance), right = straightMove(world.trig, (heading - B.probeTurn + C.turn) % C.turn, B.probeDistance);
  let leftSeen = terrainAt(world, x + left.dx, y + left.dy) === B.wallTerrain, rightSeen = terrainAt(world, x + right.dx, y + right.dy) === B.wallTerrain, h = heading;
  if (blocked && leftSeen && rightSeen) { leftSeen = false; rightSeen = false; }
  if (leftSeen) { h = (h - B.probeTurn + C.turn) % C.turn; const m = straightMove(world.trig, h, B.nudge); x = wrap16(x + m.dx); y = wrap16(y + m.dy); }
  if (rightSeen) { h = (h + B.probeTurn) % C.turn; const m = straightMove(world.trig, h, B.nudge); x = wrap16(x + m.dx); y = wrap16(y + m.dy); }
  return { x, y, heading: h, turned: h !== heading, probes: { left: leftSeen, right: rightSeen } };
}

// The bounce after a blocked move (obj1+0x13925 to +0x13c3f): the car is thrown back along the opposite direction, then the feelers turn it away from the wall.
function bounce(world, point, heading) {
  const B = BOUNCE(), C = MODEL();
  const back = straightMove(world.trig, (heading + B.halfTurn) % C.turn, B.thrownBack);
  return feelers(world, wrap16(point.x + back.dx), wrap16(point.y + back.dy), heading, true);
}

// The bump of a contact with an obstacle or a racer (obj1+0x1369f to +0x13772 and the contact routine obj1+0x1d3fc): a drift or a hop ends and takes the throttle with it, the heading turns by 0x12
// (to the left when the other lies right of the car's middle, the zone 5; else to the right), the camera moves a unit along the new heading, and the spark runs (3 for the zones 3 and 4, 4 for 5).
export function bumpCar(world, car, zone, sound) {
  const B = BOUNCE(), C = MODEL(), ZONE_RIGHT = 5; // @math the column zone of a record right of the car's middle (car.object-zones)
  const heading = zone === ZONE_RIGHT ? (car.heading - B.probeTurn + C.turn) % C.turn : (car.heading + B.probeTurn) % C.turn, m = straightMove(world.trig, heading, B.nudge);
  const cancel = car.drift !== 0 || car.hop !== 0;
  return { ...car, heading, cx: wrap16(car.cx + m.dx), cy: wrap16(car.cy + m.dy), drift: 0, hop: 0, throttle: cancel ? 0 : car.throttle, spark: zone === ZONE_RIGHT ? SPARK_LEFT : SPARK_RIGHT, sparkCount: 0, events: [...car.events, sound] };
}

// The zones of a racer's draw record against the car's (the object pass): level and in the middle when the racer cannot be projected.
export function racerZones(world, car, racer, fx = null) {
  const camera = { x: car.cx, y: car.cy, heading: car.heading }, record = racerRecord(world, viewSetup(world, camera), camera, racer, car.heading, 0, frameTable());
  return record ? zonesOf(record, playerRecord(world, car, null, undefined, fx, false)) : { row: LEVEL_ZONE, column: MIDDLE_ZONE };
}

// The bump of a racer that touched the car (racer.contact-response): the zones of the racer's record against the car's, seen from the camera as the move left it (the object pass runs before
// the contact routine turns the camera), give the turn (the obstacle's bump: the unit move, the spark) with the racer's sound and the contact routine's throttle push (obj1+0x1d499 to
// +0x1d4f2): a racer drawn nearer than the car's row pushes the car on (up to the cap), one farther holds it back. `fx` is the frame's effects (the car's jiggle moves its record a row).
export function racerBump(world, car, racer, fx = null) {
  const K_ = CONTACT(), zones = racerZones(world, car, racer, fx), bumped = bumpCar(world, car, zones.column, K_.sound);
  let throttle = bumped.throttle;
  if (zones.row === K_.push.nearer) throttle = Math.min(throttle + K_.push.amount, K_.push.cap);
  else if (zones.row === K_.push.farther) throttle = Math.max(throttle - K_.push.amount, 0);
  return { ...bumped, throttle };
}

// The wreck after a fast hit on an obstacle (car.crash-observed): the call that finds it turns the car and clears the throttle; the calls after it roll the car back along its
// heading, and then it stays (the crash word is never cleared by the code that was read). The car record's position words follow the camera only when the car moves.
export function wreck(car, world) {
  const W = CRASH(), C = MODEL();
  if (!car.crashed) return { ...car, heading: (car.heading + W.turn) % C.turn, throttle: 0, crashed: true, crash: 0 }; // the hit call: the heading changes, the throttle goes, nothing moves
  if (car.crash >= W.rollSteps) return car;
  const back = straightMove(world.trig, (car.heading + C.turn / 2) % C.turn, car.crash === 0 ? W.rollFirst : W.rollBack); // @math half a turn is the opposite direction
  const rolled = { ...car, cx: wrap16(car.cx + back.dx), cy: wrap16(car.cy + back.dy), crash: car.crash + 1 };
  return { ...rolled, px: carPosition(rolled, world).x, py: carPosition(rolled, world).y };
}

// input: {accelerate, brake, left, right, spin}. `racing` is whether the race mode is 2: in the countdown only the control routine's throttle and picture words run, the steering routine and the
// move wait for the green light (car.drive-observed). `objects` are the live .SPW objects ({x, y, consumed}) and `racers` the computer racers' positions (index 0 is the player,
// unused): what the walk touches comes back as `touched` ({code, index}). `detail` is the game's detail level (the steering rate), `tick` its frame counter, `finished` and `pose` the finish flag
// and the finish state, `stunned` the racer's stun word and `slot` the driver's slot. Returns the next car and the list of unproven things this tick relied on.
export function stepCar(car0, input, world, { racing = true, objects = [], racers = [], detail = 1, tick = 0, finished = false, pose = 0, stunned = false, slot = PLAYER_SLOT, demo = false, duck = false } = {}) {
  const C = MODEL(), B = BOUNCE(), T = TOUCH(), unproven = [];
  if (car0.crashed) return { car: wreck(car0, world), unproven, touched: null, hit: false, sounds: [] }; // the input routine ignores the keys while the crash word is set (obj1+0x1d7d0)
  const env = { world, tick, detail, racing, finished, stunned, pose, slot, demo, duck }; // `duck`: the duck game's and the shoot-out's throttle step, steering rate and no slide (duck.race-rules)
  const ctl = controlStep(car0, input, env);
  unproven.push(...ctl.unproven);
  let car = ctl.car;
  const probe = straightMove(world.trig, car.heading, B.probeDistance); // along the heading before the turn (obj1+0x13814 to +0x1382d)
    const done = (next, touched, hit, probes = null, zone = null) => { // the end of the call: the surface under the new position, the effects that follow the move and the draw routine's step
    const at = carPosition(next, world);
    let out = { ...next, px: at.x, py: at.y, surface: terrainAt(world, at.x, at.y) };
    if (probes) { // the wall's spark and clang: the first probe that sees the wall starts the spark of 4 frames (obj1+0x13b08 to +0x13c38); CLANG sounds when no spark is running
      if (probes.left && out.spark === 0) out = { ...out, spark: SPARK_LEFT, sparkCount: 0, events: [...out.events, CLANG] };
      if (probes.right && out.spark === 0) out = { ...out, spark: SPARK_RIGHT, sparkCount: 0, events: [...out.events, CLANG] };
    }
    if (zone !== null) out = { ...out, spark: zone === 5 ? SPARK_LEFT : SPARK_RIGHT, sparkCount: 0, events: [...out.events, SWIPE] }; // a racer touched: SWIPE and the spark (obj1+0x13701); @math the zone 5 is right of the middle
    out = lookupEffects(out, env);
    out = boostAfterMove(out, env, world.speeds);
    out = animate(out, env);
    out = drawStep(out);
    if (UNPORTED_SURFACES.includes(out.surface)) unproven.push(`the effect of the surface ${out.surface} under the car (the throttle bump of 12 and 15 is observed but its cause is not read)`);
    const sounds = out.events; out = { ...out, events: [] };
    return { car: out, unproven, touched, hit, sounds };
  };
  if (!racing) {
    const seen = walk(world, { x: car.cx, y: car.cy }, { x: car.cx, y: car.cy }, probe, objects, racers, car.jump !== 0);
    if (seen?.code === T.codes.racer) return done(racerBump(world, { ...car, speed: ctl.speed, cx: seen.point.x, cy: seen.point.y }, racers[seen.index]), seen, false); // the contact of the countdown (car.racer-hit-observed)
    return done({ ...car, speed: ctl.speed }, seen && seen.code !== T.codes.fall ? seen : null, false);
  }
  // the move along the old heading, walked step by step; what the walk touches decides what follows
  const move = straightMove(world.trig, car.heading, ctl.speed);
  let cx = wrap16(car.cx + move.dx), cy = wrap16(car.cy + move.dy), heading = car.heading, throttle = car.throttle, steer = true;
  const seen = walk(world, { x: car.cx, y: car.cy }, { x: cx, y: cy }, probe, objects, racers, car.jump !== 0);
  let hit = false, touched = null, racerHit = false, probes = null;
  if (seen) { // the walk stopped at a step of the line: the position words keep that step
    ({ x: cx, y: cy } = seen.point);
    if (seen.code === B.hitCode) { // the wall: a jump ends, a drift or a hop is cancelled with the throttle, the car is thrown back and the steering is skipped (obj1+0x138d3 to +0x13c4a)
      const out = bounce(world, seen.point, car.heading);
      ({ x: cx, y: cy, heading } = out); throttle = 0; steer = false; hit = true; probes = out.probes;
      if (car.jump !== 0) car = { ...car, jump: 0 };
      if (car.drift !== 0) car = { ...car, drift: 0 };
      if (car.hop !== 0) car = { ...car, hop: 0 };
      if (out.turned) unproven.push('the turn away from a wall seen by one probe (read, not observed)');
      if (car.heading !== heading && !out.turned) unproven.push('the heading of a wall hit');
    } else if (seen.code === T.codes.fall) { // the pit: the jump starts and the car goes on (the walk stopped at its first step)
      car = startJump(car);
    } else if (seen.code === T.codes.racer) {
      racerHit = true;
      unproven.push('a hit on a computer racer after the green light (observed only in the countdown)');
    } else touched = seen;
  }
  let { rampLeft, rampRight, horizon } = car;
  if (steer) { // the steering amounts the input routine set (obj1+0x13c4f to +0x13e8e): the ramps, the heading and the camera's swing about the pivot, the left side first
    const forced = car.turn !== 0, before = pivotOffset(world, car.heading);
    if (ctl.left > 0) { rampLeft = forced ? forcedRamp() : nextRamp(rampLeft, true); heading = (heading - ctl.left + C.turn) % C.turn; horizon = scrollHorizon(horizon, 'left', rampLeft); } else rampLeft = nextRamp(rampLeft, false);
    if (ctl.right > 0) { rampRight = forced ? forcedRamp() : nextRamp(rampRight, true); heading = (heading + ctl.right) % C.turn; horizon = scrollHorizon(horizon, 'right', rampRight); } else rampRight = nextRamp(rampRight, false);
    const after = pivotOffset(world, heading);
    cx = wrap16(cx + before[0] - after[0]); cy = wrap16(cy + before[1] - after[1]);
  }
  if (!hit) { // every call that did not hit the wall ends with the feelers (obj1+0x13e98 to +0x14107), looking from the camera as the steering left it
    const felt = feelers(world, cx, cy, heading, false);
    ({ x: cx, y: cy, heading } = felt); probes = felt.probes;
  }
  if (racerHit) touched = seen; // the answer to the touch comes after the racers have moved (race.js: the object pass sees their new places)
  return done({ ...car, cx, cy, heading, throttle, speed: ctl.speed, rampLeft, rampRight, horizon }, touched, hit, probes);
}
