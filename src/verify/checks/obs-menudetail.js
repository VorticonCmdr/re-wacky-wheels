import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, layoutOf } from '../../render/menu.js';
import { enterMenu, stepFrame } from '../../game/menu.js';
import { menuDef, shiftOf, defaultSettings } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ T: expected('menu.tree-observed') });
const KEY = { KBD_esc: 'escape', KBD_space: 'enter', KBD_enter: 'enter', KBD_up: 'up', KBD_down: 'down' }; // the recorder's key names as the port's step takes them
const BETWEEN = 8; // @math steps of the menu between two pauses: more than the 5 an icon animation takes
const SETTLE = 4; // @math pauses after a tap before the state words of the menu are compared: a menu just opened is still setting them up
const LOST_TAPS = 3; // @math taps the game dropped in the record
const PAGE = { width: 320, height: 200 }; // @math the mode 13h page every record reads
const category = id => (id === 'detail' ? 'detail' : 'list');

const boxOf = id => { const d = menuDef(id), l = layoutOf(d.kind, d.items); return [l.x0 + 16, l.y0, l.width - 32, 12 * d.items.length + 1]; }; // @math 16 columns in from each end; the rows are 12 apart with the last tile 13 high
function blockCrc(art, id, box) {
  const d = menuDef(id), fb = new Uint8Array(PAGE.width * PAGE.height), [x, y, w, h] = box;
  renderMenu(fb, art, { kind: d.kind, items: d.items, lionTop: 0, lionFrame: 0, pair: 0, size: 0, frame: 0 }); // @math any state: the rectangle lies between the icons and the cars
  const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = fb[(y + j) * PAGE.width + x + i];
  return crc(out);
}

// Replay the taps through the port's menus: after every pause the menu shown (the detail menu or a list), the two setting words, and - once the menu has settled -
// its cursor and icon row are the port's; a list opens on the current level and choosing item n sets the level to n. A tap the game dropped leaves the state as it was.
function replay(dat, r, V, { skip = null, wrongShift = null } = {}) {
  assertArchive(r, dat);
  const T = V.T, art = loadMenuArt(archiveMembers(dat)), keys = new Map(r.keys.map(([i, k]) => [i, KEY[k]])), first = r.samples[0];
  const [splitWord, singleWord] = [T.menus.split.word, T.menus.single.word].sort((a, b) => a - b);
  assert.deepEqual(Object.keys(first.extra).map(Number).sort((a, b) => a - b), [splitWord, singleWord], 'the words the record read are the level words of the claim');
  const levels = s => ({ single: s.extra[T.menus.single.word], split: s.extra[T.menus.split.word] });
  const boxes = [boxOf('detail'), boxOf('single')];
  assert.deepEqual(r.rectBoxes, boxes, 'the rectangles are the blocks of the detail menu and of a list');
  const crcs = [blockCrc(art, 'detail', boxes[0]), blockCrc(art, 'single', boxes[1])], listCrc = { single: crcs[1], split: blockCrc(art, 'split', boxes[1]) };
  const shiftIndex = id => r.shifts.indexOf(wrongShift ?? shiftOf(id));
  assert.ok(['detail', 'single', 'split'].every(id => shiftIndex(id) >= 0), 'the record read the state block of every menu');
  let menu = enterMenu('detail', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 1 }], { ...defaultSettings(), detail: levels(first) }); // @math item 6 of the main menu, item 1 of the options menu
  menu = { ...menu, cursor: first.blocks[shiftIndex('detail')][0] };
  menu.lionTop = first.blocks[shiftIndex('detail')][1];
  let lost = 0, since = SETTLE, compared = 0, pending = null;
  r.samples.forEach((s, i) => {
    const key = keys.get(i) === skip ? null : keys.get(i), recorded = levels(s);
    const shown = crcs[0] === s.rects[0] ? 'detail' : crcs[1] === s.rects[1] ? 'list' : null;
    const sameState = m => category(m.id) === shown && m.settings.detail.single === recorded.single && m.settings.detail.split === recorded.split;
    if (key) { pending = { at: i, before: menu }; menu = stepFrame(menu, key).menu; since = 0; }
    // the page shows a tap's effect a pause late: a tap is judged two pauses on, and one the game dropped leaves the state as it was
    if (pending && i === pending.at + 2 && !sameState(menu) && sameState(pending.before)) { menu = pending.before; lost++; } // @math judged two pauses after the tap
    for (let k = 0; k < BETWEEN; k++) menu = stepFrame(menu, null).menu;
    since++;
    if (since > 2) { // @math two pauses after a tap
      assert.equal(category(menu.id), shown, `pause ${i}: the page shows the ${category(menu.id)} the port is in`);
      assert.deepEqual(menu.settings.detail, recorded, `pause ${i}: the level words`);
      if (shown === 'list') assert.equal(s.rects[1], listCrc[menu.id], `pause ${i}: the page is the port's page of the ${menu.id} list`);
    }
    // a cursor key the game dropped shows once the words are settled: the cursor is still the one before
    if (pending && i === pending.at + SETTLE && ['up', 'down'].includes(keys.get(pending.at)) && menu.cursor !== s.blocks[shiftIndex(menu.id)][0] && pending.before.cursor === s.blocks[shiftIndex(menu.id)][0]) { menu = pending.before; lost++; }
    if (since > SETTLE) { const b = s.blocks[shiftIndex(menu.id)]; assert.equal(menu.cursor, b[0], `pause ${i}: the cursor of ${menu.id}`); if (b[2] === 0) assert.equal(menu.lionTop, b[1], `pause ${i}: the settled icons of ${menu.id}`); compared++; } // @math 0 is the settled value of menu.animation-observed
  });
  assert.ok(lost <= LOST_TAPS, `at most ${LOST_TAPS} dropped taps (${lost})`);
  return compared;
}

export default {
  id: 'obs-menudetail',
  claims: ['menu.tree-observed'],
  obs: ['menudetail-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const compared = replay(await ctx.open('WACKY.DAT'), ctx.obs('menudetail-1'), values());
    assert.ok(compared >= 250, `most pauses compared the state words (${compared})`); // @math the record has 460 pauses and the menus are settled in most of them
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menudetail-1');
    return [
      { label: 'a tap left out', fn: () => replay(dat, r, V, { skip: 'enter' }) },
      { label: 'the state block of the lists as deep as the detail menu', fn: () => replay(dat, r, V, { wrongShift: shiftOf('detail') }) },
      { label: 'a recorded level word altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 200 ? { ...s, extra: { ...s.extra, [V.T.menus.single.word]: s.extra[V.T.menus.single.word] % 3 + 1 } } : s)) }, V) }, // @math three levels; a pause in the middle of the record
      { label: 'a recorded cursor altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 300 ? { ...s, blocks: s.blocks.map(b => [b[0] + 1, b[1], b[2]]) } : s)) }, V) }, // @math a pause late in the record
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
