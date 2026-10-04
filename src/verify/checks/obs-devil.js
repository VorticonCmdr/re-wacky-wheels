import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('devil.draw-observed'), mov: expected('mov.use'), sp: expected('sp.draw') });
const TOOL = { driver: 0x84f4, flag: 0x8500, frame: 0x8504, step: 0x8508 }; // @math the words observe.mjs devil reads, in the order of its words column

const own = (g, k, [w, h]) => { const p = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = g[w * h * k + i * h + j]; if (v !== 0) p.push(v); } return [p.length, crc(Uint8Array.from(p))]; };

function validate(dat, r, V, { lag = V.d.lag, perDriver = V.d.perDriver } = {}) {
  const D = V.d, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), g = members.get(D.member), mov = members.get(D.mov);
  assertArchive(r, dat);
  assert.deepEqual([D.driverWord, D.flagWord, D.frameWord, D.stepWord], [TOOL.driver, TOOL.flag, TOOL.frame, TOOL.step], 'the words the tool read');
  assert.deepEqual(r.columns, ['tick', 'driver', 'flag', 'frame', 'step'], 'the columns of the words');
  assert.equal(g.length, D.frames * D.frame[0] * D.frame[1], 'GIGGLES.SP is 28 frames of 38 x 44');
  assert.equal(D.frames, 7 * perDriver, 'seven drivers of four frames'); // @math seven drivers
  assert.deepEqual([D.columnBase, D.rowBase], [V.mov.xBases[0], 0x78], 'the first routine of mov.use: the column base'); // @math the row base of the first routine
  assert.equal(D.frame[1], V.mov.heights[0], 'the height of the first routine of mov.use');
  assert.equal(D.frame[0], 0x26, 'the width 0x26 of the code'); // @math the sprite width the routine sets
  const O = Array.from({ length: D.frames }, (_, k) => own(g, k, D.frame)), at = e => ({ x: new DataView(mov.buffer, mov.byteOffset).getInt16(2 + 4 * e, true), y: new DataView(mov.buffer, mov.byteOffset).getInt16(4 + 4 * e, true) }); // @math the count word, then the x and y words of an entry
  const same = (a, k) => a && a[0] === O[k][0] && a[1] === O[k][1];
  let visible = 0, firstStep = Infinity, lastStep = 0;
  for (const s of r.samples) {
    const [, driver, , frame, step] = s.words, block = Math.max(driver - 1, 0);
    if (driver >= 1 && step >= 1) { // @math the figure is on from step 1
      visible++; firstStep = Math.min(firstStep, step); lastStep = Math.max(lastStep, step);
      const shown = [...Array(D.frames).keys()].filter(k => same(s.prev[k], k));
      assert.deepEqual(shown, [block * perDriver + ((frame - lag + perDriver) % perDriver)], `step ${step}: exactly one frame matches at the entry step - 1, the previous frame of the driver's block`);
      assert.ok([0, 1, 2, 3].every(i => !same(s.before[i], block * perDriver + i) && !same(s.now[i], block * perDriver + i)), `step ${step}: no frame at the neighbouring entries`); // @math the four frames of the block
      const here = at(step - lag), before = at(step - lag - 1), now = at(step - lag + 1);
      assert.ok(here.x !== before.x || here.y !== before.y, 'the neighbouring entries are other places'); assert.ok(here.x !== now.x || here.y !== now.y, 'both of them');
    } else assert.ok(s.prev.every((a, k) => !same(a, k)) || step === 0, 'nothing shown when the figure is off'); // @math step 0
  }
  assert.deepEqual([visible, firstStep, lastStep, driverOf(r)], [D.visibleSamples, D.firstStep, D.lastStep, D.driver], 'the pauses with the figure on');
  const end = r.samples.filter(s => s.words[1] === 0); assert.ok(end.length >= 1 && end.length <= 1 + r.samples.length - visible, 'the driver word returns to 0'); // @math one pause
}
const driverOf = r => r.samples.find(s => s.words[1] >= 1).words[1];

export default {
  id: 'obs-devil',
  claims: ['devil.draw-observed'],
  obs: ['devil-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('devil-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('devil-1'), V = values(), D = V.d;
    return [
      { label: 'no lag between words and picture', fn: () => validate(dat, r, V, { lag: 0 }) },
      { label: 'a lag of 2', fn: () => validate(dat, r, V, { lag: D.lag + 1 }) },
      { label: 'blocks of 3 frames', fn: () => validate(dat, r, V, { perDriver: D.perDriver - 1 }) },
      { label: 'a crc altered', fn: () => validate(dat, { ...r, samples: r.samples.map((s, i) => (i === 3 ? { ...s, prev: s.prev.map(a => (a && a[0] > 900 ? [a[0], '00000000'] : a)) } : s)) }, V) }, // @math the fourth pause
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
