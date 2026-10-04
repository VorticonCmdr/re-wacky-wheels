import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, layoutOf } from '../../render/menu.js';
import { enterMenu, stepFrame } from '../../game/menu.js';
import { menuDef } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ T: expected('menu.tree-observed') });
const MENUS = ['main', 'options', 'comm', 'detail', 'toggles']; // the order of the rectangles in a record (the first record took the first four)
const KEY = { KBD_esc: 'escape', KBD_space: 'enter', KBD_enter: 'enter', KBD_up: 'up', KBD_down: 'down' }; // the recorder's key names as the port's step takes them
const BETWEEN = 8; // @math steps of the menu between two pauses: more than the 5 an icon animation takes
const LOST_TAPS = 2; // @math taps the game dropped in a record
const PAGE = { width: 320, height: 200 }; // @math the mode 13h page every record reads
// Where each record starts: the menu on screen at its first pause, with the menus above it.
const STARTS = {
  'menupath-1': { id: 'comm', stack: [{ id: 'main', cursor: 5 }] }, // @math the Comm-bat menu is opened from item 5 of the main menu
  'menupath-2': { id: 'toggles', stack: [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 3 }] }, // @math item 6 of the main menu, item 3 of the options menu
};
const SEEN = { 'menupath-1': ['comm', 'main', 'options', 'detail', 'options', 'main', 'comm', 'main'], 'menupath-2': ['toggles', 'options', 'toggles', 'options', 'main'] };

// The rectangle the record took for a menu: inside the block of bars, clear of the icons (16 columns in from each end).
const boxOf = (id, settings) => { const d = menuDef(id, settings), l = layoutOf(d.kind, d.items); return [l.x0 + 16, l.y0, l.width - 32, 12 * d.items.length + 1]; }; // @math 16 columns in from each end; the rows are 12 apart with the last tile 13 high

// The CRC-32 of each recorded rectangle on the port's page of a menu (the bars do not depend on the animation).
function blockCrcs(art, id, settings, boxes) {
  const d = menuDef(id, settings), fb = new Uint8Array(PAGE.width * PAGE.height);
  renderMenu(fb, art, { kind: d.kind, items: d.items, lionTop: 0, lionFrame: 0, pair: 0, size: 0, frame: 0 }); // @math any state: the rectangles lie between the icons and the cars
  return boxes.map(([x, y, w, h]) => { const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = fb[(y + j) * PAGE.width + x + i]; return crc(out); });
}

// Replay the taps through the port's menus: at every pause the menu the port is in is the one whose own block of bars the recorded page shows (a tap the game
// dropped leaves the menu as it was).
function replay(dat, r, V, { start = STARTS[r.id] } = {}) {
  assertArchive(r, dat);
  const art = loadMenuArt(archiveMembers(dat)), keys = new Map(r.keys.map(([i, k]) => [i, KEY[k]])), ids = MENUS.slice(0, r.rectBoxes.length);
  const settings = { switches: V.T.menus.toggles.words.map(w => (r.samples[0].extra ?? {})[w] ?? 1) }; // @math all on when the record did not read the words
  assert.deepEqual(r.rectBoxes, ids.map(id => boxOf(id, settings)), 'the rectangles are the blocks of the menus');
  const crcs = new Map(ids.map(id => [id, blockCrcs(art, id, settings, r.rectBoxes)]));
  let menu = { ...enterMenu(start.id, start.stack, settings) }, lost = 0;
  const seen = [];
  r.samples.forEach((s, i) => {
    const before = menu;
    menu = stepFrame(menu, keys.get(i) ?? null).menu;
    const shown = ids.filter((id, k) => crcs.get(id)[k] === s.rects[k]); // each menu's own rectangle: the others may take in the icons of the menu shown
    if (keys.has(i) && shown.join() !== menu.id && shown.join() === before.id) { menu = before; lost++; }
    assert.deepEqual(shown, [menu.id], `${r.id} pause ${i}: the page shows the menu the port is in (${menu.id})`);
    if (seen.at(-1) !== menu.id) seen.push(menu.id);
    for (let k = 0; k < BETWEEN; k++) menu = stepFrame(menu, null).menu;
  });
  assert.ok(lost <= LOST_TAPS, `${r.id}: at most ${LOST_TAPS} dropped taps (${lost})`);
  return seen;
}

export default {
  id: 'obs-menupath',
  claims: ['menu.tree-observed'],
  obs: ['menupath-1', 'menupath-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    for (const id of Object.keys(SEEN)) assert.deepEqual(replay(dat, ctx.obs(id), V), SEEN[id], `${id}: the menus the path went through`);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), r1 = ctx.obs('menupath-1'), r2 = ctx.obs('menupath-2');
    return [
      { label: 'the path started in the options menu', fn: () => replay(dat, r1, V, { start: { id: 'options', stack: [{ id: 'main', cursor: 6 }] } }) }, // @math item 6 of the main menu opens the options menu
      { label: 'a tap left out', fn: () => replay(dat, { ...r1, keys: r1.keys.filter((k, i) => i !== 2) }, V) }, // @math the third tap, the first Space
      { label: 'a recorded block CRC altered', fn: () => replay(dat, { ...r1, samples: r1.samples.map((s, i) => (i === 30 ? { ...s, rects: s.rects.map(() => '00000000') } : s)) }, V) }, // @math a pause inside the detail menu
      { label: 'the switches menu from the wrong item', fn: () => replay(dat, { ...r2, samples: r2.samples.map(s => s) }, V, { start: { id: 'options', stack: [{ id: 'main', cursor: 6 }] } }) }, // @math item 6 of the main menu
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r1, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
