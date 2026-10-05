// What the page defines for a COMM-BAT game on top of the link (docs/comm-bat.md): the input of a player as the two bytes that go over the line each frame, the race the host chose as the
// setup bytes, the checksum the two games compare, and how many frames of delay a line needs. Not evidence about the DOS game: its link carried the controls too (docs/leads/menus.md), but
// its format was not read.
import { SLOTS } from '../game/keys.js';

export const INPUT_SIZE = 2; // the keys (one bit each, in the order of SLOTS) and the taunt key
export const MAX_DELAY = 8; // the most frames of delay a line is given (the game steps about 70 times a second)

export function encodeInput(input) {
  const b = new Uint8Array(INPUT_SIZE);
  SLOTS.forEach((name, i) => { if (input[name]) b[0] |= 1 << i; });
  b[1] = input.taunt ?? 0;
  return b;
}
export function decodeInput(bytes) {
  const input = Object.fromEntries(SLOTS.map((name, i) => [name, Boolean(bytes[0] & (1 << i))]));
  if (bytes[1]) input.taunt = bytes[1];
  return input;
}

// The race: the number of cars (1 head to head, 2 with all cars), the class item, the laps, the engine, the track, both drivers and the detail level that sets the steering rate.
const FIELDS = ['cars', 'cls', 'laps', 'engine', 'track', 'slotOne', 'slotTwo', 'detail'];
export const encodeParams = p => Uint8Array.from(FIELDS.map(f => p[f]));
export function decodeParams(bytes) {
  if (bytes.length !== FIELDS.length) throw new Error('a race of this page has eight setup bytes');
  return Object.fromEntries(FIELDS.map((f, i) => [f, bytes[i]]));
}

// Whether a race the other side chose is one this page can run (the setup arrives over a line anyone can write to): null when it is, else the reason. `tracks` are the numbers of the tracks of the
// archive, `drivers` the number of drivers of CARS.SP.
export function checkParams(p, { tracks, drivers }) {
  const within = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const ok = within(p.cars, 1, 2) && within(p.cls, 1, 3) && within(p.laps, 1, 20) && within(p.engine, 1, 2) && within(p.detail, 1, 3) && tracks.includes(p.track)
    && within(p.slotOne, 0, drivers - 1) && within(p.slotTwo, 0, drivers - 1) && p.slotOne !== p.slotTwo;
  return ok ? null : 'THE OTHER PLAYER CHOSE A RACE THIS GAME CANNOT RUN';
}

// The frames of delay for a round trip: one way plus a frame of slack, as many as fit in `frameMs` each, within 2 to MAX_DELAY.
export const delayFor = (rtt, frameMs) => Math.max(2, Math.min(MAX_DELAY, Math.ceil((rtt ?? 2 * frameMs) / 2 / frameMs) + 1));

// A checksum of what the two games must agree on: the frame, both cars' places, headings and speeds and the laps of each.
export function raceHash(state, cars) {
  let h = 17;
  const mix = n => { h = (Math.imul(h, 31) + (n | 0)) >>> 0; };
  mix(state.tick);
  for (const c of cars) { mix(c.cx); mix(c.cy); mix(c.heading); mix(c.throttle); mix(c.speed); }
  return h;
}
