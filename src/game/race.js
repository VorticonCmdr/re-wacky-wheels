// One race of the port without a page: the start (the countdown), the player's car with its objects, the computer racers, the laps and the finish, the reaction figure and the HUD state,
// all held in a plain `state` object that the page draws from. The page (src/play.js) and scripts/check-race.js run the same frames.
import { withSteps } from '../evidence/k.js';
import { createCar, racerBump } from './car.js';
import { finishCar, sampleKeys, spinOut, invertSteering, straightState } from './control.js';
import { createShots, createSoundClock, fireStep, spawnShot, stepShots } from './shots.js';
import { racerFrame } from './racers.js';
import { classSetup } from './classes.js';
import { driverSlots } from './drivers.js';
import { labelOf, labelCount, messageOf, pointsOf, stageDelay } from './finish.js';
import { framePeriod } from './clock.js';
import { createPlayer, stepPlayer } from './player.js';
import { liveObjects } from './pickups.js';
import { createStart, stepStart, idleRef, idleFrame, starterPass } from './start.js';
import { introEnabled, startIntro, stepIntro, flameAfter, animationOffset } from './intro.js';
import { horizonStart } from './horizon.js';
import { blinkAtStart, markFlags, objectPass } from './blink.js';
import { viewSetup } from './view.js';
import { racerRecords } from './racers.js';
import { stepEffects, stepSparks } from './effects.js';
import { createCycle, stepCycle } from './palette-cycle.js';
import { headOnRacer, wreckByRacer, animateCrashes } from './headon.js';
import { lapWords, recordLap } from './timetrial.js';
import { playerRef, refEntry, playerGeometry, playerRecord, PLAYER_SLOT } from './player-car.js';
import { fallFrames } from './control.js';
import { createLaps, stepLaps, stepWrongWay, gridValue, stepFinish, NO_KEYS, figureDriver } from './laps.js';
import { startFigure, stepFigure } from './figure.js';
import { createDope, triggerDope, stepDope, belchMember } from './dope.js';
import { createAi, stepAi, progressAi, rankPlayer } from './ai.js';
import { createHud, stepHud } from './hud.js';
import { createVersus, stepVersus } from './versus.js';
import { createDuckAi, stepDuckAi, animateDucks, roundOver, crateObjects, duckSounds, gone, hitDuck } from './duck.js';

const FIXED = 2; // @math the finish flag once stage 1 has fixed the results (race.finish-flow)
const MODE_RACING = 2, START = 10, BELL = 9; // @math the race mode word 2 and the sounds START and BELL (race.start-rules, audio.race-sounds)
const TRIAL = 4; // @math the time trial class (race.class-levels)
const TRIES = 3; // @math the tries word +0x6c is set to 3 at the race routine's entry (obj1+0x1fe7d)
const HUMAN_SLOT = 7; // @math the human's default driver: Tigi, the slot of CARS.SP frame 88 (car.player-frames-observed)

