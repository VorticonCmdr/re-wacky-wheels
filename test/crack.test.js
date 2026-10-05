import test from 'node:test';
import assert from 'node:assert/strict';
import { linePoints, drawCrack } from '../src/render/crack.js';

test('the line routine plots the start, steps the long axis and the short one when the sum passes the long difference, and ends on the end point', () => {
  assert.deepEqual(linePoints(0, 0, 4, 2), [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2]]);
  assert.deepEqual(linePoints(5, 0, 5, 3), [[5, 0], [5, 1], [5, 2], [5, 3]]);
  assert.deepEqual(linePoints(4, 2, 0, 0), [[4, 2], [3, 2], [2, 1], [1, 1], [0, 0]]); // the other way round is not the same pixels
  assert.deepEqual(linePoints(0, 0, 2, 2), [[0, 0], [1, 1], [2, 2]]); // equal differences go along the y axis
  for (const [x1, y1, x2, y2] of [[119, 95, 22, 41], [168, 90, 185, 53], [247, 43, 296, 56]]) { const p = linePoints(x1, y1, x2, y2); assert.deepEqual([p[0], p.at(-1)], [[x1, y1], [x2, y2]]); }
});

test('the crack draws its picture and seven lines of the colour 0x14', () => {
  const world = { crack: new Uint8Array(84 * 62).fill(7) }, fb = new Uint8Array(320 * 200);
  drawCrack(fb, world);
  assert.equal(fb[90 * 320 + 118], 7); assert.equal(fb[(90 + 61) * 320 + 118 + 83], 7);
  assert.equal(fb[95 * 320 + 119], 0x14); // the first line starts at (0x77, 0x5f)
  assert.equal(fb[41 * 320 + 22], 0x14); // and ends at (0x16, 0x29)
});
