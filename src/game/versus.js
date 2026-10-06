// The two player modes (versus.shootout-rules, versus.race-rules, versus.layout, STATIC): two humans on one track, each with a viewer of their own (the page draws the two halves of the split screen).
// The shoot-out has no countdown and no computer racers, a shot of the right kind wrecks the human it reaches and the match is won by the first to the hits word; the race is the single player race
// for two (laps, places, the computer racers of RACE WITH ALL CARS) and ends when either human finishes. The race routine's per-human words are the seat fields (versus-seat.js).
import { SHOOT, FLOW, LAYOUT, RACE, TAUNT } from './versus-rules.js';
import { createCar, racerBump } from './car.js';
import { createPlayer, stepPlayer } from './player.js';
import { liveObjects } from './pickups.js';
import { stepShots } from './shots.js';
import { stepStart, createStart } from './start.js';
import { createHud, stepHud } from './hud.js';
import { racerFrame, racerRecords } from './racers.js';
import { viewSetup } from './view.js';
import { playerRecord } from './player-car.js';
import { idleRef, idleFrame, idlePlayer } from './start.js';
import { markFlags, objectPass, blinkStart } from './blink.js';
import { humanCompass, swapSeat, carsBySeat, slotsBySeat, holderOf, updateSeat, wreckCar } from './versus-seat.js';
import { raceCars, raceSetup, seatLapsStart, raceViewRacers, raceAi, seatLaps, racePlaces, raceFinisher } from './versus-race.js';
import { driverName, driverCount } from './drivers.js';
import { speedDigits, timerText, lapText } from './hud.js';
import { spinOut, invertSteering } from './control.js';
import { startFigure, stepFigure } from './figure.js';
import { starterPass } from './start.js';
import { framePeriod } from './clock.js';
import { stepWrongWay } from './laps.js';
export { swapSeat, carsBySeat, humanCompass };

const MODE_RACING = 2, START = 10; // @math the race mode word 2 and the sound START (race.start-rules, audio.race-sounds)

// A new match, or the next round of one (`mode` { kind: 'shootout' | 'race', slots: [slot of player one, slot of player two], hits and scores of a shoot-out, laps, class, engine and cars of a race }): the
// cars on their places with their headings, no ammo and no held item (a two player game starts them at 0), the pickups back, no shots.
export function createVersus(state, world, mode) {
  const S = SHOOT(), kind = mode.kind ?? 'shootout', race = kind === 'race', bias = world.start.x - world.gam.starts[0].x, second = world.gam.starts[1];
  const objects = liveObjects(world);
  const seatWorld = slot => ({ ...world, carFrames: { ...world.carFrames, driver: world.driverArt(slot) } });
  const worlds = mode.slots.map(seatWorld);
  const cars = (race ? raceCars(world, worlds) : [
    createCar({ x: world.start.x, y: world.start.y, heading: S.headings[0] }, worlds[0]),
    createCar({ x: second.x + bias, y: second.y + bias, heading: S.headings[1] }, worlds[1]),
  ]).map((c, n) => ({ ...c, wrecked: false, wreckPic: 0, wreckShown: 0, flame: race ? RACE().animation.flame : S.animation.flame, jiggle: RACE().animation.jiggle[n], dustStart: RACE().animation.dustStart }));
  const extra = race ? raceSetup(state, world, mode, driverCount()) : null;
  const seat = n => ({ world: worlds[n], car: cars[n], player: createPlayer(cars[n], objects), fx: null, hud: createHud(), humanSlot: mode.slots[n], pose: 0, racingBefore: !race, touching: undefined, beforeAnswer: null, ...(race ? seatLapsStart(world, cars[n], extra.place) : { laps: null, place: 1, figure: null, figureDraw: null }), taunt: null, tauntCount: 0, tauntDraw: null, lionShown: race });
  Object.assign(state, seat(0));
  const base = mode.animBase ?? (race ? RACE().animation.first : S.animation.first); // the animation routine's calls before this round's first pass: the object words go on from round to round
  state.seat2 = seat(1); state.animOffset = base - S.animation.lag;
  state.lionOn = race; // the starter word the race load sets (obj1+0x2014c), 0 in the shoot-out (obj1+0x20169)
  if (race) state.start = createStart(); else state.ai = null;
  state.versus = { kind, base: world, mode, animBase: base, hits: mode.hits, scores: [...(mode.scores ?? [0, 0])], viewer: 0, objects, message: null, blinks: [{}, {}], modes: extra ? extra.modes : [0, 0] }; // @math the humans of a shoot-out wait with no lateral word // @math both scores start at 0 (obj1+0x10166)
}

