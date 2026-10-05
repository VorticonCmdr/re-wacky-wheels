import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu, enterMenu, enterSetup, stepFrame, moveCursor, advanceAnimation, sizeOf, frameOf } from '../src/game/menu.js';
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

test('SINGLE PLAYER RACING shows the vehicle screen, then leads through the setup menus and the last one starts the race', () => {
  const opened = stepFrame(createMenu(), 'enter');
  assert.equal(opened.chosen.vehicle, 'class'); // the vehicle screen comes first (menu.vehicle-screen)
  let menu = enterSetup(opened.menu, opened.chosen.vehicle);
  assert.deepEqual([menu.id, menu.stack.length], ['class', 1]);
  for (const id of ['laps', 'engine', 'races']) { menu = stepFrame(menu, 'enter').menu; assert.equal(menu.id, id); }
  menu = settle(stepFrame(menu, 'down').menu);
  const out = stepFrame(menu, 'enter');
  assert.equal(out.chosen.race, 1);
  assert.equal(out.chosen.settings.flow.races, 2);
  assert.equal(out.chosen.settings.flow.class, 1);
  assert.equal(stepFrame(menu, 'escape').menu.id, 'main');
});

test('items that are not menus are returned to the page', () => {
  let menu = createMenu();
  for (let i = 0; i < 8; i++) menu = settle(stepFrame(menu, 'down').menu);
  assert.deepEqual(stepFrame(menu, 'enter').chosen, { leave: true }); // LEAVE GAME ends the game on its text screen
});

test('every menu a choice opens is in the table', async () => {
  const { famousIds } = await import('../src/game/menus.js'), all = [...menuIds(), ...famousIds()];
  for (const id of all) for (const a of menuDef(id).actions) if (a.open) assert.ok(all.includes(a.open), `${id} opens ${a.open}`);
});

test('the Info menu leads to the famous drivers menus and their halls', async () => {
  const { famousIds } = await import('../src/game/menus.js'), flow = (races) => ({ ...defaultSettings(), flow: { ...defaultSettings().flow, races } });
  assert.deepEqual(menuDef('info').actions[2], { pending: 'FAMOUS DRIVERS' }); assert.deepEqual(menuDef('info', defaultSettings(1, true)).actions[2], { open: 'drivers' });
  assert.deepEqual(menuDef('drivers').actions.map(a => a.open ?? (a.back ? 'back' : null)), ['cups1', 'cups2', 'cups3', 'trials', 'back']);
  assert.deepEqual(menuDef('cups2').items, ['BRONZE RACE', 'SILVER RACE', 'GOLD RACE', 'LEAVE THIS MENU']); assert.deepEqual(menuDef('cups2').actions[1], { famous: { cls: 2, cup: 2 } });
  assert.deepEqual(menuDef('cups1', flow(2)).items, ['BONUS BRONZE RACE', 'BONUS SILVER RACE', 'BONUS GOLD RACE', 'LEAVE THIS MENU']);
  assert.deepEqual(menuDef('trials').actions.map(a => a.open ?? (a.back ? 'back' : null)), ['tracks1', 'tracks2', 'tracks3', 'back']);
  assert.deepEqual(menuDef('tracks2').items, ['SILVER TRACK 1', 'SILVER TRACK 2', 'SILVER TRACK 3', 'SILVER TRACK 4', 'SILVER TRACK 5', 'LEAVE THIS MENU']); assert.deepEqual(menuDef('tracks2').actions[2], { hall: { cup: 2, race: 3 } });
  assert.equal(famousIds().length, 9);
  assert.deepEqual(menuDef('restore', defaultSettings(1, true)).items, ['RESTORE SAVED GAME', 'START NEW GAME']); assert.deepEqual(menuDef('restore').actions, [{ restore: true }, { newGame: true }]);
});

test('menus are laid out centred, with 4 cars in a submenu', () => {
  assert.deepEqual([layoutOf('main', menuDef('main').items).x0, layoutOf('main', menuDef('main').items).y0], [39, 76]);
  const o = menuDef('options'), l = layoutOf('sub', o.items);
  assert.deepEqual([l.x0, l.y0], [33, 88]);
  const info = menuDef('info'), li = layoutOf('sub', info.items);
  assert.deepEqual([li.x0, li.y0], [66, 82]);
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
  assert.equal(tileOf('0'), 26);
  assert.equal(tileOf('9'), 35);
  assert.throws(() => tileOf('!'), /no proven tile/);
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

test('a detail list opens on the current level and choosing sets the level and goes back', () => {
  const settings = { ...defaultSettings(), detail: { single: 2, split: 3 } };
  const detail = enterMenu('detail', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 1 }], settings);
  let menu = stepFrame(detail, 'enter').menu; // item 1: the single screen list
  assert.deepEqual([menu.id, menu.cursor], ['single', 2]);
  menu = settle(stepFrame(menu, 'down').menu);
  assert.equal(menu.cursor, 3);
  menu = stepFrame(menu, 'enter').menu;
  assert.deepEqual([menu.id, menu.cursor, menu.settings.detail], ['detail', 1, { single: 3, split: 3 }]);
  // the split list opens on its own level
  menu = settle(stepFrame(menu, 'down').menu);
  menu = stepFrame(menu, 'enter').menu;
  assert.deepEqual([menu.id, menu.cursor], ['split', 3]);
  assert.deepEqual(menuDef('single').items, ['HIGH   DETAIL', 'MEDIUM DETAIL', 'LOW    DETAIL']);
});

test('the class item skips the setup menus its class forces: the time trial the laps, the kid mode the laps and the engine', async () => {
  const { menuDef } = await import('../src/game/menus.js'), { forcedOf } = await import('../src/game/classes.js');
  const actions = menuDef('class').actions.map(a => a.goto ?? a.race);
  assert.deepEqual(actions, ['laps', 'laps', 'laps', 'engine', 'races']);
  assert.deepEqual([forcedOf(1), forcedOf(4), forcedOf(5)], [{ skip: [], laps: null, engine: null }, { skip: ['laps'], laps: 6, engine: null }, { skip: ['laps', 'engine'], laps: 3, engine: 2 }]);
});