// A race on `world` for `total` laps: the fields of `state` the page and the frames use.
export function startRace(state, world, total) {
  const setup = classSetup(state.class ?? 1, state.engine ?? 1); // @math the class 1 and the engine 1 unless the page says otherwise
  state.world = world; state.cycle = world.beach ? createCycle(world.gam.flag, world.gam.extra, world.beach) : null; state.start = createStart(); state.lionOn = true; state.lionShown = true; // the starter word the race load sets (obj1+0x2014c)
  state.car = createCar({ ...state.world.start, horizon: state.horizonCarry ?? horizonStart() }, state.world); state.intro = null; state.introLength = 0; state.minimap = null; state.player = createPlayer(state.car, liveObjects(state.world)); // the horizon pointer is a global the previous race leaves (horizon.scroll); the overhead map keeps its rectangle from the first frame of the race (hud.minimap-draw)
  state.shots = createShots(); state.clock = createSoundClock(); state.sounds = []; state.fx = null; state.lapTimes = lapWords(); state.lapStamp = 0;
  state.humanSlot ??= HUMAN_SLOT; state.result = null;
  state.slots ??= driverSlots(state.seed ?? Math.floor(Math.random() * 0x7fffffff), state.humanSlot); // the opponents are drawn once per cup (obj1+0xffee); @math a random seed stands in for the 10 Hz timer
  state.finishCount = 0; state.playerPlace = 0; state.labels = []; state.message = null; state.stage = { flag: 0, stamp: 0 }; state.race ??= 1; state.points = Array.from({ length: state.slots.length }, () => 0); state.leaderboard = false;
  state.tick = 0; state.hud = createHud(); state.detail ??= 1; state.pose = 0; // @math the detail level 1 is the highest (the steering rate 40)
  state.unproven = new Set(['the place digit from the ranking code (read, not observed; seen on screen only for the 8th place)', 'the computer cars: the slot (driver) of each is an arbitrary one here and their pictures are the CARS.SP frames (the game picks the drivers at random and fills two slots from the driver files)', 'the computer cars\' level 89, speed table VEL.TAB and the road assumed under the start line (the level word\'s source, the slow engine\'s table and other surfaces are not observed)', 'the count label (0) and the single digit (3) of the banner: their start values are read in fresh races, what they count is not known', 'the laps from the menu choice (6, 8 or 10 laps, read from the code)']);
  state.laps = createLaps(state.world.pos, state.world.start.x, state.world.start.y); state.total = total; state.finished = false; state.finalTicks = 0; state.dope = createDope(); state.dopeDraw = null; state.figure = null; state.figureDraw = null; state.ai = setup.trial ? null : createAi(state.world, { level: setup.level, threshold: setup.threshold }); state.place = state.ai ? 8 : 1; // @math the place word starts as 8 with several racers (every HUD record) and 1 alone (obj1+0x2021e)
  if (state.ai && !state.duck && !state.versus) startSides(state); // the side the racers wait with
  if (!state.ai && !setup.trial) state.unproven.add('this track has no computer cars here: its start does not lie on the route (the shootout, duck shoot and bonus starts are other branches)');
  state.unproven.add('the waiting pictures of the racers that are out of view at the start (the game keeps the side they had in the race before; the port takes it from their mode word)');
  state.unproven.add('the order of the HUD call and the starter inside the frame where the countdown ends (the clock starts with the frame after it)');
  if (state.duckMode) { // the duck game: no countdown, the ducks for the computer racers, the hog crates for the pickups (duck.race-rules, duck.racers)
    state.duck = { score: 0, round: 0 };
    state.start = { mode: MODE_RACING, tick: 0, lion: 0 };
    state.player = createPlayer(state.car, crateObjects(world, liveObjects(world)));
    state.ai = createDuckAi(world, { round: 0, rng: state.rng, player: state.humanSlot });
    state.slots = state.ai.racers.map(r => r.slot);
    state.unproven = new Set(['the duck game as read from the code (duck.race-rules, duck.racers, duck.pictures, duck.hud: STATIC, only the start was observed)']);
  } else state.duck = null;
  state.versus = null;
  if (state.versusMode) { // the two player shoot-out: two humans, no countdown, no computer racers (versus.shootout-rules)
    createVersus(state, world, state.versusMode);
    if (state.versus.kind === 'shootout') { state.start = { mode: MODE_RACING, tick: 0, lion: 0 }; state.ai = null; state.slots = [state.humanSlot, state.seat2.humanSlot]; }
    state.unproven = new Set(['the two player modes as read from the code (versus.shootout-rules, versus.race-rules, versus.layout: STATIC; the shoot-out\'s split screen frames were compared with the running game)']);
  }
}

// The human car's point a computer racer looks at after every route point of its walk (racer.contact-response): none while the car jumps, is wrecked or has finished.
function humanPoint(state) {
  const car = state.car;
  return car.jump === 0 && !car.crashed && !state.finished ? { x: car.px, y: car.py } : null;
}

