import test from 'node:test';
import assert from 'node:assert/strict';
import { gridValue, createLaps, stepLaps, stepWrongWay, lapsTotal, isFinished } from '../src/game/laps.js';
import { counterDigits, lapText } from '../src/game/hud.js';
import { slotOf, drawText } from '../src/render/text.js';
import { renderHud, drawWrongWay } from '../src/render/hud.js';

const clear = { wrong: 0, wrongSince: 0, wrongNext: 0, wrongShown: null }; // the WRONG WAY sign's words while it is off (hud.wrong-way)
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
  assert.deepEqual(laps, { lap: 0, prev: 27, flag: 0, shown: false, key1: 27, key2: 27, ...clear });
  laps = stepLaps(laps, 1, 27, 6).laps;
  assert.deepEqual(laps, { lap: 1, prev: 1, flag: 0, shown: true, key1: 1025, key2: 28, ...clear }); // lap x trailer + value
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
  assert.deepEqual(back.laps, { lap: 2, prev: 27, flag: 1, shown: true, key1: 1051, key2: 54, ...clear }); // the lap less 1 while the flag is set
  assert.ok(back.unproven.length > 0);
  const forward = stepLaps(back.laps, 1, 27, 6);
  assert.deepEqual(forward.laps, { lap: 2, prev: 1, flag: 0, shown: true, key1: 2049, key2: 55, ...clear });
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

// The WRONG WAY sign (hud.wrong-way): the human's update turns it on and off, the HUD routine flips its picture once a call.
test('a falling value turns the sign on with the counter as its stamp, and it starts on the first picture', () => {
  const on = stepLaps({ lap: 1, prev: 12, flag: 0, shown: true, ...clear, wrongNext: 1 }, 11, 27, 6, 40).laps;
  assert.deepEqual([on.wrong, on.wrongSince, on.wrongNext], [1, 40, 0]);
  const again = stepLaps(on, 10, 27, 6, 47).laps; // still falling: the stamp and the picture word are kept
  assert.deepEqual([again.wrong, again.wrongSince], [1, 40]);
  assert.equal(stepWrongWay(again).wrongShown, 0);
});

test('a backward crossing of the line sets the flag but neither shows nor clears the sign', () => {
  const back = stepLaps({ lap: 2, prev: 1, flag: 0, shown: true, ...clear }, 27, 27, 6, 5).laps;
  assert.deepEqual([back.flag, back.wrong], [1, 0]);
  const kept = stepLaps({ lap: 2, prev: 1, flag: 0, shown: true, ...clear, wrong: 1, wrongSince: 3 }, 27, 27, 6, 5).laps;
  assert.deepEqual([kept.flag, kept.wrong, kept.wrongSince], [1, 1, 3]);
});

test('the sign goes off at a rising value, at a forward crossing, or after 10 frames on the same value', () => {
  const sign = { lap: 1, prev: 12, flag: 0, shown: true, ...clear, wrong: 1, wrongSince: 100 };
  assert.equal(stepLaps(sign, 13, 27, 6, 101).laps.wrong, 0);
  assert.equal(stepLaps({ ...sign, prev: 27 }, 1, 27, 6, 101).laps.wrong, 0);
  assert.equal(stepLaps(sign, 12, 27, 6, 109).laps.wrong, 1); // 9 frames
  assert.equal(stepLaps(sign, 12, 27, 6, 110).laps.wrong, 0); // 10 frames
  assert.equal(stepLaps(sign, 0, 27, 6, 500).laps.wrong, 1); // off the course nothing changes
});

test('the HUD routine alternates the two pictures once a call while the sign is on and shows none when it is off', () => {
  let laps = { ...clear, wrong: 1 };
  const shown = [];
  for (let k = 0; k < 4; k++) { laps = stepWrongWay(laps); shown.push(laps.wrongShown); }
  assert.deepEqual(shown, [0, 1, 0, 1]);
  assert.equal(stepWrongWay({ ...laps, wrong: 0 }).wrongShown, null);
});

test('the sign is drawn from LAP.SP 0x2cdc or 0x322c at (120, 182), zero transparent, the second player 100 rows higher', () => {
  const lap = new Uint8Array(0x4c56), icons = new Uint8Array(0x15c6), genef = new Uint8Array(0x3964), ofont = new Uint8Array(0x403c);
  lap.fill(9, 0x2cdc, 0x2cdc + 80 * 17); lap.fill(6, 0x322c, 0x322c + 80 * 17); lap[0x2cdc] = 0;
  const fb = new Uint8Array(320 * 200).fill(3);
  renderHud(fb, { lap, icons, genef, ofont }, { wrongWay: 0 });
  assert.equal(fb[182 * 320 + 120], 3); // the zero pixel in the corner
  assert.equal(fb[183 * 320 + 120], 9);
  assert.equal(fb[198 * 320 + 199], 9);
  assert.equal(fb[199 * 320 + 199], 3);
  assert.equal(fb[182 * 320 + 200], 3);
  const split = new Uint8Array(320 * 200);
  drawWrongWay(split, { lap }, 1, true);
  assert.equal(split[82 * 320 + 120], 6);
  assert.equal(split[182 * 320 + 120], 0);
});
