import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { replaceMember, editLines } from '../patch.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { createHash } from 'node:crypto';
import { expected } from '../expect.js';

const values = () => ({ space: expected('gam.trailing-space'), notfound: expected('dat.notfound-behavior'), pcx: expected('pcx.layout') });

// Experiment: line 5 of 2.GAM was edited to "back2.pcx " (a trailing space). Rebuild the test archive from the user's own and compare, then
// check what the game kept of the line and what it loaded as the sky picture.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const S = V.space, N = V.notfound, members = parseDatDirectory(dat), by = new Map(members.map(e => [e.name, e]));
  const edited = replaceMember(dat, record.member, editLines(by.get(record.member).data, record.edits));
  assert.equal(edited.length, record.modified.size, 'the rebuilt test archive has the recorded size');
  assert.equal(createHash('sha1').update(edited).digest('hex'), record.modified.sha1, 'the rebuilt test archive is the one the game ran from');
  assert.deepEqual(record.edits, [[S.skyLine, S.skyText]], 'the experiment edited the sky-name line and nothing else');
  // What the game kept of the line: the text with its trailing space, then a NUL.
  const want = [...Buffer.from(S.skyText, 'latin1').map(b => (b >= 0x61 && b <= 0x7a ? b - S.caseDelta : b)), S.terminator]; // @math the lookup upper-cases a-z in place (dat.entry-compare)
  assert.deepEqual(record.slotBytes.slice(0, want.length), want, 'the stored line keeps its trailing space and ends in a NUL');
  assert.equal(want.at(-2), 0x20, 'the line really ends in a space'); // @math ASCII space
  // What the game loaded as the sky picture: not the member, but the bytes that follow the previously read member.
  const sky = by.get(record.skyMember), stream = sky.data.subarray(V.pcx.header, V.pcx.header + record.skyBytes);
  assert.equal(record.skyBytes, sky.size - V.pcx.header - V.pcx.palette, 'the length the loader reads for this member');
  assert.notEqual(record.skyBufferCrc, crc(stream), 'the sky buffer is not BACK2.PCX\'s stream');
  const previous = by.get(N.previousMember), expectedAt = previous.offset + previous.size + V.pcx.header;
  assert.deepEqual(record.matchedOffsets, [expectedAt], 'the sky buffer equals the archive bytes that follow the previous member by one PCX header');
  assert.equal(record.skyBufferCrc, crc(edited.subarray(expectedAt, expectedAt + record.skyBytes)), 'and those bytes are what was loaded');
}

export default {
  id: 'obs-gamslot',
  claims: ['gam.trailing-space', 'dat.notfound-behavior'],
  obs: ['gamslot-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('gamslot-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('gamslot-1'), V = values();
    const s = patch => () => validate(dat, record, { ...V, space: { ...V.space, ...patch } }), n = patch => () => validate(dat, record, { ...V, notfound: { ...V.notfound, ...patch } }), p = patch => () => validate(dat, record, { ...V, pcx: { ...V.pcx, ...patch } });
    return [
      { label: 'sky line is line 4', fn: s({ skyLine: V.space.skyLine - 1 }) },
      { label: 'sky text without the space', fn: s({ skyText: V.space.skyText.trimEnd() }) },
      { label: 'slot not NUL-terminated', fn: s({ terminator: V.space.terminator + 1 }) },
      { label: 'case delta 0x10', fn: s({ caseDelta: V.space.caseDelta / 2 }) }, // @math half the delta
      { label: 'previous read was 2.POS', fn: n({ previousMember: '2.POS' }) },
      { label: 'previous read was 2.SPW', fn: n({ previousMember: '2.SPW' }) },
      { label: 'PCX header of 0x7f bytes', fn: p({ header: V.pcx.header - 1 }) },
      { label: 'PCX header of 0x81 bytes', fn: p({ header: V.pcx.header + 1 }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