// The answer to a racer that touched the car (racer.contact-response): the bump of the contact routine.
function racerTouch(state, n, headOn = false) {
  const bumped = racerBump(state.world, state.car, state.ai.racers[n], state.fx);
  state.sounds.push(...bumped.events); let next = { ...bumped, events: [] };
  if (headOn) { // the wreck (race.head-on): BOOM, the car's words cleared, the racer crashed; the call after it wrecks the car
    const hit = wreckByRacer(next, state.ai, n, straightState());
    next = hit.car; state.ai = hit.ai; state.sounds.push(hit.sound); state.player = { ...state.player, pending: true };
  }
  state.player = { ...state.player, car: next }; state.car = next;
}

// The fire routine of a frame, after the steering: a spawned shot starts at the car's point along its heading (item.shot-rules).
function fire(state, input, racing) {
  const kb = sampleKeys(state.player.car, input, { racing, finished: state.finished, stunned: false });
  const out = fireStep(state.player.car, state.player.volley, kb.fire, { tick: state.tick, owner: state.versus?.viewer ?? 0 }), car = out.car; // @math the owner of a shot is the viewer, 0 or 1
  state.player = { ...state.player, car, volley: out.volley }; state.car = car;
  for (const spawn of out.spawns) state.shots = spawnShot(state.world, state.shots, spawn, { x: car.px, y: car.py }, car.heading);
  state.sounds.push(...out.sounds);
}

// The shot update of a frame, after the AI step: the shots move and hit; a hit racer stops (the word is merged back into the AI) and a hit on the player spins or inverts the car.
function updateShots(state) {
  if (!state.shots.some(s => s.active)) return;
  const car = state.car, ai = state.ai;
  const view = [{ x: car.px, y: car.py, hit: 0, human: true, airborne: car.jump !== 0, wrecked: false, crashed: car.crashed, inverted: car.inverted !== 0, frame: 0 },
    ...(ai ? ai.racers.slice(1).map(r => ({ x: r.x, y: r.y, hit: r.hit, hitStamp: r.hitStamp, hitSpin: r.hitSpin, human: false, airborne: false, wrecked: Boolean(r.crashed), frame: racerFrame(car.heading, r.compass), helmeted: r.helmeted, hp: r.hp, flicker: r.flicker })) : [])];
  const res = stepShots(state.shots, { world: state.world, objects: state.player.objects, racers: view, ownerHeading: () => car.heading, tick: state.tick, clock: state.clock, duck: state.duck ? { sound: duckSounds().hit, hit: hitDuck } : null });
  state.shots = res.shots; state.sounds.push(...res.sounds);
  if (ai) state.ai = { ...ai, racers: ai.racers.map((r, n) => (n === 0 ? r : { ...r, hit: view[n].hit, hitStamp: view[n].hitStamp, hitSpin: view[n].hitSpin, ...(state.duck ? { hp: view[n].hp, flicker: view[n].flicker } : {}) })) };
  for (const owner of res.volleys) if (owner === 0) state.player = { ...state.player, volley: Math.max(state.player.volley - 1, 0) }; // @math the owner 0 is the human
  for (const e of res.effects) {
    if (e.racer !== 0) continue; // @math the human is the racer 0
    const hit = e.kind === 'spin' ? spinOut(state.player.car, state.tick) : e.kind === 'invert' ? invertSteering(state.player.car, state.tick) : state.player.car;
    state.player = { ...state.player, car: hit }; state.car = hit;
  }
}

// The finishing numbers (obj1+0x2e3c, +0x2efe): the human's lap word reaching the laps word plus 1 takes the next number, then the computer racers' progress update does the same; the first
// three finishers get a label.
function assignPlaces(state) {
  const addLabel = n => { const place = n === 0 ? state.playerPlace : state.ai.racers[n].place; if (place >= 1 && place <= labelCount() && !state.labels.some(l => l.racer === n)) state.labels = [...state.labels, { racer: n, place, slot: state.slots[n] }]; };
  if (state.playerPlace === 0 && state.laps.lap === state.total + 1) { state.finishCount += 1; state.playerPlace = state.finishCount; if (state.class !== TRIAL) addLabel(0); } // @math the lap word one past the laps word
  if (!state.ai) return;
  state.ai = progressAi({ ...state.ai, finished: state.finishCount }, { pos: state.world.pos, trailer: state.world.pos.trailer, total: state.total });
  state.finishCount = state.ai.finished;
  if (state.class !== TRIAL) for (let n = 1; n < state.ai.racers.length; n++) addLabel(n);
}

