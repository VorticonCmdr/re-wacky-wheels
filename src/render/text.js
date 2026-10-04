// The game's text routine for the HUD (text.char-map, text.glyphs-observed): every character of a string is an 8 x 8 glyph of OFONT.SP, column-major, zero
// pixels transparent, drawn left to right at an advance of 8; a character with no glyph draws nothing and still advances.
import { K } from '../evidence/k.js';

const GLYPHS = () => K({ tableAt: 0xa778, entries: 0x3d, slotBytes: 0x40, glyphSize: [8, 8], member: 'OFONT.SP', text: 'TIGI', x: 4, y: 50, advance: 8, letterBase: 0x41, letters: 26, subsetMatches: 1 }, 'text.glyphs-observed');
const MAP = () => K({ routine: 0x48f4, tableAt: 0xa778, advance: 8, letterBase: 0x41, letterLast: 0x5a, digitFirst: 0x30, digitLast: 0x39, digitBase: 0x16, punctuation: { 0x21: 0x24, 0x23: 0x26, 0x26: 0x2a, 0x27: 0x39, 0x28: 0x2c, 0x29: 0x2d, 0x2c: 0x36, 0x2d: 0x37, 0x2e: 0x35, 0x3a: 0x35, 0x3f: 0x34, 0x40: 0x38 }, glyphSize: [8, 8], modes: { plain: 0, shaded: 2 }, boxColours: [0x26, 0x2c], boxRoutine: 0x271e4 }, 'text.char-map');
const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on (floor.model and every observation read 320 x 200)

// The glyph slot of a character, or null when the routine draws nothing for it.
export function slotOf(ch) {
  const M = MAP(), code = ch.charCodeAt(0);
  if (ch.length !== 1) throw new Error(`not one character: ${JSON.stringify(ch)}`);
  if (code >= M.letterBase && code <= M.letterLast) return code - M.letterBase;
  if (code >= M.digitFirst && code <= M.digitLast) return code - M.digitBase;
  return M.punctuation[code] ?? null;
}

// Draw `text` with its first character's top left at (x, y).
export function drawText(fb, ofont, text, x, y) {
  const G = GLYPHS(), [w, h] = G.glyphSize;
  [...text].forEach((ch, k) => {
    const slot = slotOf(ch);
    if (slot === null) return;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      const v = ofont[G.slotBytes * slot + i * h + j], px = x + G.advance * k + i, py = y + j;
      if (v !== 0 && px >= 0 && px < SCREEN.width && py >= 0 && py < SCREEN.height) fb[py * SCREEN.width + px] = v;
    }
  });
}

// The place a driver's name is drawn at (text.glyphs-observed: TIGI under the place panel).
export const nameAt = () => { const G = GLYPHS(); return { x: G.x, y: G.y, text: G.text }; };
