import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { locateLe, parseFixups, siteMasks } from '../../formats/le.js';
import { maskedCrc } from '../../evidence/crc32.js';
import { expected } from '../expect.js';
import { assertArchive } from '../obs-helpers.js';

// Cross-validate a `load` record against the in-process decode of the same executable.
function validate(record, exe, bases, stride) {
  const { le } = locateLe(exe), { sites, masks } = siteMasks(le, exe), page = le.pageSize, offset32 = expected('le.fixup-record').source.offset32, [first, second] = le.objects.map(o => o.number);
  assert.equal(record.exe.size, exe.length);
  assert.equal(record.exe.sha1, createHash('sha1').update(exe).digest('hex'), 'the observed executable is this one');
  // Every stored page's live masked CRC is recorded. The check decides which equal the file's (fixup sites masked out). The code object
  // is predicted to differ in exactly one page, the one holding the entry point, which the loader's start-up code rewrites at run time.
  const differing = le.objects.map((obj, oi) => {
    const crcs = record.pageCrc[obj.number], pages = Math.ceil(obj.data.length / page);
    assert.equal(crcs.length, pages, `obj${obj.number}: one live CRC per stored page`);
    return crcs.map((live, p) => [live, p]).filter(([live, p]) => live !== maskedCrc(obj.data.subarray(p * page, Math.min((p + 1) * page, obj.data.length)), masks[oi].subarray(p * page, Math.min((p + 1) * page, obj.data.length)))).map(([, p]) => p);
  });
  assert.deepEqual(differing[0], [Math.floor(le.eip.offset / page)], 'the code object differs in exactly the page holding the entry point');
  assert.ok(differing[1].length > 0 && differing[1].length < Math.ceil(le.objects[1].data.length / page), 'the data object is written in some pages and not others');
  // Relocation: the live dword at each sampled site is the target object's live base plus the target offset.
  const wanted = sites.filter(s => s.type === offset32 && s.object === first).filter((_, i) => i % stride === 0);
  assert.equal(record.relocSamples.length, wanted.length, 'samples are exactly every stride-th obj1 site');
  record.relocSamples.forEach(([object, offset, live], i) => {
    const s = wanted[i];
    assert.deepEqual([object, offset], [s.object, s.offset], `sample ${i} is the expected site`);
    assert.equal(live, bases[s.targetObject] + s.target, `obj${object}+${offset}: live ${live.toString(16)}`); // @math hex radix
  });
  assert.ok(bases[first] + le.objects[0].virtualSize <= bases[second], 'objects do not overlap');
  assert.equal(bases[first] % page, 0);
  assert.equal(bases[second] % page, 0);
}

export default {
  id: 'obs-load',
  claims: ['ww.exe.relocation'],
  obs: ['load-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const exe = await ctx.open('WW.EXE'), record = ctx.obs('load-2'), want = expected('ww.exe.relocation');
    assertArchive(record, await ctx.open('WACKY.DAT'));
    assert.deepEqual(record.bases, { 1: want.obj1Base, 2: want.obj2Base });
    validate(record, exe, record.bases, want.sampleStride);
  },
  // A shifted base, a different sampling stride and an un-relocated reading must all fail.
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), record = ctx.obs('load-2'), want = expected('ww.exe.relocation'), pageSize = expected('ww.exe.layout').pageSize;
    return [
      { label: 'obj2 base + 1', fn: () => validate(record, exe, { 1: want.obj1Base, 2: want.obj2Base + 1 }, want.sampleStride) },
      { label: 'obj1 base + one page', fn: () => validate(record, exe, { 1: want.obj1Base + pageSize, 2: want.obj2Base }, want.sampleStride) },
      { label: 'stride 32', fn: () => validate(record, exe, record.bases, want.sampleStride / 2) }, // @math half the stride
      { label: 'raw target offsets instead of relocated values', fn: () => validate(record, exe, { 1: 0, 2: 0 }, want.sampleStride) }, // @math a staging copy holds unrelocated targets
    ];
  },
};
