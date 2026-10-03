import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { crc, assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ small: expected('small.read') });

// Cross-validate a `buffers` record: each live region holds its archive member whole, loaded from the name the game keeps.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), claimed = V.small.regions;
  assert.equal(record.regions.length, claimed.length, 'the record has the claimed regions');
  record.regions.forEach((live, i) => {
    const want = claimed[i], data = members.get(want.member);
    assert.ok(data, `${want.member} is an archive member`);
    assert.equal(live.member, want.member);
    assert.equal(live.offset, want.offset, `${want.member}: buffer offset`);
    assert.equal(live.nameOffset, want.nameOffset, `${want.member}: name offset`);
    assert.equal(live.liveName, want.member, `${want.member}: the game's name string`);
    assert.equal(live.bytes, data.length, `${want.member}: the buffer is as long as the member`);
    assert.equal(live.crc, crc(data), `${want.member}: the buffer holds the member whole`);
  });
  assert.equal(new Set(record.regions.map(r => r.crc)).size, record.regions.length, 'the four buffers differ, so each match tells its member apart');
}

export default {
  id: 'obs-buffers',
  claims: ['small.read'],
  obs: ['buffers-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('buffers-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('buffers-1'), V = values(), R = V.small.regions;
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { small: { regions: R.map((r, i) => ({ ...r, ...(patch[i] ?? {}) })) } }) });
    return [
      tweak('the two TAB members swapped', [{ member: R[1].member }, { member: R[0].member }]),
      tweak('VIEW and SLP swapped', [{}, {}, { member: R.at(-1).member }, { member: R.at(-2).member }]), // @math the last two regions
      tweak('VEL.TAB buffer 4 bytes on', [{ offset: R[0].offset + 4 }]), // @math one dword on
      tweak('SLP name offset 4 on', [{}, {}, {}, { nameOffset: R.at(-1).nameOffset + 4 }]), // @math one dword on
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
