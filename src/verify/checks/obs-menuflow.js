import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, layoutOf } from '../../render/menu.js';
import { enterMenu, stepFrame } from '../../game/menu.js';
import { menuDef, shiftOf } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['class', 'laps', 'engine', 'races']; // the menus of the single player setup, in the order of the record's rectangles
const values = () => ({ T: expected('menu.tree-observed'), C: expected('menu.cursor-observed') });
const KEY = { KBD_esc: 'escape', KBD_space: 'enter', KBD_enter: 'enter', KBD_up: 'up', KBD_down: 'down' }; // the recorder's key names as the port's step takes them
const BETWEEN = 8; // @math steps of the menu between two pauses: more than the 5 an icon animation takes
const SETTLE = 4; // @math pauses after a tap before the state words of the menu are compared
const LOST_TAPS = 3; // @math taps the game dropped in the record
const PAGE = { width: 320, height: 200 }; // @math the mode 13h page every record reads

const boxOf = id => { const d = menuDef(id), l = layoutOf(d.kind, d.items); return [l.x0 + 16, l.y0, l.width - 32, 12 * d.items.length + 1]; }; // @math 16 columns in from each end; the rows are 12 apart with the last tile 13 high
function blockCrc(art, id, box) {
  const d = menuDef(id), fb = new Uint8Array(PAGE.width * PAGE.height), [x, y, w, h] = box;
  renderMenu(fb, art, { kind: d.kind, items: d.items, lionTop: 0, lionFrame: 0, pair: 0, size: 0, frame: 0 }); // @math any state: the rectangle lies between the icons and the cars
  const out = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = fb[(y + j) * PAGE.width + x + i];
  return crc(out);
}

// Replay the taps through the port's setup menus: each choice leads to the next menu (the last one starts the race), the page shows the menu the port is in,
// and once it has settled the cursor and icon row are the port's. A tap the game dropped leaves the state as it was.
function replay(dat, r, V, { skip = null, wrongFlow = null } = {}) {
  assertArchive(r, dat);
  const art = loadMenuArt(archiveMembers(dat)), keys = new Map(r.keys.map(([i, k]) => [i, KEY[k]])), boxes = IDS.map(boxOf);
  assert.deepEqual(r.rectBoxes, boxes, 'the rectangles are the blocks of the four menus');
  const crcs = IDS.map((id, k) => blockCrc(art, id, boxes[k]));
  const shiftIndex = id => r.shifts.indexOf(shiftOf(id));
  assert.ok(IDS.every(id => shiftIndex(id) >= 0), 'the record read the state block of every menu');
  const flow = wrongFlow ?? V.T.flow;
  assert.deepEqual(flow, IDS, 'the menus of the sequence');
  let menu = enterMenu('class', [{ id: 'main', cursor: 1 }]), since = SETTLE, lost = 0, compared = 0, pending = null, started = false;
  const shownOf = s => { const k = crcs.findIndex((c, j) => c === s.rects[j]); return k < 0 ? null : IDS[k]; };
  r.samples.forEach((s, i) => {
    const key = keys.get(i) === skip ? null : keys.get(i), shown = shownOf(s);
    if (key) { pending = { at: i, before: menu, key }; const out = stepFrame(menu, key); menu = out.menu; if (out.chosen?.race) started = true; since = 0; }
    // a tap is judged two pauses on: the page shows the effect a pause late, and one the game dropped leaves the state as it was
    if (pending && i === pending.at + 2 && shown !== null && shown !== menu.id && shown === pending.before.id) { menu = pending.before; lost++; started = false; } // @math judged two pauses after the tap
    for (let k = 0; k < BETWEEN; k++) menu = stepFrame(menu, null).menu;
    since++;
    if (!started && since > SETTLE) assert.notEqual(shown, null, `pause ${i}: the page shows one of the setup menus`);
    if (!started && since > 2 && shown !== null) assert.equal(shown, menu.id, `pause ${i}: the page shows the menu the port is in (${menu.id})`); // @math two pauses after a tap
    if (pending && i === pending.at + SETTLE && ['up', 'down'].includes(pending.key) && !started) { const b = s.blocks[shiftIndex(menu.id)]; if (menu.cursor !== b[0] && pending.before.cursor === b[0]) { menu = pending.before; lost++; } }
    if (!started && since > SETTLE && shown === menu.id) { const b = s.blocks[shiftIndex(menu.id)]; assert.equal(menu.cursor, b[0], `pause ${i}: the cursor of ${menu.id}`); if (b[2] === 0) assert.equal(menu.lionTop, b[1], `pause ${i}: the settled icons of ${menu.id}`); compared++; } // @math 0 is the settled value of menu.animation-observed
  });
  assert.ok(lost <= LOST_TAPS, `at most ${LOST_TAPS} dropped taps (${lost})`);
  assert.ok(started, 'the last menu started the race');
  return { compared, flow: menu.settings.flow };
}

export default {
  id: 'obs-menuflow',
  claims: ['menu.tree-observed'],
  obs: ['menuflow-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const got = replay(await ctx.open('WACKY.DAT'), ctx.obs('menuflow-1'), values());
    assert.ok(got.compared >= 100, `most pauses compared the state words (${got.compared})`); // @math the record has 365 pauses and the menus settle within a few of each tap
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menuflow-1');
    return [
      { label: 'a tap left out', fn: () => replay(dat, r, V, { skip: 'enter' }) },
      { label: 'the menus in another order', fn: () => replay(dat, r, V, { wrongFlow: ['laps', 'class', 'engine', 'races'] }) },
      { label: 'a recorded cursor altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 100 ? { ...s, blocks: s.blocks.map(b => [b[0] + 1, b[1], b[2]]) } : s)) }, V) }, // @math a pause in the laps menu
      { label: 'a recorded block CRC altered', fn: () => replay(dat, { ...r, samples: r.samples.map((s, i) => (i === 100 ? { ...s, rects: s.rects.map(() => '00000000') } : s)) }, V) }, // @math a pause in the laps menu
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
