import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMov, startFigure, stepFigure } from '../src/game/figure.js';
import { renderHud } from '../src/render/hud.js';

test('GIG.MOV is a count word and count + 1 entries of two signed words', () => {
  const data = new Uint8Array(2 + 3 * 4), dv = new DataView(data.buffer);
  dv.setUint16(0, 2, true);
  [[0, 0], [-2, 5], [7, -9]].forEach(([x, y], e) => { dv.setInt16(2 + 4 * e, x, true); dv.setInt16(4 + 4 * e, y, true); });
  assert.deepEqual(parseMov(data), { count: 2, entries: [{ x: 0, y: 0 }, { x: -2, y: 5 }, { x: 7, y: -9 }] });
});

test('the figure of driver 7 draws the frames 24 to 27 in turn at the entries 0, 1, 2 ...', () => {
  let fig = startFigure(7);
  const draws = [];
  for (let n = 0; n < 6; n++) { const out = stepFigure(fig, 80); draws.push([out.draw.picture, out.draw.entry, out.fig.frame, out.fig.step]); fig = out.fig; }
  assert.deepEqual(draws, [[24, 0, 1, 1], [25, 1, 2, 2], [26, 2, 3, 3], [27, 3, 0, 4], [24, 4, 1, 5], [25, 5, 2, 6]]);
});

test('the figure plays 81 entries, then three calls of the second phase without a picture, then ends', () => {
  let fig = startFigure(1);
  const phases = [];
  while (fig) { const out = stepFigure(fig, 80); phases.push(out.draw.picture === null ? 'b' : 'a'); fig = out.fig; }
  assert.equal(phases.join(''), 'a'.repeat(81) + 'bbb');
});

test('a short table ends the first phase earlier and keeps the frame word running', () => {
  let fig = startFigure(2);
  const out = [];
  for (let n = 0; n < 3 && fig; n++) { const call = stepFigure(fig, 1); out.push([call.draw.phase, call.fig && call.fig.phase, call.fig && call.fig.step, call.fig && call.fig.frame]); fig = call.fig; }
  assert.deepEqual(out, [[0, 0, 1, 1], [0, 1, 0, 2], [1, 1, 0, 3]]);
});

test('the figure frame is drawn transparent at the column 0xfa and row 0x78 plus its entry, and a call without a picture draws nothing', () => {
  const giggles = new Uint8Array(46816).fill(0);
  giggles.fill(9, 24 * 1672 + 1, 25 * 1672); // frame 24 of the driver 7's block; its first pixel stays transparent
  const art = { lap: new Uint8Array(1), icons: new Uint8Array(1), genef: new Uint8Array(1), ofont: new Uint8Array(1), giggles };
  const fb = new Uint8Array(320 * 200).fill(3);
  renderHud(fb, art, { figure: { draw: { picture: 24, entry: 1, phase: 0 }, entry: { x: -2, y: 5 } } });
  assert.equal(fb[(0x78 + 5) * 320 + 0xfa - 2], 3); // transparent first pixel
  assert.equal(fb[(0x78 + 6) * 320 + 0xfa - 2], 9);
  const other = new Uint8Array(320 * 200).fill(3);
  renderHud(other, art, { figure: { draw: { picture: null, entry: 0, phase: 1 }, entry: { x: 0, y: 0 } } });
  assert.ok(other.every(v => v === 3));
});
