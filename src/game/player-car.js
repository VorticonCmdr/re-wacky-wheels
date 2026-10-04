// The player's car as a draw-list record (view.player-car-draw, car.player-frames-observed): always the largest car picture, 0x7c away, at the middle
// of the screen, its frame chosen by the lean of the car (the pictures of Tigi: TIGER.SP 0 and 1, CARS.SP 88, TIGER.SP 2 and 3) or the drift picture.
import { K } from '../evidence/k.js';

const MODEL = () => K({ samples: 80, width: 38, height: 28, left: 141, topRows: [164, 165], frameBytes: 1064, straight: ['CARS.SP', 88], drift: ['CARS.SP', 87], steering: ['TIGER.SP', 0, 1, 2, 3], histogram: { 'CARS.SP:88': 51, 'CARS.SP:87': 5, 'TIGER.SP:0': 9, 'TIGER.SP:1': 4, 'TIGER.SP:2': 2, 'TIGER.SP:3': 9 }, frameWordOrder: [['TIGER.SP', 0], ['TIGER.SP', 1], ['CARS.SP', 88], ['TIGER.SP', 2], ['TIGER.SP', 3]], stateWord: 24, frameWord: 26, pressedState: 5, driftState: 3 }, 'car.player-frames-observed');
const DRAW = () => K({ routine: 0x16a3c, skipWords: [0x28c42, 0x28ca8], skipWhen: 4, centre: 0xa0, rowWordAt: 0xbdf8, distance: 0x7c, type: 0, racerIndexWord: 0x28b7e, maxRow: 0xc7, drawListAt: 0x1d86c, drawRecordBytes: 0x28, frameWord: 0x1d704, pictureTables: [0xe470, 0xe560] }, 'view.player-car-draw');
const VIEW = () => K({ fixedBits: 16, tan: 37837, center: 160, maxColumn: 319, viewShift: 14, viewRound: 8096, minDistance: 80, maxDistance: 1122, sizeBase: 124, sizeStep: 70, maxSize: 9, maxRow: 199, worldOffset: 1024, fanHalf: 160, fanReach: 1122, rowFirst: 240, rowNumerator: 18000, rowMinimum: 21, rowMaximum: 240, rowBase: 120, rowEntries: 4096, trigEntryBytes: 8, turn: 1920, slopeBytes: 4, viewBytes: 4, rounding: 32768 }, 'view.model');

const frameOf = (world, [file, index]) => {
  const C = MODEL(), data = file === 'CARS.SP' ? world.carFrames.cars : world.carFrames.driver;
  return data.subarray(index * C.frameBytes, (index + 1) * C.frameBytes);
};

// car: the lean word (0 to 4) and `spin` of the car state. The top row is the row-table bottom of the distance 0x7c less the picture's 28 rows.
export function playerRecord(world, car) {
  const C = MODEL(), V = VIEW(), distance = DRAW().distance, picture = world.carShape[0];
  const ref = car.spin ? C.drift : C.frameWordOrder[car.lean];
  return { width: picture.w, height: picture.h, left: C.left, top: world.rows[distance] - picture.h, picture, firstColumn: 0, skipRows: 0, frame: frameOf(world, ref), distance, sizeClass: 0, type: 0, racer: 0, object: -1, maxRow: V.maxRow };
}
