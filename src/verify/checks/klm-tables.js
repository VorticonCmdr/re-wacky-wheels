import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ t: expected('klm.opl-tables'), player: expected('klm.player') });

// The AdLib driver's tables in WW.EXE's data object, read as dwords.
function tables(exe, T, P) {
  const data = locateLe(exe).le.objects[1].data, dv = view(data), dword = at => dv.getUint32(at, true);
  const slots = Array.from({ length: P.channels }, (_, ch) => [dword(T.slotMapAt + ch * T.slotMapStride), dword(T.slotMapAt + ch * T.slotMapStride + 4)]); // @math the second dword of the pair
  return {
    slots,
    opOffsets: Array.from({ length: T.opOffsets.length }, (_, i) => dword(T.opOffsetsAt + i * 4)), // @math dwords
    rhythmBits: Array.from({ length: T.rhythmBits.length }, (_, i) => dword(T.rhythmBitsAt + (T.rhythmFirstChannel + i) * 4)), // @math dwords
    masterVolume: dword(T.masterVolumeAt),
  };
}

function validate(exe, V) {
  const T = V.t, got = tables(exe, T, V.player);
  // Single-operator percussion channels only use the first word of their pair.
  const used = got.slots.map(([mod, car], ch) => (ch < V.player.twoOperatorChannels ? [mod, car] : [mod, 0]));
  assert.deepEqual(used, T.slots, 'the operator slots of the channels');
  assert.deepEqual(got.opOffsets, T.opOffsets, 'the register offsets of the slots');
  assert.deepEqual(got.rhythmBits, T.rhythmBits, 'the rhythm key bits');
  assert.equal(got.masterVolume, T.masterVolume, 'the master volume');
  // Every slot a channel names indexes the offset table.
  for (const [mod] of T.slots) assert.ok(mod < T.opOffsets.length, 'slot index');
}

export default {
  id: 'klm-tables',
  claims: ['klm.opl-tables'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), values()); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), V = values(), t = patch => () => validate(exe, { ...V, t: { ...V.t, ...patch } });
    return [
      { label: 'slot map one dword on', fn: t({ slotMapAt: V.t.slotMapAt + 4 }) }, // @math one dword
      { label: 'slot map stride 12', fn: t({ slotMapStride: V.t.slotMapStride + 4 }) }, // @math one dword
      { label: 'channels 0 and 1 swapped', fn: t({ slots: [V.t.slots[1], V.t.slots[0], ...V.t.slots.slice(2)] }) }, // @math the first two channels
      { label: 'an operator offset changed', fn: t({ opOffsets: V.t.opOffsets.map((o, i) => (i === V.t.rhythmFirstChannel ? o + 1 : o)) }) },
      { label: 'rhythm bits reversed', fn: t({ rhythmBits: [...V.t.rhythmBits].reverse() }) },
      { label: 'rhythm from channel 5', fn: t({ rhythmFirstChannel: V.t.rhythmFirstChannel - 1 }) },
      { label: 'master volume 0x7f', fn: t({ masterVolume: V.t.masterVolume >> 1 }) }, // @math half
    ];
  },
};
