import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu, enterMenu, stepFrame, moveCursor, advanceAnimation, sizeOf, frameOf } from '../src/game/menu.js';
import { menuDef, menuIds, defaultSettings } from '../src/game/menus.js';
import { menuItems, tileOf, loadTiles, drawItem, layoutOf, lionTopFor, carCount } from '../src/render/menu.js';

const settle = menu => { while (menu.busy) menu = stepFrame(menu, null).menu; return menu; };

test('the cursor wraps at both ends of any menu', () => {
  assert.equal(moveCursor(1, 'up', 9), 9);
  assert.equal(moveCursor(9, 'down', 9), 1);
  assert.equal(moveCursor(4, 'down', 4), 1);
  assert.equal(moveCursor(1, 'up', 3), 3);
  assert.equal(menuItems().length, 9);
});

test('a cursor key moves the cursor at once and animates the icons at the old row, then settles', () => {
  const start = createMenu(), def = menuDef('main');
  let { menu } = stepFrame(start, 'down');
  assert.equal(menu.cursor, 2);
  assert.equal(menu.busy, 1);
  assert.equal(menu.lionTop, lionTopFor(def.kind, def.items, 1));
  for (let i = 0; i < 3; i++) menu = stepFrame(menu, null).menu;
  assert.equal(menu.lionFrame, 3);
  menu = stepFrame(menu, null).menu;
  assert.deepEqual([menu.busy, menu.lionFrame, menu.lionTop], [0, 0, lionTopFor(def.kind, def.items, 2)]);
});

test('a cursor key while the icons are busy is dropped', () => {
  const { menu } = stepFrame(createMenu(), 'down');
  assert.equal(stepFrame(menu, 'down').menu.cursor, 2);
});

test('Enter opens a submenu, Esc and LEAVE THIS MENU go back to the item that was opened', () => {
  let menu = createMenu();
  for (let i = 0; i < 5; i++) menu = settle(stepFrame(menu, 'down').menu);
  assert.equal(menu.cursor, 6);
  menu = stepFrame(menu, 'enter').menu;
  assert.equal(menu.id, 'options');
  assert.equal(menu.cursor, 1);
  assert.equal(menu.pair, carCount('sub') - 1);
  const back = stepFrame(menu, 'escape').menu;
  assert.deepEqual([back.id, back.cursor], ['main', 6]);
  // the last item of a submenu is LEAVE THIS MENU
  for (let i = 0; i < 3; i++) menu = settle(stepFrame(menu, 'down').menu);
  const left = stepFrame(menu, 'enter').menu;
  assert.deepEqual([left.id, left.cursor], ['main', 6]);
});

test('Esc in the main menu puts the cursor on the last item at once, icons settled', () => {
  const { menu } = stepFrame(createMenu(), 'escape');
  assert.deepEqual([menu.cursor, menu.busy, menu.lionFrame], [9, 0, 0]);
  assert.equal(stepFrame(menu, 'escape').menu.cursor, 9);
});

test('items that are not menus are returned to the page', () => {
  assert.deepEqual(stepFrame(createMenu(), 'enter').chosen, { race: 1 });
  let menu = createMenu();
  for (let i = 0; i < 8; i++) menu = settle(stepFrame(menu, 'down').menu);
  assert.deepEqual(stepFrame(menu, 'enter').chosen, { pending: 'LEAVE GAME' });
});

test('every menu a choice opens is in the table', () => {
  for (const id of menuIds()) for (const a of menuDef(id).actions) if (a.open) assert.ok(menuIds().includes(a.open));
});

test('menus are laid out centred, with 4 cars in a submenu', () => {
  assert.deepEqual([layoutOf('main', menuDef('main').items).x0, layoutOf('main', menuDef('main').items).y0], [39, 76]);
  const o = menuDef('options'), l = layoutOf('sub', o.items);
  assert.deepEqual([l.x0, l.y0], [33, 88]);
  assert.equal(carCount('main'), 2);
  assert.equal(carCount('sub'), 4);
});

test('the cars run a 51 step cycle and move to the next pair', () => {
  let s = { phase: 1, count: 1, pair: 1 };
  const sizes = [];
  for (let i = 0; i < 51; i++) { sizes.push(sizeOf(s.phase, s.count)); s = advanceAnimation(s, 2); }
  assert.deepEqual([s.phase, s.count, s.pair], [1, 1, 3]);
  assert.deepEqual(sizes.slice(0, 11), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]);
  assert.equal(sizes[50], 9);
  assert.equal(advanceAnimation({ phase: 4, count: 0, pair: 3 }, 4).pair, 7);
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
  drawItem(fb, tiles, 'AB', 39, 76, 2);
  assert.equal(fb[76 * 320 + 39], 37);
  assert.equal(fb[76 * 320 + 50], 1);
  assert.equal(fb[76 * 320 + 61], 2);
  assert.throws(() => loadTiles(new Uint8Array(10)), /not 42 tiles/);
});

test('the switches menu flips a switch at once and its texts follow', () => {
  const on = menuDef('toggles').items;
  assert.deepEqual(on, ['OVERHEAD MAP  ON ', 'CLOCK DISPLAY ON ', 'SPEEDOMETER   ON ', 'LEAVE THIS MENU']);
  let menu = enterMenu('toggles', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 3 }], defaultSettings());
  menu = stepFrame(menu, 'enter').menu;
  assert.deepEqual(menu.settings.switches, [0, 1, 1]);
  assert.equal(menu.id, 'toggles');
  assert.equal(menuDef('toggles', menu.settings).items[0], 'OVERHEAD MAP  OFF');
  assert.equal(menu.busy, 0);
  // the settings survive leaving
  const back = stepFrame({ ...menu, cursor: 4 }, 'enter').menu;
  assert.deepEqual([back.id, back.cursor, back.settings.switches], ['options', 3, [0, 1, 1]]);
});
