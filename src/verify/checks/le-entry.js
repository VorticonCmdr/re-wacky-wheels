import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

function entryStub(le, object, offset) {
  const stub = expected('ww.exe.entry-stub'), text = stub.banner;
  const b = objectBytes(le, object, offset, stub.length + stub.operand);
  assert.equal(b[0], stub.opcode, 'entry opcode');
  assert.equal(b[1], stub.operand, 'jump distance');
  const banner = String.fromCharCode(...b.subarray(stub.length, stub.length + text.length));
  assert.equal(banner, text);
  assert.ok(text.length <= stub.operand, 'jump target lies beyond the banner');
}

export default {
  id: 'le-entry',
  claims: ['le.header', 'le.object-entry', 'ww.exe.layout', 'ww.exe.entry-stub'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const exe = await ctx.open('WW.EXE'), want = expected('ww.exe.layout'), { le } = locateLe(exe);
    assert.deepEqual(le.eip, want.eip);
    assert.deepEqual(le.esp, want.esp);
    assert.equal(le.esp.offset, le.objects[le.esp.object - 1].virtualSize, 'initial ESP at the end of its object');
    entryStub(le, le.eip.object, le.eip.offset);
  },
  // The same offset in the other object, and the neighbouring offsets, must not hold the stub.
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), { le } = locateLe(exe), { object, offset } = le.eip;
    return [
      { label: 'entry offset in the other object', fn: () => entryStub(le, le.objects.length + 1 - object, offset) },
      { label: 'entry - 1', fn: () => entryStub(le, object, offset - 1) },
      { label: 'entry + 1', fn: () => entryStub(le, object, offset + 1) },
    ];
  },
};
