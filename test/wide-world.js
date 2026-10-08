// The synthetic wide-view world of the Stage 4 tests (test/stage4-wide.test.js, test/hud-place.test.js), no game files: tables of exact cosines,
// a world the game's draw list can draw from, its floor, a race state over it and an in-memory storage.
import { cosT, stripPeriod } from '../src/enhance/geometry.js';
import { createRandom } from '../src/enhance/particles.js';
import { models } from '../src/enhance/models.js';
import { buildRowTable } from '../src/game/view.js';

const F = models().floor, S = models().sky, V = models().view;

// A TRIG table of exact 16.16 cosines and sines (entry 0 on the x axis), the SLP table of their slopes (16.16 tangents, 0 straight up and down,
// where the tangent has no value), VIEW words of 2^14 times the cosine of each column's angle, the game's row table.
export function tables() {
  const trig = new DataView(new ArrayBuffer(V.turn * V.trigEntryBytes)), slp = new DataView(new ArrayBuffer(V.turn * V.slopeBytes)), view = new DataView(new ArrayBuffer((V.maxColumn + 1) * V.viewBytes)), unit = 2 ** V.fixedBits;
  for (let e = 0; e < V.turn; e++) {
    const a = (2 * Math.PI * e) / V.turn; // @math a turn
    trig.setInt32(e * V.trigEntryBytes, Math.round(unit * Math.cos(a)), true); trig.setInt32(e * V.trigEntryBytes + V.trigEntryBytes / 2, Math.round(unit * Math.sin(a)), true); // @math the second word half an entry on
    slp.setInt32(e * V.slopeBytes, e % (V.turn / 2) === V.turn / 4 ? 0 : Math.trunc(Math.tan(a) * unit), true); // straight up or down no tangent; next to it about 2e7, within a 32-bit word
  }
  for (let c = 0; c <= V.maxColumn; c++) view.setUint32(c * V.viewBytes, Math.round(2 ** V.viewShift * cosT(trig, c - V.center)), true); // @math the VIEW word is a 2.14 fixed-point scale
  return { trig, slp, view, rows: buildRowTable() };
}

// An .INF shape of ten pictures over a W0 x H0 column-major frame (as test/stage4-blit.test.js builds them).
export function infPicture(w, h, src) {
  const deltas = new Int32Array((h + 1) * w);
  for (let i = 0; i < w; i++) { deltas[i * (h + 1)] = src(i, 0); for (let j = 0; j < h; j++) deltas[i * (h + 1) + 1 + j] = j + 1 < h ? src(i, j + 1) - src(i, j) : 0; }
  return { w, h, deltas };
}
export const shapeOfSize = (W0, H0) => Array.from({ length: 10 }, (_, k) => { const w = Math.max(W0 - 3 * k, 2), h = Math.max(H0 - 2 * k, 2); return infPicture(w, h, (i, j) => Math.floor((i * W0) / w) * H0 + Math.floor((j * H0) / h)); }); // @math the size classes shrink

// A world the game's draw list can draw from: the tables, the cars' shape and frames (8 slots of 12 frames of 38 x 28), one kind of object
// (24 x 40, four frames), the starter's frames, the shots' and the ducks' pictures, a start point.
export function syntheticWorld() {
  const random = createRandom(7), bytes = n => Uint8Array.from({ length: n }, () => (random() < 0.3 ? 0 : 1 + Math.floor(random() * 255))); // @math about a third transparent
  return {
    name: 'w', ...tables(), carShape: shapeOfSize(38, 28), shotShape: shapeOfSize(18, 13), pitShape: shapeOfSize(32, 24), shapes: new Map([[5, shapeOfSize(24, 40)]]), // @math the cars', the shots', the pit's and an object's sizes
    sprites: [{ shape: 5, width: 24, height: 40, frames: 4, data: bytes(4 * 24 * 40) }], carFrames: { cars: bytes(8 * 12 * 1064), driver: bytes(12 * 1064) }, // @math four frames; 8 slots of 12 frames of 1064 bytes
    lion: bytes(9000), hogmis: bytes(4000), duckArt: { digger: bytes(16 * 1064), genef: bytes(7641 + 4 * 1064) }, start: { x: 9000, y: 9000, heading: 0 }, // @math the starter's and the shots' bytes; the ducks' 16 frames and the explosion after 7641 bytes; the start far from the camera
  };
}
export const CAMERA = { x: 2048, y: 2048, heading: 300 }; // @math a camera over the map's middle, turned
// A present state of the intro (no own car in the draw list: the camera is not on the human, which stands far behind), with the things given.
export function stateWith(world, { objects = [], racers = [], tick = 0, ...rest } = {}) {
  return { world, tick, intro: true, car: { px: CAMERA.x - 3000, py: CAMERA.y, heading: 0 }, player: { objects, taken: [] }, ai: { racers: [{ x: 0, y: 0, n: 0, compass: 0 }, ...racers] }, slots: [7, 1, 2, 3, 4, 5, 6, 0], start: { mode: 2, tick: 100, lion: 2 }, lionShown: true, shots: [], ...rest }; // @math the racing mode
}
// A world point at `angle` TRIG entries from the camera's heading and `radius` world units away.
export const pointAt = (angle, radius) => { const a = ((CAMERA.heading + angle) * 2 * Math.PI) / V.turn; return { x: Math.round(CAMERA.x + radius * Math.cos(a)), y: Math.round(CAMERA.y + radius * Math.sin(a)) }; }; // @math a turn

// The floor of the synthetic world (the enhancer's frame draws it): NDIST distances, a map of tiles, two sheets, a sky, a strip of the period
// and a palette.
export function floorOf() {
  const random = createRandom(5), ndist = new DataView(new ArrayBuffer(F.columns * F.steps * 4)); // @math four bytes a distance
  for (let c = 0; c < F.columns; c++) for (let k = 0; k < F.steps; k++) ndist.setUint32((c * F.steps + k) * 4, 110 + k * k + (c % 9), true); // @math a plausible floor
  const P = stripPeriod(), par = new Uint8Array(S.parBytes);
  for (let j = 0; j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels; p++) par[j * S.parRowPixels + p] = (p % P) & 0xff; // @math a strip of the period
  return { ndist, tiles: Uint8Array.from({ length: 4096 }, () => Math.floor(random() * 108)), sheets: [0, 1].map(() => Uint8Array.from({ length: 54 * 1024 }, () => Math.floor(random() * 256))), sky: Uint8Array.from({ length: S.width * F.height }, (_, i) => 200 + (Math.floor(i / S.width) % 7)), par, palette: new Uint8Array(768).fill(32) }; // @math 4096 cells of 108 tiles; two sheets of 54 tiles; a sky of rows; a grey palette
}

// A race state over the synthetic world with its floor (the enhancer's frame draws it): the own car on the camera, an object in the left margin.
export const raceOf = () => { const world = { ...syntheticWorld(), ...floorOf() }; return { ...stateWith(world, { objects: [{ id: 0, ...pointAt(-190, 300), consumed: 0, frame: 0 }] }), intro: false, car: { cx: CAMERA.x, cy: CAMERA.y, heading: CAMERA.heading, px: CAMERA.x, py: CAMERA.y, horizon: 100, pic: { table: 'lean', row: 2 } }, humanSlot: 7, fx: null }; }; // @math the object outside the fan at 4 BY 3; the own car straight (control.js's lean row 2)
export const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
