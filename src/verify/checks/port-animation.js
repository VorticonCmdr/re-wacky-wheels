import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { objectFrame } from '../../game/objects.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['spw-1', 'spwstart-1', 'spwstart-2'];
const COUNTER = 4, FRAME = 5; // @math the record's words: sprite id, consumed, x, y, counter, frame
const values = () => ({ a: expected('object.animation') });

// The port's frame rule against every sample of every object record: the frame is the port's, or one step behind it (the pause between the counter and the animation).
function replay(dat, records, V, { offset } = {}) {
  const world = loadTrack(dat, '5'), counts = { exact: 0, behind: 0, samples: 0 };
  for (const r of records) {
    assertArchive(r, dat);
    for (const s of r.samples) s.records.forEach(rec => {
      const frames = world.sprites[rec[0]].frames, ahead = offset === undefined ? objectFrame(world, rec[0], s.tick) : (s.tick + offset) % frames, behind = (ahead - V.a.lag + frames) % frames;
      assert.equal(rec[COUNTER], V.a.counter, 'the counter word stays 0');
      assert.ok(rec[FRAME] === ahead || rec[FRAME] === behind, `tick ${s.tick}: object of sprite ${rec[0]} shows frame ${rec[FRAME]}, the rule gives ${ahead} (or ${behind})`);
      if (frames > 1 && rec[FRAME] === ahead) counts.exact++; else if (frames > 1) counts.behind++;
      counts.samples++;
    });
  }
  return counts;
}

export default {
  id: 'port-animation',
  claims: ['object.animation'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), counts = replay(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), V);
    assert.ok(counts.samples >= 2000 && counts.exact > 9 * counts.behind, `most samples agree exactly (${JSON.stringify(counts)})`); // @math 2016 samples, 84 of the 882 multi-frame ones a step behind
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), recs = IDS.map(id => ctx.obs(id));
    return [
      { label: 'a phase of 19', fn: () => replay(dat, recs, V, { offset: V.a.offset - 1 }) },
      { label: 'a phase of 0', fn: () => replay(dat, recs, V, { offset: 0 }) }, // @math no common phase
    ];
  },
};
