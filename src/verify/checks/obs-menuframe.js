import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, menuItems, lionTopFor, carCount } from '../../render/menu.js';
import { advanceAnimation, frameOf, sizeOf } from '../../game/menu.js';
import { menuDef, menuIds } from '../../game/menus.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['menuanim-2', 'menusub-1', 'menusub-2', 'menusub-3'];
const values = () => ({ S: expected('menu.screen-model'), main: expected('menu.main-observed'), A: expected('menu.animation-observed'), T: expected('menu.tree-observed') });
const PAGE = 320 * 200; // @math the 320 x 200 page the CRC covers
const LAG = 10; // @math the displayed page can be one step behind the words (a few pauses in a record): at most this many

const stateOf = (s, def) => ({ kind: def.kind, items: def.items, lionTop: s.lionRow, lionFrame: s.lionFrame, pair: s.pair, size: s.size, frame: frameOf(s.phase, s.count) });
const frameCrc = (art, state) => { const fb = new Uint8Array(PAGE); renderMenu(fb, art, state); return crc(fb); };

// The cars' animation state one step before the recorded one: every (phase, count, pair) whose step is the recorded one.
function olderCars(s, V, cars) {
  const out = [];
  for (let phase = 1; phase <= V.A.lengths.length + 1; phase++) for (let count = 0; count < V.A.lengths[1]; count++) for (let k = 0; k < V.A.pairs; k++) { // @math the three phases with a count and the single step after them
    const n = advanceAnimation({ phase, count, pair: k }, cars);
    if (n.phase === s.phase && n.count === s.count && n.pair === s.pair) out.push({ phase, count, pair: k });
  }
  return out;
}

// The tree: the main menu's items are the ones menu.main-observed saw, and every menu a choice opens is in the table.
function tree(V) {
  assert.deepEqual(menuDef('main').items, V.main.items, 'the items of menu.main-observed');
  for (const id of menuIds()) {
    const def = menuDef(id);
    assert.equal(def.actions.length, def.items.length, `${id}: an action for every item`);
    if (id !== 'main') assert.equal(def.items.at(-1), V.T.leave, `${id}: the last item of a submenu is the one that leaves it`);
    for (const a of def.actions) if (a.open) assert.ok(menuIds().includes(a.open), `${id}: the menu ${a.open} it opens is in the table`);
  }
}

// The port's page for the state words of each pause equals the game's whole displayed page (its CRC-32), or - when the page was one step behind the words -
// the page of the state one step earlier.
function replay(dat, r, V, { alter = s => s } = {}) {
  assertArchive(r, dat);
  const art = loadMenuArt(archiveMembers(dat)), def = menuDef(r.menu), cars = carCount(def.kind);
  let exact = 0, lagged = 0;
  r.samples.map(alter).forEach((s, i) => {
    if (s.busy === V.A.lion.settled) assert.equal(s.lionRow, lionTopFor(def.kind, def.items, s.cursor), `${r.id} pause ${i}: the settled icons are at the row of the cursor`);
    if (frameCrc(art, stateOf(s, def)) === s.frameCrc) { exact++; return; }
    const hit = olderCars(s, V, cars).some(c => [s.lionFrame, s.lionFrame - 1].some(lf => lf >= 0 && frameCrc(art, { kind: def.kind, items: def.items, lionTop: s.lionRow, lionFrame: lf, pair: c.pair, size: sizeOf(c.phase, c.count), frame: frameOf(c.phase, c.count) }) === s.frameCrc));
    assert.ok(hit, `${r.id} pause ${i}: the page equals neither the port's page for the words nor for the step before`);
    lagged++;
  });
  assert.ok(lagged <= LAG, `${r.id}: at most ${LAG} pauses caught the page a step behind (${lagged})`);
  return { exact, lagged, total: r.samples.length };
}

export default {
  id: 'obs-menuframe',
  claims: ['menu.screen-model', 'menu.animation-observed', 'menu.tree-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    tree(V);
    for (const id of IDS) {
      const r = ctx.obs(id), got = replay(dat, r, V);
      assert.equal(got.exact + got.lagged, got.total, `${id}: every pause`);
      assert.ok(got.exact >= 0.95 * got.total, `${id}: almost every page equals the port's (${got.exact} of ${got.total})`); // @math 297 of 300 were exact in the first record
    }
    assert.deepEqual(IDS.map(id => ctx.obs(id).menu).sort(), ['comm', 'detail', 'main', 'options'].sort(), 'every menu of the table with items of its own has a record'); // @math the four menus of the table
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r = ctx.obs('menuanim-2'), sub = ctx.obs('menusub-1');
    return [
      { label: 'the cars one frame further', fn: () => replay(dat, r, V, { alter: s => ({ ...s, count: s.count + 2 }) }) }, // @math two counts further move the frame by one
      { label: 'the other pair of car slots', fn: () => replay(dat, r, V, { alter: s => ({ ...s, pair: (s.pair + 2) % 8 }) }) }, // @math the next pair of the four
      { label: 'the icons one row lower', fn: () => replay(dat, r, V, { alter: s => ({ ...s, lionRow: s.lionRow + 1 }) }) },
      { label: 'the icons one frame on', fn: () => replay(dat, r, V, { alter: s => ({ ...s, lionFrame: (s.lionFrame + 1) % V.A.lion.frames }) }) },
      { label: 'a submenu with the cars of the other pair', fn: () => replay(dat, sub, V, { alter: s => ({ ...s, pair: (s.pair + 4) % 8 }) }) }, // @math the other pair of the two a submenu uses
      { label: 'a submenu labelled as the main menu', fn: () => replay(dat, { ...sub, menu: 'main' }, V) },
      { label: 'a recorded page CRC altered', fn: () => replay(dat, r, V, { alter: s => ({ ...s, frameCrc: '00000000' }) }) },
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