const GONE = {}; // @math a record that stands for the viewer's own racer (skipped by every loop over the racers, obj1+0x155f8)
// The racers the current viewer sees, as the walk and the draw read them: the own place is a dummy, the other human is racer 1 at its car point (obj1+0x225bc to +0x225ce), the computer racers follow.
export function viewRacers(state) {
  const v = state.versus.viewer, other = carsBySeat(state)[1 - v], wrecked = Boolean(other.wrecked), pictures = SHOOT().wreck.pictures;
  const pic = v === 1 ? other.wreckPic : other.wreckShown; // the first viewer draws the second human before its own pass counts the picture word up, the second viewer draws the first after it did
  const human = { x: other.px, y: other.py, n: 1, crashed: wrecked, crashPic: pic, gone: wrecked && pic >= pictures, compass: humanCompass(other.heading), mode: state.versus.modes[1 - v], human: true, hit: 0 }; // @math the other human is the racer 1 of the viewer's list; a wrecked human shows the crash pictures and then nothing (obj1+0x157b4)
  const list = [GONE, human, ...(state.versus.kind === 'race' ? raceViewRacers(state, human).slice(1) : [])];
  return list.map((r, n) => (n === 0 ? r : { ...r, blink: state.versus.blinks[v][n === 1 ? 1 - v : n] ?? blinkStart() })); // the racer's glance words are one set for each viewer (obj1+0x187ec)
}

// The slots of CARS.SP of the racers of the current viewer's list (the other human's driver is the racer 1, the computer racers' follow).
export const viewSlots = state => [0, slotsBySeat(state)[1 - state.versus.viewer], ...(state.versus.kind === 'race' && state.ai ? state.slots.slice(RACE().firstComputer) : [])];

// Whether the contact the viewer found is the head-on that wrecks both cars (obj1+0x13482 to +0x13532): the throttle at 100, the other human facing the viewer, the car on the ground without a splash picture.
function headOn(state) {
  const H = SHOOT().wreck.headOn, car = state.car, other = viewRacers(state)[state.touching];
  return state.touching === 1 && car.throttle >= H.throttle && !car.wrecked && car.jump === 0 && car.special === 0 && H.frames.includes(racerFrame(car.heading, other.compass)); // a computer racer never wrecks a human here
}

// A key 1 to 6 taunts the other player (obj1+0x1d70e): the seventh in a round is refused with the NO sound; one that is not over blocks a new one; the voice is the sample of the value (GIG1 to GIG5, the sixth plays the fifth).
function tauntKey(state, id) {
  const T = TAUNT();
  if (state.tauntCount >= T.limit) { state.sounds.push(T.refuse); return; }
  if (state.taunt) return;
  state.tauntCount += 1; state.taunt = startFigure(id);
  state.sounds.push({ member: `${T.voices.prefix}${Math.min(id, T.voices.files)}${T.voices.suffix}` });
}

function seatLogic(state, input, h, racing) {
  if (input.taunt) tauntKey(state, input.taunt);
  const V = state.versus, shoot = V.kind === 'shootout', env = { detail: state.detail, tick: state.tick, finished: false, pose: 0, child: false, demo: false, duck: shoot, versus: true }; // the shoot-out steers, accelerates and slides as the duck game does
  state.player = { ...state.player, objects: V.objects };
  state.touching = undefined; state.racingBefore = racing;
  if (state.car.wrecked) return; // the input routine ignores the keys while the wreck word is set (obj1+0x1d7d0)
  const first = state.sounds.length, out = stepPlayer(state.player, input, state.world, { racing, racers: viewRacers(state), ...env });
  state.player = out.player; state.car = out.player.car; state.sounds.push(...out.sounds);
  h.fire(state, input, racing);
  for (let i = first; i < state.sounds.length; i++) if (state.sounds[i] === 'driver') state.sounds[i] = state.humanSlot; // the driver's own voice is the seat's driver's (the voice numbers are the slots)
  V.objects = state.player.objects;
  if (out.player.racerTouch >= 0) state.touching = out.player.racerTouch;
}

