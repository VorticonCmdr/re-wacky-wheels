import test from 'node:test';
import assert from 'node:assert/strict';
import { gridValue, createLaps, stepLaps, lapsTotal, isFinished } from '../src/game/laps.js';
import { counterDigits, lapText } from '../src/game/hud.js';
import { slotOf, drawText } from '../src/render/text.js';
import { renderHud } from '../src/render/hud.js';

const pos = () => { const grid = new Uint16Array(64 * 64); grid[2 * 64 + 3] = 5; return { grid, trailer: 27 }; };

test('the grid value is the cell at row and column of the offset from 0x400 shifted by 5, and 0 outside the square', () => {
  const p = pos();
  assert.equal(gridValue(p, 0x400 + 3 * 32 + 5, 0x400 + 2 * 32 + 7), 5);
  assert.equal(gridValue(p, 0x400 + 4 * 32, 0x400 + 2 * 32), 0);
  assert.equal(gridValue(p, 0x3ff, 0x400), 0);
  assert.equal(gridValue(p, 0x400, 0x400 + 0x800), 0);
  assert.equal(gridValue(p, 0x400 + 0x7ff, 0x400 + 0x7ff), 0); // the last cell of the empty grid
});

test('a lap is counted when the value goes from the trailer to 1', () => {
  let laps = { lap: 0, prev: 20, flag: 0, shown: false };
  for (const v of [24, 27]) laps = stepLaps(laps, v, 27, 6).laps;
  assert.deepEqual(laps, { lap: 0, prev: 27, flag: 0, shown: false });
  laps = stepLaps(laps, 1, 27, 6).laps;
  assert.deepEqual(laps, { lap: 1, prev: 1, flag: 0, shown: true });
  laps = stepLaps(laps, 2, 27, 6).laps;
  assert.equal(laps.lap, 1);
});

test('the value 0 changes nothing and is listed as unproven', () => {
  const laps = { lap: 3, prev: 27, flag: 0, shown: true }, out = stepLaps(laps, 0, 27, 6);
  assert.deepEqual(out.laps, laps);
  assert.equal(out.unproven.length, 1);
  assert.equal(stepLaps(out.laps, 1, 27, 6).laps.lap, 4); // the previous value was kept
});

test('crossing the line backwards sets the flag and the next forward crossing is cancelled', () => {
  let laps = { lap: 2, prev: 1, flag: 0, shown: true };
  const back = stepLaps(laps, 27, 27, 6);
  assert.deepEqual(back.laps, { lap: 2, prev: 27, flag: 1, shown: true });
  assert.ok(back.unproven.length > 0);
  const forward = stepLaps(back.laps, 1, 27, 6);
  assert.deepEqual(forward.laps, { lap: 2, prev: 1, flag: 0, shown: true });
  laps = stepLaps(forward.laps, 27, 27, 6).laps;
  assert.equal(stepLaps(stepLaps(laps, 1, 27, 6).laps, 2, 27, 6).laps.lap, 2);
});

test('a lap start is a lap only from the trailer: 1 after 5 is not a crossing', () => {
  assert.equal(stepLaps({ lap: 0, prev: 5, flag: 0, shown: false }, 1, 27, 6).laps.lap, 0);
});

test('the lap text is shown from the first counted lap, and the figure starts when the lap word reaches the laps word', () => {
  const first = stepLaps({ lap: 0, prev: 27, flag: 0, shown: false }, 1, 27, 6);
  assert.deepEqual([first.laps.lap, first.laps.shown, first.started], [1, true, false]);
  assert.equal(stepLaps({ lap: 5, prev: 27, flag: 0, shown: true }, 1, 27, 6).started, true);
  const last = stepLaps({ lap: 6, prev: 27, flag: 0, shown: true }, 1, 27, 6);
  assert.deepEqual([last.laps.lap, last.started], [7, false]);
});

