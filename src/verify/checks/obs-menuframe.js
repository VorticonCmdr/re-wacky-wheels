import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadMenuArt, renderMenu, menuItems } from '../../render/menu.js';
import { advanceAnimation, frameOf, sizeOf, lionTopOf } from '../../game/menu.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ S: expected('menu.screen-model'), main: expected('menu.main-observed'), A: expected('menu.animation-observed') });
const PAGE = 320 * 200; // @math the 320 x 200 page the CRC covers
const LAG = 10; // @math the displayed page can be one step behind the words (3 of 300 pauses here): at most this many

const stateOf = s => ({ lionTop: s.lionRow, lionFrame: s.lionFrame, pair: s.pair, size: s.size, frame: frameOf(s.phase, s.count) });
const frameCrc = (art, state) => { const fb = new Uint8Array(PAGE); renderMenu(fb, art, state); return crc(fb); };

// The cars' animation state one step before the recorded one: every (phase, count, pair) whose step is the recorded one.
function olderCars(s, V) {
  const out = [];
  for (let phase = 1; phase <= V.A.lengths.length + 1; phase++) for (let count = 0; count < V.A.lengths[1]; count++) for (let k = 0; k < V.A.pairs; k++) { // @math the three phases with a count and the single step after them
    const n = advanceAnimation({ phase, count, pair: k });
    if (n.phase === s.phase && n.count === s.count && n.pair === s.pair) out.push({ phase, count, pair: k });
  }
  return out;
}

// The port's page for the state words of each pause equals the game's whole displayed page (its CRC-32), or - when the page was one step behind the words -
// the page of the state one step earlier.
function replay(dat, r, V, { alter = s => s } = {}) {
  assertArchive(r, dat);
  const members = archiveMembers(dat), art = loadMenuArt(members), longest = Math.max(...menuItems().map(t => [...t].length));
  assert.equal(V.S.items.width, longest, 'the bars are as long as the longest item');
  assert.deepEqual(V.main.items, menuItems(), 'the items of menu.main-observed');
  let exact = 0, lagged = 0;
  r.samples.map(alter).forEach((s, i) => {
    if (s.busy === V.A.lion.settled) assert.equal(s.lionRow, lionTopOf(s.cursor), `pause ${i}: the settled icons are at the row of the cursor`);
    if (frameCrc(art, stateOf(s)) === s.frameCrc) { exact++; return; }
    const hit = olderCars(s, V).some(c => [s.lionFrame, s.lionFrame - 1].some(lf => lf >= 0 && frameCrc(art, { lionTop: s.lionRow, lionFrame: lf, pair: c.pair, size: sizeOf(c.phase, c.count), frame: frameOf(c.phase, c.count) }) === s.frameCrc));
    assert.ok(hit, `pause ${i}: the page equals neither the port's page for the words nor for the step before`);
    lagged++;
  });
  assert.ok(lagged <= LAG, `at most ${LAG} pauses caught the page a step behind (${lagged})`);
  return { exact, lagged };
}

export default {
  id: 'obs-menuframe',
  claims: ['menu.screen-model', 'menu.animation-observed'],
  obs: ['menuanim-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menuanim-2'), got = replay(dat, r, values());
    assert.equal(got.exact + got.lagged, r.samples.length, 'every pause');
    assert.ok(got.exact >= 0.95 * r.samples.length, `almost every page equals the port's (${got.exact} of ${r.samples.length})`); // @math 297 of 300 were exact
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('menuanim-2'), V = values();
    return [
      { label: 'the cars one frame further', fn: () => replay(dat, r, V, { alter: s => ({ ...s, count: s.count + 2 }) }) }, // @math two counts further move the frame by one
      { label: 'the other pair of car slots', fn: () => replay(dat, r, V, { alter: s => ({ ...s, pair: (s.pair + 2) % 8 }) }) }, // @math the next pair of the four
      { label: 'the icons one row lower', fn: () => replay(dat, r, V, { alter: s => ({ ...s, lionRow: s.lionRow + 1 }) }) },
      { label: 'the icons one frame on', fn: () => replay(dat, r, V, { alter: s => ({ ...s, lionFrame: (s.lionFrame + 1) % V.A.lion.frames }) }) },
      { label: 'a recorded page CRC altered', fn: () => replay(dat, r, V, { alter: s => ({ ...s, frameCrc: '00000000' }) }) },
      { label: 'one archive byte changed', fn: () => replay(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
