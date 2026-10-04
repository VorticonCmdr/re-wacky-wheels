import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { assertSetupExe, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const values = () => ({ s: expected('setup.score-reset') });

// The strings and the delete call in SETUP.EXE, read from its objects.
function code(exe, V, { dosDelete = V.s.dosDelete, files = V.s.files, nameAt = V.s.nameAt } = {}) {
  const S = V.s, { le } = locateLe(exe), text = (offset, n) => String.fromCharCode(...objectBytes(le, 2, offset, n)); // @math the data object holds the strings
  files.forEach((name, i) => assert.equal(text(nameAt[i], name.length), name, `the file name ${i}`));
  assert.equal(text(S.oopsAt, S.oops.length), S.oops, 'the first menu line');
  assert.equal(text(S.yesAt, S.yes.length), S.yes, 'the second menu line');
  assert.equal(text(S.titleAt, S.title.length), S.title, 'the title shown while deleting');
  assert.deepEqual([...objectBytes(le, 1, S.deleteCall, 5)], [0xe9, ...d(S.helper - (S.deleteCall + 5))], 'the call jumps to the DOS helper'); // @math jmp rel32 is 5 bytes: the opcode and a distance from the next instruction
  assert.deepEqual([...objectBytes(le, 1, S.helper, 8)], [0x52, 0x89, 0xc2, 0xb4, dosDelete, 0xcd, 0x21, 0xd1], 'the helper puts the file name in edx, calls INT 21h with AH = delete (0x41)'); // @math push edx; mov edx,eax; mov ah,function; int 21h; rcl eax,1
}

// What the run did to the files: exactly the named files that existed are gone, the others are untouched.
async function observed(ctx, r, V, { files = V.s.files } = {}) {
  assertSetupExe(r, await ctx.open('SETUP.EXE'));
  const before = new Map(r.before.map(f => [f.name, f])), after = new Map(r.after.map(f => [f.name, f]));
  const gone = [...before.keys()].filter(n => !after.has(n)).sort(), named = files.filter(n => before.has(n)).sort();
  assert.deepEqual(gone, named, 'the files that disappeared are the named ones that existed');
  assert.ok(files.length > named.length, 'some named file did not exist, and no file appeared'); // @math WACKY2.* are not in the installation
  for (const [n, f] of after) assert.deepEqual(f, before.get(n), `the file ${n} is unchanged`);
  assert.ok(after.size > 0 && [...after.keys()].every(n => !files.includes(n)), 'files that were not named are still there');
  for (const n of named) {
    const data = await ctx.open(n);
    assert.deepEqual([before.get(n).size, before.get(n).crc], [data.length, crc(data)], `${n} was the installed file`);
  }
}

export default {
  id: 'obs-setupreset',
  claims: ['setup.score-reset'],
  obs: ['setup-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const V = values(); code(await ctx.open('SETUP.EXE'), V); await observed(ctx, ctx.obs('setup-1'), V); },
  async discriminate(ctx) {
    const V = values(), S = V.s, exe = await ctx.open('SETUP.EXE'), r = ctx.obs('setup-1');
    return [
      { label: 'another DOS function', fn: () => code(exe, V, { dosDelete: S.dosDelete + 1 }) },
      { label: 'the names in another order', fn: () => code(exe, V, { files: [...S.files].reverse() }) },
      { label: 'another name table', fn: () => code(exe, V, { nameAt: S.nameAt.map(a => a + 1) }) }, // @math the next byte
      { label: 'a further file claimed deleted', fn: () => observed(ctx, r, V, { files: [...S.files, 'WACKY0.HI'] }) },
      { label: 'a file missing from the names', fn: () => observed(ctx, r, V, { files: S.files.slice(1) }) },
      { label: 'a file changed', fn: () => observed(ctx, { ...r, after: r.after.map((f, i) => (i === 0 ? { ...f, crc: '00000000' } : f)) }, V) }, // @math the first file kept
    ];
  },
};
