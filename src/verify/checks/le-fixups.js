import assert from 'node:assert/strict';
import { view } from '../../binary.js';
import { locateLe, parseFixups, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

export default {
  id: 'le-fixups',
  claims: ['le.header', 'le.fixup-record', 'ww.exe.fixups', 'ww.exe.fixup-sites'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const exe = await ctx.open('WW.EXE'), { le } = locateLe(exe), fixups = parseFixups(exe, le);
    const want = expected('ww.exe.fixups'), f = expected('le.fixup-record'), count = (type, flags) => fixups.filter(x => x.type === type && (flags === undefined || x.flags === flags)).length;
    assert.equal(fixups.length, want.total);
    assert.equal(count(f.source.offset32, f.flags.target32), want.offset32Target32);
    assert.equal(count(f.source.offset32, f.flags.target16), want.offset32Target16);
    assert.equal(count(f.source.selector16), want.selector16);
    // Each page's records end exactly at the next page's table entry (parseFixups throws otherwise),
    // and every record targets an existing object inside its virtual size.
    for (const f of fixups) {
      const target = le.objects[f.object - 1];
      assert.ok(target, `fixup on page ${f.page} targets missing object ${f.object}`);
      assert.ok(f.target < target.virtualSize, `fixup on page ${f.page} targets beyond obj${f.object}`);
      assert.ok(f.source < le.pageSize, `fixup on page ${f.page} has source ${f.source}`);
    }
    // The pre-fixup bytes at each 32-bit site hold the target offset, which pins every source
    // offset (and the record layout that produced it) to an exact byte position.
    assert.equal(fixups.filter(x => x.source < 0).length, expected('ww.exe.fixup-sites').negativeSources);
    for (const x of fixups.filter(x => x.type === f.source.offset32)) {
      const obj = le.objects.find(o => x.page >= o.pageIndex && x.page < o.pageIndex + o.pageCount);
      const site = (x.page - obj.pageIndex) * le.pageSize + x.source;
      assert.equal(view(objectBytes(le, obj.number, site, f.target32)).getUint32(0, true), x.target, `site obj${obj.number}+${site}`);
    }
  },
  // The record table read one byte late must not parse cleanly.
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), { le } = locateLe(exe);
    return [{ label: 'record table + 1', fn: () => {
      const fixups = parseFixups(exe, { ...le, fixupRecordTable: le.fixupRecordTable + 1 });
      for (const f of fixups) assert.ok(le.objects[f.object - 1] && f.target < le.objects[f.object - 1].virtualSize);
    } }];
  },
};