// The object pass of the viewer's draw (blink.js): the other racers that the car trails glance back, and the car glances at one that is level with it or behind it. The words of each racer are the viewer's.
function versusBlink(state) {
  const V = state.versus, v = V.viewer, car = state.car, slot = state.humanSlot;
  if (V.kind === 'race' && idlePlayer(state.tick, null, 0, v === 1) !== null) return; // the waiting pictures of the start: the first human's last 35 frames, the second one's 41 (race.idle-observed)
  const camera = { x: car.cx, y: car.cy, heading: car.heading }, view = viewSetup(state.world, camera), slots = viewSlots(state);
  const waiting = V.kind === 'race' && idleFrame(state.tick, 0) !== null; // the computer racers and the other human do not glance back until their pictures have stopped waiting
  const racers = waiting ? viewRacers(state) : markFlags(viewRacers(state), car.heading), records = racerRecords(state.world, view, camera, racers, car.heading, slots, [], r => r.gone === true);
  const player = playerRecord(state.world, car, idleRef(state, slot), slot, state.fx, false);
  const out = objectPass(racers, car, { player, records, tick: state.tick, racing: state.start.mode === MODE_RACING, slots, finished: false, duck: false });
  out.racers.forEach((r, n) => { if (n > 0) V.blinks[v][n === 1 ? 1 - v : n] = r.blink; });
  state.car = out.car; state.player = { ...state.player, car: out.car }; state.sounds.push(...out.sounds);
}

// The HUD routine's call of a pass (obj1+0x1a92c, in the draw group at the head of a pass): the speedometer's word eases toward the car as the last pass's logic left it; the counters show the car's.
function seatHud(state, racing) {
  const after = stepHud(state.hud, state.car, racing);
  state.hud = { ...after.hud, ...(racing ? {} : { ticks: 0 }), counter: state.car.counter };
  if (state.versus.kind === 'race') state.laps = stepWrongWay(state.laps); // the WRONG WAY pass: the shoot-out skips it (hud.wrong-way)
}

function seatDraw(state, h, racing) {
  if (state.versus.kind === 'race') { const pass = starterPass(state.lionOn, state.world, { x: state.car.cx, y: state.car.cy, heading: state.car.heading }, state.start.lion); state.lionOn = pass.on; state.lionShown = pass.shown; } // the starter's pass of this viewer: the word is shared by both viewers (obj1+0x34f0, +0x35f9)
  state.tauntDraw = null; // the figure of a taunt: one call a frame while it runs (obj1+0x1aade)
  if (state.taunt) { const call = stepFigure(state.taunt, state.mov.count); state.taunt = call.fig; if (call.draw.picture !== null) state.tauntDraw = { draw: call.draw, entry: state.mov.entries[call.draw.entry] }; }
  if (state.car.inverted !== 0 && state.tick - state.car.invertedAt >= LAYOUT().flip.clearAfter) { state.car = { ...state.car, inverted: 0 }; state.player = { ...state.player, car: state.car }; } // the flipped view and the swapped steering end 300 frames after the shot (obj1+0x1fc07 to +0x1fc1d)
  if (state.car.wrecked) { state.car = { ...state.car, wreckShown: state.car.wreckPic, wreckPic: state.car.wreckPic + 1 }; state.player = { ...state.player, car: state.car }; return; } // each human's crash picture word goes up once a drawn frame of its own viewer, after the draw has used it (obj1+0x16d3d to +0x16d4b)
  h.drawEffects(state);
  if (state.touching !== undefined && headOn(state)) { // two humans meet head on at the full throttle: both are wrecked (obj1+0x13445 to +0x1369c)
    state.sounds.push(SHOOT().wreck.sound);
    for (const n of [0, 1]) updateSeat(state, n, wreckCar);
    state.touching = undefined; return;
  }
  if (state.touching !== undefined) { // the contact routine's bump against the other human or a computer racer (obj1+0x1d3fc), after the object pass
    const bumped = racerBump(state.world, state.car, viewRacers(state)[state.touching], state.fx);
    state.sounds.push(...bumped.events); const next = { ...bumped, events: [] };
    state.player = { ...state.player, car: next }; state.car = next; state.touching = undefined;
  }
  versusBlink(state);
}

