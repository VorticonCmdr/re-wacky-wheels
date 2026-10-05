// The crack the single-player crash puts over the picture (effects.crash): CRACK.SP drawn plain at its place, then seven lines of one colour. The lines are the game's Bresenham lines
// (obj1+0x11f04): the start point is plotted, the smaller difference is added to half of the larger one at each step along the larger axis, and the other axis steps when the sum passes
// the larger difference; the end point is plotted last.
import { K } from '../evidence/k.js';
import { blitFlat } from './sprites.js';

const CRASH = () => K({ routine: 0x16a3c, states: { flight: 1, hold: 2, fall: 3, gone: 4 }, flightFrames: 8, flightStep: 6, flightStop: 0x72, hold: 0xb, fallStep: 4, fallMax: 0xc7, gone: 0xd, crack: { member: 'CRACK.SP', left: 0x76, top: 0x5a, width: 0x54, height: 0x3e, color: 0x14, sound: 0xb, from: 2, lines: [[0x77, 0x16, 0x5f, 0x29], [0xa8, 0xb9, 0x5a, 0x35], [0xc6, 0xf7, 0x5d, 0x2b], [0xf7, 0x128, 0x2b, 0x38], [0xc3, 0xf1, 0x91, 0xb2], [0xf1, 0xd7, 0xb2, 0xc2], [0x78, 0x2c, 0x86, 0xa9]] } }, 'effects.crash');

// The points of one line from (x1, y1) to (x2, y2), in the order the routine plots them.
export function linePoints(x1, y1, x2, y2) {
  const points = [];
  let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), sx = x2 < x1 ? -1 : 1, sy = y2 < y1 ? -1 : 1;
  if (dy < dx) { // the x axis is the long one
    let sum = dx >> 1; // @math half the long difference (sar 1)
    while (x1 !== x2) { points.push([x1, y1]); sum += dy; if (sum > dx) { y1 += sy; sum -= dx; } x1 += sx; }
  } else { // the y axis is the long one (the routine swaps the roles of the axes)
    let sum = dy >> 1; // @math half the long difference (sar 1)
    while (y1 !== y2) { points.push([x1, y1]); sum += dx; if (sum > dy) { x1 += sx; sum -= dy; } y1 += sy; }
  }
  points.push([x1, y1]); // the end of the line: the point reached
  return points;
}

// The crack over the frame `fb` (the palette indices of the 320 x 200 picture): CRACK.SP of the world, then the seven lines.
export function drawCrack(fb, world) {
  const C = CRASH().crack, width = 320; // @math the picture is 320 columns wide (sprite.model)
  blitFlat(fb, { bytes: world.crack, width: C.width, height: C.height, x: C.left, y: C.top });
  for (const [x1, x2, y1, y2] of C.lines) for (const [x, y] of linePoints(x1, y1, x2, y2)) if (x >= 0 && x < width && y >= 0 && y < 200) fb[y * width + x] = C.color; // @math the picture is 200 rows high
  return fb;
}