test('the laps of a race follow the menu choice and the finish is the crossing after the last lap', () => {
  assert.deepEqual([1, 2, 3].map(lapsTotal), [6, 8, 10]);
  assert.equal(isFinished(7, 6), true);
  assert.equal(isFinished(6, 6), false);
  assert.equal(createLaps(pos(), 0x400 + 3 * 32, 0x400 + 2 * 32).prev, 5);
});

test('the lap text reads LAP n, then LAST LAP! at the laps word, FINISHED! when finished', () => {
  assert.equal(lapText(0, 6, false), 'LAP 0');
  assert.equal(lapText(5, 6, false), 'LAP 5');
  assert.equal(lapText(6, 6, false), 'LAST LAP!');
  assert.equal(lapText(7, 6, true), 'FINISHED!');
});

test('the count label shows two zero-padded digits', () => {
  assert.deepEqual(counterDigits(0), [0, 0]);
  assert.deepEqual(counterDigits(7), [0, 7]);
  assert.deepEqual(counterDigits(42), [4, 2]);
});

test('the text routine maps letters, digits and punctuation to slots and leaves other characters out', () => {
  assert.deepEqual(['A', 'Z', '0', '9', '!', ':'].map(slotOf), [0, 25, 26, 35, 36, 53]);
  assert.equal(slotOf(' '), null);
  assert.equal(slotOf('a'), null);
  assert.throws(() => slotOf('AB'), /not one character/);
});

test('drawText advances 8 for every character, also for a space, and skips zero pixels', () => {
  const ofont = new Uint8Array(0x403c);
  for (let k = 0; k < 61; k++) ofont.fill(k + 1, k * 0x40 + 1, (k + 1) * 0x40); // the first byte of each glyph stays 0
  const fb = new Uint8Array(320 * 200).fill(9);
  drawText(fb, ofont, 'A B', 10, 20);
  assert.equal(fb[20 * 320 + 10], 9); // transparent first pixel
  assert.equal(fb[21 * 320 + 10], 1); // A is slot 0, fill 1
  assert.equal(fb[20 * 320 + 18], 9); // the space draws nothing
  assert.equal(fb[21 * 320 + 26], 2); // B is slot 1, fill 2, at the third place
});

test('the banner draws its three pictures, then the digits opaque, and the HUD draws the name and the lap text', () => {
  const lap = new Uint8Array(0x4c56).fill(7), icons = new Uint8Array(0x15c6), genef = new Uint8Array(0x3964), ofont = new Uint8Array(0x403c).fill(5);
  for (let d = 0; d < 10; d++) lap.fill(d + 20, 0x46ec + 90 * d, 0x46ec + 90 * (d + 1));
  const fb = new Uint8Array(320 * 200);
  renderHud(fb, { lap, icons, genef, ofont }, { banner: [4, 2], name: true, lap: 'LAP 1' });
  assert.equal(fb[6 * 320 + 17], 7); // the panel's top left
  assert.equal(fb[6 * 320 + 68], 7); // the lap label
  assert.equal(fb[6 * 320 + 146], 7); // the count label
  assert.equal(fb[11 * 320 + 118], 23); // the single digit 3
  assert.equal(fb[11 * 320 + 181], 24); // tens 4
  assert.equal(fb[11 * 320 + 191], 22); // units 2
  assert.equal(fb[50 * 320 + 4], 5); // the name
  assert.equal(fb[164 * 320 + 4], 5); // the lap text
});

test('the lap text glyphs not seen on the screen are listed', async () => {
  const { unseenGlyphs } = await import('../src/game/hud.js');
  assert.deepEqual(unseenGlyphs('LAP 2'), []);
  assert.deepEqual(unseenGlyphs('LAST LAP!'), []);
  assert.deepEqual(unseenGlyphs('LAP 10'), ['1', '0']);
  assert.deepEqual(unseenGlyphs('LAP 3'), ['3']);
});
