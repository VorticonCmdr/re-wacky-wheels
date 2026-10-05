// The player's car as a draw-list record (view.player-car-draw, car.player-frames-observed): always the largest car picture, 0x7c away, at the middle
// of the screen, its frame chosen by the lean of the car (the pictures of Tigi: TIGER.SP 0 and 1, CARS.SP 88, TIGER.SP 2 and 3) or the drift picture.
import { K } from '../evidence/k.js';
import { pictureOf, entryNumber } from './control.js';
import { hopOf } from './effects.js';

const MODEL = () => K({ samples: 80, width: 38, height: 28, left: 141, topRows: [164, 165], frameBytes: 1064, straight: ['CARS.SP', 88], drift: ['CARS.SP', 87], steering: ['TIGER.SP', 0, 1, 2, 3], histogram: { 'CARS.SP:88': 51, 'CARS.SP:87': 5, 'TIGER.SP:0': 9, 'TIGER.SP:1': 4, 'TIGER.SP:2': 2, 'TIGER.SP:3': 9 }, frameWordOrder: [['TIGER.SP', 0], ['TIGER.SP', 1], ['CARS.SP', 88], ['TIGER.SP', 2], ['TIGER.SP', 3]], stateWord: 24, frameWord: 26, pressedState: 5, driftState: 3 }, 'car.player-frames-observed');
const DRAW = () => K({ routine: 0x16a3c, skipWords: [0x28c42, 0x28ca8], skipWhen: 4, centre: 0xa0, rowWordAt: 0xbdf8, distance: 0x7c, type: 0, racerIndexWord: 0x28b7e, maxRow: 0xc7, drawListAt: 0x1d86c, drawRecordBytes: 0x28, frameWord: 0x1d704, pictureTables: [0xe470, 0xe560] }, 'view.player-car-draw');
const VIEW = () => K({ fixedBits: 16, tan: 37837, center: 160, maxColumn: 319, viewShift: 14, viewRound: 8096, minDistance: 80, maxDistance: 1122, sizeBase: 124, sizeStep: 70, maxSize: 9, maxRow: 199, worldOffset: 1024, fanHalf: 160, fanReach: 1122, rowFirst: 240, rowNumerator: 18000, rowMinimum: 21, rowMaximum: 240, rowBase: 120, rowEntries: 4096, trigEntryBytes: 8, turn: 1920, slopeBytes: 4, viewBytes: 4, rounding: 32768 }, 'view.model');

export const PLAYER_SLOT = 7; // @math the player's driver slot: CARS.SP frame 88 is the entry 4 of the slot 7 (car.player-frames-observed, car.control-rules)

const frameOf = (world, [file, index]) => {
  const C = MODEL(), data = file === 'CARS.SP' ? world.carFrames.cars : world.carFrames.driver;
  return data.subarray(index * C.frameBytes, (index + 1) * C.frameBytes);
};

// The frame the car's entry shows ([file, index] of the archive's car files): the idle frame while the cars wait, else the picture the car's table row names.
export function playerRef(car, idle = null, slot = PLAYER_SLOT) {
  const C = MODEL(), source = pictureOf(car, slot) ?? { file: 'cars', index: C.straight[1] }; // a picture the slot does not have is drawn as the straight pose
  return idle ?? [source.file === 'cars' ? 'CARS.SP' : 'TIGER.SP', source.index];
}

// The entry of the slot record that frame is, or -1 (effects.ground-dust: the frames of the table are the entries 1 to 3 and 5 to 7).
export const refEntry = (ref, slot = PLAYER_SLOT) => entryNumber(ref, slot);

// The left column and the top row of the player's entry (the row-table bottom of the distance 0x7c less the picture's rows), before the car's jiggle and hop.
export function playerGeometry(world) {
  const C = MODEL(), picture = world.carShape[0];
  return { left: C.left, top: world.rows[DRAW().distance] - picture.h };
}

// car: the car state, whose picture table and row (`pic`, car.control-rules) name the frame; `slot` is the driver's slot. `fx` is the draw's result for this frame (effects.js): the car rises a
// row in every second call, a pit state shows its own picture, and the effects are blitted after the car.
export function playerRecord(world, car, idle = null, slot = PLAYER_SLOT, fx = null, lifted = true) {
  const C = MODEL(), V = VIEW(), D = DRAW(), picture = world.carShape[0], ref = playerRef(car, idle, slot);
  const up = (fx?.up ?? 0) + (lifted ? hopOf(car) : 0), after = fx?.after ?? []; // the jump height is taken off the row inside the entry's draw, after the object pass (racer.blink)
  if (fx?.crash) { // the crash states: the flight or fall frame at the crash row (effects.crash)
    const source = pictureOf({ pic: { table: fx.crash.table, row: fx.crash.row } }, slot);
    if (source) return { width: picture.w, height: picture.h, left: C.left, top: fx.crash.top, picture, firstColumn: 0, skipRows: 0, frame: frameOf(world, [source.file === 'cars' ? 'CARS.SP' : 'TIGER.SP', source.index]), distance: D.distance, sizeClass: 0, type: 0, racer: 0, object: -1, maxRow: V.maxRow, skip: false, after };
  }
  if (fx?.pit) { // the pit state: the record's second picture through the first size of 32X24.INF (effects.pit)
    const shape = world.pitShape[0];
    return { width: shape.w, height: shape.h, left: D.centre - (shape.w >> 1), top: world.rows[D.distance] - shape.h - up, picture: shape, firstColumn: 0, skipRows: 0, frame: fx.pit.bytes, distance: D.distance, sizeClass: 0, type: 0, racer: 0, object: -1, maxRow: V.maxRow, skip: fx.hidden, after };
  }
  return { width: picture.w, height: picture.h, left: C.left, top: world.rows[D.distance] - picture.h - up, picture, firstColumn: 0, skipRows: 0, frame: frameOf(world, ref), distance: D.distance, sizeClass: 0, type: 0, racer: 0, object: -1, maxRow: V.maxRow, skip: fx?.hidden ?? false, after };
}
