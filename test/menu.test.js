import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu, stepMenu } from '../src/game/menu.js';
import { menuItems, tileOf, loadTiles, drawItem, brightest } from '../src/render/menu.js';

test('the cursor moves between the nine items and stops at the ends', () => {
  let { menu } = stepMenu(createMenu(), 'up');
  assert.equal(menu.selected, 0);
  for (let i = 0; i < 20; i++) menu = stepMenu(menu, 'down').menu;
  assert.equal(menu.selected, menuItems().length - 1);
  assert.equal(menuItems().length, 9);
  assert.equal(stepMenu(menu, 'enter').chosen, 8);
  assert.equal(stepMenu(menu, 'escape').chosen, -1);
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

test('an item draws one tile per character, 11 columns apart', () => {
  const data = new Uint8Array(15 * 13 * 42).fill(0);
  for (let t = 0; t < 42; t++) data[t * 195] = t + 1; // @math the first pixel of tile t holds the value t + 1 (195 = 15 x 13)
  const tiles = loadTiles(data), fb = new Uint8Array(320 * 200);
  drawItem(fb, tiles, 'AB', 0);
  assert.equal(fb[76 * 320 + 50], 1);
  assert.equal(fb[76 * 320 + 61], 2);
  assert.throws(() => loadTiles(new Uint8Array(10)), /not 42 tiles/);
});

test('the brightest palette entry', () => {
  assert.equal(brightest(Uint8Array.from([0, 0, 0, 9, 9, 9, 1, 2, 3])), 1);
});
