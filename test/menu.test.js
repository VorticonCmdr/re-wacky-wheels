import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu, stepFrame, moveCursor, advanceAnimation, sizeOf, frameOf, lionTopOf } from '../src/game/menu.js';
import { menuItems, tileOf, loadTiles, drawItem } from '../src/render/menu.js';

test('the cursor wraps at both ends', () => {
  assert.equal(moveCursor(1, 'up'), 9);
  assert.equal(moveCursor(9, 'down'), 1);
  assert.equal(moveCursor(4, 'down'), 5);
  assert.equal(menuItems().length, 9);
});

test('a cursor key moves the cursor at once and animates the icons at the old row, then settles', () => {
  let { menu } = stepFrame(createMenu(), 'down');
  assert.equal(menu.cursor, 2);
  assert.equal(menu.busy, 1);
  assert.equal(menu.lionTop, lionTopOf(1));
  for (let i = 0; i < 3; i++) menu = stepFrame(menu, null).menu;
  assert.equal(menu.lionFrame, 3);
  assert.equal(menu.lionTop, lionTopOf(1));
  menu = stepFrame(menu, null).menu;
  assert.deepEqual([menu.busy, menu.lionFrame, menu.lionTop], [0, 0, lionTopOf(2)]);
});

test('a cursor key while the icons are busy is dropped, Enter chooses the cursor', () => {
  const { menu } = stepFrame(createMenu(), 'down');
  assert.equal(stepFrame(menu, 'down').menu.cursor, 2);
  assert.equal(stepFrame(createMenu(), 'enter').chosen, 1);
  assert.equal(stepFrame(createMenu(), 'escape').chosen, 0);
});

test('Esc puts the cursor on the last item at once, icons settled', () => {
  const { menu } = stepFrame(createMenu(), 'escape');
  assert.deepEqual([menu.cursor, menu.lionTop, menu.busy, menu.lionFrame], [9, lionTopOf(9), 0, 0]);
  assert.equal(stepFrame(menu, 'escape').menu.cursor, 9);
});

test('the cars run a 51 step cycle and move to the next pair', () => {
  let s = { phase: 1, count: 1, pair: 1 };
  const sizes = [];
  for (let i = 0; i < 51; i++) { sizes.push(sizeOf(s.phase, s.count)); s = advanceAnimation(s); }
  assert.deepEqual([s.phase, s.count, s.pair], [1, 1, 3]);
  assert.deepEqual(sizes.slice(0, 11), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]);
  assert.equal(sizes[50], 9);
  assert.equal(frameOf(1, 1), 0);
  assert.equal(frameOf(2, 8), 0);
  assert.equal(frameOf(2, 10), 1);
});

test('characters map to the proven tiles and refuse the unproven ones', () => {
  assert.equal(tileOf('A'), 0);
  assert.equal(tileOf('Z'), 25);
  assert.equal(tileOf(' '), 36);
  assert.equal(tileOf('-'), 39);
  assert.equal(tileOf('™'), 41);
  assert.throws(() => tileOf('5'), /no proven tile/);
  assert.throws(() => tileOf('a'), /no proven tile/);
});

test('an item draws a space tile first, then one tile per character, 11 columns apart', () => {
  const data = new Uint8Array(15 * 13 * 42).fill(0);
  for (let t = 0; t < 42; t++) data[t * 195] = t + 1; // @math the first pixel of tile t holds the value t + 1 (195 = 15 x 13)
  const tiles = loadTiles(data), fb = new Uint8Array(320 * 200);
  drawItem(fb, tiles, 'AB', 0);
  assert.equal(fb[76 * 320 + 39], 37);
  assert.equal(fb[76 * 320 + 50], 1);
  assert.equal(fb[76 * 320 + 61], 2);
  assert.throws(() => loadTiles(new Uint8Array(10)), /not 42 tiles/);
});
