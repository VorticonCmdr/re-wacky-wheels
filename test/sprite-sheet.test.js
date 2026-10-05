import test from 'node:test';
import assert from 'node:assert/strict';
import { spriteSheet, spriteSheetLayout } from '../src/sprite-sheet.js';

const palette = Uint8Array.from({ length: 768 }, (_, i) => Math.floor(i / 3));
const red = sheet => Array.from({ length: sheet.width * sheet.height }, (_, i) => sheet.rgba[i * 4]);
const alpha = (sheet, x, y) => sheet.rgba[(y * sheet.width + x) * 4 + 3];

test('sprite sheets transpose column-major frames and wrap them in source order without altering bytes', () => {
  const data = new Uint8Array([1, 3, 2, 4, 5, 7, 6, 8, 0, 11, 10, 12]), original = data.slice();
  const sheet = spriteSheet(data, 2, 2, palette, { columns: 2, transparent: 0 });
  assert.equal(sheet.frames, 3); assert.equal(sheet.width, 4); assert.equal(sheet.height, 4);
  assert.deepEqual(red(sheet), [1, 2, 5, 6, 3, 4, 7, 8, 0, 10, 0, 0, 11, 12, 0, 0]);
  assert.equal(alpha(sheet, 0, 2), 0); assert.equal(alpha(sheet, 1, 2), 255); assert.equal(alpha(sheet, 2, 2), 0);
  assert.deepEqual(data, original);
});
test('row-major export honors offsets and keeps unused grid cells transparent with opaque frames', () => {
  const sheet = spriteSheet(new Uint8Array([99, 98, 0, 1, 2, 3, 4, 5]), 2, 1, palette, { offset: 2, columns: 2, columnMajor: false });
  assert.deepEqual(red(sheet), [0, 1, 2, 3, 4, 5, 0, 0]);
  assert.equal(alpha(sheet, 0, 0), 255); assert.equal(alpha(sheet, 2, 1), 0);
});
test('exports use the selected palette and include a padded partial final frame consistently with the preview', () => {
  const colors = palette.slice(); colors.set([17, 34, 51], 3);
  const sheet = spriteSheet(new Uint8Array([1, 2, 3]), 2, 1, colors, { columns: 1, columnMajor: false, transparent: 0 });
  assert.equal(sheet.frames, 2); assert.equal(sheet.partialFrame, true);
  assert.deepEqual([...sheet.rgba.subarray(0, 4)], [17, 34, 51, 255]);
  assert.equal(alpha(sheet, 1, 1), 0);
});
test('automatic layouts balance image dimensions and invalid or oversized allocations are rejected', () => {
  const layout = spriteSheetLayout(32 * 32 * 10, 32, 32);
  assert.equal(layout.columns, 4); assert.equal(layout.rows, 3);
  const tall = spriteSheetLayout(10 * 100 * 16, 10, 100); assert.equal(tall.columns, 13);
  assert.throws(() => spriteSheetLayout(4, 0, 2), /Invalid/);
  assert.throws(() => spriteSheetLayout(4, 2, 2, 4), /Invalid/);
  assert.throws(() => spriteSheetLayout(4, 2, 2, 0, -1), /Invalid/);
  assert.throws(() => spriteSheetLayout(20000, 1, 1, 0, 1), /too large/);
  assert.throws(() => spriteSheetLayout(17000000, 1, 1), /too large/);
  assert.throws(() => spriteSheet(new Uint8Array([1]), 1, 1, new Uint8Array()), /palette/);
});