// Stage 1 (obj1+0x21813): once the human has finished and three racers have finished (at once in time trial) the points of the places and the message are fixed; stage 2 (obj1+0x21919) follows
// 800 counts of the 136 Hz counter later: the points are added to the totals and the leaderboard is next (a human place below the third loses a try instead).
function stages(state) {
  if (!state.finished) return;
  const counts = state.tick * framePeriod(), cls = state.class ?? 1, trial = cls === TRIAL;
  if (state.stage.flag === 1 && (state.finishCount >= labelCount() || trial)) {
    const places = [state.playerPlace, ...(state.ai ? state.ai.racers.slice(1).map(r => r.place) : [])];
    state.points = state.slots.map((_, n) => (places[n] ? pointsOf(cls, places[n]) : 0));
    state.message = state.playerPlace >= 1 && state.playerPlace <= labelCount() ? messageOf(cls, state.playerPlace, state.race) : null;
    state.stage = { flag: FIXED, stamp: counts };
  } else if (state.stage.flag === FIXED && counts - state.stage.stamp >= stageDelay() && !state.result) {
    if (trial) state.result = 'trial'; // the time trial shows its hall of fame instead of the leaderboard (obj1+0x21d7f)
    else if (state.playerPlace <= labelCount()) { state.totals = (state.totals ?? state.slots.map(() => 0)).map((t, n) => t + state.points[n]); state.result = 'leaderboard'; }
    else { state.tries = (state.tries ?? 3) - 1; state.result = state.tries === 0 ? 'gameover' : 'retry'; } // @math three tries at the race routine's entry (obj1+0x1fe7d)
  }
}

// One frame with the keys of the player (the manual's player 1 keyboard: accelerate, brake, left, right, spin and fire flags).
// The glance words the racers start with (blink.js blinkAtStart): the records of the racers in view at the start camera give each its side.
function startSides(state) {
  const slot = state.humanSlot ?? PLAYER_SLOT, camera = { x: state.car.cx, y: state.car.cy, heading: state.car.heading }, view = viewSetup(state.world, camera);
  const records = racerRecords(state.world, view, camera, state.ai.racers, camera.heading, state.slots, []), player = playerRecord(state.world, state.car, null, slot, null), centre = player.left + (player.width >> 1) - 1;
  state.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (n === 0 ? r : { ...r, blink: blinkAtStart(records.find(x => x.racer === n), centre, r.mode) })) };
}

// The object pass of the draw (blink.js) for a car and the draw state the call left: after the observed idle frames of the start, the racers the player trails glance back and the player glances at
// one that is level with it. Nothing of the state is changed; `fx` is the draw state the player's record is built from.
function runPass(state, car, fx, seen = state.beforeAnswer ?? car) {
  const slot = state.humanSlot ?? PLAYER_SLOT, camera = { x: seen.cx, y: seen.cy, heading: seen.heading }, view = viewSetup(state.world, camera); // the draw that answers a touch shows the car as the move left it (race.blink)
  const racers = markFlags(state.ai.racers, seen.heading, Boolean(state.duck)), records = racerRecords(state.world, view, camera, racers, seen.heading, state.slots, [], gone); // a duck that is gone has no record in the draw list
  const player = playerRecord(state.world, car, idleRef(state, slot), slot, fx, false); // the pass sees the car's entry without the jump height (racer.blink)
  const ctx = { player, records, tick: state.tick, racing: state.start.mode === MODE_RACING, slots: state.slots, finished: state.finished, duck: Boolean(state.duck), playerGlance: state.duck || idleFrame(state.tick, 0) === null }; // the player glances only after the waiting frames of the start
  return { out: objectPass(racers, car, ctx), ctx, racers, seen };
}

