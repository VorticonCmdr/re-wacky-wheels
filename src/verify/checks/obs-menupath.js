import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, layoutOf } from '../../render/menu.js';
import { enterMenu, stepFrame, viewOf } from '../../game/menu.js';
import { menuDef } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ T: expected('menu.tree-observed'), S: expected('menu.screen-model'), main: expected('menu.main-observed') });
const MENUS = ['main', 'options', 'comm', 'detail']; // the order of the rectangles in the record
const KEY = { KBD_esc: 'escape', KBD_space: 'enter', KBD_enter: 'enter', KBD_up: 'up', KBD_down: 'down' }; // the recorder's key names as the port's step takes them
const BETWEEN = 8; // @math steps of the menu between two pauses: more than the 5 an icon animation takes
const PAGE = { width: 320, height: 200 }; // @math the mode 13h page every record reads

// The rectangle the record took for a menu: inside the block of bars, clear of the icons (16 columns in from each end).
const boxOf = id => { const d = menuDef(id), l = layoutOf(d.kind, d.items); return [l.x0 + 16, l.y0, l.width - 32, 12 * d.items.length + 1]; }; // @math 16 columns in from each end; the rows are 12 apart with the last tile 13 high

// The CRC-32 of each recorded rectangle on the port's page of a menu (the bars do not depend on the animation).
function blockCrcs(art, id, boxes) {
  const d = menuDef(id), fb = new Uint8Array(PAGE.width * PAGE.height);
  renderMenu(fb, art, { kind: d.kind, items: d.items, lionTop: 0, lionFrame: 0, pair: 0, size: 0, frame: 0 }); // @math any state: the rectangles lie between the icons and the cars
  return boxes.map(([x, y, w, h]) => { const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = fb[(y + j) * PAGE.width + x + i]; return crc(out); });
}

// Replay the taps through the port's menus: at every pause the menu the port is in is the one whose block of bars the recorded page shows.
function replay(dat, r, V, { start = r.start, opens = null } = {}) {
  assertArchive(r, dat);
  const art = loadMenuArt(archiveMembers(dat)), keys = new Map(r.keys.map(([i, k]) => [i, KEY[k]]));
  assert.deepEqual(r.rectBoxes, MENUS.map(boxOf), 'the rectangles are the blocks of the four menus');
  const crcs = new Map(MENUS.map(id => [id, blockCrcs(art, id, r.rectBoxes)]));
  let menu = enterMenu(start.id, start.stack);
  const seen = [];
  r.samples.forEach((s, i) => {
    menu = stepFrame(menu, keys.get(i) ?? null).menu;
    const shown = MENUS.filter((id, k) => crcs.get(id)[k] === s.rects[k]); // each menu's own rectangle: the others may take in the icons of the menu shown
    assert.deepEqual(shown, [menu.id], `pause ${i}: the page shows the menu the port is in (${menu.id})`);
    if (seen.at(-1) !== menu.id) seen.push(menu.id);
    for (let k = 0; k < BETWEEN; k++) menu = stepFrame(menu, null).menu;
  });
  return seen;
}

export default {
  id: 'obs-menupath',
  claims: ['menu.tree-observed'],
  obs: ['menupath-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), r = ctx.obs('menupath-1'), seen = replay(await ctx.open('WACKY.DAT'), { ...r, start: { id: 'comm', stack: [{ id: 'main', cursor: 5 }] } }, V); // @math the Comm-bat menu was entered from item 5 of the main menu
    assert.deepEqual(seen, ['comm', 'main', 'options', 'detail', 'options', 'main', 'comm', 'main'], 'the menus the path went through');
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), r = { ...ctx.obs('menupath-1'), start: { id: 'comm', stack: [{ id: 'main', cursor: 5 }] } }; // @math the Comm-bat menu was entered from item 5
    return [
      { label: 'the path started in the options menu', fn: () => replay(dat, { ...r, start: { id: 'options', stack: [{ id: 'main', cursor: 6 }] } }, V) }, // @math item 6 of the main menu opens the options menu
      { label: 'a tap left out', fn: () => replay(dat, { ...r, keys: r.keys.filter((k, i) => i !== 2) }, V) }, // @math the third tap, the first Space
      { label: 'a recorded block CRC altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 30 ? { ...s, rects: s.rects.map(() => '00000000') } : s)) }, V) }, // @math a pause inside the detail menu
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