// The shots of the frame: both humans are targets and owners; the shots that wreck, spin or flip a human are applied to its seat, and in a race the computer racers are stunned as in the one player race.
function versusShots(state) {
  const V = state.versus, W = SHOOT().wreck, shoot = V.kind === 'shootout';
  if (!state.shots.some(s => s.active)) return;
  const cars = carsBySeat(state), ai = !shoot && state.ai ? state.ai.racers.slice(RACE().firstComputer) : [];
  const view = [...cars.map(c => ({ x: c.px, y: c.py, hit: 0, human: true, airborne: c.jump !== 0, wrecked: Boolean(c.wrecked), crashed: c.crashed, inverted: c.inverted !== 0, frame: 0 })),
    ...ai.map(r => ({ x: r.x, y: r.y, hit: r.hit, hitStamp: r.hitStamp, hitSpin: r.hitSpin, human: false, airborne: false, wrecked: false, frame: racerFrame(cars[0].heading, r.compass) }))];
  const res = stepShots(state.shots, { world: state.world, objects: V.objects, racers: view, ownerHeading: o => cars[o].heading, tick: state.tick, clock: state.clock, duck: null, shoot: shoot ? { sound: W.sound, types: W.shotTypes } : null });
  state.shots = res.shots; state.sounds.push(...res.sounds);
  if (ai.length) state.ai = { ...state.ai, racers: state.ai.racers.map((r, n) => (n < RACE().firstComputer ? r : { ...r, hit: view[n].hit, hitStamp: view[n].hitStamp, hitSpin: view[n].hitSpin })) };
  for (const owner of res.volleys) { const holder = holderOf(state, owner); holder.player = { ...holder.player, volley: Math.max(holder.player.volley - 1, 0) }; } // @math the owner's volley word goes down by one
  for (const e of res.effects) {
    if (e.kind === 'wreck') updateSeat(state, e.racer, wreckCar);
    else if (e.kind === 'spin') updateSeat(state, e.racer, c => spinOut(c, state.tick));
    else if (e.kind === 'invert') updateSeat(state, e.racer, c => invertSteering(c, state.tick));
  }
}

// The round-end test of the frame routine (obj1+0x21229): every second frame, once a wrecked human's crash picture word is above 12 the message is chosen.
function roundCheck(state) {
  const V = state.versus, S = SHOOT(), [c0, c1] = carsBySeat(state), names = slotsBySeat(state).map(driverName);
  if (!c0.wrecked && !c1.wrecked) return;
  let text = null;
  if (c0.wrecked && c1.wrecked) { if (c0.wreckPic > S.wreck.ready && c1.wreckPic > S.wreck.ready) text = V.kind === 'race' ? RACE().crash : S.message.double; }
  else if (c0.wrecked && c0.wreckPic > S.wreck.ready) text = names[0] + S.message.waxed;
  else if (c1.wrecked && c1.wreckPic > S.wreck.ready) text = names[1] + S.message.waxed;
  if (text) V.message = { text, counts: 0, wrecked: [c0.wrecked, c1.wrecked] };
}

// After the wait: in the shoot-out the survivor is credited (both on a double kill) and a score at the hits word ends the match; in the race nothing is kept. Else the round is set up again from the start.
function endMessage(state) {
  const V = state.versus, w = V.message.wrecked;
  if (V.kind === 'shootout') {
    if (w[0]) V.scores[1]++;
    if (w[1]) V.scores[0]++;
    if (V.scores[0] >= V.hits || V.scores[1] >= V.hits) { V.over = true; state.result = 'versus'; V.message = null; return; }
  }
  const { base, mode, scores } = V, kept = [...scores];
  createVersus(state, base, { ...mode, scores: kept, animBase: V.animBase + state.tick + SHOOT().animation.restart });
  state.shots = state.shots.map(() => ({ active: 0 })); state.tick = 0; if (V.kind === 'shootout') state.start = { mode: MODE_RACING, tick: 0, lion: 0 };
}