function blinkPass(state) {
  if (!state.ai) return;
  const { out, ctx, seen } = runPass(state, state.car, state.fx);
  if (!ctx.racing) { // the countdown's image of a tick is the next pass's (SHOWN_AHEAD): the cars stand still, so the next pass sees the same records
    const next = objectPass(markFlags(out.racers, seen.heading, Boolean(state.duck)), out.car, { ...ctx, tick: state.tick + 1, playerGlance: false });
    out.racers = out.racers.map((r, n) => (r.blink ? { ...r, blink: { ...r.blink, ahead: next.racers[n].blink.shown } } : r));
  }
  state.ai = { ...state.ai, racers: out.racers }; state.player = { ...state.player, car: out.car }; state.car = out.car; state.sounds.push(...out.sounds);
}

// The sparks of the frame (effects.js stepSparks), after the answer to a touch: the entry's draw runs the counter.
function drawSparks(state) {
  const out = stepSparks(state.car, state.world, state.fx.entry);
  state.car = out.car; state.player = { ...state.player, car: out.car }; state.fx = { ...state.fx, car: out.car, after: [...state.fx.after, ...out.after] };
}

// The draw of the player's car for the state the last call left (effects.js): the jiggle, the pit picture, the dust, the rear pictures and the sparks, one call a frame. The race mode is
// the one the call left, as the draw that follows it reads it.
function drawEffects(state, sparksLater = false, headOn = false, passAfter = false, switching = false) {
  const slot = state.humanSlot ?? PLAYER_SLOT, ref = playerRef(state.car, idleRef(state, slot), slot);
  const ctx = { sparksLater, switching, world: state.world, track: Number(state.world.name), entryNumber: refEntry(ref, slot), racing: state.racingBefore, racingNow: state.start.mode === MODE_RACING, finished: state.finished, pending: state.player.pending || headOn, tick: state.tick, fallFrames: fallFrames(slot), geometry: playerGeometry(state.world) };
  if (passAfter && state.ai) { const dry = stepEffects(state.car, ctx), pass = runPass(state, dry.car, dry, state.car); ctx.glanceNow = pass.out.car.glance !== 0 && dry.car.glance === 0; } // the pass of the draw comes first: a glance that starts in it has changed the entry's frame before the dust compares it (racer.blink)
  const out = stepEffects(state.car, ctx);
  state.player = { ...state.player, car: out.car }; state.car = out.car; state.fx = out; state.sounds.push(...out.sounds);
  for (const u of out.unproven) state.unproven.add(u);
  if (out.lifeLost && !state.result) { state.tries = (state.tries ?? TRIES) - 1; state.result = state.tries === 0 ? 'gameover' : 'restart'; state.unproven.add('the crash by a head-on racer (the obstacle crash is read from the car routine, not observed)'); } // the try is lost after the car is gone (obj1+0x214a2): the same race again, or the game over
}

// The duck game's racers for a frame (duck.racers): the animation words first (the draw group of the frame), the round check, then the step of every duck; the ducks that touched the car and the
// score they left are what the rest of the frame answers.
function duckFrame(state) {
  let ai = animateDucks(state.ai);
  if (roundOver(ai)) { state.duck = { ...state.duck, round: state.duck.round + 1 }; ai = createDuckAi(state.world, { round: state.duck.round, rng: state.rng, player: state.humanSlot }); state.slots = ai.racers.map(r => r.slot); }
  const moved = stepDuckAi(ai, { human: humanPoint(state), tick: state.tick, score: state.duck.score });
  state.ai = moved.ai; state.duck = { ...state.duck, score: moved.score }; state.sounds.push(...moved.sounds);
  state.touching = state.player.racerTouch >= 0 ? state.player.racerTouch : moved.contacts[0];
}

