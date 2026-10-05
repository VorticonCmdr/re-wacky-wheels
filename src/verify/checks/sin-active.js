import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { decodePcxMember, splitTiles } from '../../formats/pcx.js';
import { expected } from '../expect.js';

const values = () => ({ S: expected('sin.active-flags'), L: expected('sin.layout') });

// For every track, the two words at the start of each 12-byte .SIN record against the mask tile of the same number: the word k is 1 where the tile holds a pixel of the value k.
function scan(dat, V, { swap = false, bytes = [0, 2] } = {}) { // @math the two words at +0 and +2
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), exceptions = new Map();
  let tiles = 0, agree = 0, tracks = 0;
  for (const [name, data] of members) {
    const m = /^(\d+)\.GAM$/.exec(name); if (!m) continue; tracks++;
    const gam = parseGam(data), sin = members.get(`${m[1]}.SIN`), all = gam.masks.flatMap(n => splitTiles(decodePcxMember(members.get(`A_${n.toUpperCase()}`))));
    for (let id = 0; id < V.L.records; id++) {
      const word = at => sin[id * V.L.recordBytes + at] | (sin[id * V.L.recordBytes + at + 1] << 8), t = all[id], present = [0, 1].map(v => t.some(p => p === v)); // @math the mask values 0 and 1
      const flags = bytes.map(word).map(w => w === 1), want = swap ? [present[1], present[0]] : present; // @math the word is 1 when set
      tiles++;
      if (flags[0] === want[0] && flags[1] === want[1]) agree++; else { const k = Number(m[1]); if (!exceptions.has(k)) exceptions.set(k, []); exceptions.get(k).push(id); }
    }
  }
  return { tracks, tiles, agree, exceptions };
}

function validate(dat, V, options) {
  const got = scan(dat, V, options), S = V.S;
  assert.equal(got.tracks, S.tracks, 'the tracks'); assert.equal(got.tiles, S.tiles, 'the tiles'); assert.equal(got.agree, S.agree, 'the tiles that agree');
  assert.deepEqual([...got.exceptions.keys()], S.exceptionTracks, 'the tracks with exceptions');
  for (const t of S.exceptionTracks) assert.deepEqual(got.exceptions.get(t), S.exceptionTiles, `the exceptions of track ${t}`);
}

export default {
  id: 'sin-active',
  claims: ['sin.active-flags'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    return [
      { label: 'the two flags swapped', fn: () => validate(dat, V, { swap: true }) },
      { label: 'the words at +4 and +6', fn: () => validate(dat, V, { bytes: [4, 6] }) }, // @math the first word of the second dword and the next
    ];
  },
};
