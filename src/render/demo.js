// What a demo race draws differently (demo.flow): the page picture as the sky of a slide, the logo, and the attract mode's DEMO MODE text.
import { demoModel } from '../game/demo.js';
import { blitFlat } from './sprites.js';
import { drawText } from './text.js';

const SCREEN_WIDTH = 320; // @math the screen is 320 columns wide

// Rows 0 to 129 of the page picture replace the sky and the horizon strip; its zero pixels are black.
export function drawDemoSky(fb, picture) {
  const D = demoModel();
  fb.set(picture.indices.subarray(0, D.picture.rows * SCREEN_WIDTH), 0);
  return fb;
}

// The 92 x 41 picture from OFONT.SP (the piece after the glyph table), drawn transparently at (4, 0x9b).
export function drawDemoLogo(fb, ofont) {
  const L = demoModel().logo;
  return blitFlat(fb, { bytes: ofont.subarray(L.offset, L.offset + L.width * L.height), width: L.width, height: L.height, x: L.x, y: L.y });
}

// The banner routine's DEMO MODE text of the attract mode.
export function drawDemoText(fb, ofont) {
  const T = demoModel().text;
  drawText(fb, ofont, T.text, T.x, T.y);
}