// The starter's pass of the draw for the frame just stepped (the camera of the car after the step is the picture the game draws at the head of the next pass).
function latchStarter(state) {
  if (state.duck) { state.lionOn = false; state.lionShown = false; return; } // no starter in the duck game (obj1+0x20169)
  const pass = starterPass(state.lionOn, state.world, { x: state.car.cx, y: state.car.cy, heading: state.car.heading }, state.start.lion, state.intro ? 0 : null); // the intro's frames have the mode word 0
  state.lionOn = pass.on; state.lionShown = pass.shown;
}

// The intro before the countdown (race.intro) for the race just started, when the race has one: the camera is put at the first pass of it, and `stepRace` walks the rest before the first frame.
export function beginIntro(state) {
  if (!introEnabled({ duck: Boolean(state.duck), versus: Boolean(state.versus), cls: state.class })) return;
  const out = startIntro(state.car);
  state.car = out.car; state.player = { ...state.player, car: out.car }; state.intro = out.intro;
}

// The cycle the picture of the state is shown with. A pause at the counter value c of a demo race had the DAC after the intro's passes + c + 1 calls of the cycler (palette.cycle-start-replay), and the
// images the port shows after the step of the tick t are the ones the game shows at the counter value t + 1 in the countdown and t in the race (the sweeps of whole demo runs, race.idle-observed), so the
// DAC that goes with the picture of the tick t is the cycler's state two calls on in the countdown and one call on in the race. Pauses that read the screen and the DAC together (2026-10-05, a demo race on
// track 2, not kept as a record) scatter by one call around these (2 or 3 in the countdown, 0 to 2 in the race: a pause falls anywhere in a frame); the intro's passes have no pair of image and DAC.
const CYCLE_AHEAD = { 1: 2, 2: 1 }; // @math the calls ahead of the port's step by the race mode word (the countdown 1, the race 2)
export function shownCycle(state) {
  let cycle = state.cycle;
  for (let n = state.intro ? 0 : CYCLE_AHEAD[state.start?.mode] ?? 0; n > 0; n--) cycle = stepCycle(cycle);
  return cycle;
}

export function stepRace(state, keys) {
  state.cycle = stepCycle(state.cycle); // the palette cycler runs once a drawn frame, the intro's passes too (palette.cycle-rules)
  if (state.versus) { stepVersus(state, keys, { fire, drawEffects }); return; } // the two humans of the split screen (versus.js)
  if (state.intro) { // one pass of the intro: the keys are not read, the frame counter stays 0
    state.sounds = [];
    const out = stepIntro(state.world, state.car, state.intro);
    state.car = out.car; state.player = { ...state.player, car: out.car }; state.intro = out.intro; state.introLength = (state.introLength ?? 0) + 1; // the passes the animation ran before the first frame
    if (!state.intro) { // the first draw of the countdown comes with the car's effects (the rear pictures at the frame word the intro's passes left), then the word goes on
      const car = { ...state.car, flame: flameAfter(state.introLength) }; state.car = car; state.player = { ...state.player, car };
      drawEffects(state, false, false, Boolean(state.ai) && !state.duck);
      if (state.ai && !state.duck) blinkPass(state); // the first pass of the object pass, at the end of the intro: the glances begin (race.blink)
      state.animOffset = animationOffset(state.introLength, Boolean(state.demo)); // the object animation counts the passes too
    }
  } else stepFrame(state, keys);
  latchStarter(state); state.horizonCarry = state.car.horizon;
}

// The DOPE easter egg's trigger (the counter of the control routine, before the car's step) and its scene (one call a frame while it is on, after the HUD): hold left and the brake through the
// countdown (dope.scene). The scene's loader makes the reaction figure read its pictures from the DOPE data until the menu is back (page: state.hudArt.dopeLoaded).
function dopeTrigger(state, input) {
  if (state.duck || state.demo) return; // the duck game has no starter and a demo cancels the steering word while the car stands (obj1+0x1939c)
  const car = state.player.car, kb = sampleKeys(car, input, { racing: true, finished: state.finished, stunned: false });
  const out = triggerDope(state.dope, { left: car.inverted !== 0 ? kb.right : kb.left, still: (car.stepWord ?? 0) === 0, starter: state.lionOn, accelerate: kb.accelerate, brake: kb.brake, alone: !state.versus }, state.tick);
  state.dope = out.dope;
  if (out.started && state.hudArt) state.hudArt.dopeLoaded = true;
}

