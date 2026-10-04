import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const values = () => ({ t: expected('tick.rate') });

// The timer registrations, the library's division, the frame period and its limiter as instruction bytes built from the claim's values.
function code(exe, V, { period = V.t.period, rates = V.t.counters.map(c => c.hz) } = {}) {
  const T = V.t, { le } = locateLe(exe), read = (at, n) => [...objectBytes(le, 1, at, n)];
  T.counters.forEach((c, i) => {
    assert.deepEqual(read(c.rateAt, 5), [0xba, ...d(rates[i])], `the rate of the counter at obj2+0x${c.address.toString(16)}`); // @math mov edx, imm32
    assert.deepEqual(read(c.addressAt, 5), [0xb9, ...d(c.address)], 'and its address'); // @math mov ecx, imm32
  });
  assert.deepEqual(read(T.library.divideAt, 12), [0xb8, ...d(T.library.numerator), 0x89, 0xc2, 0xc1, 0xfa, 0x1f, 0xf7, 0xff], 'the library divides its constant by the rate'); // @math mov eax,imm32; mov edx,eax; sar edx,31; idiv edi (12 bytes)
  assert.deepEqual(read(T.defaultAt, 10), [0xc7, 0x05, ...d(T.periodWord), ...d(period)], 'the default frame period'); // @math mov dword [word], imm32
  assert.deepEqual(read(T.copyAt, 12), [0xa1, ...d(T.periodWord), 0xa3, ...d(T.activeWord), 0x5a, 0x5b], 'copied to the active period'); // @math mov eax,[period]; mov [active],eax; pop edx; pop ebx (12 bytes)
  assert.deepEqual(read(T.limiterAt, 28), [0x83, 0x3d, ...d(T.activeWord), 0x00, 0x74, 0x13, 0xa1, ...d(T.counters[0].address), 0x2b, 0x05, ...d(T.lastWord), 0x3b, 0x05, ...d(T.activeWord), 0x7c, 0xed], 'the frame limiter'); // @math cmp [active],0; jz +0x13; mov eax,[counter]; sub eax,[last]; cmp eax,[active]; jl back
  assert.deepEqual(read(T.incAt, 6), [0xff, 0x05, ...d(T.frameWord)], 'the frame counter is incremented right after'); // @math inc dword [frame counter]
}

// The counters against the clock in a running race.
function observed(dat, r, V, { tolerance = V.t.tolerance } = {}) {
  const T = V.t;
  assertArchive(r, dat);
  assert.deepEqual([r.words.period, r.words.active], [T.period, T.period], 'the words hold the default period');
  assert.ok(Math.abs(r.delta.hundred36 - r.delta.frames * T.period) <= T.frameSlack * T.period, `one frame per ${T.period} counts of the fast counter (${JSON.stringify(r.delta)})`); 
  const hz = r.delta.hundred36 * T.msPerSecond / r.elapsedMs;
  assert.ok(Math.abs(hz - T.counters[0].hz) <= T.counters[0].hz * tolerance, `the fast counter runs at ${T.counters[0].hz} Hz (measured ${hz.toFixed(1)})`);
  const frameHz = r.delta.frames * T.msPerSecond / r.elapsedMs;
  assert.ok(Math.abs(frameHz - T.counters[0].hz / T.period) <= T.counters[0].hz / T.period * tolerance, `and the frames at ${T.counters[0].hz}/${T.period} a second (measured ${frameHz.toFixed(2)})`); // @math two decimals in the message
}

export default {
  id: 'exe-tickrate',
  claims: ['tick.rate'],
  obs: ['rate-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const V = values(); code(await ctx.open('WW.EXE'), V); observed(await ctx.open('WACKY.DAT'), ctx.obs('rate-1'), V); },
  async discriminate(ctx) {
    const V = values(), exe = await ctx.open('WW.EXE'), dat = await ctx.open('WACKY.DAT'), r = ctx.obs('rate-1');
    return [
      { label: 'a period of 6', fn: () => code(exe, V, { period: V.t.period / 2 }) }, // @math the other value the command line can set
      { label: 'the fast counter at 100 Hz', fn: () => code(exe, V, { rates: [V.t.counters[0].hz - 36, ...V.t.counters.slice(1).map(c => c.hz)] }) }, // @math another rate
      { label: 'a measured interval of half the time', fn: () => observed(dat, { ...r, elapsedMs: r.elapsedMs / 2 }, V) }, // @math half the interval
      { label: 'frames lost', fn: () => observed(dat, { ...r, delta: { ...r.delta, frames: r.delta.frames - 30 } }, V) }, // @math thirty frames missing
    ];
  },
};
