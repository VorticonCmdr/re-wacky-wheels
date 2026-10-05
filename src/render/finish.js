// The finish's labels and message on the race screen (race.finish-flow).
import { drawText } from './text.js';
import { messageBox, labelOf } from '../game/finish.js';

const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on

// The box of the boxed text mode (obj1+0x271e4): a border of one pixel and a fill, 8 per character and 8 wide, 16 high, from (x - 4, y - 4).
export function drawBox(fb, x, y, width, height, border, fill) {
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const px = x + i, py = y + j;
    if (px < 0 || px >= SCREEN.width || py < 0 || py >= SCREEN.height) continue;
    fb[py * SCREEN.width + px] = i === 0 || i === width - 1 || j === 0 || j === height - 1 ? border : fill;
  }
}

// The message at (x, y): the box of its width and the text inside.
export function drawMessage(fb, ofont, message) {
  const B = messageBox();
  drawBox(fb, message.x - B.margin, message.y - B.margin, B.glyph * message.text.length + B.glyph, B.height, B.border, B.fill);
  drawText(fb, ofont, message.text, message.x, message.y);
}

const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)

// The labels of the finishers: the text and the driver's picture (CARS.SP slot frame 0, the size of the largest car picture, column-major, zero transparent).
export function drawLabels(fb, ofont, world, labels) {
  const { w, h } = world.carShape[0], bytes = w * h;
  for (const l of labels) {
    const at = labelOf(l.place);
    drawText(fb, ofont, at.text, at.textX, at.y);
    const frame = world.carFrames.cars.subarray(l.slot * SLOT_FRAMES * bytes, l.slot * SLOT_FRAMES * bytes + bytes);
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = frame[i * h + j], px = at.pictureX + i, py = at.y + j; if (v !== 0 && px < SCREEN.width && py < SCREEN.height) fb[py * SCREEN.width + px] = v; }
  }
}