// One frame of the match with the keys of both players `keys` { p1, p2 }; `h` carries the race routine's own helpers (fire, drawEffects).
export function stepVersus(state, keys, h) {
  const V = state.versus, race = V.kind === 'race';
  state.sounds = [];
  if (V.over) return;
  if (V.message) { V.message.counts += framePeriod(); if (V.message.counts > SHOOT().message.counts) endMessage(state); return; } // the frame waits in the message's loop
  const modeBefore = state.start.mode, stepped = stepStart(state.start), racing = stepped.racing;
  seatHud(state, modeBefore === MODE_RACING); swapSeat(state); seatHud(state, modeBefore === MODE_RACING); swapSeat(state); // the draw group comes first in a pass
  state.start = stepped.start; state.tick = state.start.tick;
  if (race && modeBefore !== MODE_RACING && state.start.mode === MODE_RACING) state.sounds.push(START); // the green light (obj1+0x166fc)
  seatLogic(state, keys.p1, h, racing);
  swapSeat(state); seatLogic(state, keys.p2, h, racing); swapSeat(state);
  if (race && racing) { // the computer racers' step and the progress of the laps, then the places (obj1+0x22768 to +0x2279b)
    const [a, b] = carsBySeat(state), points = [a, b].map(c => (c.jump === 0 && !c.wrecked ? { x: c.px, y: c.py } : null));
    const out = raceAi(state, racing, points);
    for (const n of [0, 1]) { const holder = holderOf(state, n); if (holder.touching === undefined && out.contactsBy[n][0] !== undefined) holder.touching = out.contactsBy[n][0]; }
    seatLaps(state); swapSeat(state); seatLaps(state); swapSeat(state);
    racePlaces(state);
  }
  versusShots(state);
  seatDraw(state, h, racing);
  swapSeat(state); seatDraw(state, h, racing); swapSeat(state);
  if (state.tick % 2 === 1) roundCheck(state); // @math every second pass; the page word is 0x3e80 in every second pass: two rounds of a shoot-out reached the crash picture 13 at an even counter and began the message at the next, odd one
  if (race && racing) { const finisher = raceFinisher(state); if (finisher >= 0) { V.over = true; V.finisher = finisher; state.result = 'versusRace'; } } // the race ends at once (obj1+0x2150c)
}

// The numbers the strips show for the page (versus.layout): the names, the hog counters, the scores and the held items of the two players.
export function stripValues(state) {
  const cars = carsBySeat(state), slots = slotsBySeat(state), seats = [holderOf(state, 0), holderOf(state, 1)];
  return cars.map((c, n) => ({ name: driverName(slots[n]), ammo: c.counter, score: state.versus.scores[n], held: c.held, taunt: seats[n].tauntDraw }));
}

// What the two player race's HUD shows in each half (versus.race-rules): the timer (the first player's, the same in both), the speedometer's digits, the place, the WRONG WAY sign's picture
// (hud.wrong-way), the lap text unless the figure runs, and the figure.
export function raceValues(state) {
  const seats = [holderOf(state, 0), holderOf(state, 1)], time = timerText(seats[0].hud.timerShown);
  return seats.map(s => ({ timer: time, speed: speedDigits(s.hud.now ?? 0), place: s.place, wrongWay: s.laps.wrongShown ?? null, lap: s.laps.shown && !s.figure ? lapText(s.laps.lap, state.total, false) : null, figure: s.figureDraw }));
}

// The message of a round's end as the box routine places it (obj1+0x1a414): a box of 8 columns a character plus 8 centred, from the row 92, with the text 4 in from its corner.
export function messageAt(text, row = null) { // `row` is the box routine's second argument: the row of the box when it is not 0
  const M = SHOOT().message;
  return { text, x: Math.floor((M.width - (M.glyph * text.length + M.glyph)) / 2) + M.margin, y: (row ?? M.y) + M.margin }; // @math half the free width
}

// The match end screen (obj1+0x1bbd8, versus.flow): the winner's line, the winner's CARS.SP frame (both cars on a draw) and the hint. `scores` are clamped to the hits word first.
export function winnerLayout(scores, hits, slots) {
  const W = FLOW().winner, clamped = scores.map(s => Math.min(s, hits)), drawn = clamped[0] === clamped[1], winner = clamped[0] > clamped[1] ? slots[0] : slots[1];
  const centred = text => Math.floor((W.screen - W.glyph * text.length) / 2); // @math centred
  const line = drawn ? W.draw : driverName(winner) + W.won;
  return { lines: [{ text: line, x: centred(line), y: W.textY }, { text: W.hint, x: centred(W.hint), y: W.hintY }], cars: (drawn ? [slots[0], slots[1]].map((slot, k) => ({ slot, x: W.drawX[k] })) : [{ slot: winner, x: W.picture1X }]).map(c => ({ ...c, y: W.pictureY })) };
}
