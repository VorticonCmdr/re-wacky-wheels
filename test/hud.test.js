import test from 'node:test';
import assert from 'node:assert/strict';
import { createHud, stepSpeed, stepHud, advanceTimer, speedDigits, timerText, hudGates } from '../src/game/hud.js';
import { defaultSettings } from '../src/game/menus.js';
import { renderHud, drawTimer } from '../src/render/hud.js';

test('the speed word eases toward twice the speed word by 2 up and 4 down, and stops at the target', () => {
  assert.deepEqual(stepSpeed(0, 20), { shown: 0, word: 2 });
  assert.deepEqual(stepSpeed(38, 20), { shown: 38, word: 40 });
  assert.deepEqual(stepSpeed(39, 20), { shown: 39, word: 40 }); // 41 would pass the target
  assert.deepEqual(stepSpeed(60, 22), { shown: 60, word: 56 });
  assert.deepEqual(stepSpeed(45, 22), { shown: 45, word: 44 }); // 41 would pass the target
  assert.deepEqual(stepSpeed(44, 22), { shown: 44, word: 44 });
});

test('outside the racing mode nothing is drawn and the steps are 4 up and 10 down', () => {
  assert.deepEqual(stepSpeed(0, 20, false), { shown: 0, word: 4 });
  assert.deepEqual(stepSpeed(50, 10, false), { shown: 0, word: 40 });
});

test('the number drawn is the word as it stands, limited to 99', () => {
  assert.equal(stepSpeed(120, 80).shown, 99);
  assert.equal(stepSpeed(99, 80).shown, 99);
  assert.equal(stepSpeed(160, 80).word, 160);
});

test('the speedometer shows two digits, a single digit padded with a zero', () => {
  assert.deepEqual(speedDigits(0), [0, 0]);
  assert.deepEqual(speedDigits(7), [0, 7]);
  assert.deepEqual(speedDigits(52), [5, 2]);
  assert.deepEqual(speedDigits(99), [9, 9]);
});

test('the timer text is MM:SS:T of the tenths counter, and 0 above the cap', () => {
  assert.equal(timerText(0), '00:00:0');
  assert.equal(timerText(98), '00:09:8');
  assert.equal(timerText(159), '00:15:9');
  assert.equal(timerText(600), '01:00:0');
  assert.equal(timerText(36000), '60:00:0');
  assert.equal(timerText(36001), '00:00:0');
});

test('the race counter ticks every 100 ms of the wall clock and keeps the remainder', () => {
  let hud = advanceTimer(createHud(), 250);
  assert.deepEqual([hud.ticks, hud.rest], [2, 50]);
  hud = advanceTimer(hud, 49);
  assert.deepEqual([hud.ticks, hud.rest], [2, 99]);
  hud = advanceTimer(hud, 1);
  assert.deepEqual([hud.ticks, hud.rest], [3, 0]);
});

test('a race frame reads the counter and eases the word, and lists what is only read from the code', () => {
  let hud = advanceTimer(createHud(), 300);
  const first = stepHud(hud, { speed: 20 });
  assert.deepEqual([first.hud.shown, first.hud.word, first.hud.timerShown], [0, 2, 3]);
  assert.ok(first.unproven.some(u => /under 10/.test(u)));
  hud = { ...first.hud, word: 120 };
  assert.ok(stepHud(hud, { speed: 80 }).unproven.some(u => /limit of 99/.test(u)));
  assert.deepEqual(stepHud({ ...hud, word: 50 }, { speed: 40 }).unproven, []);
  assert.equal(stepHud(advanceTimer(createHud(), 300), { speed: 20 }, false).hud.timerShown, 0);
});

test('the Race Screen Options switches gate the speedometer and the timer', () => {
  const settings = defaultSettings();
  assert.deepEqual(hudGates(settings), { speedometer: true, timer: true });
  assert.deepEqual(hudGates({ ...settings, switches: [1, 0, 1] }), { speedometer: true, timer: false }); // OVERHEAD MAP, CLOCK DISPLAY, SPEEDOMETER
  assert.deepEqual(hudGates({ ...settings, switches: [1, 1, 0] }), { speedometer: false, timer: true });
});

// Synthetic pictures: every frame a different fill so the right one can be told.
const art = () => {
  const lap = new Uint8Array(0x4c56), icons = new Uint8Array(0x15c6), genef = new Uint8Array(0x3964);
  for (let k = 0; k < 8; k++) lap.fill(k + 1, k * 0x27e, (k + 1) * 0x27e);
  icons.fill(200, 0xccc, 0xccc + 0x31e);
  for (let d = 0; d < 10; d++) icons.fill(d + 1, 0xfea + 0x96 * d, 0xfea + 0x96 * (d + 1));
  for (let g = 0; g < 11; g++) genef.fill(g + 100, 13733 + 63 * g, 13733 + 63 * (g + 1));
  return { lap, icons, genef };
};
const at = (fb, x, y) => fb[y * 320 + x];

test('the HUD draws the place frame, the speedometer panel with its digits and the timer glyphs at the observed places', () => {
  const fb = new Uint8Array(320 * 200);
  renderHud(fb, art(), { place: 3, speed: [5, 2], timer: '12:34:5' });
  assert.equal(at(fb, 25, 12), 3); // the third LAP frame, its top left
  assert.equal(at(fb, 46, 40), 3); // and its bottom right
  assert.equal(at(fb, 24, 12), 0);
  assert.equal(at(fb, 0, 181), 200); // the panel
  assert.equal(at(fb, 41, 199), 200);
  assert.equal(at(fb, 3, 183), 6); // the tens digit 5 is the picture 5 (fill 6)
  assert.equal(at(fb, 12, 197), 6);
  assert.equal(at(fb, 15, 183), 3); // the units digit 2
  assert.equal(at(fb, 264, 112), 101); // the timer's first glyph is the digit 1
  assert.equal(at(fb, 264 + 7 * 2, 112), 110); // the colon (glyph 10) at the third place
  assert.equal(at(fb, 264 + 7 * 6, 112), 105); // the last digit 5
});

test('timer glyphs are transparent where the picture has a zero', () => {
  const a = art(), fb = new Uint8Array(320 * 200).fill(77);
  a.genef[13733] = 0; // the first pixel of the digit 0
  drawTimer(fb, a, '0');
  assert.equal(at(fb, 264, 112), 77);
  assert.equal(at(fb, 265, 112), 100);
  assert.throws(() => drawTimer(fb, a, 'x'), /no timer glyph/);
});
