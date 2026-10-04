import assert from 'node:assert/strict';
import { moveCursor } from '../../game/menu.js';
import { menuDef } from '../../game/menus.js';
import { expected } from '../expect.js';

const IDS = ['menucur-1', 'menuanim-2', 'menusub-1'];
const values = () => ({ C: expected('menu.cursor-observed') });
const LOST_TAPS = 4; // @math the recordings tapped 93 keys and the game dropped at most this many

// Replay the cursor: between two pauses a tap (read in the interval) moves it one item, wrapping, or is dropped; with no tap it does not move.
function replay(records, V, { wrap = V.C.wrap, step = 1 } = {}) {
  const seen = { moved: 0, lost: 0, wrapDown: 0, wrapUp: 0 };
  for (const r of records) {
    assert.equal(r.words.cursor, V.C.cursorWord, `${r.id}: the tool read the cursor word of the claim`);
    const count = menuDef(r.menu).items.length;
    const keys = new Map(r.keys.map(([i, k]) => [i, k.replace('KBD_', '')]));
    for (let i = 1; i < r.samples.length; i++) {
      const a = r.samples[i - 1].cursor, b = r.samples[i].cursor, key = keys.get(i);
      assert.ok(a >= V.C.base && a < V.C.base + count, 'the cursor is an item number of the menu');
      if (!key) { assert.equal(b, a, `pause ${i} of ${r.id}: no key, no move`); continue; }
      if (b === a) { seen.lost++; continue; }
      const expectedNext = wrap ? moveCursor(a, key, count) : Math.min(Math.max(a + (key === 'down' ? step : -step), V.C.base), V.C.base + count - 1);
      assert.equal(b, expectedNext, `pause ${i} of ${r.id}: ${key} from ${a}`);
      seen.moved++;
      if (key === 'down' && a === V.C.base + count - 1) seen.wrapDown++;
      if (key === 'up' && a === V.C.base) seen.wrapUp++;
    }
  }
  assert.ok(seen.lost <= LOST_TAPS, `at most ${LOST_TAPS} dropped taps (${seen.lost})`);
  return seen;
}

export default {
  id: 'obs-menucursor',
  claims: ['menu.cursor-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const seen = replay(IDS.map(id => ctx.obs(id)), values());
    assert.ok(seen.wrapDown >= 1 && seen.wrapUp >= 1 && seen.moved >= 50, `both wraps and enough moves were seen (${JSON.stringify(seen)})`); // @math 25 + 20 + 9 moves were recorded
  },
  async discriminate(ctx) {
    const recs = IDS.map(id => ctx.obs(id)), V = values();
    return [
      { label: 'a cursor that stops at the ends', fn: () => replay(recs, V, { wrap: false }) },
      { label: 'a step of two', fn: () => replay(recs, V, { wrap: false, step: 2 }) }, // @math two items a key
      { label: 'a recorded cursor altered', fn: () => replay(recs.map(r => ({ ...r, samples: r.samples.map((s, i) => (i === 20 ? { ...s, cursor: (s.cursor % 4) + 1 } : s)) })), V) }, // @math four items
    ];
  },
};
