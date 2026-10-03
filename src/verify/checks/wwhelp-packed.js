import assert from 'node:assert/strict';
import { expected } from '../expect.js';

const values = () => ({ w: expected('wwhelp.packed'), mz: expected('wwhelp.exe.mz') });

const latin1 = bytes => String.fromCharCode(...bytes);

// WWHELP.EXE: an executable image (as the MZ header sizes it) followed by appended data; the four bytes where the header's
// relocation table would be (it has none) are a packer signature, and the appended data holds a plain title block.
function validate(exe, V) {
  const W = V.w, F = V.mz.fields, image = (F.pages - 1) * W.pageBytes + F.lastPage; // @math the last page is partial
  assert.equal(exe.length, V.mz.size, 'the file size of wwhelp.exe.mz');
  assert.equal(F.relocations, 0, 'no relocations');
  assert.equal(latin1(exe.subarray(F.relocTable, F.relocTable + W.signature.length)), W.signature, 'the signature in the relocation table position');
  assert.equal(image, W.imageBytes, 'the image the header sizes');
  assert.equal(exe.length - image, W.appendedBytes, 'the data appended after the image');
  assert.equal(latin1(exe.subarray(W.titleAt, W.titleAt + W.title.length)), W.title, 'the title block');
  assert.ok(W.titleAt >= image, 'the title block lies in the appended data');
  assert.equal(Buffer.from(exe).indexOf(W.title), W.titleAt, 'and occurs once');
}

export default {
  id: 'wwhelp-packed',
  claims: ['wwhelp.packed'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WWHELP.EXE'), values()); },
  async discriminate(ctx) {
    const exe = await ctx.open('WWHELP.EXE'), V = values(), w = patch => () => validate(exe, { ...V, w: { ...V.w, ...patch } });
    return [
      { label: 'signature LZ09', fn: w({ signature: 'LZ09' }) },
      { label: 'title one byte on', fn: w({ titleAt: V.w.titleAt + 1 }) },
      { label: 'image of 512 bytes more', fn: w({ imageBytes: V.w.imageBytes + V.w.pageBytes }) },
      { label: 'one appended byte more', fn: w({ appendedBytes: V.w.appendedBytes + 1 }) },
      { label: 'pages of 256 bytes', fn: w({ pageBytes: V.w.pageBytes / 2 }) }, // @math half a page
      { label: 'another title', fn: w({ title: V.w.title.replace('v1.1', 'v1.2') }) },
    ];
  },
};
