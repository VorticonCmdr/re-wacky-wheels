import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { replaceMember, editLines } from '../patch.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const RECORDS = ['gamtext-1', 'gamtext-2', 'gamtext-3', 'gamtext-4'];
const values = () => ({ atoi: expected('gam.atoi'), reader: expected('gam.line-reader'), layout: expected('gam.layout'), read: expected('gam.read') });

// The claimed line reader: bytes up to the terminator, then the terminator and `consumed` further bytes are skipped.
function lines(bytes, count, R) {
  const out = [];
  let p = 0;
  while (out.length < count) {
    let text = '';
    while (p < bytes.length && bytes[p] !== R.terminator) text += String.fromCharCode(bytes[p++]);
    assert.ok(p < bytes.length, 'the simulated reader ran off the end of the member');
    p += 1 + R.consumed; // @math the terminator itself plus the consumed bytes
    out.push(text);
  }
  return out;
}

// The claimed converter, using the game's own ctype flags (as recorded) for the characters that matter.
function atoi(text, flagOf, A) {
  const code = i => text.charCodeAt(i);
  let i = 0, value = 0;
  while (i < text.length && flagOf(code(i)) & A.ctypeSpace) i++;
  const sign = code(i);
  if (sign === A.plus || sign === A.minus) i++;
  while (i < text.length && flagOf(code(i)) & A.ctypeDigit) value = value * 10 + (code(i++) - 0x30); // @math decimal digit accumulation, ASCII zero
  return sign === A.minus ? -value : value;
}

function validate(dat, record, V, ctx) {
  assertArchive(record, dat);
  const { atoi: A, reader: R, layout: L, read: G } = V, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  // The test input: rebuilt from the user's own archive, it must be the archive the game ran from.
  const edited = editLines(members.get(record.member), record.edits), rebuilt = replaceMember(dat, record.member, edited);
  assert.equal(rebuilt.length, record.modified.size, 'the rebuilt test archive has the recorded size');
  assert.equal(createHash('sha1').update(rebuilt).digest('hex'), record.modified.sha1, 'the rebuilt test archive is the one the game ran from');
  // The game's character classes, as read from its table.
  const table = ctx.obs('ctype-1'), flags = new Map(table.pairs), flagOf = c => { if (!flags.has(c)) throw new Error(`no recorded class for character ${c}`); return flags.get(c); };
  assert.equal(table.tableOffset, A.ctypeTable, 'the class table the game uses');
  assert.equal(table.indexBias, A.ctypeIndexBias, 'indexed by the character plus this');
  assert.equal(flags.size, 256, 'one class byte per character'); // @math all byte values
  record.ctype.forEach(([c, f]) => assert.equal(f, flags.get(c), `character ${c}: the class read with the run matches the table`));
  for (const [c, f] of flags) {
    assert.equal(Boolean(f & A.ctypeSpace), (c >= 9 && c <= 13) || c === 32, `character ${c}: white-space class`); // @math ASCII control white space and the space
    assert.equal(Boolean(f & A.ctypeDigit), c >= 0x30 && c <= 0x39, `character ${c}: digit class`); // @math ASCII digits
  }
  // What the game stored, from the edited text.
  const head = L.tilesets + L.masks + L.sky, pairAt = head + L.values + L.skipped, flagAt = pairAt + L.startPairs * 2; // @math each pair is two lines
  const read = lines(edited, flagAt + 1 + L.extraLines, R), modulus = 2 ** A.wordBits, word = v => ((v % modulus) + modulus) % modulus, bits = word; // @math store into a word of wordBits bits
  assert.notEqual(atoi(read[flagAt], flagOf, A), 0, 'the flag line is non-zero, so the extra lines are read');
  assert.equal(record.startWords.x, word(atoi(read[pairAt], flagOf, A) + G.startBias), 'first x word');
  assert.equal(record.startWords.y, word(atoi(read[pairAt + 1], flagOf, A) + G.startBias), 'first y word');
  record.extraWords.values.forEach((live, k) => assert.equal(live, bits(atoi(read[flagAt + 1 + k], flagOf, A)), `extra word ${k}`));
  assert.ok(record.edits.length > 0);
}

export default {
  id: 'obs-gamtext',
  claims: ['gam.atoi', 'gam.line-reader'],
  obs: [...RECORDS, 'ctype-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { const dat = await ctx.open('WACKY.DAT'), V = values(); for (const id of RECORDS) validate(dat, ctx.obs(id), V, ctx); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), all = (patch, key) => () => { for (const id of RECORDS) validate(dat, ctx.obs(id), { ...V, [key]: { ...V[key], ...patch } }, ctx); };
    return [
      { label: 'plus and minus swapped', fn: all({ plus: V.atoi.minus, minus: V.atoi.plus }, 'atoi') },
      { label: 'no sign accepted', fn: all({ plus: 0, minus: 0 }, 'atoi') },
      { label: 'white-space class 0x04', fn: all({ ctypeSpace: V.atoi.ctypeSpace << 1 }, 'atoi') }, // @math the neighbouring class bit
      { label: 'digit class 0x10', fn: all({ ctypeDigit: V.atoi.ctypeDigit >> 1 }, 'atoi') }, // @math the neighbouring class bit
      { label: 'line ends at LF (0x0a)', fn: all({ terminator: 0x0a }, 'reader') }, // @math the other end-of-line byte
      { label: 'no byte consumed after the terminator', fn: all({ consumed: 0 }, 'reader') },
      { label: 'two bytes consumed after the terminator', fn: all({ consumed: V.reader.consumed + 1 }, 'reader') },
      { label: 'stored in a 15-bit word', fn: all({ wordBits: V.atoi.wordBits - 1 }, 'atoi') },
      { label: 'stored in a 17-bit word', fn: all({ wordBits: V.atoi.wordBits + 1 }, 'atoi') },
      { label: 'start bias 0x3df', fn: all({ startBias: V.read.startBias - 1 }, 'read') },
    ];
  },
};