function dopeFrame(state) {
  state.dopeDraw = null;
  if (!state.dope?.on) return;
  const out = stepDope(state.dope, state.tick);
  state.dope = out.dope; state.dopeDraw = out.draw;
  if (out.belch) state.sounds.push({ member: belchMember() });
  state.unproven.add('the DOPE scene (dope.scene: read from the code, not compared with the running game)');
}

function stepFrame(state, keys) {
  state.sounds = [];
  const modeBefore = state.start.mode, stepped = stepStart(state.start); state.racingBefore = modeBefore === MODE_RACING; // the car routine's jiggle and the dust see the race mode as the frame began (the demos' jiggle flag)
   // the counter goes up; the cars, the laps and the clock run only if the race mode was 2 when the frame began (race.start-rules)
  state.start = stepped.start; state.tick = state.start.tick;
  if (modeBefore !== MODE_RACING && state.start.mode === MODE_RACING) state.sounds.push(START); // the green light (obj1+0x166fc)
  // The finish: the call after the lap word reaches the laps word plus 1 sets the flag and stores the final time; from then on the keys are ignored (lap.rules, car.finish-observed).
  const fin = stepFinish(state.finished, state.laps.lap, state.total);
  if (stepped.racing && fin.fresh) {
    if (state.playerPlace === 0) assignPlaces(state); // the lap word reaches the laps word plus 1 one pass before the finish block, which normally has the place already
    state.finished = true; state.finalTicks = state.hud.ticks; state.stage.flag = 1;
    const posed = finishCar(state.player.car, state.playerPlace, state.tick); state.pose = posed.anim; state.player = { ...state.player, car: posed }; state.car = posed; // the pose of the places 1 to 3 or the wobble (car.control-rules)
    state.unproven.add('what the finish shows beyond the car\'s pose: the place label with the driver picture at the top right, the messages and the leaderboard that follows (the pose is read from the disassembly; only the coasting, the missing timer and the missing lap text were observed)');
  }
  const input = state.finished ? NO_KEYS : keys, env = { detail: state.detail, tick: state.tick, finished: state.finished, pose: state.pose, child: Boolean(state.child), demo: Boolean(state.demo), duck: Boolean(state.duck) };
  const racers = state.ai ? state.ai.racers : [];
  dopeTrigger(state, input);
  if (!stepped.racing) { // the countdown: the throttle and the speed word run on the keys, the car stands still, and the HUD routine zeroes the clock's tick word and shows no speed (car.drive-observed)
    const idle = stepPlayer(state.player, input, state.world, { racing: false, racers, ...env });
    state.player = idle.player; state.car = state.player.car; state.sounds.push(...idle.sounds);
    fire(state, input, false);
    const wait = stepHud(state.hud, state.car, false); state.hud = { ...wait.hud, ticks: 0, counter: state.car.counter }; if (!state.duck) state.laps = stepWrongWay(state.laps); drawEffects(state, false, false, !state.duck, state.start.mode === MODE_RACING); // the call that switches the mode word to the race is the last of the countdown's branch
    if (!state.duck) blinkPass(state); // the racers glance in the countdown too (the waiting pictures)
    dopeFrame(state);
    return;
  }
  const { result, steps } = withSteps(() => stepPlayer(state.player, input, state.world, { racing: true, racers, ...env }));
  state.player = result.player; state.car = state.player.car; state.steps = steps; state.sounds.push(...result.sounds);
  for (const u of result.unproven) state.unproven.add(u);
  fire(state, input, true);
  if (state.duck) duckFrame(state);
  else if (state.ai) { // the computer racers move on the keys of the last frame
    state.ai = animateCrashes(state.ai); // the crashed racers' pictures go on (obj1+0x16288)
    const moved = stepAi(state.ai, { pos: state.world.pos, trailer: state.world.pos.trailer, total: state.total, playerKey2: state.laps.key2, playerPlace: state.place, tick: state.tick, clock: state.clock, sounds: state.sounds, child: Boolean(state.child), finished: state.finished, deferProgress: true, human: humanPoint(state) });
    state.ai = moved.ai; for (const e of moved.events) state.unproven.add(e);
    const touching = state.player.racerTouch >= 0 ? state.player.racerTouch : moved.contacts[0]; // the human's walk or a racer's walk found the touch
    state.touching = touching; // the object pass of the frame answers it with the racers' new places, after the car routine's jiggle
  }
  updateShots(state);
  if (!state.duck) { // no laps, places or finish in the duck game (the progress routine is never called, duck.race-rules)
  const at = { x: state.car.px, y: state.car.py }, lap = stepLaps(state.laps, gridValue(state.world.pos, at.x, at.y), state.world.pos.trailer, state.total, state.tick); // the lookup is at the car record position
  if (lap.laps.lap > state.laps.lap && lap.laps.lap === state.total) state.sounds.push({ id: BELL, guard: true }); // the last lap begins: the bell (obj1+0x2c8a)
  if (state.class === TRIAL && lap.laps.lap > state.laps.lap) { const timed = recordLap(state.lapTimes, state.lapStamp, lap.laps.lap, state.hud.ticks); state.lapTimes = timed.times; state.lapStamp = timed.stamp; } // the lap's time (race.time-trial)
  state.laps = lap.laps; for (const u of lap.unproven) state.unproven.add(u);
  assignPlaces(state);
  if (lap.started) state.figure = startFigure(figureDriver());
  if (state.ai) state.place = rankPlayer([state.laps.key1, ...state.ai.racers.slice(1).map(r => r.key1)], state.place);
  if (state.playerPlace !== 0) state.place = state.class === TRIAL ? 1 : Math.min(Math.max(state.playerPlace, 1), state.slots.length); // after the finish the place digit shows the finishing number (obj1+0x2ae2)
  if (state.place !== 8) state.unproven.add('the place digit pictures other than the 8th (seen on screen only for the 8th)'); // @math the place of the last car
  state.figureDraw = null; // the reaction figure: one call a frame while it runs, drawn from the call's picture
  if (state.figure) {
    const call = stepFigure(state.figure, state.mov.count); state.figure = call.fig;
    if (call.draw.picture === null) state.unproven.add('the last three calls of the reaction figure (their pictures are not identified)');
    else state.figureDraw = { draw: call.draw, entry: state.mov.entries[call.draw.entry] };
  }
  }
  const after = stepHud(state.hud, state.car, true, state.finished ? state.finalTicks : null); state.hud = { ...after.hud, counter: state.car.counter }; // the HUD routine follows the car step in a frame
  if (!state.duck) state.laps = stepWrongWay(state.laps); // the HUD routine's WRONG WAY pass: the duck game skips it (hud.wrong-way)
  for (const u of after.unproven) state.unproven.add(u);
  stages(state);
  const headOn = state.touching !== undefined && !state.duck && !state.versus && state.ai && headOnRacer(state.car, state.ai.racers[state.touching], state.car.heading, { child: Boolean(state.child), pending: state.player.pending }); // a racer that faces the car at the full throttle wrecks it (race.head-on): the draw of the frame shows the flight
  drawEffects(state, true, headOn, true);
  state.beforeAnswer = null; // the car as the frame's move left it, kept for the frames that end with the answer to a touch (a pause between the two shows it)
  if (state.touching !== undefined) { const c = state.car; state.beforeAnswer = { cx: c.cx, cy: c.cy, heading: c.heading, throttle: c.throttle, speed: c.speed }; racerTouch(state, state.touching, headOn); state.touching = undefined; }
  drawSparks(state); // the answer starts a spark before the entry is drawn: its first picture is in the frame of the touch (race.blink grabs, three runs)
  blinkPass(state);
  dopeFrame(state);
}
