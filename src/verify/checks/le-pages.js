import assert from 'node:assert/strict';
import { view } from '../../binary.js';
import { locateLe } from '../../formats/le.js';
import { expected } from '../expect.js';

export default {
  id: 'le-pages',
  claims: ['le.header', 'le.object-entry', 'le.page-map-entry', 'ww.exe.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const exe = await ctx.open('WW.EXE'), want = expected('ww.exe.layout'), { le } = locateLe(exe);
    assert.equal(le.pages, want.pages);
    assert.equal(le.pageSize, want.pageSize);
    assert.equal(le.lastPageSize, want.lastPageSize);
    assert.equal(le.dataPages + (le.pages - 1) * le.pageSize + le.lastPageSize, exe.length, 'data pages must end at EOF');
    // The page map is the identity 1..pages with no flags, and objects tile it in order without gaps.
    le.pageMap.forEach((p, i) => { assert.equal(p.number, i + 1, `page map entry ${i}`); assert.equal(p.flags, 0); });
    let next = 1;
    for (const obj of le.objects) { assert.equal(obj.pageIndex, next); next += obj.pageCount; }
    assert.equal(next - 1, le.pages);
    assert.deepEqual(le.objects.map(({ base, virtualSize, flags, pageIndex, pageCount }) => ({ base, virtualSize, flags, pageIndex, pageCount })), want.objects);
  },
  // Reading the page number as a little-endian uint32 (the LX layout) must not give the identity map.
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), { le } = locateLe(exe), dv = view(exe), map = le.header + dv.getUint32(le.header + expected('le.header').pageMap, true);
    const size = expected('le.page-map-entry').size;
    return [{
      label: 'page map as uint32 LE',
      fn: () => { for (let i = 0; i < le.pages; i++) assert.equal(dv.getUint32(map + i * size, true), i + 1); },
    }];
  },
};
