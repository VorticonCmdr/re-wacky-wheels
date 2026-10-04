import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, layoutOf } from '../../render/menu.js';
import { enterMenu, stepFrame } from '../../game/menu.js';
import { menuDef } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['menutoggle-1', 'menutoggle-2'];
const values = () => ({ T: expected('menu.tree-observed') });
const KEY = { KBD_esc: 'escape', KBD_space: 'enter', KBD_enter: 'enter', KBD_up: 'up', KBD_down: 'down' }; // the recorder's key names as the port's step takes them
const BETWEEN = 8; // @math steps of the menu between two pauses: more than the 5 an icon animation takes
const LOST_TAPS = 3; // @math taps the game dropped in each record: the first one of a run is often lost
const PAGE = { width: 320, height: 200 }; // @math the mode 13h page every record reads

// The CRC-32 of the record's rectangle on the port's page of the switches menu with the given settings.
function blockCrc(art, settings, box) {
  const d = menuDef('toggles', settings), fb = new Uint8Array(PAGE.width * PAGE.height), [x, y, w, h] = box;
  renderMenu(fb, art, { kind: d.kind, items: d.items, lionTop: 0, lionFrame: 0, pair: 0, size: 0, frame: 0 }); // @math any state: the rectangle lies between the icons and the cars
  const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = fb[(y + j) * PAGE.width + x + i];
  return crc(out);
}

// Replay the taps through the port's menus. After each pause the cursor and the switch words are the port's (a dropped tap leaves the state as it was), the
// settled icons are at the row of the cursor, and while the switches menu is shown its block of bars is the port's page for the switches in the words.
function replay(dat, r, V, { skip = null, wrongStart = null } = {}) {
  assertArchive(r, dat);
  const art = loadMenuArt(archiveMembers(dat)), T = V.T.menus.toggles, keys = new Map(r.keys.map(([i, k]) => [i, KEY[k]])), first = r.samples[0];
  assert.deepEqual(Object.keys(first.extra).map(Number), T.words, 'the words the record read are the switches of the claim');
  const wordsOf = s => T.words.map(w => s.extra[w]);
  const d = menuDef('toggles'), l = layoutOf(d.kind, menuDef('toggles').items), box = [l.x0 + 16, l.y0, l.width - 32, 12 * d.items.length + 1]; // @math 16 columns in from each end; the rows are 12 apart with the last tile 13 high
  assert.deepEqual(r.rectBoxes, [box], 'the rectangle is the block of bars of the switches menu');
  // the switches menu is opened from item 3 of the options menu, which was opened from item 6 of the main menu
  const options = { ...enterMenu('options', [{ id: 'main', cursor: 6 }], { switches: wrongStart ?? wordsOf(first) }), cursor: 3 }; // @math item 6 of the main menu, item 3 of the options menu
  let menu = stepFrame(options, 'enter').menu;
  assert.deepEqual([menu.id, menu.cursor], ['toggles', 1], 'item 3 of the options menu opens the switches menu at its first item'); // @math the first item
  menu = { ...menu, cursor: first.cursor };
  menu.lionTop = first.lionRow;
  let lost = 0, mismatches = 0, shown = 0;
  r.samples.forEach((s, i) => {
    const key = keys.get(i) === skip ? null : keys.get(i), before = menu;
    if (key) menu = stepFrame(menu, key).menu;
    const recorded = { cursor: s.cursor, switches: wordsOf(s) };
    const same = m => m.cursor === recorded.cursor && m.settings.switches.join() === recorded.switches.join();
    if (key && !same(menu) && same(before)) { menu = before; lost++; } // the game dropped the tap
    for (let k = 0; k < BETWEEN; k++) menu = stepFrame(menu, null).menu;
    assert.equal(menu.cursor, recorded.cursor, `${r.id} pause ${i}: the cursor`);
    assert.deepEqual(menu.settings.switches, recorded.switches, `${r.id} pause ${i}: the switches`);
    if (s.busy === 0 && menu.busy === 0) assert.equal(menu.lionTop, s.lionRow, `${r.id} pause ${i}: the settled icons are at the row of the cursor`); // @math 0 is the settled value of menu.animation-observed
    if (menu.id === 'toggles') { shown++; if (blockCrc(art, menu.settings, box) !== s.rects[0]) mismatches++; }
  });
  assert.ok(lost <= LOST_TAPS, `${r.id}: at most ${LOST_TAPS} dropped taps (${lost})`);
  assert.ok(mismatches <= LOST_TAPS, `${r.id}: the block of bars is the port's (${mismatches} of ${shown} pauses differ)`);
  return { lost, shown };
}

export default {
  id: 'obs-menutoggle',
  claims: ['menu.tree-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    for (const id of IDS) { const got = replay(dat, ctx.obs(id), V); assert.ok(got.shown >= 0.4 * ctx.obs(id).samples.length, `${id}: the switches menu was on screen for a good part of the pauses (${got.shown})`); } // @math 40 percent: the first record leaves the menu after about a third of the pauses
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menutoggle-2');
    return [
      { label: 'a tap left out', fn: () => replay(dat, r, V, { skip: 'escape' }) && replay(dat, r, V, { skip: 'enter' }) },
      { label: 'all switches off at the start', fn: () => replay(dat, r, V, { wrongStart: [0, 0, 0] }) }, // @math three switches
      { label: 'a recorded switch word altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 100 ? { ...s, extra: { ...s.extra, [V.T.menus.toggles.words[0]]: 1 - s.extra[V.T.menus.toggles.words[0]] } } : s)) }, V) }, // @math a pause in the middle of the run
      { label: 'a recorded block CRC altered', fn: () => replay(dat, { ...r, samples: r.samples.map(s => ({ ...s, rects: ['00000000'] })) }, V) },
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
