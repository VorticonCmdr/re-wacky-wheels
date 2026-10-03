import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { lookupMember } from '../obs-helpers.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ tail: expected('dat.entry-tail'), datLayout: expected('dat.layout'), lookup: expected('dat.entry-lookup'), entrySize: expected('dat.entry-size') });

// The members the game demonstrably loaded: the other checks validated their data in memory (obs-race, obs-buffers).
function loaded(race, buffers) {
  const track = race.names.track, upper = n => n.toUpperCase();
  return [...race.names.tilesets, ...race.names.masks, race.names.sky, ...['GAM', 'M', 'POS', 'SIN', 'RD', 'SPW', 'PAR'].map(x => `${track}.${x}`), ...expected('dat.entry-tail').fixedMembers, ...buffers.regions.map(r => r.member)].map(upper);
}

// A name compare that does not stop at the entry name's first NUL: the whole name field must equal the request padded with NULs.
function wholeFieldFinds(dat, name, V) {
  const L = V.datLayout, E = V.lookup, Z = V.entrySize, dv = new DataView(dat.buffer, dat.byteOffset, dat.byteLength), count = dv.getInt16(L.countAt, true);
  for (let i = 0; i < count; i++) {
    const at = L.countAt + L.countBytes + i * L.entrySize, field = dat.subarray(at + E.nameAt, at + Z.sizeAt);
    const want = new Uint8Array(field.length); want.set(Buffer.from(name.toUpperCase(), 'latin1'));
    if (field.every((b, k) => b === want[k])) return true;
  }
  return false;
}

function validate(dat, race, buffers, V, { whole = false } = {}) {
  assertArchive(race, dat); assertArchive(buffers, dat);
  const L = V.datLayout, names = loaded(race, buffers), entries = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e]));
  let withTail = 0;
  for (const name of new Set(names)) {
    const entry = entries.get(name);
    assert.ok(entry, `${name} has a directory entry`);
    const field = dat.subarray(entry.entryAt + V.lookup.nameAt, entry.entryAt + V.entrySize.sizeAt), end = field.indexOf(0);
    if (field.subarray(end + 1).some(b => b !== 0)) withTail++;
    if (whole) assert.ok(wholeFieldFinds(dat, name, V), `${name} is found by comparing the whole name field`);
    else assert.ok(lookupMember(dat, name, V), `${name} is found by the NUL-terminated compare`);
  }
  assert.equal(new Set(names).size, V.tail.loaded, 'the number of distinct members the game demonstrably loaded');
  assert.equal(withTail, V.tail.tailed, 'how many of them have a non-zero name tail');
  assert.ok(L.entrySize > 0);
}

export default {
  id: 'obs-lookup',
  claims: ['dat.entry-tail'],
  obs: ['race-3', 'buffers-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('race-3'), ctx.obs('buffers-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), race = ctx.obs('race-3'), buffers = ctx.obs('buffers-1'), V = values();
    return [
      { label: 'compare of the whole name field instead of up to the NUL', fn: () => validate(dat, race, buffers, V, { whole: true }) },
      { label: 'all loaded members claimed to have a tail', fn: () => validate(dat, race, buffers, { ...V, tail: { ...V.tail, tailed: V.tail.loaded } }) },
      { label: 'one more loaded member claimed', fn: () => validate(dat, race, buffers, { ...V, tail: { ...V.tail, loaded: V.tail.loaded + 1 } }) },
    ];
  },
};
