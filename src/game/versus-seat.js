// The two humans of a split screen game and what is held per human (versus.shootout-rules, versus.layout): the race routine's per-human words (the car, its objects and effects, the HUD, the laps)
// are the `seat` fields of the state; the second human's seat waits in `state.seat2` and is swapped in for its pass, as the game swaps the viewer's words in.
import { SHOOT } from './versus-rules.js';
import { compassSector } from './racers.js';

export const SEAT_FIELDS = ['world', 'car', 'player', 'fx', 'hud', 'humanSlot', 'pose', 'racingBefore', 'touching', 'beforeAnswer', 'laps', 'place', 'figure', 'figureDraw', 'taunt', 'tauntCount', 'tauntDraw', 'lionShown'];

// The compass word of a human racer from its heading (obj1+0x1876c): the table entry of the heading's sector (the rounding of the camera's own sector).
export const humanCompass = heading => SHOOT().compass.table[compassSector(heading)];

// Swaps the second human's seat with the first's: the words of the viewer in the state are the current pass's.
export function swapSeat(state) {
  const other = state.seat2;
  for (const f of SEAT_FIELDS) { const t = state[f]; state[f] = other[f]; other[f] = t; }
  state.versus.viewer ^= 1; // @math the viewer word is 0 or 1
}

export const carsBySeat = state => (state.versus.viewer === 0 ? [state.car, state.seat2.car] : [state.seat2.car, state.car]);
export const slotsBySeat = state => (state.versus.viewer === 0 ? [state.humanSlot, state.seat2.humanSlot] : [state.seat2.humanSlot, state.humanSlot]);

// The object that holds the words of seat `n` (0 or 1): the state itself while it is the viewer, else the waiting seat.
export const holderOf = (state, n) => (state.versus.viewer === n ? state : state.seat2);

// Changes the car of seat `n` and its player record, wherever the seat is held.
export function updateSeat(state, n, change) {
  const holder = holderOf(state, n), car = change(holder.car);
  holder.car = car; holder.player = { ...holder.player, car };
}

// The wreck of a car (obj1+0x11c20 to +0x11c5c, +0x13640 to +0x13676): the wreck word, the crash picture word back at 0, the throttle and the speed gone.
export const wreckCar = car => ({ ...car, wrecked: true, wreckPic: 0, wreckShown: 0, throttle: 0, speed: 0 });
