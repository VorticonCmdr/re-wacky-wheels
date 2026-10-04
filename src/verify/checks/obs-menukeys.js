import assert from 'node:assert/strict';
import { stepFrame, lionTopOf } from '../../game/menu.js';
import { expected } from '../expect.js';

const values = () => ({ K: expected('menu.keys-observed') });

// menukeys-2 (the main menu): every Esc tap is replayed through the port's step and must end at the recorded cursor and icon row, settled.
function main(r, V, { escapeTo = V.K.escapeTo } = {}) {
  const keys = new Map(r.keys.map(([i, k]) => [i, k])), escapes = [];
  let state = null;
  r.samples.forEach((s, i) => {
    const key = keys.get(i);
    if (key === V.K.escapeKey) {
      assert.equal(s.cursor, escapeTo, `pause ${i}: Esc puts the cursor on item ${escapeTo}`);
      assert.equal(s.lionRow, lionTopOf(escapeTo), `pause ${i}: the icons are at its row at once`);
      assert.equal(s.busy, 0, `pause ${i}: and not animating`); // @math 0 is the settled value of menu.animation-observed
      const before = { cursor: r.samples[i - 1].cursor, lionTop: r.samples[i - 1].lionRow, lionFrame: r.samples[i - 1].lionFrame, busy: r.samples[i - 1].busy, phase: s.phase, count: s.count, pair: s.pair };
      const got = stepFrame(before, 'escape').menu;
      assert.deepEqual([got.cursor, got.lionTop, got.lionFrame, got.busy], [s.cursor, s.lionRow, s.lionFrame, s.busy], `pause ${i}: the port's step agrees`);
      escapes.push(i);
    }
    state = s;
  });
  assert.ok(state, 'samples');
  return escapes.length;
}

// menukeys-1 (a submenu and a menu opened from it): Space and Enter each open a menu that starts at cursor 1 with the 136 Hz counter reset, and Esc goes back.
function opened(r, V, { cursor = V.K.openedCursor } = {}) {
  const keys = new Map(r.keys.map(([i, k]) => [i, k]));
  let opens = 0, backs = 0;
  r.samples.forEach((s, i) => {
    const key = keys.get(i);
    if (!key || i === 0) return;
    const reset = s.t136 < r.samples[i - 1].t136;
    if (V.K.selectKeys.includes(key)) { assert.equal(s.cursor, cursor, `pause ${i}: ${key} opens a menu at its first item`); assert.ok(reset, `pause ${i}: and the 136 Hz counter was reset`); opens++; }
    if (key === V.K.escapeKey) { assert.ok(reset, `pause ${i}: Esc left the menu (counter reset)`); backs++; }
  });
  const keysList = r.keys.map(([, k]) => k);
  assert.ok(V.K.selectKeys.every(k => keysList.includes(k)), 'both selecting keys were tried');
  // Esc goes back to the item that was opened: the cursor after the first Esc is the one before Space
  const at = new Map(r.keys.map(([i, k]) => [k + i, i]));
  const space = r.keys.find(([, k]) => k === V.K.selectKeys[0])[0], esc = r.keys.find(([i, k]) => k === V.K.escapeKey && i > space)[0];
  assert.equal(r.samples[esc].cursor, r.samples[space - 1].cursor, 'Esc returns to the item that was opened');
  assert.ok(at.size > 0, 'keys');
  return { opens, backs };
}

export default {
  id: 'obs-menukeys',
  claims: ['menu.keys-observed'],
  obs: ['menukeys-1', 'menukeys-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), escapes = main(ctx.obs('menukeys-2'), V), got = opened(ctx.obs('menukeys-1'), V);
    assert.ok(escapes >= 3 && got.opens >= 2 && got.backs >= 3, `enough taps (${escapes}, ${JSON.stringify(got)})`); // @math 3 Esc in the main menu, 2 opens and 3 Esc in the submenu were recorded
  },
  async discriminate(ctx) {
    const V = values(), r2 = ctx.obs('menukeys-2'), r1 = ctx.obs('menukeys-1');
    return [
      { label: 'Esc to item 8', fn: () => main(r2, V, { escapeTo: V.K.escapeTo - 1 }) },
      { label: 'a menu opened at its second item', fn: () => opened(r1, V, { cursor: V.K.openedCursor + 1 }) },
      { label: 'a recorded counter not reset', fn: () => opened({ ...r1, samples: r1.samples.map((s, i) => (i === r1.keys[6][0] ? { ...s, t136: 1e9 } : s)) }, V) }, // @math the Space tap's pause
    ];
  },
};
