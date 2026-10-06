// The two player race's own parts (versus.race-rules, STATIC): the two humans on the grid's first two places, the computer racers 2 to 7 of RACE WITH ALL CARS, the laps and places of both humans
// and the instant finish. The frames, the seats and the shots are versus.js's; this module holds what only the race has.
import { RACE } from './versus-rules.js';
import { createCar } from './car.js';
import { createLaps, gridValue, stepLaps, figureDriver } from './laps.js';
import { createAi, stepAi, progressAi, rankPlayer, startMode } from './ai.js';
import { classSetup } from './classes.js';
import { startFigure, stepFigure } from './figure.js';
import { carsBySeat, holderOf } from './versus-seat.js';

// The two cars: the first human on the grid's first place, the second 0x14 to the right of it, both facing the way of the one player race.
export function raceCars(world, worlds) {
  const R = RACE();
  return [0, R.secondDx].map((dx, n) => createCar({ x: world.start.x + dx, y: world.start.y, heading: R.headings[n] }, worlds[n]));
}

// The drivers of the racers: the humans' two, then the lowest drivers that are not taken, in order (obj1+0xbe3c).
export function raceRoster(slots, allCars, drivers) {
  const roster = [...slots];
  if (allCars) for (let d = 0; roster.length < drivers; d++) if (!roster.includes(d)) roster.push(d);
  return roster;
}

// The race words of a new round: the laps of both humans, their places, the computer racers (RACE WITH ALL CARS) and the roster.
export function raceSetup(state, world, mode, drivers) {
  const R = RACE(), setup = classSetup(mode.class ?? 1, mode.engine ?? 1), all = mode.cars === 2; // @math the class 1 and the engine 1 unless the menus say otherwise; the word 2 is RACE WITH ALL CARS
  state.ai = all ? createAi(world, { level: setup.level, threshold: setup.threshold, computers: R.firstComputer }) : null;
  state.slots = raceRoster(mode.slots, all, drivers); state.total = mode.laps; state.class = mode.class ?? 1; state.child = false;
  return { all, place: all ? R.firstPlace : 1, modes: [0, startMode(world, world.start.x + R.secondDx)] }; // the first human waits with the pictures 8 and 9 whatever the lateral word, the second with the side pictures of a racer right of the route's start (a played race's start frames) // @math the place is 1 with only the humans
}

export const seatLapsStart = (world, car, place) => ({ laps: createLaps(world.pos, car.px, car.py), place, figure: null, figureDraw: null });

// The racers one viewer sees (obj1+0x155f8): the own place is skipped, the other human is the racer 1 and the computer racers follow from 2.
export function raceViewRacers(state, other) {
  const ai = state.ai ? state.ai.racers.slice(RACE().firstComputer) : [];
  return [other, ...ai];
}

// The computer racers' frame: the walk of each along the route, the contacts with either human, and the humans' own places in the racers' list (obj1+0x225d4 to +0x2279b).
export function raceAi(state, racing, humanPoints) {
  const V = state.versus;
  if (!state.ai || !racing) return { contactsBy: [[], []] };
  const humans = carsBySeat(state), racers = state.ai.racers.map((r, n) => (n < RACE().firstComputer ? { ...r, x: humans[n].px, y: humans[n].py } : r)); // the humans' car points stand in the racers 0 and 1
  const moved = stepAi({ ...state.ai, racers }, { pos: state.world.pos, trailer: state.world.pos.trailer, total: state.total, tick: state.tick, clock: state.clock, sounds: state.sounds, child: false, finished: false, deferProgress: true, humans: humanPoints, noHelper: true, playerKey2: 0, playerPlace: 0 });
  state.ai = moved.ai;
  return { contactsBy: moved.contactsBy };
}

// The laps of the viewer (obj1+0x2b44 for a human): the lap word and the ranking keys from the grid value under the car; a lap that reaches the laps word starts the figure.
export function seatLaps(state) {
  const car = state.car, lap = stepLaps(state.laps, gridValue(state.world.pos, car.px, car.py), state.world.pos.trailer, state.total, state.tick);
  state.laps = lap.laps;
  if (lap.started) state.figure = startFigure(figureDriver());
  state.figureDraw = null; // the reaction figure: one call a frame while it runs, drawn from the call's picture
  if (state.figure) { const call = stepFigure(state.figure, state.mov.count); state.figure = call.fig; if (call.draw.picture !== null) state.figureDraw = { draw: call.draw, entry: state.mov.entries[call.draw.entry] }; }
}

// After both humans' laps: the computer racers' progress and the places of the humans by the ranking keys.
export function racePlaces(state) {
  if (state.ai) state.ai = progressAi({ ...state.ai, racers: state.ai.racers.map((r, n) => (n < RACE().firstComputer ? { ...r, key1: holderOf(state, n).laps.key1 } : r)) }, { pos: state.world.pos, trailer: state.world.pos.trailer, total: state.total });
  const keys = [holderOf(state, 0).laps.key1, holderOf(state, 1).laps.key1, ...(state.ai ? state.ai.racers.slice(RACE().firstComputer).map(r => r.key1) : [])];
  for (const n of [0, 1]) { const holder = holderOf(state, n); holder.place = rankPlayer(keys, holder.place, n); }
}

// The end of the race: either human's lap word is the laps word plus 1 (obj1+0x2150c). Returns the finisher or -1.
export const raceFinisher = state => [0, 1].find(n => holderOf(state, n).laps.lap === state.total + 1) ?? -1; // @math the finish is the laps word plus 1 (lap.rules)


// The places of every racer when the race ends (obj1+0x28a4): the humans' words, the computer racers' by the ranking keys; the cup points of a racer are 9 less its place (obj1+0x215ac).
export function finalPlaces(state) {
  const keys = [holderOf(state, 0).laps.key1, holderOf(state, 1).laps.key1, ...(state.ai ? state.ai.racers.slice(RACE().firstComputer).map(r => r.key1) : [])];
  return keys.map((k, n) => (n < RACE().firstComputer ? holderOf(state, n).place : 1 + keys.filter(o => o > k).length)); // @math places count from 1
}
export const racePoints = place => RACE().points - place;
