// How the computer racers are drawn (racer.frames, STATIC; racer.frame-observed for the frame rule): the picture of a racer is the frame its compass word picks from
// the table built at start-up, in the camera's compass sector; it is projected and clipped as the object pass does (view.car-column-observed).
import { K } from '../evidence/k.js';
import { projectPoint } from './view.js';

const FRAMES = () => K({ tableAt: 0x106a0, rows: 8, columns: 8, firstRow: 6, sectorSize: 0xf0, roundAt: 0x78, headingWord: 0x1d5d4, sectorWord: 0x28c30, compassWord: 0x1a, frameWord: 0x38, slotWord: 0x26, slotRecordBytes: 0x98, slotTableAt: 0x13c08, drawRoutine: 0x155d4, viewerWord: 0x28b7e }, 'racer.frames');
const SHAPE = () => K({ samples: 80, width: 38, height: 28, left: 141, topRows: [164, 165], frameBytes: 1064, straight: ['CARS.SP', 88], drift: ['CARS.SP', 87], steering: ['TIGER.SP', 0, 1, 2, 3], histogram: { 'CARS.SP:88': 51, 'CARS.SP:87': 5, 'TIGER.SP:0': 9, 'TIGER.SP:1': 4, 'TIGER.SP:2': 2, 'TIGER.SP:3': 9 }, frameWordOrder: [['TIGER.SP', 0], ['TIGER.SP', 1], ['CARS.SP', 88], ['TIGER.SP', 2], ['TIGER.SP', 3]], stateWord: 24, frameWord: 26, pressedState: 5, driftState: 3 }, 'car.player-frames-observed');
const VIEW = () => K({ fixedBits: 16, tan: 37837, center: 160, maxColumn: 319, viewShift: 14, viewRound: 8096, minDistance: 80, maxDistance: 1122, sizeBase: 124, sizeStep: 70, maxSize: 9, maxRow: 199, worldOffset: 1024, fanHalf: 160, fanReach: 1122, rowFirst: 240, rowNumerator: 18000, rowMinimum: 21, rowMaximum: 240, rowBase: 120, rowEntries: 4096, trigEntryBytes: 8, turn: 1920, slopeBytes: 4, viewBytes: 4, rounding: 32768 }, 'view.model');
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)

// The table of obj2+0x106a0 as the start-up code fills it: row r, column c holds (6 - r + c) mod 8 (the row starts at 6 and goes down one a row, the column goes up
// one a place).
export function frameTable() {
  const F = FRAMES(), table = [];
  let edge = F.firstRow;
  for (let row = 0; row < F.rows; row++) {
    let value = edge;
    table.push(Array.from({ length: F.columns }, () => { const v = value; value++; if (value > F.columns - 1) value = 0; return v; }));
    edge--; if (edge < 0) edge = F.rows - 1;
  }
  return table;
}

// The camera's compass sector (obj1+0x187f7 to +0x18875): the heading over 0xf0, one more from 0x78 on, wrapping to 0.
export function compassSector(heading) {
  const F = FRAMES(), whole = Math.floor(heading / F.sectorSize), rest = heading - whole * F.sectorSize;
  let sector = whole % F.rows;
  if (rest >= F.roundAt && whole < heading) { sector++; if (sector > F.rows - 1) sector = 0; }
  return sector;
}

// The frame of a racer for the camera heading and the racer's compass word.
export const racerFrame = (heading, compass, table = frameTable()) => table[compassSector(heading)][compass];

// The draw record of a racer (type 1), or null: the picture of the size class, clipped to the screen as the object pass does, with the frame of its slot.
export function racerRecord(world, view, camera, racer, heading, slot, table, forced = null) {
  const V = VIEW(), C = SHAPE(), hit = projectPoint(world, view, camera, racer.x, racer.y, world.rows);
  if (!hit) return null;
  const picture = world.carShape[hit.sizeClass], frame = forced?.bytes ? 0 : (slot * SLOT_FRAMES + (forced?.frame ?? racerFrame(heading, racer.compass, table))) * C.frameBytes; // forced: a frame of the slot or the picture bytes themselves
  let width = picture.w, height = picture.h, left = hit.column - (picture.w >> 1), top = hit.bottom - picture.h, skipRows = 0, firstColumn = 0; // @math half the width, rounded down
  if (top > V.maxRow) return null;
  if (left < 0) { firstColumn = -left; width -= firstColumn; if (width <= 0) return null; left = 0; }
  else if (left + picture.w - 1 > V.maxColumn) { width -= left + picture.w - 1 - V.maxColumn; if (width <= 0) return null; }
  if (top + picture.h - 1 > V.maxRow) { const cut = top + picture.h - 1 - V.maxRow; height -= cut; if (height <= 0) return null; skipRows = cut; }
  return { width, height, left, top, picture, firstColumn, skipRows, frame: forced?.bytes ?? world.carFrames.cars.subarray(frame, frame + C.frameBytes), distance: hit.distance, sizeClass: hit.sizeClass, type: 1, racer: racer.n, object: -1 };
}

// The records of the computer racers (racer 0 is the player, drawn by player-car.js). `slots` gives each racer's slot of CARS.SP and `frames` the frames forced for some of them.
export function racerRecords(world, view, camera, racers, heading, slots, frames = [], hidden = () => false) {
  const table = frameTable(), out = [];
  for (let n = 1; n < racers.length; n++) { // `frames[n]` is a frame number or { bytes } for a picture of its own (the ducks); `hidden` leaves a racer out
    if (hidden(racers[n])) continue;
    const r = racerRecord(world, view, camera, racers[n], heading, slots[n], table, frames[n] == null ? null : typeof frames[n] === 'object' ? frames[n] : { frame: frames[n] });
    if (r) out.push(r);
  }
  return out;
}
